import type { TokenPayload } from './jwt.js'

export type AppEnv = {
  Variables: {
    user: TokenPayload
  }
}
