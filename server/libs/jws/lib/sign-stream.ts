import Stream from 'node:stream';
import { format, inherits } from 'node:util';
import { Buffer as SafeBuffer } from 'safe-buffer';
import jwa from '../../jwa';
import DataStream from './data-stream';
import toString from './tostring';

const Buffer = SafeBuffer as unknown as typeof globalThis.Buffer;

interface SignOptions {
  header: { alg: string; [field: string]: unknown };
  payload?: unknown;
  secret?: unknown;
  privateKey?: unknown;
  key?: unknown;
  encoding?: BufferEncoding;
}

interface SignStream extends Stream {
  readable: boolean;
  header: SignOptions['header'];
  encoding: SignOptions['encoding'];
  secret: InstanceType<typeof DataStream>;
  privateKey: InstanceType<typeof DataStream>;
  key: InstanceType<typeof DataStream>;
  payload: InstanceType<typeof DataStream>;
  sign(): string | undefined;
}

function base64url(string: string | undefined, encoding: BufferEncoding) {
  return Buffer
    .from(string as string, encoding)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function jwsSecuredInput(header: SignOptions['header'], payload: unknown, encoding?: BufferEncoding) {
  encoding = encoding || 'utf8';
  var encodedHeader = base64url(toString(header), 'binary');
  var encodedPayload = base64url(toString(payload), encoding);
  return format('%s.%s', encodedHeader, encodedPayload);
}

function jwsSign(opts: SignOptions) {
  var header = opts.header;
  var payload = opts.payload;
  var secretOrKey = opts.secret || opts.privateKey;
  var encoding = opts.encoding;
  var algo = jwa(header.alg);
  var securedInput = jwsSecuredInput(header, payload, encoding);
  var signature = algo.sign(securedInput, secretOrKey);
  return format('%s.%s', securedInput, signature);
}

function SignStream(this: SignStream, opts: SignOptions) {
  var secret = opts.secret || opts.privateKey || opts.key;
  var secretStream = new DataStream(secret);
  this.readable = true;
  this.header = opts.header;
  this.encoding = opts.encoding;
  this.secret = this.privateKey = this.key = secretStream;
  this.payload = new DataStream(opts.payload);
  this.secret.once('close', () => {
    if (!this.payload.writable && this.readable)
      this.sign();
  });

  this.payload.once('close', () => {
    if (!this.secret.writable && this.readable)
      this.sign();
  });
}
inherits(SignStream, Stream);

const SignStreamConstructor = SignStream as unknown as {
  new (opts: SignOptions): SignStream;
  prototype: SignStream;
  sign: typeof jwsSign;
};

SignStreamConstructor.prototype.sign = function sign() {
  try {
    var signature = jwsSign({
      header: this.header,
      payload: this.payload.buffer,
      secret: this.secret.buffer,
      encoding: this.encoding
    });
    this.emit('done', signature);
    this.emit('data', signature);
    this.emit('end');
    this.readable = false;
    return signature;
  } catch (e) {
    this.readable = false;
    this.emit('error', e);
    this.emit('close');
  }
};

SignStreamConstructor.sign = jwsSign;

export = SignStreamConstructor;
