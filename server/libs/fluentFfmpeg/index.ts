//
// modified for use with audiobookshelf
// Source: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
//

import path from 'node:path';
import { inherits } from 'node:util';
import { EventEmitter } from 'node:events';
import type Ffmpeg from '../fluentFfmpeg';
import utils from './utils';
import installInputs from './options/inputs';
import installAudio from './options/audio';
import installVideo from './options/video';
import installVideoSize from './options/videosize';
import installOutput from './options/output';
import installCustom from './options/custom';
import installMisc from './options/misc';
import installProcessor from './processor';
import installCapabilities from './capabilities';
import installProbe from './ffprobe';
import installRecipes from './recipes';
import type { CommandInput } from './options/types';

type Source = Ffmpeg.FfmpegCommandOptions['source'];
type Options = Ffmpeg.FfmpegCommandOptions;
type RuntimeCommand = Omit<installProcessor.Command, 'input' | 'clone'> & installRecipes.Prototype & {
  input(source: CommandInput['source']): RuntimeCommand;
  output(): RuntimeCommand;
  clone(): RuntimeCommand;
};

interface RuntimeConstructor {
  (input?: Source | Options, options?: Options): RuntimeCommand;
  new (input?: Source | Options, options?: Options): RuntimeCommand;
  prototype: RuntimeCommand;
  setFfmpegPath(path: string): void;
  setFfprobePath(path: string): void;
  setFlvtoolPath(path: string): void;
  availableFilters(callback: Parameters<installCapabilities.Prototype['availableFilters']>[0]): void;
  getAvailableFilters: RuntimeConstructor['availableFilters'];
  availableCodecs(callback: Parameters<installCapabilities.Prototype['availableCodecs']>[0]): void;
  getAvailableCodecs: RuntimeConstructor['availableCodecs'];
  availableFormats(callback: Parameters<installCapabilities.Prototype['availableFormats']>[0]): void;
  getAvailableFormats: RuntimeConstructor['availableFormats'];
  availableEncoders(callback: Parameters<installCapabilities.Prototype['availableEncoders']>[0]): void;
  getAvailableEncoders: RuntimeConstructor['availableEncoders'];
  ffprobe(file: Source, ...args: Parameters<installProbe.Prototype['ffprobe']>): void;
}

/**
 * Create an ffmpeg command
 *
 * Can be called with or without the 'new' operator, and the 'input' parameter
 * may be specified as 'options.source' instead (or passed later with the
 * addInput method).
 *
 * @constructor
 * @param {String|ReadableStream} [input] input file path or readable stream
 * @param {Object} [options] command options
 * @param {Object} [options.logger=<no logging>] logger object with 'error', 'warning', 'info' and 'debug' methods
 * @param {Number} [options.niceness=0] ffmpeg process niceness, ignored on Windows
 * @param {Number} [options.priority=0] alias for `niceness`
 * @param {String} [options.presets="fluent-ffmpeg/lib/presets"] directory to load presets from
 * @param {String} [options.preset="fluent-ffmpeg/lib/presets"] alias for `presets`
 * @param {String} [options.stdoutLines=100] maximum lines of ffmpeg output to keep in memory, use 0 for unlimited
 * @param {Number} [options.timeout=<no timeout>] ffmpeg processing timeout in seconds
 * @param {String|ReadableStream} [options.source=<no input>] alias for the `input` parameter
 */
const constructor: unknown = function FfmpegCommand(this: RuntimeCommand, input?: Source | Options, options?: Options) {
  // Make 'new' optional
  if (!(this instanceof commandConstructor)) {
    return new commandConstructor(input, options);
  }

  EventEmitter.call(this);

  if (typeof input === 'object' && !('readable' in input)) {
    // Options object passed directly
    options = input;
  } else {
    // Input passed first
    options = options || {};
    options.source = input;
  }

  // Add input if present
  this._inputs = [];
  if (options.source) {
    this.input(options.source);
  }

  // Add target-less output for backwards compatibility
  this._outputs = [];
  this.output();

  // Create argument lists
  this._global = utils.args();
  this._complexFilters = utils.args();

  // Set default option values
  options.stdoutLines = 'stdoutLines' in options ? options.stdoutLines : 100;
  options.presets = options.presets || options.preset || path.join(__dirname, 'presets');
  options.niceness = options.niceness || options.priority || 0;

  // Save options
  this.options = options;

  // Setup logger
  this.logger = options.logger || {
    debug: function () { },
    info: function () { },
    warn: function () { },
    error: function () { }
  };
};

