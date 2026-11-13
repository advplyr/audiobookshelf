import universalify from '../../universalify'
import move from './move'
import moveSync from './move-sync'
import type { MoveOptions } from './types'

interface Move {
  (src: string, dest: string, options?: MoveOptions | null): Promise<void>
  (src: string, dest: string, callback: (error?: unknown) => void): void
  (src: string, dest: string, options: MoveOptions | null | undefined, callback: (error?: unknown) => void): void
}

// The original callback API accepts a callback in the optional options position.
const wrappedMove = universalify.fromCallback<unknown, [string, string, MoveOptions | null | undefined], void>(move) as Move

export = {
  move: wrappedMove,
  moveSync
}
