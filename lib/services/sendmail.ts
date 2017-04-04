import { MailConfig } from '../config/mail-config'
import * as nodemailer from 'nodemailer'
import * as smtpTransport from 'nodemailer-smtp-transport'
import * as handlebars from 'handlebars'
import * as path from 'path'
import * as fs from 'fs-extra-promise'
import * as Bluebird from 'bluebird'
import {APIError} from '../services/api-error'
export class SendMail {
  private transporter: nodemailer.Transporter
  private mailConfig: MailConfig
  constructor (mailConfig: MailConfig, transporter?: nodemailer.Transporter) {
    this.mailConfig = mailConfig
    const options = {
      host: this.mailConfig.getHost(),
      port: this.mailConfig.getPort(),
      auth: {
        user: this.mailConfig.getUser(),
        pass: this.mailConfig.getPassword()
      }
    }
    this.transporter = nodemailer.createTransport(transporter || smtpTransport(options))
  }

  public sendForgotEmail (name: string, email: string, url: string): Bluebird<nodemailer.SentMessageInfo> {
    return this.generateHtml(name, email, url, TpEMail.forgot)
    .then((html: string) => {
      return this.sendMail(email, 'Recuperação de senha', html)
    })
    .catch((e: Error) => {
      throw new APIError('layout não localizado',500)
    }) as Bluebird<nodemailer.SentMessageInfo>
  }

  public sendConfirmationEmail (email: string, url: string): Bluebird<nodemailer.SentMessageInfo> {
    return this.generateHtml('', email, url, TpEMail.confirmation)
    .then((html: string) => {
      return this.sendMail(email, 'Confirmação de Cadastro', html)
    })
    .catch((e: Error) => {
      throw new APIError('layout não localizado',500)
    }) as Bluebird<nodemailer.SentMessageInfo>
  }

  private sendMail (to: string, subject: string, html: string): Bluebird<nodemailer.SentMessageInfo> {
    const options: nodemailer.SendMailOptions = {
      // from === nome da empresa
      from: `${this.mailConfig.getFrom()} <${this.mailConfig.getEmail()}>`,
      // para quem o email será enviado
      to,
      // assunto do email
      subject,
      // corpo do email
      html
    }
    return this.transporter.sendMail(options) as Bluebird<nodemailer.SentMessageInfo>
  }

  private generateHtml (name: string, email: string, url: string, type: TpEMail) {
    let chooseTemplate = (t: TpEMail) => {
      if (t === TpEMail.confirmation) {
        return path.join(this.mailConfig.getLayoutPath(), `confirmation.hbs`)
      } else {
        return path.join(this.mailConfig.getLayoutPath(), `forgot.hbs`)
      }
    }

    return fs.readFileAsync((chooseTemplate(type)), 'utf-8')
      .then((html: string) => {
        let template = handlebars.compile(html)
        let result = template({ name: name, email: email, url: url })
        return result
      })
  }

}

export enum TpEMail {
  confirmation,
  forgot
}
