/**
 * Archiver Vending
 *
 * @ignore
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
import type ZipStream from './zip-stream';
import Archiver from './lib/core';
import Zip from './lib/plugins/zip';
import Json from './lib/plugins/json';

type Options = ZipStream.Options & { statConcurrency?: number };
type Core = InstanceType<typeof Archiver>;
type Format = Parameters<Core['setModule']>[0];
interface FormatConstructor {
  new (options?: Options): Format;
  prototype: Format;
}
interface ArchiveFactory {
  (format: string, options?: Options): Core;
  create(format: string, options?: Options): Core;
  registerFormat(format: string, module: unknown): void;
  isRegisteredFormat(format: string): boolean;
}

var formats: Partial<Record<string, FormatConstructor>> = {};

/**
 * Dispenses a new Archiver instance.
 *
 * @constructor
 * @param  {String} format The archive format to use.
 * @param  {Object} options See [Archiver]{@link Archiver}
 * @return {Archiver}
 */
const factory: ArchiveFactory = Object.assign(function vending(format: string, options?: Options): Core {
  return factory.create(format, options);
}, {

  /**
   * Creates a new Archiver instance.
   *
   * @param  {String} format The archive format to use.
   * @param  {Object} options See [Archiver]{@link Archiver}
   * @return {Archiver}
   */
  create(format: string, options?: Options) {
    const Plugin = formats[format];
    if (Plugin) {
      var instance = new Archiver(format, options);
      instance.setFormat(format);
      instance.setModule(new Plugin(options));

      return instance;
    } else {
      throw new Error('create(' + format + '): format not registered');
    }
  },

  /**
   * Registers a format for use with archiver.
   *
   * @param  {String} format The name of the format.
   * @param  {Function} module The function for archiver to interact with.
   * @return void
   */
  registerFormat(format: string, module: unknown) {
    if (formats[format]) {
      throw new Error('register(' + format + '): format already registered');
    }

    if (typeof module !== 'function') {
      throw new Error('register(' + format + '): format module invalid');
    }

    const plugin = module as FormatConstructor;
    if (typeof plugin.prototype.append !== 'function' || typeof plugin.prototype.finalize !== 'function') {
      throw new Error('register(' + format + '): format module missing methods');
    }

    formats[format] = plugin;
  },

  /**
   * Check if the format is already registered.
   *
   * @param {String} format the name of the format.
   * @return boolean
   */
  isRegisteredFormat(format: string) {
    if (formats[format]) {
      return true;
    }

    return false;
  },
});

factory.registerFormat('zip', Zip);
factory.registerFormat('json', Json);

export = factory;
