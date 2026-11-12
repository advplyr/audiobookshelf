declare module 'cookie-parser' {
  import type { RequestHandler } from 'express'
  export default function cookieParser(): RequestHandler
}

declare module 'express-session' {
  import type { RequestHandler } from 'express'
  import { EventEmitter } from 'events'

  export class Store extends EventEmitter {}

  export default function session(options: {
    secret: string
    resave: boolean
    saveUninitialized: boolean
    cookie: { secure: boolean }
    store: Store
  }): RequestHandler
}
