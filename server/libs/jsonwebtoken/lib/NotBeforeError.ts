import JsonWebTokenError from './JsonWebTokenError';

interface NotBeforeErrorInstance extends InstanceType<typeof JsonWebTokenError> {
  date: Date;
}

function NotBeforeError(this: NotBeforeErrorInstance, message: string, date: Date) {
  JsonWebTokenError.call(this, message);
  this.name = 'NotBeforeError';
  this.date = date;
};

NotBeforeError.prototype = Object.create(JsonWebTokenError.prototype) as InstanceType<typeof JsonWebTokenError>;

NotBeforeError.prototype.constructor = NotBeforeError;

// This CommonJS constructor is also called with an existing error receiver by its subclasses.
type Constructor = {
  prototype: NotBeforeErrorInstance;
  new (message: string, date: Date): NotBeforeErrorInstance;
  (this: NotBeforeErrorInstance, message: string, date: Date): void;
};
export = NotBeforeError as Constructor;