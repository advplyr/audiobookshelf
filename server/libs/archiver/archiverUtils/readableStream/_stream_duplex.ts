// Keep this file as an alias for the full stream module.
import { createRequire } from 'node:module'

const { Duplex } = createRequire(__filename)('./stream') as Pick<typeof import('node:stream'), 'Duplex'>
export = Duplex
