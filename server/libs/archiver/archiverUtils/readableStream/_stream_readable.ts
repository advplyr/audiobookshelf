// Keep this file as an alias for the full stream module.
import { createRequire } from 'node:module'

const { Readable } = createRequire(__filename)('./stream') as Pick<typeof import('node:stream'), 'Readable'>
export = Readable
