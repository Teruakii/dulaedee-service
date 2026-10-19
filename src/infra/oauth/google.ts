const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export type OAuthUser = {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

export class GoogleOAuth {
  constructor(
    private readonly clientID: string,
    private readonly clientSecret: string,
    private readonly redirectURL: string,
  ) {}

  getLoginURL(state: string): string {
    const q = new URLSearchParams({
      client_id: this.clientID,
      redirect_uri: this.redirectURL,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    })
    return `${AUTH_URL}?${q}`
  }

  async exchangeCode(code: string): Promise<OAuthUser> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientID,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectURL,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) throw new Error(`exchange code: status ${tokenRes.status}`)
    const { access_token } = (await tokenRes.json()) as { access_token: string }

    const userRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } })
    if (!userRes.ok) throw new Error(`get userinfo: status ${userRes.status}`)
    return (await userRes.json()) as OAuthUser
  }
}

// คืน null เมื่อยังไม่ได้ตั้งค่า client id/secret
export function newGoogleOAuth(clientID: string, clientSecret: string, redirectURL: string): GoogleOAuth | null {
  if (!clientID || !clientSecret || !redirectURL) return null
  return new GoogleOAuth(clientID, clientSecret, redirectURL)
}
