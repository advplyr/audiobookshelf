/*jshint node:true*/
'use strict';

var utils = require('../utils');

/*
 *! Input-related methods
 */

module.exports = function(proto) {
  /**
   * Add an input to command
   *
   * Also switches "current input", that is the input that will be affected
   * by subsequent input-related methods.
   *
   * Note: only one stream input is supported for now.
   *
   * @method FfmpegCommand#input
   * @category Input
   * @aliases mergeAdd,addInput
   *
   * @param {String|Readable} source input file path or readable stream
   * @return FfmpegCommand
   */
  proto.mergeAdd =
  proto.addInput =
  proto.input = function(source) {
    var isFile = false;
    var isStream = false;

    if (typeof source !== 'string') {
      if (!('readable' in source) || !(source.readable)) {
        throw new Error('Invalid input');
      }

      var hasInputStream = this._inputs.some(function(input) {
        return input.isStream;
      });

      if (hasInputStream) {
        throw new Error('Only one input stream is supported');
      }

      isStream = true;
      source.pause();
    } else {
      var protocol = source.match(/^([a-z]{2,}):/i);
      isFile = !protocol || protocol[0] === 'file';
    }

    this._inputs.push(this._currentInput = {
      source: source,
      isFile: isFile,
      isStream: isStream,
      options: utils.args()
    });

    return this;
  };


  /**
   * Specify input format for the last specified input
   *
   * @method FfmpegCommand#inputFormat
   * @category Input
   * @aliases withInputFormat,fromFormat
   *
   * @param {String} format input format
   * @return FfmpegCommand
   */
  proto.withInputFormat =
  proto.inputFormat =
  proto.fromFormat = function(format) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.options('-f', format);
    return this;
  };


  /**
   * Specify input FPS for the last specified input
   * (only valid for raw video formats)
   *
   * @method FfmpegCommand#inputFps
   * @category Input
   * @aliases withInputFps,withInputFPS,withFpsInput,withFPSInput,inputFPS,inputFps,fpsInput
   *
   * @param {Number} fps input FPS
   * @return FfmpegCommand
   */
  proto.withInputFps =
  proto.withInputFPS =
  proto.withFpsInput =
  proto.withFPSInput =
  proto.inputFPS =
  proto.inputFps =
  proto.fpsInput =
  proto.FPSInput = function(fps) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.options('-r', fps);
    return this;
  };


  /**
   * Use native framerate for the last specified input
   *
   * @method FfmpegCommand#native
   * @category Input
   * @aliases nativeFramerate,withNativeFramerate
   *
   * @return FfmmegCommand
   */
  proto.nativeFramerate =
  proto.withNativeFramerate =
  proto.native = function() {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.options('-re');
    return this;
  };


  /**
   * Specify input seek time for the last specified input
   *
   * @method FfmpegCommand#seekInput
   * @category Input
   * @aliases setStartTime,seekTo
   *
   * @param {String|Number} seek seek time in seconds or as a '[hh:[mm:]]ss[.xxx]' string
   * @return FfmpegCommand
   */
  proto.setStartTime =
  proto.seekInput = function(seek) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.options('-ss', seek);

    return this;
  };


  /**
   * Loop over the last specified input
   *
   * @method FfmpegCommand#loop
   * @category Input
   *
   * @param {String|Number} [duration] loop duration in seconds or as a '[[hh:]mm:]ss[.xxx]' string
   * @return FfmpegCommand
   */
  proto.loop = function(duration) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.options('-loop', '1');

    if (typeof duration !== 'undefined') {
      this.duration(duration);
    }

    return this;
  };
};
