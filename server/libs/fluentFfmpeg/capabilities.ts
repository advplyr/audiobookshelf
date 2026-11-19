import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type Ffmpeg from '../fluentFfmpeg';
import utils from './utils';
import type { CommandWithInput, CommandWithMediaOutput } from './options/types';

type Codecs = Record<string, Partial<Ffmpeg.Codec>>;
type Encoders = Record<string, Omit<Ffmpeg.Encoder, 'type'> & { type?: string }>;
type Result<Value> = (...args: [err: Error, value?: undefined] | [err: null, value: Value]) => void;
type Done = (error?: Error | null) => void;
type PathStep = (path: string, callback: Result<string>) => void;
type CapabilitySteps = [
  (callback: Result<Ffmpeg.Formats>) => void,
  (formats: Ffmpeg.Formats, callback: Done) => void,
  (callback: Result<Encoders>) => void,
  (encoders: Encoders, callback: Done) => void,
];

interface AsyncWaterfall {
  waterfall(tasks: [(callback: Result<string>) => void, ...PathStep[]], callback: Result<string>): void;
  waterfall(tasks: CapabilitySteps, callback: Done): void;
}

// The embedded async runtime passes each task's result to the next task.
const async = createRequire(__filename)('../async') as AsyncWaterfall;

interface CapabilitiesPrototype {
  setFfmpegPath(path: string): Ffmpeg.FfmpegCommand;
  setFfprobePath(path: string): Ffmpeg.FfmpegCommand;
  setFlvtoolPath(path: string): Ffmpeg.FfmpegCommand;
  _forgetPaths(): void;
  _getFfmpegPath(callback: Result<string>): void;
  _getFfprobePath(callback: Result<string>): void;
  _getFlvtoolPath(callback: Result<string>): void;
  availableFilters(callback: Result<Ffmpeg.Filters>): void;
  getAvailableFilters(callback: Result<Ffmpeg.Filters>): void;
  availableCodecs(callback: Result<Codecs>): void;
  getAvailableCodecs(callback: Result<Codecs>): void;
  availableEncoders(callback: Result<Encoders>): void;
  getAvailableEncoders(callback: Result<Encoders>): void;
  availableFormats(callback: Result<Ffmpeg.Formats>): void;
  getAvailableFormats(callback: Result<Ffmpeg.Formats>): void;
  _checkCapabilities(callback: Done): void;
}

type CapabilityCommand = CommandWithInput & CommandWithMediaOutput & CapabilitiesPrototype & {
  _spawnFfmpeg(args: string[], options: { captureStdout: boolean; stdoutLines: number }, callback: Result<ReturnType<typeof utils.linesRing>>): void;
};

interface CapabilitiesCache {
  ffmpegPath?: string;
  ffprobePath?: string;
  flvtoolPath?: string;
  filters?: Ffmpeg.Filters;
  codecs?: Codecs;
  encoders?: Encoders;
  formats?: Ffmpeg.Formats;
}

/*
 *! Capability helpers
 */

var avCodecRegexp = /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
var ffCodecRegexp = /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
var encodersRegexp = /^\s*([VAS\.])([F\.])([S\.])([X\.])([B\.])([D\.]) ([^ ]+) +(.*)$/;
var formatRegexp = /^\s*([D ])([E ])\s+([^ ]+)\s+(.*)$/;
var lineBreakRegexp = /\r\n|\r|\n/;
var filterRegexp = /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;

const codecTypes: Partial<Record<string, string>> = { V: 'video', A: 'audio', S: 'subtitle' };
var cache: CapabilitiesCache = {};

