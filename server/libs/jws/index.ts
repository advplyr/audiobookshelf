//
// used by jsonwebtoken
// Source: https://github.com/auth0/node-jws
//

import SignStream from './lib/sign-stream';
import VerifyStream from './lib/verify-stream';

var ALGORITHMS = [
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512'
];

function createSign(opts: ConstructorParameters<typeof SignStream>[0]) {
  return new SignStream(opts);
}

function createVerify(opts: ConstructorParameters<typeof VerifyStream>[0]) {
  return new VerifyStream(opts);
}

export = {
  ALGORITHMS,
  sign: SignStream.sign,
  verify: VerifyStream.verify,
  decode: VerifyStream.decode,
  isValid: VerifyStream.isValid,
  createSign,
  createVerify
};
