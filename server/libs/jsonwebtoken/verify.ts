import jws from '../jws';
import decode from './decode';
import JsonWebTokenError from './lib/JsonWebTokenError';
import NotBeforeError from './lib/NotBeforeError';
import TokenExpiredError from './lib/TokenExpiredError';
import timespan from './lib/timespan';

var PS_SUPPORTED = true
interface VerifyOptions {
  algorithms?: string[];
  clockTimestamp?: number;
  clockTolerance?: number;
  nonce?: string;
  ignoreNotBefore?: boolean;
  ignoreExpiration?: boolean;
  audience?: string | RegExp | (string | RegExp)[];
  issuer?: string | string[];
  subject?: string;
  jwtid?: string;
  maxAge?: string | number;
  complete?: boolean;
}

type VerifyCallback = (error: unknown, data?: unknown) => unknown;
type KeyCallback = (error: Error | null | undefined, key?: unknown) => unknown;
type KeyProvider = (header: unknown, callback: KeyCallback) => unknown;
type DecodedToken = { header: unknown; payload: unknown; signature: string };

interface Verify {
  (token: unknown, key: unknown, options?: VerifyOptions | null): unknown;
  (token: unknown, key: unknown, callback: VerifyCallback): unknown;
  (token: unknown, key: unknown, options: VerifyOptions | null | undefined, callback: VerifyCallback): unknown;
}

var PUB_KEY_ALGS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
var RSA_KEY_ALGS = ['RS256', 'RS384', 'RS512'];
var HS_ALGS = ['HS256', 'HS384', 'HS512'];

if (PS_SUPPORTED) {
  PUB_KEY_ALGS.splice(3, 0, 'PS256', 'PS384', 'PS512');
  RSA_KEY_ALGS.splice(3, 0, 'PS256', 'PS384', 'PS512');
}

