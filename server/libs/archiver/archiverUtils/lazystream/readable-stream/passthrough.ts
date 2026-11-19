import { createRequire } from 'node:module'

const { PassThrough } = createRequire(__filename)('./readable') as Pick<typeof import('node:stream'), 'PassThrough'>
export = PassThrough
