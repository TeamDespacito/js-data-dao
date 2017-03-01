import { IForgot, IBaseUser } from '../interfaces'
import { ServiceLib } from '../services/service-lib'
import { SendMail } from '../services/sendmail'
import * as Bluebird from 'bluebird'
import * as JSData from 'js-data'
import * as _ from 'lodash'
import { AppConfig } from '../config/app-config'
import * as nodemailer from 'nodemailer'
import * as moment from 'moment'
import {APIError} from '../services/api-error'
export class ForgotDAO {
  storedb: JSData.DataStore
  private _sendMail: SendMail
  private _serviceLib: ServiceLib
  private _appConfig: AppConfig
  constructor ( store: JSData.DataStore, appConfig: AppConfig, transporter?: nodemailer.Transporter ) {
    this.storedb = store
    this._appConfig = appConfig
    this._sendMail = new SendMail( appConfig.mailConfig, transporter )
    this._serviceLib = new ServiceLib( appConfig )
  }

  /**
   * Envia um email para o usuário
   *
   * @param {IForgot} obj
   * @returns {JSData.JSDataPromise<IBaseUser>}
   *
   * @memberOf ForgotDAO
   */
  public sendForgotMail ( obj: IForgot , url: string): any {

    if ( !ServiceLib.emailValidator( obj.email ) ) {
      throw new APIError('Email inválido' , 400)
    } else {
      let filterEmail: any = { where: { email: { '===': obj.email } } }
      return this.storedb.findAll( this._appConfig.getUsersTable(), filterEmail )
        .then(( users: IBaseUser[] ) => {
          if ( _.isEmpty( users ) ) {
            throw 'Usuário não encontrado'
          }
          let user: IBaseUser = _.head( users )
          let token: string = this._serviceLib.generateToken( obj.email )
          return this._sendMail.sendForgotEmail( user.name, obj.email, `${url}/auth/forgot/${token}` )
        } )

    }
  }

  /**
   * Valida o token e retorna o user com email do token
   *
   * @param {*} params
   * @returns {JSData.JSDataPromise<IBaseUser>}
   *
   * @memberOf ForgotDAO
   */
  public validaToken ( params: any ): Promise<IBaseUser> {
    let tokenDecrypted: string = this._serviceLib.decrypt( params.token )
    let data: any = JSON.parse( tokenDecrypted )
    let today: Date = new Date()
    let filterUser: any = {
      where: {
        email: {
          '===': data.email
        }
      }
    }
    return this.storedb.findAll( this._appConfig.getUsersTable(), filterUser )
      .then(( users: Array<IBaseUser> ) => {
        let user: IBaseUser = _.head( users )
        if ( _.isEmpty( user ) ) {
          throw 'Token inválido'
        } else if ( moment( data.expiration ) < moment( today ) ) {
          throw 'O token expirou'
        } else if ( !user.active ) {
          throw 'A conta foi desativada'
        }
        delete user.password
        return user
      } )
  }

  /**
   * Verifica o token e reseta a senha do usuário
   *
   * @param {*} params
   * @param {*} obj
   * @returns {JSData.JSDataPromise<IBaseUser>}
   *
   * @memberOf ForgotDAO
   */
  public resetPassword ( params: any, obj: IBaseUser ): Promise<boolean> {
    let data: any = JSON.parse( this._serviceLib.decrypt( params.token ) )
    let today: Date = new Date()
    let filterUser: any = {
      where: {
        email: {
          '===': data.email
        }
      }
    }
    return this.storedb.findAll( this._appConfig.getUsersTable(), filterUser )
      .then(( users: Array<IBaseUser> ) => {
        let user: IBaseUser = _.head( users )
        if ( _.isEmpty( user ) ) {
          throw 'Token inválido'
        } else if ( moment( data.expiration ) < moment( today ) ) {
          throw 'O token expirou'
        } else if ( !user.active ) {
          throw 'A conta foi desativada'
        } else if ( !obj.password ) {
          throw 'A nova senha não foi definida'
        } else if ( obj.password.length < 6 ) {
          throw 'A nova senha deve conter no mínimo 6 caracteres'
        }
        return Bluebird.all( [
          user,
          ServiceLib.hashPassword( obj.password )
        ] )
      } )
      .then(( resp: any ) => {
        let user: IBaseUser = resp[ 0 ]
        let passwordEncrypted: string = resp[ 1 ]
        user.password = passwordEncrypted
        return this.storedb.update( this._appConfig.getUsersTable(), user.id, user )
      } )
      .then(() => true )
  }
}
