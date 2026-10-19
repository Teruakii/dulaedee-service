import type { Express } from 'express'
import type { JWT } from '../../infra/jwt.js'
import type { Logger } from '../../infra/logs.js'
import type { Mailer } from '../../infra/mail/mailer.js'
import type { GoogleOAuth } from '../../infra/oauth/google.js'
import type { UserRepo } from '../user/user.repo.js'
import { AuthHandler } from './auth.handler.js'
import { mount } from './auth.router.js'
import { AuthService } from './auth.service.js'

// options object แทน functional options ของ Go: google เป็น null ได้เมื่อยังไม่ตั้งค่า
export type AuthModuleOptions = {
  userRepo: UserRepo
  logger: Logger
  jwt: JWT
  google: GoogleOAuth | null
  clientURL: string
  mailer: Mailer
  resetSecret: string
}

export class AuthModule {
  private readonly svc: AuthService
  private readonly handler: AuthHandler

  constructor(private readonly opts: AuthModuleOptions) {
    this.svc = new AuthService(opts.logger, opts.userRepo, opts.jwt, { secret: opts.resetSecret, mailer: opts.mailer, clientURL: opts.clientURL })
    this.handler = new AuthHandler(this.svc, opts.google, opts.clientURL)
  }

  service = (): AuthService => this.svc

  mount(app: Express) {
    mount(app, this.handler, this.opts.jwt)
  }
}
