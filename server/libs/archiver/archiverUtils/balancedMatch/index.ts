'use strict'

/**
 * @param {string | RegExp} a
 * @param {string | RegExp} b
 * @param {string} str
 */
function balanced(a: string | RegExp, b: string | RegExp, str: string) {
  const open = a instanceof RegExp ? maybeMatch(a, str) : a
  const close = b instanceof RegExp ? maybeMatch(b, str) : b

  const r = range(open, close, str)

  return (
    r && {
      start: r[0],
      end: r[1],
      pre: str.slice(0, r[0]),
      body: str.slice(r[0] + open!.length, r[1]),
      post: str.slice(r[1] + close!.length)
    }
  )
}

/**
 * @param {RegExp} reg
 * @param {string} str
 */
function maybeMatch(reg: RegExp, str: string) {
  const m = str.match(reg)
  return m ? m[0] : null
}

balanced.range = range

/**
 * @param {string} a
 * @param {string} b
 * @param {string} str
 */
function range(a: string | null, b: string | null, str: string): [number, number] | undefined {
  let begs: number[], beg: number, left: number, right: number | undefined, result: [number, number] | undefined
  let ai = str.indexOf(String(a))
  let bi = str.indexOf(String(b), ai + 1)
  let i = ai

  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi]
    }
    begs = []
    left = str.length

    while (i >= 0 && !result) {
      if (i === ai) {
        begs.push(i)
        ai = str.indexOf(String(a), i + 1)
      } else if (begs.length === 1) {
        result = [begs.pop()!, bi]
      } else {
        beg = begs.pop()!
        if (beg < left) {
          left = beg
          right = bi
        }

        bi = str.indexOf(String(b), i + 1)
      }

      i = ai < bi && ai >= 0 ? ai : bi
    }

    if (begs.length) {
      // A closing token was found, so any remaining opening tokens follow a recorded pair.
      result = [left, right!]
    }
  }

  return result
}

export = balanced
