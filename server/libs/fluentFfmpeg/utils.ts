import os from 'node:os';
import which from '../which';
import type { EventEmitter } from 'node:events';
import type { MediaArguments, MediaFilter } from './options/types';

var isWindows = os.platform().match(/win(32|64)/);

var nlRegexp = /\r\n|\r|\n/g;
var streamRegexp = /^\[?(.*?)\]?$/;
var filterEscapeRegexp = /[,]/;
var whichCache: Record<string, string | undefined> = {};

interface CodecData {
  format: string;
  audio: string;
  video: string;
  duration: string;
  audio_details?: string[];
  video_details?: string[];
}

interface CodecState {
  inputStack: CodecData[];
  inputIndex: number;
  inInput: boolean;
}

interface ProgressData {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string | undefined;
  percent?: number;
}

type ProgressCommand = EventEmitter & {
  _ffprobeData?: { format?: { duration?: string | number } };
};

/**
 * Parse progress line from ffmpeg stderr
 *
 * @param {String} line progress line
 * @return progress object
 * @private
 */
function parseProgressLine(line: string) {
  var progress: Partial<Record<string, string>> = {};

  // Remove all spaces after = and trim
  line = line.replace(/=\s+/g, '=').trim();
  var progressParts = line.split(' ');

  // Split every progress part by "=" to get key and value
  for (var i = 0; i < progressParts.length; i++) {
    var progressSplit = progressParts[i].split('=', 2);
    var key = progressSplit[0];
    var value = progressSplit[1];

    // This is not a progress line
    if (typeof value === 'undefined')
      return null;

    progress[key] = value;
  }

  return progress;
}


