import jsonwebtoken from 'jsonwebtoken'
import { sentinel } from '../constants/errors.js'

export type TokenType = 'access' | 'refresh'

export const ErrWrongTokenType = sentinel('WRONG_TOKEN_TYPE')
export const ErrInvalidToken = sentinel('INVALID_TOKEN')

// sub คือ user id (reference ใช้ username แต่ทุก module ที่นี่ต้องค้นข้อมูลตามเจ้าของด้วย id)
// pv มีเฉพาะ refresh: ลายนิ้วมือของรหัสผ่านตอนออกโทเคน เปลี่ยนรหัสแล้วโทเคนเก่าใช้ไม่ได้
export type TokenClaims = { sub: string; role: string; pv?: string }

export class JWT {
  constructor(private readonly secretKey: string) {}

  generateToken(sub: string, role: string, expiresInSec: number, typ: TokenType, pv?: string): string {
    return jsonwebtoken.sign({ sub, role, typ, ...(pv ? { pv } : {}) }, this.secretKey, { algorithm: 'HS256', expiresIn: expiresInSec })
  }

  verifyAccessToken(token: string): TokenClaims {
    return this.verifyTyped(token, 'access')
  }

  verifyRefreshToken(token: string): TokenClaims {
    return this.verifyTyped(token, 'refresh')
  }

  private verifyTyped(token: string, want: TokenType): TokenClaims {
    let claims: jsonwebtoken.JwtPayload | string
    try {
      claims = jsonwebtoken.verify(token, this.secretKey, { algorithms: ['HS256'] })
    } catch {
      throw ErrInvalidToken
    }
    if (typeof claims === 'string' || typeof claims.sub !== 'string' || !claims.sub) throw ErrInvalidToken
    if (claims['typ'] !== want) throw ErrWrongTokenType
    return {
      sub: claims.sub,
      role: typeof claims['role'] === 'string' ? claims['role'] : '',
      ...(typeof claims['pv'] === 'string' ? { pv: claims['pv'] } : {}),
    }
  }
}
