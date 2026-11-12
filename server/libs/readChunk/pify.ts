// https://github.com/sindresorhus/pify

interface Options {
  include?: (string | RegExp)[];
  exclude?: (string | RegExp)[];
  errorFirst?: boolean;
  multiArgs?: boolean;
  excludeMain?: boolean;
  promiseModule?: PromiseConstructor;
}

type ResolvedOptions = Options & Required<Pick<Options, 'exclude' | 'errorFirst' | 'promiseModule'>>;
type DynamicFunction = (this: unknown, ...args: unknown[]) => unknown;

function isFunction(input: unknown): input is DynamicFunction {
  return typeof input === 'function';
}

const processFn = (fn: DynamicFunction, options: ResolvedOptions) => function (this: unknown, ...args: unknown[]) {
  const P = options.promiseModule;

  // Keep the original rejection value, including callback tuples in multiArgs mode.
  const executor = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
    if (options.multiArgs) {
      args.push((...result: unknown[]) => {
        if (options.errorFirst) {
          if (result[0]) {
            reject(result);
          } else {
            result.shift();
            resolve(result);
          }
        } else {
          resolve(result);
        }
      });
    } else if (options.errorFirst) {
      args.push((error: unknown, result: unknown) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    } else {
      args.push(resolve);
    }

    fn.apply(this, args);
  };
  return new P(executor);
};

function pify<Args extends unknown[], Values extends unknown[], Receiver>(
  input: (this: Receiver, ...args: [...Args, callback: (error: NodeJS.ErrnoException | null, ...values: Values) => void]) => void,
  options: Options & { multiArgs: true; errorFirst?: true; excludeMain?: false }
): (this: Receiver, ...args: Args) => Promise<Values>;
function pify(input: object, options?: Options): object;
function pify(input: unknown, settings?: Options): object {
  const options = Object.assign({
    exclude: [/.+(Sync|Stream)$/],
    errorFirst: true,
    promiseModule: Promise
  }, settings);

  const objType = typeof input;
  if (!(input !== null && (typeof input === 'object' || typeof input === 'function'))) {
    throw new TypeError(`Expected \`input\` to be a \`Function\` or \`Object\`, got \`${input === null ? 'null' : objType}\``);
  }

  const filter = (key: string) => {
    const match = (pattern: string | RegExp) => typeof pattern === 'string' ? key === pattern : pattern.test(key);
    return options.include ? options.include.some(match) : !options.exclude.some(match);
  };

  let ret: object;
  if (isFunction(input)) {
    ret = function (this: unknown, ...args: unknown[]) {
      return options.excludeMain ? input(...args) : processFn(input, options).apply(this, args);
    };
  } else {
    ret = Object.create(Reflect.getPrototypeOf(input)) as object;
  }

  // Copy enumerable properties, including inherited ones, as in the original wrapper.
  for (const key in input) {
    const property: unknown = Reflect.get(input, key);
    (ret as Record<string, unknown>)[key] = isFunction(property) && filter(key) ? processFn(property, options) : property;
  }

  return ret;
}

export = pify;
