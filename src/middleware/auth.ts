import type { NextFunction, Request, Response } from 'express'
import { isRole, type Role } from '../constants/role.js'
import { forbidden, unauthorized } from '../infra/http/response.js'
import type { JWT } from '../infra/jwt.js'

export type AuthLocals = { userID: string; role: Role }

// auth(j) = ต้อง login · auth(j, 'ADMIN') = ต้อง login และเป็น role ที่กำหนด
export function auth(j: JWT, ...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = bearerToken(req)
    if (!raw) return unauthorized(res, 'UNAUTHORIZED')
    let claims
    try {
      claims = j.verifyAccessToken(raw)
    } catch {
      return unauthorized(res, 'UNAUTHORIZED')
    }
    if (!isRole(claims.role)) return unauthorized(res, 'UNAUTHORIZED')
    if (allowedRoles.length > 0 && !allowedRoles.includes(claims.role)) return forbidden(res, 'FORBIDDEN')
    res.locals.userID = claims.sub
    res.locals.role = claims.role
    next()
  }
}

// ใช้หลัง auth() เท่านั้น
export const currentUser = (res: Response): AuthLocals => res.locals as AuthLocals

export function bearerToken(req: Request): string {
  const a = req.get('Authorization') ?? ''
  return a.startsWith('Bearer ') ? a.slice(7).trim() : ''
}
