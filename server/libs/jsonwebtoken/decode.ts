import jws from '../jws';

interface DecodeOptions {
  complete?: boolean;
  json?: boolean;
  encoding?: string;
}

interface DecodedToken {
  header: unknown;
  payload: unknown;
  signature: string;
}

// jws parses the wire format; the payload remains untrusted.
const decodeJws = jws.decode as (this: typeof jws, jwt: string, options: DecodeOptions) => DecodedToken | null;

function decode(jwt: string, options: DecodeOptions & { complete: true }): DecodedToken | null;
function decode(jwt: string, options?: DecodeOptions | null): unknown;
function decode(jwt: string, options?: DecodeOptions | null) {
  options = options || {};
  var decoded = decodeJws.call(jws, jwt, options);
  if (!decoded) { return null; }
  var payload = decoded.payload;

  //try parse the payload
  if (typeof payload === 'string') {
    try {
      var obj: unknown = JSON.parse(payload);
      if (obj !== null && typeof obj === 'object') {
        payload = obj;
      }
    } catch {
      // Leave a non-JSON payload as the original string.
    }
  }

  //return header if `complete` option is enabled.  header includes claims
  //such as `kid` and `alg` used to select the key within a JWKS needed to
  //verify the signature
  if (options.complete === true) {
    return {
      header: decoded.header,
      payload: payload,
      signature: decoded.signature
    };
  }
  return payload;
}

export = decode;
