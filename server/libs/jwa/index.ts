//
// used by jws
// Source: https://github.com/auth0/node-jwa
//

import type { KeyLike, SignJsonWebKeyInput, SignKeyObjectInput, SignPrivateKeyInput, VerifyKeyObjectInput, VerifyPublicKeyInput } from 'node:crypto';
import crypto from 'node:crypto';
import util from 'node:util';
import { Buffer as SafeBuffer } from 'safe-buffer';
import bufferEqual from './buffer-equal-constant-time';
import formatEcdsa from './ecdsa-sig-formatter';

const Buffer = SafeBuffer as unknown as typeof globalThis.Buffer;

type PublicKey = KeyLike;
type PrivateKey = KeyLike | SignKeyObjectInput | SignPrivateKeyInput | SignJsonWebKeyInput;
type KeyFields = { type?: unknown; asymmetricKeyType?: unknown; export?: unknown };

var MSG_INVALID_ALGORITHM = '"%s" is not a valid algorithm.\n  Supported algorithms are:\n  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".'
var MSG_INVALID_SECRET = 'secret must be a string or buffer';
var MSG_INVALID_VERIFIER_KEY = 'key must be a string or a buffer';
var MSG_INVALID_SIGNER_KEY = 'key must be a string, a buffer or an object';

var supportsKeyObjects = typeof crypto.createPublicKey === 'function';
if (supportsKeyObjects) {
  MSG_INVALID_VERIFIER_KEY += ' or a KeyObject';
  MSG_INVALID_SECRET += 'or a KeyObject';
}

function checkIsPublicKey(key: unknown): asserts key is PublicKey {
  if (Buffer.isBuffer(key)) {
    return;
  }

  if (typeof key === 'string') {
    return;
  }

  if (!supportsKeyObjects) {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }

  if (typeof key !== 'object') {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }

  if (typeof (key as KeyFields).type !== 'string') {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }

  if (typeof (key as KeyFields).asymmetricKeyType !== 'string') {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }

  if (typeof (key as KeyFields).export !== 'function') {
    throw typeError(MSG_INVALID_VERIFIER_KEY);
  }
};

function checkIsPrivateKey(key: unknown): asserts key is PrivateKey {
  if (Buffer.isBuffer(key)) {
    return;
  }

  if (typeof key === 'string') {
    return;
  }

  if (typeof key === 'object') {
    return;
  }

  throw typeError(MSG_INVALID_SIGNER_KEY);
};

function checkIsSecretKey(key: unknown): asserts key is KeyLike {
  if (Buffer.isBuffer(key)) {
    return;
  }

  if (typeof key === 'string') {
    return;
  }

  if (!supportsKeyObjects) {
    throw typeError(MSG_INVALID_SECRET);
  }

  if (typeof key !== 'object') {
    throw typeError(MSG_INVALID_SECRET);
  }

  if ((key as KeyFields).type !== 'secret') {
    throw typeError(MSG_INVALID_SECRET);
  }

  if (typeof (key as KeyFields).export !== 'function') {
    throw typeError(MSG_INVALID_SECRET);
  }
}

