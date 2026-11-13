import JsonWebTokenError from './JsonWebTokenError';

interface TokenExpiredErrorInstance extends InstanceType<typeof JsonWebTokenError> {
  expiredAt: Date;
}

function TokenExpiredError(this: TokenExpiredErrorInstance, message: string, expiredAt: Date) {
  JsonWebTokenError.call(this, message);
  this.name = 'TokenExpiredError';
  this.expiredAt = expiredAt;
};

TokenExpiredError.prototype = Object.create(JsonWebTokenError.prototype) as InstanceType<typeof JsonWebTokenError>;

TokenExpiredError.prototype.constructor = TokenExpiredError;

// This CommonJS constructor is also called with an existing error receiver by its subclasses.
type Constructor = {
  prototype: TokenExpiredErrorInstance;
  new (message: string, expiredAt: Date): TokenExpiredErrorInstance;
  (this: TokenExpiredErrorInstance, message: string, expiredAt: Date): void;
};
export = TokenExpiredError as Constructor;