export = (function (jwtString: unknown, secretOrPublicKey: unknown, options?: VerifyOptions | VerifyCallback | null, callback?: VerifyCallback) {
  if ((typeof options === 'function') && !callback) {
    callback = options;
    options = {};
  }

  if (!options) {
    options = {};
  }

  //clone this object since we are going to mutate it.
  const settings = Object.assign({}, options) as VerifyOptions;

  var done: VerifyCallback;

  if (callback) {
    done = callback;
  } else {
    done = function (err, data) {
      if (err) throw err as Error;
      return data;
    };
  }

  if (settings.clockTimestamp && typeof settings.clockTimestamp !== 'number') {
    return done(new JsonWebTokenError('clockTimestamp must be a number'));
  }

  if (settings.nonce !== undefined && (typeof settings.nonce !== 'string' || settings.nonce.trim() === '')) {
    return done(new JsonWebTokenError('nonce must be a non-empty string'));
  }

  var clockTimestamp = settings.clockTimestamp || Math.floor(Date.now() / 1000);

  if (!jwtString) {
    return done(new JsonWebTokenError('jwt must be provided'));
  }

  if (typeof jwtString !== 'string') {
    return done(new JsonWebTokenError('jwt must be a string'));
  }

  var parts = jwtString.split('.');

  if (parts.length !== 3) {
    return done(new JsonWebTokenError('jwt malformed'));
  }

  var decodedToken: DecodedToken | null;

  try {
    decodedToken = decode(jwtString, { complete: true });
  } catch (err) {
    return done(err);
  }

  if (!decodedToken) {
    return done(new JsonWebTokenError('invalid token'));
  }

  const token = decodedToken;
  var header = token.header;
  var getSecret: KeyProvider;

  if (typeof secretOrPublicKey === 'function') {
    if (!callback) {
      return done(new JsonWebTokenError('verify must be called asynchronous if secret or public key is provided as a callback'));
    }

    getSecret = secretOrPublicKey as KeyProvider;
  }
  else {
    getSecret = function (header, secretCallback) {
      void header;
      return secretCallback(null, secretOrPublicKey);
    };
  }

  return getSecret(header, function (err, secretOrPublicKey) {
    if (err) {
      return done(new JsonWebTokenError('error in secret or public key callback: ' + err.message));
    }

    var hasSignature = parts[2].trim() !== '';

    if (!hasSignature && secretOrPublicKey) {
      return done(new JsonWebTokenError('jwt signature is required'));
    }

    if (hasSignature && !secretOrPublicKey) {
      return done(new JsonWebTokenError('secret or public key must be provided'));
    }

    if (!hasSignature && !settings.algorithms) {
      settings.algorithms = ['none'];
    }

    if (!settings.algorithms) {
      const key = secretOrPublicKey as { toString: () => string };
      settings.algorithms = key.toString().includes('BEGIN CERTIFICATE') ||
        key.toString().includes('BEGIN PUBLIC KEY') ? PUB_KEY_ALGS :
        key.toString().includes('BEGIN RSA PUBLIC KEY') ? RSA_KEY_ALGS : HS_ALGS;

    }

    if (!~settings.algorithms.indexOf((token.header as { alg: string }).alg)) {
      return done(new JsonWebTokenError('invalid algorithm'));
    }

    var valid;

    try {
      valid = jws.verify(jwtString, (token.header as { alg: string }).alg, secretOrPublicKey);
    } catch (e) {
      return done(e);
    }

    if (!valid) {
      return done(new JsonWebTokenError('invalid signature'));
    }

    var payload = token.payload as Record<string, unknown>;

    if (typeof payload.nbf !== 'undefined' && !settings.ignoreNotBefore) {
      if (typeof payload.nbf !== 'number') {
        return done(new JsonWebTokenError('invalid nbf value'));
      }
      if (payload.nbf > clockTimestamp + (settings.clockTolerance || 0)) {
        return done(new NotBeforeError('jwt not active', new Date(payload.nbf * 1000)));
      }
    }

    if (typeof payload.exp !== 'undefined' && !settings.ignoreExpiration) {
      if (typeof payload.exp !== 'number') {
        return done(new JsonWebTokenError('invalid exp value'));
      }
      if (clockTimestamp >= payload.exp + (settings.clockTolerance || 0)) {
        return done(new TokenExpiredError('jwt expired', new Date(payload.exp * 1000)));
      }
    }

    if (settings.audience) {
      var audiences = Array.isArray(settings.audience) ? settings.audience : [settings.audience];
      var target = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

      var match = target.some(function (targetAudience) {
        return audiences.some(function (audience) {
          return audience instanceof RegExp ? audience.test(targetAudience as string) : audience === targetAudience;
        });
      });

      if (!match) {
        return done(new JsonWebTokenError('jwt audience invalid. expected: ' + audiences.join(' or ')));
      }
    }

    if (settings.issuer) {
      var invalid_issuer =
        (typeof settings.issuer === 'string' && payload.iss !== settings.issuer) ||
        (Array.isArray(settings.issuer) && settings.issuer.indexOf(payload.iss as string) === -1);

      if (invalid_issuer) {
        return done(new JsonWebTokenError('jwt issuer invalid. expected: ' + (settings.issuer as string)));
      }
    }

    if (settings.subject) {
      if (payload.sub !== settings.subject) {
        return done(new JsonWebTokenError('jwt subject invalid. expected: ' + settings.subject));
      }
    }

    if (settings.jwtid) {
      if (payload.jti !== settings.jwtid) {
        return done(new JsonWebTokenError('jwt jwtid invalid. expected: ' + settings.jwtid));
      }
    }

    if (settings.nonce) {
      if (payload.nonce !== settings.nonce) {
        return done(new JsonWebTokenError('jwt nonce invalid. expected: ' + settings.nonce));
      }
    }

    if (settings.maxAge) {
      if (typeof payload.iat !== 'number') {
        return done(new JsonWebTokenError('iat required when maxAge is specified'));
      }

      var maxAgeTimestamp = timespan(settings.maxAge, payload.iat);
      if (typeof maxAgeTimestamp === 'undefined') {
        return done(new JsonWebTokenError('"maxAge" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
      }
      if (clockTimestamp >= maxAgeTimestamp + (settings.clockTolerance || 0)) {
        return done(new TokenExpiredError('maxAge exceeded', new Date(maxAgeTimestamp * 1000)));
      }
    }

    if (settings.complete === true) {
      var signature = token.signature;

      return done(null, {
        header: header,
        payload: payload,
        signature: signature
      });
    }

    return done(null, payload);
  });
}) as Verify;