function fromBase64(base64: string) {
  return base64
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function toBase64(input: unknown) {
  var base64url = (input as { toString: () => string }).toString();

  var padding = 4 - base64url.length % 4;
  if (padding !== 4) {
    for (var i = 0; i < padding; ++i) {
      base64url += '=';
    }
  }

  return base64url
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
}

function typeError(template: string, ...args: unknown[]) {
  var errMsg = util.format(template, ...args);
  return new TypeError(errMsg);
}

function bufferOrString(obj: unknown): obj is string | Buffer {
  return Buffer.isBuffer(obj) || typeof obj === 'string';
}

function normalizeInput(thing: unknown) {
  return bufferOrString(thing) ? thing : JSON.stringify(thing);
}

function createHmacSigner(bits: string) {
  return function sign(thing: unknown, secret: unknown) {
    checkIsSecretKey(secret);
    var input = normalizeInput(thing);
    var hmac = crypto.createHmac('sha' + bits, secret);
    var sig = (hmac.update(input), hmac.digest('base64'))
    return fromBase64(sig);
  }
}

function createHmacVerifier(bits: string) {
  return function verify(thing: unknown, signature: unknown, secret: unknown) {
    var computedSig = createHmacSigner(bits)(thing, secret);
    return bufferEqual(Buffer.from(signature as string | Buffer), Buffer.from(computedSig));
  }
}

function createKeySigner(bits: string) {
  return function sign(thing: unknown, privateKey: unknown) {
    checkIsPrivateKey(privateKey);
    var input = normalizeInput(thing);
    // Even though we are specifying "RSA" here, this works with ECDSA
    // keys as well.
    var signer = crypto.createSign('RSA-SHA' + bits);
    var sig = (signer.update(input), signer.sign(privateKey, 'base64'));
    return fromBase64(sig);
  }
}

function createKeyVerifier(bits: string) {
  return function verify(thing: unknown, signature: unknown, publicKey: unknown) {
    checkIsPublicKey(publicKey);
    var input = normalizeInput(thing);
    var base64 = toBase64(signature);
    var verifier = crypto.createVerify('RSA-SHA' + bits);
    verifier.update(input);
    return verifier.verify(publicKey, base64, 'base64');
  }
}

function createPSSKeySigner(bits: string) {
  return function sign(thing: unknown, privateKey: unknown) {
    checkIsPrivateKey(privateKey);
    var input = normalizeInput(thing);
    var signer = crypto.createSign('RSA-SHA' + bits);
    var sig = (signer.update(input), signer.sign({
      // OpenSSL handles the original key value inside the PSS options object.
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    } as SignKeyObjectInput | SignPrivateKeyInput, 'base64'));
    return fromBase64(sig);
  }
}

function createPSSKeyVerifier(bits: string) {
  return function verify(thing: unknown, signature: unknown, publicKey: unknown) {
    checkIsPublicKey(publicKey);
    var input = normalizeInput(thing);
    var base64 = toBase64(signature);
    var verifier = crypto.createVerify('RSA-SHA' + bits);
    verifier.update(input);
    return verifier.verify({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    } as VerifyKeyObjectInput | VerifyPublicKeyInput, base64, 'base64');
  }
}

function createECDSASigner(bits: string) {
  var inner = createKeySigner(bits);
  return function sign(...args: Parameters<typeof inner>) {
    var signature = inner.apply(null, args);
    signature = formatEcdsa.derToJose(signature, 'ES' + bits);
    return signature;
  };
}

function createECDSAVerifer(bits: string) {
  var inner = createKeyVerifier(bits);
  return function verify(thing: unknown, signature: unknown, publicKey: unknown) {
    signature = formatEcdsa.joseToDer(signature, 'ES' + bits).toString('base64');
    var result = inner(thing, signature, publicKey);
    return result;
  };
}

function createNoneSigner() {
  return function sign() {
    return '';
  }
}

function createNoneVerifier() {
  return function verify(thing: unknown, signature: unknown) {
    void thing;
    return signature === '';
  }
}

export = function jwa(algorithm: string) {
  var signerFactories = {
    hs: createHmacSigner,
    rs: createKeySigner,
    ps: createPSSKeySigner,
    es: createECDSASigner,
    none: createNoneSigner,
  }
  var verifierFactories = {
    hs: createHmacVerifier,
    rs: createKeyVerifier,
    ps: createPSSKeyVerifier,
    es: createECDSAVerifer,
    none: createNoneVerifier,
  }
  var match = algorithm.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
  if (!match)
    throw typeError(MSG_INVALID_ALGORITHM, algorithm);
  var algo = (match[1] || match[3]).toLowerCase() as keyof typeof signerFactories;
  var bits = match[2];

  return {
    sign: signerFactories[algo](bits),
    verify: verifierFactories[algo](bits),
  }
};