// The CommonJS factory supports both ordinary calls and construction with new.
const commandConstructor = constructor as RuntimeConstructor;
inherits(commandConstructor, EventEmitter);


/**
 * Clone an ffmpeg command
 *
 * This method is useful when you want to process the same input multiple times.
 * It returns a new FfmpegCommand instance with the exact same options.
 *
 * All options set _after_ the clone() call will only be applied to the instance
 * it has been called on.
 *
 * @example
 *   var command = ffmpeg('/path/to/source.avi')
 *     .audioCodec('libfaac')
 *     .videoCodec('libx264')
 *     .format('mp4');
 *
 *   command.clone()
 *     .size('320x200')
 *     .save('/path/to/output-small.mp4');
 *
 *   command.clone()
 *     .size('640x400')
 *     .save('/path/to/output-medium.mp4');
 *
 *   command.save('/path/to/output-original-size.mp4');
 *
 * @method FfmpegCommand#clone
 * @return FfmpegCommand
 */
commandConstructor.prototype.clone = function (this: RuntimeCommand) {
  var clone = new commandConstructor();

  // Clone options and logger
  clone.options = this.options;
  clone.logger = this.logger;

  // Clone inputs
  clone._inputs = this._inputs.map(function (input) {
    return {
      source: input.source,
      options: input.options.clone()
    };
  });

  // Create first output
  if ('target' in this._outputs[0]) {
    // We have outputs set, don't clone them and create first output
    clone._outputs = [];
    clone.output();
  } else {
    // No outputs set, clone first output options
    clone._outputs = [
      clone._currentOutput = {
        flags: {},
        audio: this._currentOutput.audio.clone(),
        audioFilters: this._currentOutput.audioFilters.clone(),
        video: this._currentOutput.video.clone(),
        videoFilters: this._currentOutput.videoFilters.clone(),
        sizeFilters: this._currentOutput.sizeFilters.clone(),
        options: this._currentOutput.options.clone()
      }
    ];

    if (this._currentOutput.sizeData) {
      clone._currentOutput.sizeData = {};
      utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
    }

    utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
  }

  // Clone argument lists
  clone._global = this._global.clone();
  clone._complexFilters = this._complexFilters.clone();

  return clone;
};


/* Add methods from options submodules */

// The option installers only add methods and use the public declaration for those methods.
const runtimePrototype: unknown = commandConstructor.prototype;
const optionsPrototype = runtimePrototype as Ffmpeg.FfmpegCommand;
installInputs(optionsPrototype);
installAudio(optionsPrototype);
installVideo(optionsPrototype);
installVideoSize(optionsPrototype);
installOutput(optionsPrototype);
installCustom(optionsPrototype);
installMisc(optionsPrototype);


/* Add processor methods */

installProcessor(commandConstructor.prototype);


/* Add capabilities methods */

installCapabilities(commandConstructor.prototype);

commandConstructor.setFfmpegPath = function (path) {
  (new commandConstructor()).setFfmpegPath(path);
};

commandConstructor.setFfprobePath = function (path) {
  (new commandConstructor()).setFfprobePath(path);
};

commandConstructor.setFlvtoolPath = function (path) {
  (new commandConstructor()).setFlvtoolPath(path);
};

commandConstructor.availableFilters =
  commandConstructor.getAvailableFilters = function (callback) {
    (new commandConstructor()).availableFilters(callback);
  };

commandConstructor.availableCodecs =
  commandConstructor.getAvailableCodecs = function (callback) {
    (new commandConstructor()).availableCodecs(callback);
  };

commandConstructor.availableFormats =
  commandConstructor.getAvailableFormats = function (callback) {
    (new commandConstructor()).availableFormats(callback);
  };

commandConstructor.availableEncoders =
  commandConstructor.getAvailableEncoders = function (callback) {
    (new commandConstructor()).availableEncoders(callback);
  };


/* Add ffprobe methods */

installProbe(commandConstructor.prototype);

commandConstructor.ffprobe = function (file, ...args) {
  var instance = new commandConstructor(file);
  instance.ffprobe(...args);
};

/* Add processing recipes */

installRecipes(commandConstructor.prototype);

export = commandConstructor;
