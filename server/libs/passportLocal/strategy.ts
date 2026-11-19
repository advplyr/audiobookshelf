/**
 * Module dependencies.
 */
import { createRequire } from 'node:module'
import { inherits } from 'node:util'

interface CredentialsRequest {
  body?: unknown
  query?: unknown
}

interface StrategyOptions {
  usernameField?: string
  passwordField?: string
  passReqToCallback?: boolean
}

type Done = (error?: unknown, user?: unknown, info?: unknown) => void
type Verify = (username: string, password: string, done: Done) => unknown
type VerifyWithRequest<Request extends CredentialsRequest> = (req: Request, username: string, password: string, done: Done) => unknown

interface LocalStrategy {
  name: string
  _usernameField: string
  _passwordField: string
  _passReqToCallback?: boolean
  _verify: Verify | VerifyWithRequest<CredentialsRequest> | undefined
  authenticate(req: CredentialsRequest, options?: { badRequestMessage?: string }): void
  success(user: unknown, info?: unknown): void
  fail(challenge?: unknown, status?: number): void
  error(error: unknown): void
}

const passport = createRequire(__filename)('passport-strategy') as {
  Strategy: (this: LocalStrategy) => void
}

function lookup(obj: unknown, field: string): unknown {
  if (!obj) { return null; }
  var chain = field.split(']').join('').split('[');
  for (var i = 0, len = chain.length; i < len; i++) {
    var prop = (obj as Record<string, unknown>)[chain[i]];
    if (typeof (prop) === 'undefined') { return null; }
    if (typeof (prop) !== 'object') { return prop; }
    obj = prop;
  }
  return null;
}

/**
 * `Strategy` constructor.
 *
 * The local authentication strategy authenticates requests based on the
 * credentials submitted through an HTML-based login form.
 *
 * Applications must supply a `verify` callback which accepts `username` and
 * `password` credentials, and then calls the `done` callback supplying a
 * `user`, which should be set to `false` if the credentials are not valid.
 * If an exception occured, `err` should be set.
 *
 * Optionally, `options` can be used to change the fields in which the
 * credentials are found.
 *
 * Options:
 *   - `usernameField`  field name where the username is found, defaults to _username_
 *   - `passwordField`  field name where the password is found, defaults to _password_
 *   - `passReqToCallback`  when `true`, `req` is the first argument to the verify callback (default: `false`)
 *
 * Examples:
 *
 *     passport.use(new LocalStrategy(
 *       function(username, password, done) {
 *         User.findOne({ username: username, password: password }, function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(this: LocalStrategy, options: StrategyOptions | Verify, verify?: LocalStrategy['_verify']) {
  if (typeof options == 'function') {
    verify = options;
    options = {};
  }
  if (!verify) { throw new TypeError('LocalStrategy requires a verify callback'); }

  this._usernameField = options.usernameField || 'username';
  this._passwordField = options.passwordField || 'password';

  passport.Strategy.call(this);
  this.name = 'local';
  this._verify = verify;
  this._passReqToCallback = options.passReqToCallback;
}

/**
 * Inherit from `passport.Strategy`.
 */
inherits(Strategy, passport.Strategy);

const LocalStrategy = Strategy as unknown as {
  new (verify: Verify): LocalStrategy
  new (options: StrategyOptions & { passReqToCallback?: false }, verify: Verify): LocalStrategy
  new <Request extends CredentialsRequest>(options: StrategyOptions & { passReqToCallback: true }, verify: VerifyWithRequest<Request>): LocalStrategy
  prototype: LocalStrategy
}

/**
 * Authenticate request based on the contents of a form submission.
 *
 * @param {Object} req
 * @api protected
 */
LocalStrategy.prototype.authenticate = function (req, options) {
  options = options || {};
  var username = lookup(req.body, this._usernameField)
  if (username === null) {
    lookup(req.query, this._usernameField);
  }

  var password = lookup(req.body, this._passwordField)
  if (password === null) {
    password = lookup(req.query, this._passwordField);
  }

  if (username === null || password === null) {
    return this.fail({ message: options.badRequestMessage || 'Missing credentials' }, 400);
  }

  const verified: Done = (err, user, info) => {
    if (err) { return this.error(err); }
    if (!user) { return this.fail(info); }
    this.success(user, info);
  }

  try {
    if (this._passReqToCallback) {
      (this._verify as VerifyWithRequest<CredentialsRequest>)(req, username as string, password as string, verified);
    } else {
      (this._verify as Verify)(username as string, password as string, verified);
    }
  } catch (ex) {
    return this.error(ex);
  }
};


/**
 * Expose `Strategy`.
 */
export = LocalStrategy
