import { Buffer } from 'node:buffer';

export = function toString(obj: unknown): string | undefined {
  if (typeof obj === 'string')
    return obj;
  if (typeof obj === 'number' || Buffer.isBuffer(obj))
    return obj.toString();
  return JSON.stringify(obj);
};
