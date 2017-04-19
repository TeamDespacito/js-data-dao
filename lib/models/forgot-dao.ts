import { IForgot, IBaseUser } from '../interfaces'
import { ServiceLib } from '../services/service-lib'
import { SendMail } from '../services/sendmail'
import { DAO } from './dao'
import * as JSData from 'js-data'
import * as url from 'url'
import * as _ from 'lodash'
import { AppConfig } from '../config/app-config'
import * as nodemailer from 'nodemailer'
import * as moment from 'moment'
import {APIError} from '../services/api-error'
export class ForgotDAO {
  storedb: JSData.DataStore
  private sendMail: SendMail
  private serviceLib: ServiceLib

  private userDAO: DAO<IBaseUser>
  private appConfig: AppConfig
  constructor (appConfig: AppConfig,userDao: DAO<IBaseUser>, transporter?: nodemailer.Transporter ) {
    this.appConfig = appConfig
    this.sendMail = new SendMail( appConfig.mailConfig, transporter )
    this.serviceLib = new ServiceLib( appConfig )
    this.userDAO = userDao
  }

  /**
   * Envia um email para o usuário
   *
   * @param {IForgot} obj
   * @returns {JSData.JSDataPromise<IBaseUser>}
   *
   * @memberOf ForgotDAO
   */
  public sendForgotMail ( obj: IForgot , appUrl: string): any {

    if ( !ServiceLib.emailValidator( obj.email ) ) {
      throw new APIError('Email inválido' , 400)
    } else {
      let filterEmail: any = { where: { email: { '===': obj.email } } }
      return this.userDAO.findAll(filterEmail, null)
        .then(( users: IBaseUser[] ) => {
          if ( _.isEmpty( users ) ) {
            throw new APIError('Usuário não encontrado', 404)
          }
          let user: IBaseUser = _.head( users )
          let token: string = this.serviceLib.generateToken( obj.email )
          return this.sendMail.sendForgotEmail( user.name, obj.email, url.resolve( appUrl, token ) )
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
    let tokenDecrypted: string = this.serviceLib.decrypt( params.token )
    let data: any = JSON.parse( tokenDecrypted )
    let today: Date = new Date()
    let filterUser: any = {
      where: {
        email: {
          '===': data.email
        }
      }
    }
    return this.userDAO.findAll( filterUser, null )
      .then(( users: Array<IBaseUser> ) => {
        let user: IBaseUser = _.head( users )
        if ( _.isEmpty( user ) ) {
          throw new Error('Token inválido')
        } else if ( moment( data.expiration ) < moment( today ) ) {
          throw new Error('O token expirou')
        } else if ( !user.active ) {
          throw new Error('A conta foi desativada')
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
    let data: any = JSON.parse( this.serviceLib.decrypt( params.token ) )
    let today: Date = new Date()
    let filterUser: any = {
      where: {
        email: {
          '===': data.email
        }
      }
    }
    return this.userDAO.findAll( filterUser, null )
      .then(( users: Array<IBaseUser> ) => {
        let user: IBaseUser = _.head( users )
        if ( _.isEmpty( user ) ) {
          throw new Error('Token inválido')
        } else if ( moment( data.expiration ) < moment( today ) ) {
          throw new Error('O token expirou')
        } else if ( !user.active ) {
          throw new Error('A conta foi desativada')
        } else if ( !obj.password ) {
          throw new Error('A nova senha não foi definida')
        } else if ( obj.password.length < 6 ) {
          throw new Error('A nova senha deve conter no mínimo 6 caracteres')
        }
        user.password = ServiceLib.hashPassword( obj.password )
        return this.userDAO.update(user.id, null, user)
      } )
      .then(() => true )
  }
}
