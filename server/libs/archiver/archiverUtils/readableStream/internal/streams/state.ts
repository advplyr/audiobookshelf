import { createRequire } from 'node:module'
import primordials from '../../ours/primordials'

const { MathFloor, NumberIsInteger } = primordials

type DuplexKey = 'readableHighWaterMark' | 'writableHighWaterMark'
type WaterMarkOptions = Partial<Record<DuplexKey | 'highWaterMark', number | null>>

const load = createRequire(__filename)
const { ERR_INVALID_ARG_VALUE } = (load('../../ours/errors') as {
  codes: { ERR_INVALID_ARG_VALUE: new (name: string, value: unknown) => Error }
}).codes

function highWaterMarkFrom(options: WaterMarkOptions, isDuplex: boolean, duplexKey: DuplexKey) {
  return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null
}

function getDefaultHighWaterMark(objectMode?: boolean) {
  return objectMode ? 16 : 16 * 1024
}

function getHighWaterMark(state: { objectMode?: boolean }, options: WaterMarkOptions, duplexKey: DuplexKey, isDuplex: boolean) {
  const hwm = highWaterMarkFrom(options, isDuplex, duplexKey)

  if (hwm != null) {
    if (!NumberIsInteger(hwm) || hwm < 0) {
      const name = isDuplex ? `options.${duplexKey}` : 'options.highWaterMark'
      throw new ERR_INVALID_ARG_VALUE(name, hwm)
    }

    return MathFloor(hwm)
  } // Default value

  return getDefaultHighWaterMark(state.objectMode)
}

export = {
  getHighWaterMark,
  getDefaultHighWaterMark
}
