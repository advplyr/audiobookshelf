import { spawn } from 'node:child_process';
import type { CommandInput, CommandInputStream } from './options/types';

interface ProbeFields {
  [key: string]: string | number | ProbeFields | undefined;
  duration?: string | number;
  tags?: ProbeFields;
  disposition?: ProbeFields;
}

interface ProbeData {
  streams: ProbeFields[];
  format: ProbeFields;
  chapters: ProbeFields[];
}

type ProbeCallback = (error: Error | null, data?: ProbeData) => void;
type ProbeArguments =
  | [callback: ProbeCallback]
  | [index: number, callback: ProbeCallback]
  | [options: string[], callback: ProbeCallback]
  | [index: number, options: string[], callback: ProbeCallback];

interface ProbePrototype {
  ffprobe(...args: ProbeArguments): void;
}

interface ProbeCommand {
  _currentInput?: CommandInput;
  _inputs: CommandInput[];
  _getFfprobePath(callback: (error: Error | null, path?: string) => void): void;
}

function legacyTag(key: string) { return key.match(/^TAG:/); }
function legacyDisposition(key: string) { return key.match(/^DISPOSITION:/); }

function parseFfprobeOutput(out: string): ProbeData {
  var lines = out.split(/\r\n|\r|\n/);

  lines = lines.filter(function (line) {
    return line.length > 0;
  });

  var data: ProbeData = {
    streams: [],
    format: {},
    chapters: []
  };

  function parseBlock(name: string) {
    var data: ProbeFields = {};

    var line = lines.shift();
    while (typeof line !== 'undefined') {
      if (line.toLowerCase() == '[/'+name+']') {
        return data;
      } else if (line.match(/^\[/)) {
        line = lines.shift();
        continue;
      }

      var kv = line.match(/^([^=]+)=(.*)$/);
      if (kv) {
        if (!(kv[1].match(/^TAG:/)) && kv[2].match(/^[0-9]+(\.[0-9]+)?$/)) {
          data[kv[1]] = Number(kv[2]);
        } else {
          data[kv[1]] = kv[2];
        }
      }

      line = lines.shift();
    }

    return data;
  }

  var line = lines.shift();
  while (typeof line !== 'undefined') {
    if (line.match(/^\[stream/i)) {
      var stream = parseBlock('stream');
      data.streams.push(stream);
    } else if (line.match(/^\[chapter/i)) {
      var chapter = parseBlock('chapter');
      data.chapters.push(chapter);
    } else if (line.toLowerCase() === '[format]') {
      data.format = parseBlock('format');
    }

    line = lines.shift();
  }

  return data;
}



function install(proto: ProbePrototype) {
  /**
   * A callback passed to the {@link FfmpegCommand#ffprobe} method.
   *
   * @callback FfmpegCommand~ffprobeCallback
   *
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} ffprobeData ffprobe output data; this object
   *   has the same format as what the following command returns:
   *
   *     `ffprobe -print_format json -show_streams -show_format INPUTFILE`
   * @param {Array} ffprobeData.streams stream information
   * @param {Object} ffprobeData.format format information
   */

  /**
   * Run ffprobe on last specified input
   *
   * @method FfmpegCommand#ffprobe
   * @category Metadata
   *
   * @param {?Number} [index] 0-based index of input to probe (defaults to last input)
   * @param {?String[]} [options] array of output options to return
   * @param {FfmpegCommand~ffprobeCallback} callback callback function
   *
   */
  proto.ffprobe = function(this: ProbeCommand, ...args: ProbeArguments) {
    var input: CommandInput | undefined;
    var index: number | null = null;
    var options: string[] = [];

    // the last argument should be the callback
    const callback = args[args.length - 1] as ProbeCallback;

    var ended = false
    function handleCallback(err: Error | null, data?: ProbeData) {
      if (!ended) {
        ended = true;
        callback(err, data);
      }
    }

    // map the arguments to the correct variable names
    switch (args.length) {
      case 3:
        index = args[0];
        options = args[1];
        break;
      case 2:
        if (typeof args[0] === 'number') {
          index = args[0];
        } else if (Array.isArray(args[0])) {
          options = args[0];
        }
        break;
    }


    if (index === null) {
      if (!this._currentInput) {
        return handleCallback(new Error('No input specified'));
      }

      input = this._currentInput;
    } else {
      input = this._inputs[index];

      if (!input) {
        return handleCallback(new Error('Invalid input index'));
      }
    }

    const selectedInput = input;
    // Find ffprobe
    this._getFfprobePath(function(err, path) {
      if (err) {
        return handleCallback(err);
      } else if (!path) {
        return handleCallback(new Error('Cannot find ffprobe'));
      }

      var stdout = '';
      var stdoutClosed = false;
      var stderr = '';
      var stderrClosed = false;

      // Spawn ffprobe
      // Stream inputs are piped, while file paths are passed directly to ffprobe.
      var src = selectedInput.isStream ? 'pipe:0' : selectedInput.source as string;
      var ffprobe = spawn(path, ['-show_streams', '-show_format'].concat(options, src), {windowsHide: true});

      if (selectedInput.isStream) {
        const source = selectedInput.source as CommandInputStream;
        // Skip errors on stdin. These get thrown when ffprobe is complete and
        // there seems to be no way hook in and close stdin before it throws.
        ffprobe.stdin.on('error', function(err: NodeJS.ErrnoException) {
          if (err.code !== undefined && ['ECONNRESET', 'EPIPE', 'EOF'].indexOf(err.code) >= 0) { return; }
          handleCallback(err);
        });

        // Once ffprobe's input stream closes, we need no more data from the
        // input
        ffprobe.stdin.on('close', function() {
            source.pause();
            source.unpipe(ffprobe.stdin);
        });

        source.pipe(ffprobe.stdin);
      }

      ffprobe.on('error', callback);

      // Ensure we wait for captured streams to end before calling callback
      var exitError: Error | null = null;
      function handleExit(err?: Error) {
        if (err) {
          exitError = err;
        }

        if (processExited && stdoutClosed && stderrClosed) {
          if (exitError) {
            if (stderr) {
              exitError.message += '\n' + stderr;
            }

            return handleCallback(exitError);
          }

          // Process output
          var data = parseFfprobeOutput(stdout);

          // Handle legacy output with "TAG:x" and "DISPOSITION:x" keys
          [data.format].concat(data.streams).forEach(function(target) {
            if (target) {
              var legacyTagKeys = Object.keys(target).filter(legacyTag);

              if (legacyTagKeys.length) {
                const tags = target.tags = target.tags || {};

                legacyTagKeys.forEach(function(tagKey) {
                  tags[tagKey.substr(4)] = target[tagKey];
                  delete target[tagKey];
                });
              }

              var legacyDispositionKeys = Object.keys(target).filter(legacyDisposition);

              if (legacyDispositionKeys.length) {
                const disposition = target.disposition = target.disposition || {};

                legacyDispositionKeys.forEach(function(dispositionKey) {
                  disposition[dispositionKey.substr(12)] = target[dispositionKey];
                  delete target[dispositionKey];
                });
              }
            }
          });

          handleCallback(null, data);
        }
      }

      // Handle ffprobe exit
      var processExited = false;
      ffprobe.on('exit', function(code, signal) {
        processExited = true;

        if (code) {
          handleExit(new Error('ffprobe exited with code ' + code));
        } else if (signal) {
          handleExit(new Error('ffprobe was killed with signal ' + signal));
        } else {
          handleExit();
        }
      });

      // Handle stdout/stderr streams
      ffprobe.stdout.on('data', function(data: Buffer | string) {
        stdout += String(data);
      });

      ffprobe.stdout.on('close', function() {
        stdoutClosed = true;
        handleExit();
      });

      ffprobe.stderr.on('data', function(data: Buffer | string) {
        stderr += String(data);
      });

      ffprobe.stderr.on('close', function() {
        stderrClosed = true;
        handleExit();
      });
    });
  };
}

declare namespace install {
  export type Data = ProbeData;
  export type Prototype = ProbePrototype;
}

export = install;
