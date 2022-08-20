/*jshint node:true*/
'use strict';

//
// modified for use with audiobookshelf
// Source: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
//

var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');
var ARGLISTS = ['_global', '_audio', '_audioFilters', '_video', '_videoFilters', '_sizeFilters', '_complexFilters'];


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
function FfmpegCommand(input, options) {
  // Make 'new' optional
  if (!(this instanceof FfmpegCommand)) {
    return new FfmpegCommand(input, options);
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
  var self = this;
  ['_global', '_complexFilters'].forEach(function (prop) {
    self[prop] = utils.args();
  });

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
}
util.inherits(FfmpegCommand, EventEmitter);
module.exports = FfmpegCommand;


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
FfmpegCommand.prototype.clone = function () {
  var clone = new FfmpegCommand();
  var self = this;

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
        flags: {}
      }
    ];

    ['audio', 'audioFilters', 'video', 'videoFilters', 'sizeFilters', 'options'].forEach(function (key) {
      clone._currentOutput[key] = self._currentOutput[key].clone();
    });

    if (this._currentOutput.sizeData) {
      clone._currentOutput.sizeData = {};
      utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
    }

    utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
  }

  // Clone argument lists
  ['_global', '_complexFilters'].forEach(function (prop) {
    clone[prop] = self[prop].clone();
  });

  return clone;
};


/* Add methods from options submodules */

require('./options/inputs')(FfmpegCommand.prototype);
require('./options/audio')(FfmpegCommand.prototype);
require('./options/video')(FfmpegCommand.prototype);
require('./options/videosize')(FfmpegCommand.prototype);
require('./options/output')(FfmpegCommand.prototype);
require('./options/custom')(FfmpegCommand.prototype);
require('./options/misc')(FfmpegCommand.prototype);


/* Add processor methods */

require('./processor')(FfmpegCommand.prototype);


/* Add capabilities methods */

require('./capabilities')(FfmpegCommand.prototype);

FfmpegCommand.setFfmpegPath = function (path) {
  (new FfmpegCommand()).setFfmpegPath(path);
};

FfmpegCommand.setFfprobePath = function (path) {
  (new FfmpegCommand()).setFfprobePath(path);
};

FfmpegCommand.setFlvtoolPath = function (path) {
  (new FfmpegCommand()).setFlvtoolPath(path);
};

FfmpegCommand.availableFilters =
  FfmpegCommand.getAvailableFilters = function (callback) {
    (new FfmpegCommand()).availableFilters(callback);
  };

FfmpegCommand.availableCodecs =
  FfmpegCommand.getAvailableCodecs = function (callback) {
    (new FfmpegCommand()).availableCodecs(callback);
  };

FfmpegCommand.availableFormats =
  FfmpegCommand.getAvailableFormats = function (callback) {
    (new FfmpegCommand()).availableFormats(callback);
  };

FfmpegCommand.availableEncoders =
  FfmpegCommand.getAvailableEncoders = function (callback) {
    (new FfmpegCommand()).availableEncoders(callback);
  };


/* Add ffprobe methods */

require('./ffprobe')(FfmpegCommand.prototype);

FfmpegCommand.ffprobe = function (file) {
  var instance = new FfmpegCommand(file);
  instance.ffprobe.apply(instance, Array.prototype.slice.call(arguments, 1));
};

/* Add processing recipes */

require('./recipes')(FfmpegCommand.prototype);
