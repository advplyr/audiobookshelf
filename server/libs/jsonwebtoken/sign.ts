import jws from '../jws';
import once from '../lodash.once';
import timespan from './lib/timespan';

var PS_SUPPORTED = true
interface SignOptions {
  expiresIn?: number | string;
  notBefore?: number | string;
  audience?: string | string[];
  algorithm?: string;
  header?: Record<string, unknown>;
  encoding?: BufferEncoding;
  issuer?: string;
  subject?: string;
  jwtid?: string;
  noTimestamp?: boolean;
  keyid?: string;
  mutatePayload?: boolean;
}

type Claims = Record<string, unknown>;
type Validator = { isValid: (value: unknown) => unknown; message: string };
type SignCallback = (error: unknown, token?: string) => unknown;

interface Sign {
  (payload: unknown, key: unknown, options?: SignOptions | null): string;
  (payload: unknown, key: unknown, callback: SignCallback): void;
  (payload: unknown, key: unknown, options: SignOptions | null | undefined, callback: SignCallback): void;
}

var SUPPORTED_ALGS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'HS256', 'HS384', 'HS512', 'none'];
if (PS_SUPPORTED) {
  SUPPORTED_ALGS.splice(3, 0, 'PS256', 'PS384', 'PS512');
}

function isPlainObject(value: unknown): value is Claims {
  var type = typeof value;
  return !!value && type == 'object' && !Array.isArray(value);
}
function isInteger(val: unknown) {
  return !isNaN(val as number) && val !== null && !String(val).includes('.')
}
function isNumber(val: unknown) {
  return !isNaN(val as number) && val !== null
}
function isString(val: unknown): val is string {
  return typeof val == 'string'
}

var sign_options_schema: Record<string, Validator | undefined> = {
  expiresIn: { isValid: function (value) { return isInteger(value) || (isString(value) && value); }, message: '"expiresIn" should be a number of seconds or string representing a timespan' },
  notBefore: { isValid: function (value) { return isInteger(value) || (isString(value) && value); }, message: '"notBefore" should be a number of seconds or string representing a timespan' },
  audience: { isValid: function (value) { return isString(value) || Array.isArray(value); }, message: '"audience" must be a string or array' },
  algorithm: { isValid: function (value) { return SUPPORTED_ALGS.includes(value as string); }, message: '"algorithm" must be a valid string enum value' },
  header: { isValid: isPlainObject, message: '"header" must be an object' },
  encoding: { isValid: isString, message: '"encoding" must be a string' },
  issuer: { isValid: isString, message: '"issuer" must be a string' },
  subject: { isValid: isString, message: '"subject" must be a string' },
  jwtid: { isValid: isString, message: '"jwtid" must be a string' },
  noTimestamp: { isValid: function (value) { return value === true || value === false; }, message: '"noTimestamp" must be a boolean' },
  keyid: { isValid: isString, message: '"keyid" must be a string' },
  mutatePayload: { isValid: function (value) { return value === true || value === false; }, message: '"mutatePayload" must be a boolean' }
};

var registered_claims_schema: Record<string, Validator | undefined> = {
  iat: { isValid: isNumber, message: '"iat" should be a number of seconds' },
  exp: { isValid: isNumber, message: '"exp" should be a number of seconds' },
  nbf: { isValid: isNumber, message: '"nbf" should be a number of seconds' }
};

function validate(schema: Record<string, Validator | undefined>, allowUnknown: boolean, object: unknown, parameterName: string) {
  if (!isPlainObject(object)) {
    throw new Error('Expected "' + parameterName + '" to be a plain object.');
  }
  Object.keys(object)
    .forEach(function (key) {
      var validator = schema[key];
      if (!validator) {
        if (!allowUnknown) {
          throw new Error('"' + key + '" is not allowed in "' + parameterName + '"');
        }
        return;
      }
      if (!validator.isValid(object[key])) {
        throw new Error(validator.message);
      }
    });
}

function validateOptions(options: unknown) {
  return validate(sign_options_schema, false, options, 'options');
}

function validatePayload(payload: unknown) {
  return validate(registered_claims_schema, true, payload, 'payload');
}

