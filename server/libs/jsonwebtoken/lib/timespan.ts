import { createRequire } from 'node:module'

const ms = createRequire(__filename)('ms') as (duration: string) => number | undefined

function timespan(time: unknown, iat?: number) {
  const timestamp = iat || Math.floor(Date.now() / 1000)

  if (typeof time === 'string') {
    const milliseconds = ms(time)
    if (typeof milliseconds === 'undefined') {
      return
    }
    return Math.floor(timestamp + milliseconds / 1000)
  } else if (typeof time === 'number') {
    return timestamp + time
  } else {
    return
  }
}

export = timespan
