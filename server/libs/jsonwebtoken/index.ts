//
// modified for use in audiobookshelf
// Source: https://github.com/auth0/node-jsonwebtoken
//

import verify from './verify';
import sign from './sign';
import JsonWebTokenError from './lib/JsonWebTokenError';
import NotBeforeError from './lib/NotBeforeError';
import TokenExpiredError from './lib/TokenExpiredError';
import type Decode from './decode';
import { createRequire } from 'node:module';

const jwt = {
  verify,
  sign,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
};

Object.defineProperty(jwt, 'decode', {
  enumerable: false,
  value: createRequire(__filename)('./decode') as typeof Decode,
});

export = jwt as typeof jwt & { readonly decode: typeof Decode };
