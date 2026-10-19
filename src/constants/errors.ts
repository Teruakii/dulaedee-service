// sentinel error: เทียบด้วย === แบบ errors.Is ของ Go · message เป็น UPPER_SNAKE ที่ส่งถึง client
export const sentinel = (code: string) => Object.freeze(new Error(code))

export const INVALID_CREDENTIALS = sentinel('INVALID_CREDENTIALS')
export const UNAUTHORIZED = sentinel('UNAUTHORIZED')
