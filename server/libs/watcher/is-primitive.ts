/*!
 * is-primitive <https://github.com/jonschlinkert/is-primitive>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Released under the MIT License.
 */

type Primitive = null | undefined | string | number | boolean | bigint | symbol;

function isPrimitive(val: unknown): val is Primitive {
  if (typeof val === 'object') {
    return val === null;
  }
  return typeof val !== 'function';
}

export = isPrimitive;
