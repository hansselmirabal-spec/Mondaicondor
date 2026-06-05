import jwt from 'jsonwebtoken'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} environment variable is required`)
  return val
}

const JWT_SECRET = requireEnv('JWT_SECRET')
const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET')

export interface TokenPayload {
  userId: string
  email: string
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as unknown as TokenPayload
}
