import Stream from 'node:stream';
import { inherits } from 'node:util';
import { Buffer as SafeBuffer } from 'safe-buffer';
import jwa from '../../jwa';
import DataStream from './data-stream';
import toString from './tostring';

const Buffer = SafeBuffer as unknown as typeof globalThis.Buffer;
type Reviver = (key: string, value: unknown) => unknown;

interface DecodeOptions {
  json?: boolean;
  encoding?: string | Reviver;
}

interface VerifyOptions {
  algorithm?: string;
  encoding?: string;
  secret?: unknown;
  publicKey?: unknown;
  key?: unknown;
  signature?: unknown;
}

interface VerifyStream extends Stream {
  readable: boolean;
  algorithm: VerifyOptions['algorithm'];
  encoding: VerifyOptions['encoding'];
  secret: InstanceType<typeof DataStream>;
  publicKey: InstanceType<typeof DataStream>;
  key: InstanceType<typeof DataStream>;
  signature: InstanceType<typeof DataStream>;
  verify(): boolean | undefined;
}

var JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;

function isObject(thing: unknown) {
  return Object.prototype.toString.call(thing) === '[object Object]';
}

function safeJsonParse(thing: unknown): unknown {
  if (isObject(thing))
    return thing;
  try { return JSON.parse(thing as string) as unknown; }
  catch { return undefined; }
}

function headerFromJWS(jwsSig: string) {
  var encodedHeader = jwsSig.split('.', 1)[0];
  return safeJsonParse(Buffer.from(encodedHeader, 'base64').toString('binary'));
}

function securedInputFromJWS(jwsSig: string) {
  return jwsSig.split('.', 2).join('.');
}

function signatureFromJWS(jwsSig: string) {
  return jwsSig.split('.')[2];
}

function payloadFromJWS(jwsSig: string, encoding?: BufferEncoding) {
  encoding = encoding || 'utf8';
  var payload = jwsSig.split('.')[1];
  return Buffer.from(payload, 'base64').toString(encoding);
}

function isValidJws(string: string) {
  return JWS_REGEX.test(string) && !!headerFromJWS(string);
}

function jwsVerify(jwsSig: unknown, algorithm?: string, secretOrKey?: unknown) {
  if (!algorithm) {
    var err = Object.assign(new Error("Missing algorithm parameter for jws.verify"), { code: "MISSING_ALGORITHM" });
    throw err;
  }
  var input = toString(jwsSig) as string;
  var signature = signatureFromJWS(input);
  var securedInput = securedInputFromJWS(input);
  var algo = jwa(algorithm);
  return algo.verify(securedInput, signature, secretOrKey);
}

function jwsDecode(jwsSig: unknown, opts?: DecodeOptions | string | null) {
  // VerifyStream historically passes its encoding string as the options argument.
  const options = (opts || {}) as DecodeOptions;
  const input = toString(jwsSig) as string;

  if (!isValidJws(input))
    return null;

  var header = headerFromJWS(input);

  if (!header)
    return null;

  const body = payloadFromJWS(input);
  // JSON.parse ignores a non-function reviver, including an encoding string.
  const payload: unknown = (header as { typ?: unknown }).typ === 'JWT' || options.json
    ? JSON.parse(body, options.encoding as Reviver | undefined) as unknown
    : body;

  return {
    header: header,
    payload: payload,
    signature: signatureFromJWS(input)
  };
}

function VerifyStream(this: VerifyStream, opts?: VerifyOptions | null) {
  opts = opts || {};
  var secretOrKey = opts.secret || opts.publicKey || opts.key;
  var secretStream = new DataStream(secretOrKey);
  this.readable = true;
  this.algorithm = opts.algorithm;
  this.encoding = opts.encoding;
  this.secret = this.publicKey = this.key = secretStream;
  this.signature = new DataStream(opts.signature);
  this.secret.once('close', () => {
    if (!this.signature.writable && this.readable)
      this.verify();
  });

  this.signature.once('close', () => {
    if (!this.secret.writable && this.readable)
      this.verify();
  });
}
inherits(VerifyStream, Stream);

const VerifyStreamConstructor = VerifyStream as unknown as {
  new (opts?: VerifyOptions | null): VerifyStream;
  prototype: VerifyStream;
  decode: typeof jwsDecode;
  isValid: typeof isValidJws;
  verify: typeof jwsVerify;
};

VerifyStreamConstructor.prototype.verify = function verify() {
  try {
    var valid = jwsVerify(this.signature.buffer, this.algorithm, this.key.buffer);
    var obj = jwsDecode(this.signature.buffer, this.encoding);
    this.emit('done', valid, obj);
    this.emit('data', valid);
    this.emit('end');
    this.readable = false;
    return valid;
  } catch (e) {
    this.readable = false;
    this.emit('error', e);
    this.emit('close');
  }
};

VerifyStreamConstructor.decode = jwsDecode;
VerifyStreamConstructor.isValid = isValidJws;
VerifyStreamConstructor.verify = jwsVerify;

export = VerifyStreamConstructor;