var utils = {
  isWindows: isWindows,
  streamRegexp: streamRegexp,


  /**
   * Copy an object keys into another one
   *
   * @param {Object} source source object
   * @param {Object} dest destination object
   * @private
   */
  copy: function <Source extends object>(source: Source, dest: Partial<Source>) {
    (Object.keys(source) as Array<keyof Source>).forEach(function (key) {
      dest[key] = source[key];
    });
  },


  /**
   * Create an argument list
   *
   * Returns a function that adds new arguments to the list.
   * It also has the following methods:
   * - clear() empties the argument list
   * - get() returns the argument list
   * - find(arg, count) finds 'arg' in the list and return the following 'count' items, or undefined if not found
   * - remove(arg, count) remove 'arg' in the list as well as the following 'count' items
   *
   * @private
   */
  args: function <Value = string | number>(): MediaArguments<Value> {
    var list: Value[] = [];

    // Append argument(s) to the list
    var argfunc = function (...args: Value[] | [Value[]]) {
      const first = args[0];
      if (args.length === 1 && Array.isArray(first)) {
        list = list.concat(first);
      } else {
        // Multiple arguments are individual values. An array is accepted as a single argument.
        list = list.concat(args as Value[]);
      }
    };

    return Object.assign(argfunc, {
      // Clear argument list
      clear: function () {
        list = [];
      },

      // Return argument list
      get: function () {
        return list;
      },

      // Find argument 'arg' in list, and if found, return an array of the 'count' items that follow it
      find: function (arg: Value, count?: number) {
        var index = list.indexOf(arg);
        if (index !== -1) {
          return list.slice(index + 1, index + 1 + (count || 0));
        }
      },

      // Find argument 'arg' in list, and if found, remove it as well as the 'count' items that follow it
      remove: function (arg: Value, count?: number) {
        var index = list.indexOf(arg);
        if (index !== -1) {
          list.splice(index, (count || 0) + 1);
        }
      },

      // Clone argument list
      clone: function () {
        var cloned = utils.args<Value>();
        cloned(list);
        return cloned;
      },
    });
  },


  /**
   * Generate filter strings
   *
   * @param {String[]|Object[]} filters filter specifications. When using objects,
   *   each must have the following properties:
   * @param {String} filters.filter filter name
   * @param {String|Array} [filters.inputs] (array of) input stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically choosing the first unused matching streams
   * @param {String|Array} [filters.outputs] (array of) output stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically assigning the output to the output file
   * @param {Object|String|Array} [filters.options] filter options, can be omitted to not set any options
   * @return String[]
   * @private
   */
  makeFilterStrings: function (filters: MediaFilter[]) {
    return filters.map(function (filterSpec) {
      if (typeof filterSpec === 'string') {
        return filterSpec;
      }

      var filterString = '';

      // Filter string format is:
      // [input1][input2]...filter[output1][output2]...
      // The 'filter' part can optionaly have arguments:
      //   filter=arg1:arg2:arg3
      //   filter=arg1=v1:arg2=v2:arg3=v3

      // Add inputs
      if (Array.isArray(filterSpec.inputs)) {
        filterString += filterSpec.inputs.map(function (streamSpec) {
          return streamSpec.replace(streamRegexp, '[$1]');
        }).join('');
      } else if (typeof filterSpec.inputs === 'string') {
        filterString += filterSpec.inputs.replace(streamRegexp, '[$1]');
      }

      // Add filter
      filterString += filterSpec.filter;

      // Add options
      const options = filterSpec.options;
      if (options) {
        if (typeof options === 'string' || typeof options === 'number') {
          // Option string
          filterString += '=' + options;
        } else if (Array.isArray(options)) {
          // Option array (unnamed options)
          filterString += '=' + options.map(function (option) {
            if (typeof option === 'string' && option.match(filterEscapeRegexp)) {
              return '\'' + option + '\'';
            } else {
              return option;
            }
          }).join(':');
        } else if (typeof options === 'object' && Object.keys(options).length) {
          // Option object (named options)
          filterString += '=' + Object.keys(options).map(function (option) {
            var value = options[option];

            if (typeof value === 'string' && value.match(filterEscapeRegexp)) {
              value = '\'' + value + '\'';
            }

            return option + '=' + value;
          }).join(':');
        }
      }

      // Add outputs
      if (Array.isArray(filterSpec.outputs)) {
        filterString += filterSpec.outputs.map(function (streamSpec) {
          return streamSpec.replace(streamRegexp, '[$1]');
        }).join('');
      } else if (typeof filterSpec.outputs === 'string') {
        filterString += filterSpec.outputs.replace(streamRegexp, '[$1]');
      }

      return filterString;
    });
  },


  /**
   * Search for an executable
   *
   * Uses 'which' or 'where' depending on platform
   *
   * @param {String} name executable name
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  which: function (name: string, callback: (error: null, result?: string) => void) {
    if (name in whichCache) {
      return callback(null, whichCache[name]);
    }

    void which(name, function (err, result) {
      if (err) {
        // Treat errors as not found
        return callback(null, whichCache[name] = '');
      }
      callback(null, whichCache[name] = result);
    });
  },


  /**
   * Convert a [[hh:]mm:]ss[.xxx] timemark into seconds
   *
   * @param {String} timemark timemark string
   * @return Number
   * @private
   */
  timemarkToSeconds: function (timemark: string | number) {
    if (typeof timemark === 'number') {
      return timemark;
    }

    if (timemark.indexOf(':') === -1 && timemark.indexOf('.') >= 0) {
      return Number(timemark);
    }

    var parts = timemark.split(':');

    // add seconds
    var secs = Number(parts.pop());

    if (parts.length) {
      // add minutes
      secs += Number(parts.pop()) * 60;
    }

    if (parts.length) {
      // add hours
      secs += Number(parts.pop()) * 3600;
    }

    return secs;
  },


  /**
   * Extract codec data from ffmpeg stderr and emit 'codecData' event if appropriate
   * Call it with an initially empty codec object once with each line of stderr output until it returns true
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderrLine ffmpeg stderr output line
   * @param {Object} codecObject object used to accumulate codec data between calls
   * @return {Boolean} true if codec data is complete (and event was emitted), false otherwise
   * @private
   */
  extractCodecData: function (command: EventEmitter, stderrLine: string, codecsObject: Partial<CodecState>) {
    var inputPattern = /Input #[0-9]+, ([^ ]+),/;
    var durPattern = /Duration\: ([^,]+)/;
    var audioPattern = /Audio\: (.*)/;
    var videoPattern = /Video\: (.*)/;

    if (!('inputStack' in codecsObject)) {
      codecsObject.inputStack = [];
      codecsObject.inputIndex = -1;
      codecsObject.inInput = false;
    }

    // The parser initializes these fields together when it sees a new state object.
    const state = codecsObject as CodecState;
    var inputStack = state.inputStack;
    var inputIndex = state.inputIndex;
    var inInput = state.inInput;

    var format, dur, audio, video;

    if (format = stderrLine.match(inputPattern)) {
      inInput = codecsObject.inInput = true;
      inputIndex = state.inputIndex = state.inputIndex + 1;

      inputStack[inputIndex] = { format: format[1], audio: '', video: '', duration: '' };
    } else if (inInput && (dur = stderrLine.match(durPattern))) {
      inputStack[inputIndex].duration = dur[1];
    } else if (inInput && (audio = stderrLine.match(audioPattern))) {
      audio = audio[1].split(', ');
      inputStack[inputIndex].audio = audio[0];
      inputStack[inputIndex].audio_details = audio;
    } else if (inInput && (video = stderrLine.match(videoPattern))) {
      video = video[1].split(', ');
      inputStack[inputIndex].video = video[0];
      inputStack[inputIndex].video_details = video;
    } else if (/Output #\d+/.test(stderrLine)) {
      inInput = codecsObject.inInput = false;
    } else if (/Stream mapping:|Press (\[q\]|ctrl-c) to stop/.test(stderrLine)) {
      command.emit('codecData', ...inputStack);
      return true;
    }

    return false;
  },


  /**
   * Extract progress data from ffmpeg stderr and emit 'progress' event if appropriate
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderrLine ffmpeg stderr data
   * @private
   */
  extractProgress: function (command: ProgressCommand, stderrLine: string) {
    var progress = parseProgressLine(stderrLine);

    if (progress) {
      // build progress report object
      var ret: ProgressData = {
        frames: parseInt(String(progress.frame), 10),
        currentFps: parseInt(String(progress.fps), 10),
        currentKbps: progress.bitrate ? parseFloat(progress.bitrate.replace('kbits/s', '')) : 0,
        targetSize: parseInt(String(progress.size || progress.Lsize), 10),
        timemark: progress.time
      };

      // calculate percent progress using duration
      if (command._ffprobeData && command._ffprobeData.format && command._ffprobeData.format.duration) {
        var duration = Number(command._ffprobeData.format.duration);
        if (!isNaN(duration))
          ret.percent = (utils.timemarkToSeconds(ret.timemark!) / duration) * 100;
      }
      command.emit('progress', ret);
    }
  },


  /**
   * Extract error message(s) from ffmpeg stderr
   *
   * @param {String} stderr ffmpeg stderr data
   * @return {String}
   * @private
   */
  extractError: function (stderr: string) {
    // Only return the last stderr lines that don't start with a space or a square bracket
    return stderr.split(nlRegexp).reduce<string[]>(function (messages, message) {
      if (message.charAt(0) === ' ' || message.charAt(0) === '[') {
        return [];
      } else {
        messages.push(message);
        return messages;
      }
    }, []).join('\n');
  },


  /**
   * Creates a line ring buffer object with the following methods:
   * - append(str) : appends a string or buffer
   * - get() : returns the whole string
   * - close() : prevents further append() calls and does a last call to callbacks
   * - callback(cb) : calls cb for each line (incl. those already in the ring)
   *
   * @param {Number} maxLines maximum number of lines to store (<= 0 for unlimited)
   */
  linesRing: function (maxLines: number | undefined) {
    var cbs: Array<(line: string) => void> = [];
    var lines: string[] = [];
    var current: string | null = null;
    var closed = false
    var max = Number(maxLines) - 1;

    function emit(line: string) {
      cbs.forEach(function (cb) { cb(line); });
    }

    return {
      callback: function (cb: (line: string) => void) {
        lines.forEach(function (l) { cb(l); });
        cbs.push(cb);
      },

      append: function (str: string | Buffer) {
        if (closed) return;
        if (str instanceof Buffer) str = str.toString();
        if (!str || str.length === 0) return;

        var newLines = (str as string).split(nlRegexp);

        if (newLines.length === 1) {
          if (current !== null) {
            current = current + newLines.shift();
          } else {
            current = newLines.shift()!;
          }
        } else {
          if (current !== null) {
            current = current + newLines.shift();
            emit(current);
            lines.push(current);
          }

          current = newLines.pop()!;

          newLines.forEach(function (l) {
            emit(l);
            lines.push(l);
          });

          if (max > -1 && lines.length > max) {
            lines.splice(0, lines.length - max);
          }
        }
      },

      get: function () {
        if (current !== null) {
          return lines.concat([current]).join('\n');
        } else {
          return lines.join('\n');
        }
      },

      close: function () {
        if (closed) return;

        if (current !== null) {
          emit(current);
          lines.push(current);

          if (max > -1 && lines.length > max) {
            lines.shift();
          }

          current = null;
        }

        closed = true;
      }
    };
  }
};

export = utils;
