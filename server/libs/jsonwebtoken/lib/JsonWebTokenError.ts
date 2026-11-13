interface JsonWebTokenErrorInstance extends Error {
  inner?: unknown;
}

function JsonWebTokenError(this: JsonWebTokenErrorInstance, message: string, error?: unknown) {
  Error.call(this, message);
  if(Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  }
  this.name = 'JsonWebTokenError';
  this.message = message;
  if (error) this.inner = error;
};

JsonWebTokenError.prototype = Object.create(Error.prototype) as Error;
JsonWebTokenError.prototype.constructor = JsonWebTokenError;

// This CommonJS constructor is also called with an existing error receiver by its subclasses.
type Constructor = {
  prototype: JsonWebTokenErrorInstance;
  new (message: string, error?: unknown): JsonWebTokenErrorInstance;
  (this: JsonWebTokenErrorInstance, message: string, error?: unknown): void;
};
export = JsonWebTokenError as Constructor;
