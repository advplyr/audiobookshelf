/**
 * ZIP Format Plugin
 *
 * @module plugins/zip
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
import ZipStream from '../../zip-stream';
import runtimeUtils from '../../archiverUtils';

type Options = ZipStream.Options & { forceUTC?: boolean };
type Engine = ZipStream.Instance;

interface ZipPlugin {
  options: Options;
  supports: { directory: boolean; symlink: boolean };
  engine: Engine;
  append(source: unknown, data: ZipStream.Data, callback?: ZipStream.Callback): void;
  finalize(): void;
  on(...args: Parameters<Engine['on']>): ReturnType<Engine['on']>;
  pipe<Destination extends NodeJS.WritableStream>(destination: Destination, options?: { end?: boolean }): Destination;
  unpipe(...args: Parameters<Engine['unpipe']>): ReturnType<Engine['unpipe']>;
}

const util = runtimeUtils as {
  defaults(options: Options | undefined, defaults: Options): Options;
};

/**
 * @constructor
 * @param {ZipOptions} [options]
 * @param {String} [options.comment] Sets the zip archive comment.
 * @param {Boolean} [options.forceLocalTime=false] Forces the archive to contain local file times instead of UTC.
 * @param {Boolean} [options.forceZip64=false] Forces the archive to contain ZIP64 headers.
 * @param {Boolean} [options.namePrependSlash=false] Prepends a forward slash to archive file paths.
 * @param {Boolean} [options.store=false] Sets the compression method to STORE.
 * @param {Object} [options.zlib] Passed to [zlib]{@link https://nodejs.org/api/zlib.html#zlib_class_options}
 */
const constructor: unknown = function Zip(this: ZipPlugin, options?: Options) {
  if (!(this instanceof createZipPlugin)) {
    return new createZipPlugin(options);
  }

  options = this.options = util.defaults(options, {
    comment: '',
    forceUTC: false,
    namePrependSlash: false,
    store: false
  });

  this.supports = {
    directory: true,
    symlink: true
  };

  this.engine = new ZipStream(options);
};

const createZipPlugin = constructor as {
  (options?: Options): ZipPlugin;
  new (options?: Options): ZipPlugin;
  prototype: ZipPlugin;
};

/**
 * @param  {(Buffer|Stream)} source
 * @param  {ZipEntryData} data
 * @param  {String} data.name Sets the entry name including internal path.
 * @param  {(String|Date)} [data.date=NOW()] Sets the entry date.
 * @param  {Number} [data.mode=D:0755/F:0644] Sets the entry permissions.
 * @param  {String} [data.prefix] Sets a path prefix for the entry name. Useful
 * when working with methods like `directory` or `glob`.
 * @param  {fs.Stats} [data.stats] Sets the fs stat data for this entry allowing
 * for reduction of fs stat calls when stat data is already known.
 * @param  {Boolean} [data.store=ZipOptions.store] Sets the compression method to STORE.
 * @param  {Function} callback
 * @return void
 */
createZipPlugin.prototype.append = function (source, data, callback) {
  this.engine.entry(source, data, callback);
};

/**
 * @return void
 */
createZipPlugin.prototype.finalize = function () {
  this.engine.finalize();
};

/**
 * @return this.engine
 */
createZipPlugin.prototype.on = function (...args: Parameters<Engine['on']>) {
  return this.engine.on(...args);
};

/**
 * @return this.engine
 */
createZipPlugin.prototype.pipe = function <Destination extends NodeJS.WritableStream>(destination: Destination, options?: { end?: boolean }) {
  return this.engine.pipe(destination, options);
};

/**
 * @return this.engine
 */
createZipPlugin.prototype.unpipe = function (...args: Parameters<Engine['unpipe']>) {
  return this.engine.unpipe(...args);
};

export = createZipPlugin;

/**
 * @typedef {Object} ZipOptions
 * @global
 * @property {String} [comment] Sets the zip archive comment.
 * @property {Boolean} [forceLocalTime=false] Forces the archive to contain local file times instead of UTC.
 * @property {Boolean} [forceZip64=false] Forces the archive to contain ZIP64 headers.
 * @prpperty {Boolean} [namePrependSlash=false] Prepends a forward slash to archive file paths.
 * @property {Boolean} [store=false] Sets the compression method to STORE.
 * @property {Object} [zlib] Passed to [zlib]{@link https://nodejs.org/api/zlib.html#zlib_class_options}
 * to control compression.
 * @property {*} [*] See [zip-stream]{@link https://archiverjs.com/zip-stream/ZipStream.html} documentation for current list of properties.
 */

/**
 * @typedef {Object} ZipEntryData
 * @global
 * @property {String} name Sets the entry name including internal path.
 * @property {(String|Date)} [date=NOW()] Sets the entry date.
 * @property {Number} [mode=D:0755/F:0644] Sets the entry permissions.
 * @property {Boolean} [namePrependSlash=ZipOptions.namePrependSlash] Prepends a forward slash to archive file paths.
 * @property {String} [prefix] Sets a path prefix for the entry name. Useful
 * when working with methods like `directory` or `glob`.
 * @property {fs.Stats} [stats] Sets the fs stat data for this entry allowing
 * for reduction of fs stat calls when stat data is already known.
 * @property {Boolean} [store=ZipOptions.store] Sets the compression method to STORE.
 */

/**
 * ZipStream Module
 * @external ZipStream
 * @see {@link https://www.archiverjs.com/zip-stream/ZipStream.html}
 */