function install(proto: CapabilitiesPrototype) {
  /**
   * Manually define the ffmpeg binary full path.
   *
   * @method FfmpegCommand#setFfmpegPath
   *
   * @param {String} ffmpegPath The full path to the ffmpeg binary.
   * @return FfmpegCommand
   */
  proto.setFfmpegPath = function (this: Ffmpeg.FfmpegCommand, ffmpegPath: string) {
    cache.ffmpegPath = ffmpegPath;
    return this;
  };

  /**
   * Manually define the ffprobe binary full path.
   *
   * @method FfmpegCommand#setFfprobePath
   *
   * @param {String} ffprobePath The full path to the ffprobe binary.
   * @return FfmpegCommand
   */
  proto.setFfprobePath = function (this: Ffmpeg.FfmpegCommand, ffprobePath: string) {
    cache.ffprobePath = ffprobePath;
    return this;
  };

  /**
   * Manually define the flvtool2/flvmeta binary full path.
   *
   * @method FfmpegCommand#setFlvtoolPath
   *
   * @param {String} flvtool The full path to the flvtool2 or flvmeta binary.
   * @return FfmpegCommand
   */
  proto.setFlvtoolPath = function (this: Ffmpeg.FfmpegCommand, flvtool: string) {
    cache.flvtoolPath = flvtool;
    return this;
  };

  /**
   * Forget executable paths
   *
   * (only used for testing purposes)
   *
   * @method FfmpegCommand#_forgetPaths
   * @private
   */
  proto._forgetPaths = function () {
    delete cache.ffmpegPath;
    delete cache.ffprobePath;
    delete cache.flvtoolPath;
  };

  /**
   * Check for ffmpeg availability
   *
   * If the FFMPEG_PATH environment variable is set, try to use it.
   * If it is unset or incorrect, try to find ffmpeg in the PATH instead.
   *
   * @method FfmpegCommand#_getFfmpegPath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFfmpegPath = function (this: CapabilitiesPrototype, callback: Result<string>) {
    if ('ffmpegPath' in cache) {
      const cached = cache.ffmpegPath!;
      return callback(null, cached);
    }

    async.waterfall([
      // Try FFMPEG_PATH
      function (cb: Result<string>) {
        if (process.env.FFMPEG_PATH) {
          fs.exists(process.env.FFMPEG_PATH, function (exists) {
            if (exists) {
              const ffmpegPath = process.env.FFMPEG_PATH!;
              cb(null, ffmpegPath);
            } else {
              cb(null, '');
            }
          });
        } else {
          cb(null, '');
        }
      },

      // Search in the PATH
      function (ffmpeg: string, cb: Result<string>) {
        if (ffmpeg.length) {
          return cb(null, ffmpeg);
        }

        utils.which('ffmpeg', function (err, ffmpeg) {
          const executable = ffmpeg!;
          cb(err, executable);
        });
      }
    ], function (...[err, ffmpeg]) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.ffmpegPath = (ffmpeg || ''));
      }
    });
  };


  /**
   * Check for ffprobe availability
   *
   * If the FFPROBE_PATH environment variable is set, try to use it.
   * If it is unset or incorrect, try to find ffprobe in the PATH instead.
   * If this still fails, try to find ffprobe in the same directory as ffmpeg.
   *
   * @method FfmpegCommand#_getFfprobePath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFfprobePath = function (this: CapabilitiesPrototype, callback: Result<string>) {

    if ('ffprobePath' in cache) {
      const cached = cache.ffprobePath!;
      return callback(null, cached);
    }

    async.waterfall([
      // Try FFPROBE_PATH
      function (cb: Result<string>) {
        if (process.env.FFPROBE_PATH) {
          fs.exists(process.env.FFPROBE_PATH, function (exists) {
            cb(null, exists ? process.env.FFPROBE_PATH! : '');
          });
        } else {
          cb(null, '');
        }
      },

      // Search in the PATH
      function (ffprobe: string, cb: Result<string>) {
        if (ffprobe.length) {
          return cb(null, ffprobe);
        }

        utils.which('ffprobe', function (err, ffprobe) {
          const executable = ffprobe!;
          cb(err, executable);
        });
      },

      // Search in the same directory as ffmpeg
      (ffprobe: string, cb: Result<string>) => {
        if (ffprobe.length) {
          return cb(null, ffprobe);
        }

        this._getFfmpegPath(function (...[err, ffmpeg]) {
          if (err) {
            cb(err);
          } else if (ffmpeg.length) {
            var name = utils.isWindows ? 'ffprobe.exe' : 'ffprobe';
            var ffprobe = path.join(path.dirname(ffmpeg), name);
            fs.exists(ffprobe, function (exists) {
              cb(null, exists ? ffprobe : '');
            });
          } else {
            cb(null, '');
          }
        });
      }
    ], function (...[err, ffprobe]) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.ffprobePath = (ffprobe || ''));
      }
    });
  };


  /**
   * Check for flvtool2/flvmeta availability
   *
   * If the FLVTOOL2_PATH or FLVMETA_PATH environment variable are set, try to use them.
   * If both are either unset or incorrect, try to find flvtool2 or flvmeta in the PATH instead.
   *
   * @method FfmpegCommand#_getFlvtoolPath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFlvtoolPath = function (this: CapabilitiesPrototype, callback: Result<string>) {
    if ('flvtoolPath' in cache) {
      const cached = cache.flvtoolPath!;
      return callback(null, cached);
    }

    async.waterfall([
      // Try FLVMETA_PATH
      function (cb: Result<string>) {
        if (process.env.FLVMETA_PATH) {
          fs.exists(process.env.FLVMETA_PATH, function (exists) {
            cb(null, exists ? process.env.FLVMETA_PATH! : '');
          });
        } else {
          cb(null, '');
        }
      },

      // Try FLVTOOL2_PATH
      function (flvtool: string, cb: Result<string>) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        if (process.env.FLVTOOL2_PATH) {
          fs.exists(process.env.FLVTOOL2_PATH, function (exists) {
            cb(null, exists ? process.env.FLVTOOL2_PATH! : '');
          });
        } else {
          cb(null, '');
        }
      },

      // Search for flvmeta in the PATH
      function (flvtool: string, cb: Result<string>) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        utils.which('flvmeta', function (err, flvmeta) {
          const executable = flvmeta!;
          cb(err, executable);
        });
      },

      // Search for flvtool2 in the PATH
      function (flvtool: string, cb: Result<string>) {
        if (flvtool.length) {
          return cb(null, flvtool);
        }

        utils.which('flvtool2', function (err, flvtool2) {
          const executable = flvtool2!;
          cb(err, executable);
        });
      },
    ], function (...[err, flvtool]) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.flvtoolPath = (flvtool || ''));
      }
    });
  };


  /**
   * A callback passed to {@link FfmpegCommand#availableFilters}.
   *
   * @callback FfmpegCommand~filterCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} filters filter object with filter names as keys and the following
   *   properties for each filter:
   * @param {String} filters.description filter description
   * @param {String} filters.input input type, one of 'audio', 'video' and 'none'
   * @param {Boolean} filters.multipleInputs whether the filter supports multiple inputs
   * @param {String} filters.output output type, one of 'audio', 'video' and 'none'
   * @param {Boolean} filters.multipleOutputs whether the filter supports multiple outputs
   */

  /**
   * Query ffmpeg for available filters
   *
   * @method FfmpegCommand#availableFilters
   * @category Capabilities
   * @aliases getAvailableFilters
   *
   * @param {FfmpegCommand~filterCallback} callback callback function
   */
  proto.availableFilters =
    proto.getAvailableFilters = function (this: CapabilityCommand, callback: Result<Ffmpeg.Filters>) {
      if ('filters' in cache) {
        const cached = cache.filters!;
        return callback(null, cached);
      }

      this._spawnFfmpeg(['-filters'], { captureStdout: true, stdoutLines: 0 }, function (...[err, stdoutRing]) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split('\n');
        var data: Ffmpeg.Filters = {};
        var types: Record<string, string> = { A: 'audio', V: 'video', '|': 'none' };

        lines.forEach(function (line) {
          var match = line.match(filterRegexp);
          if (match) {
            data[match[1]] = {
              description: match[4],
              input: types[match[2].charAt(0)],
              multipleInputs: match[2].length > 1,
              output: types[match[3].charAt(0)],
              multipleOutputs: match[3].length > 1
            };
          }
        });

        callback(null, cache.filters = data);
      });
    };


  /**
   * A callback passed to {@link FfmpegCommand#availableCodecs}.
   *
   * @callback FfmpegCommand~codecCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} codecs codec object with codec names as keys and the following
   *   properties for each codec (more properties may be available depending on the
   *   ffmpeg version used):
   * @param {String} codecs.description codec description
   * @param {Boolean} codecs.canDecode whether the codec is able to decode streams
   * @param {Boolean} codecs.canEncode whether the codec is able to encode streams
   */

  /**
   * Query ffmpeg for available codecs
   *
   * @method FfmpegCommand#availableCodecs
   * @category Capabilities
   * @aliases getAvailableCodecs
   *
   * @param {FfmpegCommand~codecCallback} callback callback function
   */
  proto.availableCodecs =
    proto.getAvailableCodecs = function (this: CapabilityCommand, callback: Result<Codecs>) {
      if ('codecs' in cache) {
        const cached = cache.codecs!;
        return callback(null, cached);
      }

      this._spawnFfmpeg(['-codecs'], { captureStdout: true, stdoutLines: 0 }, function (...[err, stdoutRing]) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data: Codecs = {};

        lines.forEach(function (line) {
          var match = line.match(avCodecRegexp);
          if (match && match[7] !== '=') {
            data[match[7]] = {
              type: codecTypes[match[3]],
              description: match[8],
              canDecode: match[1] === 'D',
              canEncode: match[2] === 'E',
              drawHorizBand: match[4] === 'S',
              directRendering: match[5] === 'D',
              weirdFrameTruncation: match[6] === 'T'
            };
          }

          match = line.match(ffCodecRegexp);
          if (match && match[7] !== '=') {
            var codecData = data[match[7]] = {
              type: codecTypes[match[3]],
              description: match[8],
              canDecode: match[1] === 'D',
              canEncode: match[2] === 'E',
              intraFrameOnly: match[4] === 'I',
              isLossy: match[5] === 'L',
              isLossless: match[6] === 'S'
            };

            const encoderMatch = codecData.description.match(ffEncodersRegexp);
            const encoders = encoderMatch ? encoderMatch[1].trim().split(' ') : [];

            const decoderMatch = codecData.description.match(ffDecodersRegexp);
            const decoders = decoderMatch ? decoderMatch[1].trim().split(' ') : [];

            if (encoders.length || decoders.length) {
              var coderData: Partial<Ffmpeg.Codec> = {};
              utils.copy(codecData, coderData);
              delete coderData.canEncode;
              delete coderData.canDecode;

              encoders.forEach(function (name) {
                data[name] = {};
                utils.copy(coderData, data[name]);
                data[name].canEncode = true;
              });

              decoders.forEach(function (name) {
                if (name in data) {
                  data[name].canDecode = true;
                } else {
                  data[name] = {};
                  utils.copy(coderData, data[name]);
                  data[name].canDecode = true;
                }
              });
            }
          }
        });

        callback(null, cache.codecs = data);
      });
    };


  /**
   * A callback passed to {@link FfmpegCommand#availableEncoders}.
   *
   * @callback FfmpegCommand~encodersCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} encoders encoders object with encoder names as keys and the following
   *   properties for each encoder:
   * @param {String} encoders.description codec description
   * @param {Boolean} encoders.type "audio", "video" or "subtitle"
   * @param {Boolean} encoders.frameMT whether the encoder is able to do frame-level multithreading
   * @param {Boolean} encoders.sliceMT whether the encoder is able to do slice-level multithreading
   * @param {Boolean} encoders.experimental whether the encoder is experimental
   * @param {Boolean} encoders.drawHorizBand whether the encoder supports draw_horiz_band
   * @param {Boolean} encoders.directRendering whether the encoder supports direct encoding method 1
   */

  /**
   * Query ffmpeg for available encoders
   *
   * @method FfmpegCommand#availableEncoders
   * @category Capabilities
   * @aliases getAvailableEncoders
   *
   * @param {FfmpegCommand~encodersCallback} callback callback function
   */
  proto.availableEncoders =
    proto.getAvailableEncoders = function (this: CapabilityCommand, callback: Result<Encoders>) {
      if ('encoders' in cache) {
        const cached = cache.encoders!;
        return callback(null, cached);
      }

      this._spawnFfmpeg(['-encoders'], { captureStdout: true, stdoutLines: 0 }, function (...[err, stdoutRing]) {
        if (err) {
          return callback(err);
        }

        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data: Encoders = {};

        lines.forEach(function (line) {
          var match = line.match(encodersRegexp);
          if (match && match[7] !== '=') {
            data[match[7]] = {
              type: codecTypes[match[1]],
              description: match[8],
              frameMT: match[2] === 'F',
              sliceMT: match[3] === 'S',
              experimental: match[4] === 'X',
              drawHorizBand: match[5] === 'B',
              directRendering: match[6] === 'D'
            };
          }
        });

        callback(null, cache.encoders = data);
      });
    };


  /**
   * A callback passed to {@link FfmpegCommand#availableFormats}.
   *
   * @callback FfmpegCommand~formatCallback
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} formats format object with format names as keys and the following
   *   properties for each format:
   * @param {String} formats.description format description
   * @param {Boolean} formats.canDemux whether the format is able to demux streams from an input file
   * @param {Boolean} formats.canMux whether the format is able to mux streams into an output file
   */

  /**
   * Query ffmpeg for available formats
   *
   * @method FfmpegCommand#availableFormats
   * @category Capabilities
   * @aliases getAvailableFormats
   *
   * @param {FfmpegCommand~formatCallback} callback callback function
   */
  proto.availableFormats =
    proto.getAvailableFormats = function (this: CapabilityCommand, callback: Result<Ffmpeg.Formats>) {
      if ('formats' in cache) {
        const cached = cache.formats!;
        return callback(null, cached);
      }

      // Run ffmpeg -formats
      this._spawnFfmpeg(['-formats'], { captureStdout: true, stdoutLines: 0 }, function (...[err, stdoutRing]) {
        if (err) {
          return callback(err);
        }

        // Parse output
        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data: Ffmpeg.Formats = {};

        lines.forEach(function (line) {
          const match = line.match(formatRegexp);
          if (match) {
            match[3].split(',').forEach(function (format) {
              if (!(format in data)) {
                data[format] = {
                  description: match[4],
                  canDemux: false,
                  canMux: false
                };
              }

              if (match[1] === 'D') {
                data[format].canDemux = true;
              }
              if (match[2] === 'E') {
                data[format].canMux = true;
              }
            });
          }
        });

        callback(null, cache.formats = data);
      });
    };


  /**
   * Check capabilities before executing a command
   *
   * Checks whether all used codecs and formats are indeed available
   *
   * @method FfmpegCommand#_checkCapabilities
   * @param {Function} callback callback with signature (err)
   * @private
   */
  proto._checkCapabilities = function (this: CapabilityCommand, callback: Done) {
    async.waterfall([
      // Get available formats
      (cb: Result<Ffmpeg.Formats>) => {
        this.availableFormats(cb);
      },

      // Check whether specified formats are available
      (formats: Ffmpeg.Formats, cb: Done) => {
        // Output format(s)
        const unavailableOutput = this._outputs
          .reduce<Array<Array<string | number>>>(function (fmts, output) {
            var format = output.options.find('-f', 1);
            if (format) {
              if (!(format[0] in formats) || !(formats[format[0]].canMux)) {
                fmts.push(format);
              }
            }

            return fmts;
          }, []);

        if (unavailableOutput.length === 1) {
          return cb(new Error('Output format ' + String(unavailableOutput[0]) + ' is not available'));
        } else if (unavailableOutput.length > 1) {
          return cb(new Error('Output formats ' + unavailableOutput.join(', ') + ' are not available'));
        }

        // Input format(s)
        const unavailable = this._inputs
          .reduce<Array<string | number>>(function (fmts, input) {
            var format = input.options.find('-f', 1);
            if (format) {
              if (!(format[0] in formats) || !(formats[format[0]].canDemux)) {
                fmts.push(format[0]);
              }
            }

            return fmts;
          }, []);

        if (unavailable.length === 1) {
          return cb(new Error('Input format ' + unavailable[0] + ' is not available'));
        } else if (unavailable.length > 1) {
          return cb(new Error('Input formats ' + unavailable.join(', ') + ' are not available'));
        }

        cb();
      },

      // Get available codecs
      (cb: Result<Encoders>) => {
        this.availableEncoders(cb);
      },

      // Check whether specified codecs are available and add strict experimental options if needed
      (encoders: Encoders, cb: Done) => {
        let unavailable: Array<string | number>;

        // Audio codec(s)
        unavailable = this._outputs.reduce<Array<string | number>>(function (cdcs, output) {
          var acodec = output.audio.find('-acodec', 1);
          if (acodec && acodec[0] !== 'copy') {
            if (!(acodec[0] in encoders) || encoders[acodec[0]].type !== 'audio') {
              cdcs.push(acodec[0]);
            }
          }

          return cdcs;
        }, []);

        if (unavailable.length === 1) {
          return cb(new Error('Audio codec ' + unavailable[0] + ' is not available'));
        } else if (unavailable.length > 1) {
          return cb(new Error('Audio codecs ' + unavailable.join(', ') + ' are not available'));
        }

        // Video codec(s)
        unavailable = this._outputs.reduce<Array<string | number>>(function (cdcs, output) {
          var vcodec = output.video.find('-vcodec', 1);
          if (vcodec && vcodec[0] !== 'copy') {
            if (!(vcodec[0] in encoders) || encoders[vcodec[0]].type !== 'video') {
              cdcs.push(vcodec[0]);
            }
          }

          return cdcs;
        }, []);

        if (unavailable.length === 1) {
          return cb(new Error('Video codec ' + unavailable[0] + ' is not available'));
        } else if (unavailable.length > 1) {
          return cb(new Error('Video codecs ' + unavailable.join(', ') + ' are not available'));
        }

        cb();
      }
    ], callback);
  };
}

export = install;