var options_to_payload = {
  'audience': 'aud',
  'issuer': 'iss',
  'subject': 'sub',
  'jwtid': 'jti'
} as const;

var options_for_objects = [
  'expiresIn',
  'notBefore',
  'noTimestamp',
  'audience',
  'issuer',
  'subject',
  'jwtid',
] as const;

export = (function (payload: unknown, secretOrPrivateKey: unknown, options?: SignOptions | SignCallback | null, callback?: SignCallback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else {
    options = options || {};
  }

  const settings = options;
  var isObjectPayload = typeof payload === 'object' &&
    !Buffer.isBuffer(payload);

  var header = Object.assign({
    alg: settings.algorithm || 'HS256',
    typ: isObjectPayload ? 'JWT' : undefined,
    kid: settings.keyid
  }, settings.header);

  function failure(err: unknown) {
    if (callback) {
      return callback(err);
    }
    throw err as Error;
  }

  if (!secretOrPrivateKey && settings.algorithm !== 'none') {
    return failure(new Error('secretOrPrivateKey must have a value'));
  }

  if (typeof payload === 'undefined') {
    return failure(new Error('payload is required'));
  } else if (isObjectPayload) {
    try {
      validatePayload(payload);
    }
    catch (error) {
      return failure(error);
    }
    if (!settings.mutatePayload) {
      payload = Object.assign({}, payload);
    }
  } else {
    var invalid_options = options_for_objects.filter(function (opt) {
      return typeof settings[opt] !== 'undefined';
    });

    if (invalid_options.length > 0) {
      return failure(new Error('invalid ' + invalid_options.join(',') + ' option for ' + (typeof payload) + ' payload'));
    }
  }

  const claims = payload as Claims;
  if (typeof claims.exp !== 'undefined' && typeof settings.expiresIn !== 'undefined') {
    return failure(new Error('Bad "options.expiresIn" option the payload already has an "exp" property.'));
  }

  if (typeof claims.nbf !== 'undefined' && typeof settings.notBefore !== 'undefined') {
    return failure(new Error('Bad "options.notBefore" option the payload already has an "nbf" property.'));
  }

  try {
    validateOptions(settings);
  }
  catch (error) {
    return failure(error);
  }

  var timestamp = (claims.iat || Math.floor(Date.now() / 1000)) as number;

  if (settings.noTimestamp) {
    // The original non-strict module ignored writes to read-only claims.
    Reflect.deleteProperty(claims, 'iat');
  } else if (isObjectPayload) {
    Reflect.set(claims, 'iat', timestamp);
  }

  if (typeof settings.notBefore !== 'undefined') {
    try {
      Reflect.set(claims, 'nbf', timespan(settings.notBefore, timestamp));
    }
    catch (err) {
      return failure(err);
    }
    if (typeof claims.nbf === 'undefined') {
      return failure(new Error('"notBefore" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
    }
  }

  if (typeof settings.expiresIn !== 'undefined' && typeof payload === 'object') {
    try {
      Reflect.set(claims, 'exp', timespan(settings.expiresIn, timestamp));
    }
    catch (err) {
      return failure(err);
    }
    if (typeof claims.exp === 'undefined') {
      return failure(new Error('"expiresIn" should be a number of seconds or string representing a timespan eg: "1d", "20h", 60'));
    }
  }

  const claimOptions = Object.keys(options_to_payload) as (keyof typeof options_to_payload)[];
  claimOptions.forEach(function (key) {
    var claim = options_to_payload[key];
    if (typeof settings[key] !== 'undefined') {
      if (typeof claims[claim] !== 'undefined') {
        return failure(new Error('Bad "options.' + key + '" option. The payload already has an "' + claim + '" property.'));
      }
      Reflect.set(claims, claim, settings[key]);
    }
  });

  var encoding = settings.encoding || 'utf8';

  if (typeof callback === 'function') {
    const notify = once(callback);

    jws.createSign({
      header: header,
      privateKey: secretOrPrivateKey,
      payload: payload,
      encoding: encoding
    }).once('error', notify)
      .once('done', function (signature: string) {
        notify(null, signature);
      });
  } else {
    return jws.sign({ header: header, payload: payload, secret: secretOrPrivateKey, encoding: encoding });
  }
}) as Sign;
