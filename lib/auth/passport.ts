import { IBaseUser } from '../interfaces'
import { Request, Response } from 'express'
import { APIError, ServiceLib } from '../services'
import { AppConfig } from '../config/app-config'
import * as Bluebird from 'bluebird'
// import { Passport } from 'passport'
import * as jwt from 'jsonwebtoken'
import * as JSData from 'js-data'
import * as _ from 'lodash'
const ExtractJwt = require('passport-jwt').ExtractJwt
const Strategy = require('passport-jwt').Strategy

export const passportJwt = (store: JSData.DataStore, passport: any, appConfig: AppConfig): any => {
  let params = {
    secretOrKey: appConfig.getJwtConfig().secret,
    jwtFromRequest: ExtractJwt.fromAuthHeader()
  }

  passport.use(new Strategy(params, (token: any, done: Function) => {
    // Login buscando os dados do usuário junto do client.
    // Isso facilitará na hora de filtrar por clients e equipments do usuário logado
    let options: any = { with: ['clients'] }
    // TOdo Erro ao relacionar user com client
    store.find(appConfig.getUsersTable(), token.id, options)
      .then((user: IBaseUser) => {
        if (user) {
          if (!user.active) {
            return done(new APIError('Cliente ou usuário desabilitado', 401), null)
          } else {
            let u = user
            u.isAdmin = u.companyAlias === appConfig.getMainCompany()
            return done(null, u)
          }
        } else {
          return done(new APIError('Unauthorized', 401), null)
        }
      })
  }))
  return passport
}

export const jwtGenerator = (store: JSData.DataStore, appConfig: AppConfig) => (req: Request, res: Response, nex: Function): Promise<Response> => {
  let { email, password } = req.body
  if (email && password) {
    let options: any = {
      email: {
        '===': email
      }
    }
    return store.findAll(appConfig.getUsersTable(), options)
      .then((users: Array<IBaseUser>) => {
        let user: IBaseUser = _.head(users)
        if (_.isEmpty(user)) {
          throw 'O usuário não foi encontrado'
        } else if (!user.active) {
          throw 'A conta foi desativada'
        }
        return Bluebird.all([user, ServiceLib.comparePassword(password, user.password)])
      })
      .then((resp: any) => {
        let user: IBaseUser = resp[0]
        let encryptedPassword: boolean = resp[1]
        if (encryptedPassword) {
          delete user.password
          return res.status(200).json(`JWT ${jwt.sign(user, appConfig.getJwtConfig().secret, { expiresIn: '3 days' })}`)
        }
        throw 'Invalid password'
      })
      .catch((err: Error) => {
        // throw new APIError(err, 401)
        let { statusCode, error } = new APIError(err.message, 401)
        return res.status(statusCode).json(error)
      })
  } else {
    throw new APIError('Invalid fields', 401)
  }
}
