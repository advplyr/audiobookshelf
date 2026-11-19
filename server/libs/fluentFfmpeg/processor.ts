import { spawn as spawnChildProcess } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Writable } from 'node:stream';
import * as Async from '../async';
import type Ffmpeg from '../fluentFfmpeg';
import type Capabilities from './capabilities';
import type Probe from './ffprobe';
import utils from './utils';
import type { CommandInputStream, CommandWithInput, CommandWithMediaOutput, MediaArguments } from './options/types';

type Argument = string | number;
type LineRing = ReturnType<typeof utils.linesRing>;
type Done = (error?: unknown) => void;
type PrepareCallback = (...args: [error: Error] | [error: null, args: Argument[]]) => void;
type ProcessCallback = (process: ChildProcessWithoutNullStreams, stdout: LineRing, stderr: LineRing) => void;
type EndCallback = (error: Error | null, stdout?: LineRing, stderr?: LineRing) => void;

interface SpawnOptions {
  captureStdout?: boolean;
  cwd?: string;
  niceness?: number;
  stdoutLines?: number;
  windowsHide?: boolean;
}

interface SpawnFfmpeg {
  (args: Argument[], end: EndCallback): void;
  (args: Argument[], process: ProcessCallback, end: EndCallback): void;
  (args: Argument[], options: SpawnOptions, end: EndCallback): void;
  (args: Argument[], options: SpawnOptions, process: ProcessCallback, end: EndCallback): void;
}

interface ProcessorPrototype {
  _spawnFfmpeg: SpawnFfmpeg;
  _getArguments(): Argument[];
  _prepare(callback: PrepareCallback, readMetadata?: boolean): void;
  run(): ProcessorCommand;
  exec(): ProcessorCommand;
  execute(): ProcessorCommand;
  renice(niceness?: number): ProcessorCommand;
  kill(signal?: NodeJS.Signals | number): ProcessorCommand;
}

type ProcessorCommand = Omit<CommandWithInput & CommandWithMediaOutput, 'ffprobe' | 'availableEncoders'>
  & ProcessorPrototype & Probe.Prototype & Capabilities.Prototype & {
    _ffprobeData?: Probe.Data;
    _global: MediaArguments;
    _complexFilters: MediaArguments;
    options: Ffmpeg.FfmpegCommandOptions;
    logger: Ffmpeg.FfmpegCommandLogger;
    ffmpegProc?: ChildProcessWithoutNullStreams;
    processTimer?: NodeJS.Timeout;
  };

interface ProcessorAsync {
  waterfall(tasks: [
    (callback: Done) => void,
    (callback: Done) => void,
    (callback: Done) => void,
    (callback: (error: unknown, args?: Argument[]) => void) => void,
    (args: Argument[], callback: PrepareCallback) => void,
  ], callback: PrepareCallback): void;
  each<T>(items: T[], iterator: (item: T, callback: Done) => void, callback: Done): void;
}

const async: ProcessorAsync = Async;
// Node accepts numeric arguments and converts them to strings before spawning.
const spawn = spawnChildProcess as (command: string, args: Argument[], options: SpawnOptions) => ChildProcessWithoutNullStreams;

/*
 *! Processor methods
 */


/**
 * Run ffprobe asynchronously and store data in command
 *
 * @param {FfmpegCommand} command
 * @private
 */
function runFfprobe(command: ProcessorCommand) {
  const inputProbeIndex = 0;
  if (command._inputs[inputProbeIndex].isStream) {
    // Don't probe input streams as this will consume them
    return;
  }
  command.ffprobe(inputProbeIndex, function (_err, data) {
    command._ffprobeData = data;
  });
}


function install(proto: ProcessorPrototype) {
  /**
   * Emitted just after ffmpeg has been spawned.
   *
   * @event FfmpegCommand#start
   * @param {String} command ffmpeg command line
   */

  /**
   * Emitted when ffmpeg reports progress information
   *
   * @event FfmpegCommand#progress
   * @param {Object} progress progress object
   * @param {Number} progress.frames number of frames transcoded
   * @param {Number} progress.currentFps current processing speed in frames per second
   * @param {Number} progress.currentKbps current output generation speed in kilobytes per second
   * @param {Number} progress.targetSize current output file size
   * @param {String} progress.timemark current video timemark
   * @param {Number} [progress.percent] processing progress (may not be available depending on input)
   */

  /**
   * Emitted when ffmpeg outputs to stderr
   *
   * @event FfmpegCommand#stderr
   * @param {String} line stderr output line
   */

  /**
   * Emitted when ffmpeg reports input codec data
   *
   * @event FfmpegCommand#codecData
   * @param {Object} codecData codec data object
   * @param {String} codecData.format input format name
   * @param {String} codecData.audio input audio codec name
   * @param {String} codecData.audio_details input audio codec parameters
   * @param {String} codecData.video input video codec name
   * @param {String} codecData.video_details input video codec parameters
   */

  /**
   * Emitted when an error happens when preparing or running a command
   *
   * @event FfmpegCommand#error
   * @param {Error} error error object, with optional properties 'inputStreamError' / 'outputStreamError' for errors on their respective streams
   * @param {String|null} stdout ffmpeg stdout, unless outputting to a stream
   * @param {String|null} stderr ffmpeg stderr
   */

  /**
   * Emitted when a command finishes processing
   *
   * @event FfmpegCommand#end
   * @param {Array|String|null} [filenames|stdout] generated filenames when taking screenshots, ffmpeg stdout when not outputting to a stream, null otherwise
   * @param {String|null} stderr ffmpeg stderr
   */


  /**
   * Spawn an ffmpeg process
   *
   * The 'options' argument may contain the following keys:
   * - 'niceness': specify process niceness, ignored on Windows (default: 0)
   * - `cwd`: change working directory
   * - 'captureStdout': capture stdout and pass it to 'endCB' as its 2nd argument (default: false)
   * - 'stdoutLines': override command limit (default: use command limit)
   *
   * The 'processCB' callback, if present, is called as soon as the process is created and
   * receives a nodejs ChildProcess object.  It may not be called at all if an error happens
   * before spawning the process.
   *
   * The 'endCB' callback is called either when an error occurs or when the ffmpeg process finishes.
   *
   * @method FfmpegCommand#_spawnFfmpeg
   * @param {Array} args ffmpeg command line argument list
   * @param {Object} [options] spawn options (see above)
   * @param {Function} [processCB] callback called with process object and stdout/stderr ring buffers when process has been created
   * @param {Function} endCB callback called with error (if applicable) and stdout/stderr ring buffers when process finished
   * @private
   */
  proto._spawnFfmpeg = function (this: ProcessorCommand, args: Argument[], options: SpawnOptions | ProcessCallback | EndCallback, processCB?: ProcessCallback | EndCallback, endCB?: EndCallback) {
    // Enable omitting options
    if (typeof options === 'function') {
      endCB = processCB as EndCallback | undefined;
      processCB = options;
      options = {};
    }

    // Enable omitting processCB
    if (typeof endCB === 'undefined') {
      endCB = processCB as EndCallback;
      processCB = function () { };
    }

    const spawnOptions = options;
    const onProcess = processCB as ProcessCallback;
    const onEnd = endCB;
    var maxLines = 'stdoutLines' in spawnOptions ? spawnOptions.stdoutLines : this.options.stdoutLines;

    // Find ffmpeg
    this._getFfmpegPath(function (...[err, command]) {
      if (err) {
        return onEnd(err);
      } else if (!command || command.length === 0) {
        return onEnd(new Error('Cannot find ffmpeg'));
      }

      // Apply niceness
      if (spawnOptions.niceness && spawnOptions.niceness !== 0 && !utils.isWindows) {
        args.unshift('-n', spawnOptions.niceness, command);
        command = 'nice';
      }

      var stdoutRing = utils.linesRing(maxLines);
      var stdoutClosed = false;

      var stderrRing = utils.linesRing(maxLines);
      var stderrClosed = false;

      // Spawn process
      var ffmpegProc = spawn(command, args, spawnOptions);

      if (ffmpegProc.stderr) {
        ffmpegProc.stderr.setEncoding('utf8');
      }

      ffmpegProc.on('error', function (err) {
        onEnd(err);
      });

      // Ensure we wait for captured streams to end before calling endCB
      var exitError: Error | null = null;
      function handleExit(err?: Error) {
        if (err) {
          exitError = err;
        }

        if (processExited && (stdoutClosed || !spawnOptions.captureStdout) && stderrClosed) {
          onEnd(exitError, stdoutRing, stderrRing);
        }
      }

      // Handle process exit
      var processExited = false;
      ffmpegProc.on('exit', function (code, signal) {
        processExited = true;

        if (signal) {
          handleExit(new Error('ffmpeg was killed with signal ' + signal));
        } else if (code) {
          handleExit(new Error('ffmpeg exited with code ' + code));
        } else {
          handleExit();
        }
      });

      // Capture stdout if specified
      if (spawnOptions.captureStdout) {
        ffmpegProc.stdout.on('data', function (data: Buffer | string) {
          stdoutRing.append(data);
        });

        ffmpegProc.stdout.on('close', function () {
          stdoutRing.close();
          stdoutClosed = true;
          handleExit();
        });
      }

      // Capture stderr if specified
      ffmpegProc.stderr.on('data', function (data: Buffer | string) {
        stderrRing.append(data);
      });

      ffmpegProc.stderr.on('close', function () {
        stderrRing.close();
        stderrClosed = true;
        handleExit();
      });

      // Call process callback
      onProcess(ffmpegProc, stdoutRing, stderrRing);
    });
  };


  /**
   * Build the argument list for an ffmpeg command
   *
   * @method FfmpegCommand#_getArguments
   * @return argument list
   * @private
   */
  proto._getArguments = function (this: ProcessorCommand) {
    var complexFilters = this._complexFilters.get();

    var fileOutput = this._outputs.some(function (output) {
      return output.isFile;
    });

    const args: Argument[] = [];
    return args.concat(
      // Inputs and input options
      this._inputs.reduce<Argument[]>(function (args, input) {
        var source = (typeof input.source === 'string') ? input.source : 'pipe:0';

        // For each input, add input options, then '-i <source>'
        return args.concat(
          input.options.get(),
          ['-i', source]
        );
      }, []),

      // Global options
      this._global.get(),

      // Overwrite if we have file outputs
      fileOutput ? ['-y'] : [],

      // Complex filters
      complexFilters,

      // Outputs, filters and output options
      this._outputs.reduce<Argument[]>(function (args, output) {
        var sizeFilters = utils.makeFilterStrings(output.sizeFilters.get());
        var audioFilters = output.audioFilters.get();
        var videoFilters = output.videoFilters.get().concat(sizeFilters);
        var outputArg: string[];

        if (!output.target) {
          outputArg = [];
        } else if (typeof output.target === 'string') {
          outputArg = [output.target];
        } else {
          outputArg = ['pipe:1'];
        }

        return args.concat(
          output.audio.get(),
          audioFilters.length ? ['-filter:a', audioFilters.join(',')] : [],
          output.video.get(),
          videoFilters.length ? ['-filter:v', videoFilters.join(',')] : [],
          output.options.get(),
          outputArg
        );
      }, [])
    );
  };


  /**
   * Prepare execution of an ffmpeg command
   *
   * Checks prerequisites for the execution of the command (codec/format availability, flvtool...),
   * then builds the argument list for ffmpeg and pass them to 'callback'.
   *
   * @method FfmpegCommand#_prepare
   * @param {Function} callback callback with signature (err, args)
   * @param {Boolean} [readMetadata=false] read metadata before processing
   * @private
   */
  proto._prepare = function (this: ProcessorCommand, callback: PrepareCallback, readMetadata?: boolean) {
    async.waterfall([
      // Check codecs and formats
      (cb) => {
        this._checkCapabilities(cb);
      },

      // Read metadata if required
      (cb) => {
        if (!readMetadata) {
          return cb();
        }

        this.ffprobe(0, (err, data) => {
          if (!err) {
            this._ffprobeData = data;
          }

          cb();
        });
      },

      // Check for flvtool2/flvmeta if necessary
      (cb) => {
        var flvmeta = this._outputs.some((output) => {
          // Remove flvmeta flag on non-file output
          if (output.flags.flvmeta && !output.isFile) {
            this.logger.warn('Updating flv metadata is only supported for files');
            output.flags.flvmeta = false;
          }

          return output.flags.flvmeta;
        });

        if (flvmeta) {
          this._getFlvtoolPath((...results) => {
            cb(results[0]);
          });
        } else {
          cb();
        }
      },

      // Build argument list
      (cb) => {
        var args;
        try {
          args = this._getArguments();
        } catch (e) {
          return cb(e);
        }

        cb(null, args);
      },

      // Add "-strict experimental" option where needed
      (args, cb) => {
        this.availableEncoders((...results) => {
          // Capabilities were checked above and the encoder results are cached.
          const encoders = results[1]!;
          for (var i = 0; i < args.length; i++) {
            if (args[i] === '-acodec' || args[i] === '-vcodec') {
              i++;

              if ((args[i] in encoders) && encoders[args[i]].experimental) {
                args.splice(i + 1, 0, '-strict', 'experimental');
                i += 2;
              }
            }
          }

          cb(null, args);
        });
      }
    ], callback);

    if (!readMetadata) {
      // Read metadata as soon as 'progress' listeners are added

      if (this.listeners('progress').length > 0) {
        // Read metadata in parallel
        runFfprobe(this);
      } else {
        // Read metadata as soon as the first 'progress' listener is added
        this.once('newListener', function (this: ProcessorCommand, event: string | symbol) {
          if (event === 'progress') {
            runFfprobe(this);
          }
        });
      }
    }
  };


  /**
   * Run ffmpeg command
   *
   * @method FfmpegCommand#run
   * @category Processing
   * @aliases exec,execute
   */
  proto.exec =
    proto.execute =
    proto.run = function (this: ProcessorCommand) {
      // Check if at least one output is present
      var outputPresent = this._outputs.some((output) => {
        return 'target' in output;
      });

      if (!outputPresent) {
        throw new Error('No output specified');
      }

      // Get output stream if any
      var outputStream = this._outputs.filter((output) => {
        return typeof output.target !== 'string';
      })[0];

      // Get input stream if any
      var inputStream = this._inputs.filter((input) => {
        return typeof input.source !== 'string';
      })[0];

      // Ensure we send 'end' or 'error' only once
      var ended = false;
      const emitEnd = (err: unknown, stdout?: string, stderr?: string) => {
        if (!ended) {
          ended = true;

          if (err) {
            this.emit('error', err, stdout, stderr);
          } else {
            this.emit('end', stdout, stderr);
          }
        }
      };

      this._prepare((...[err, args]) => {
        if (err) {
          return emitEnd(err);
        }

        // Run ffmpeg
        this._spawnFfmpeg(
          args,
          {
            captureStdout: !outputStream,
            niceness: this.options.niceness,
            cwd: this.options.cwd,
            windowsHide: true
          },

          (ffmpegProc, stdoutRing, stderrRing) => {
            this.ffmpegProc = ffmpegProc;
            this.emit('start', 'ffmpeg ' + args.join(' '));

            // Pipe input stream if any
            if (inputStream) {
              const source = inputStream.source as CommandInputStream;
              source.on('error', (err) => {
                var reportingErr = Object.assign(new Error('Input stream error: ' + err.message), { inputStreamError: err });
                emitEnd(reportingErr);
                ffmpegProc.kill();
              });

              source.resume();
              source.pipe(ffmpegProc.stdin);

              // Set stdin error handler on ffmpeg (prevents nodejs catching the error, but
              // ffmpeg will fail anyway, so no need to actually handle anything)
              ffmpegProc.stdin.on('error', () => { });
            }

            // Setup timeout if requested
            if (this.options.timeout) {
              this.processTimer = setTimeout(() => {
                var msg = 'process ran into a timeout (' + this.options.timeout + 's)';

                emitEnd(new Error(msg), stdoutRing.get(), stderrRing.get());
                ffmpegProc.kill();
              }, this.options.timeout * 1000);
            }


            if (outputStream) {
              const target = outputStream.target as Writable;
              // Pipe ffmpeg stdout to output stream
              ffmpegProc.stdout.pipe(target, outputStream.pipeopts);

              // Handle output stream events
              target.on('close', () => {
                this.logger.debug('Output stream closed, scheduling kill for ffmpeg process');

                // Don't kill process yet, to give a chance to ffmpeg to
                // terminate successfully first  This is necessary because
                // under load, the process 'exit' event sometimes happens
                // after the output stream 'close' event.
                setTimeout(() => {
                  emitEnd(new Error('Output stream closed'));
                  ffmpegProc.kill();
                }, 20);
              });

              target.on('error', (err: Error) => {
                this.logger.debug('Output stream error, killing ffmpeg process');
                var reportingErr = Object.assign(new Error('Output stream error: ' + err.message), { outputStreamError: err });
                emitEnd(reportingErr, stdoutRing.get(), stderrRing.get());
                ffmpegProc.kill('SIGKILL');
              });
            }

            // Setup stderr handling
            if (stderrRing) {

              // 'stderr' event
              if (this.listeners('stderr').length) {
                stderrRing.callback((line) => {
                  this.emit('stderr', line);
                });
              }

              // 'codecData' event
              if (this.listeners('codecData').length) {
                var codecDataSent = false;
                var codecObject = {};

                stderrRing.callback((line) => {
                  if (!codecDataSent)
                    codecDataSent = utils.extractCodecData(this, line, codecObject);
                });
              }

              // 'progress' event
              if (this.listeners('progress').length) {
                stderrRing.callback((line) => {
                  utils.extractProgress(this, line);
                });
              }
            }
          },

          (err, stdoutRing, stderrRing) => {
            clearTimeout(this.processTimer);
            // The legacy completion handler reads both rings once the child process exists.
            const stdout = stdoutRing!;
            const stderr = stderrRing!;
            delete this.ffmpegProc;

            if (err) {
              if (err.message.match(/ffmpeg exited with code/)) {
                // Add ffmpeg error message
                err.message += ': ' + utils.extractError(stderr.get());
              }

              emitEnd(err, stdout.get(), stderr.get());
            } else {
              // Find out which outputs need flv metadata
              var flvmeta = this._outputs.filter((output) => {
                return output.flags.flvmeta;
              });

              if (flvmeta.length) {
                this._getFlvtoolPath((...[err, flvtool]) => {
                  if (err) {
                    return emitEnd(err);
                  }

                  async.each(
                    flvmeta,
                    (output, cb) => {
                      // Preparation clears the flag on stream outputs.
                      const file = output.target as string;
                      spawn(flvtool, ['-U', file], { windowsHide: true })
                        .on('error', (err) => {
                          cb(new Error('Error running ' + flvtool + ' on ' + file + ': ' + err.message));
                        })
                        .on('exit', (code, signal) => {
                          if (code !== 0 || signal) {
                            cb(
                              String(new Error(flvtool + ' ' +
                                (signal ? 'received signal ' + signal
                                  : 'exited with code ' + code))) +
                              ' when running on ' + file
                            );
                          } else {
                            cb();
                          }
                        });
                    },
                    (err) => {
                      if (err) {
                        emitEnd(err);
                      } else {
                        emitEnd(null, stdout.get(), stderr.get());
                      }
                    }
                  );
                });
              } else {
                emitEnd(null, stdout.get(), stderr.get());
              }
            }
          }
        );
      });

      return this;
    };


  /**
   * Renice current and/or future ffmpeg processes
   *
   * Ignored on Windows platforms.
   *
   * @method FfmpegCommand#renice
   * @category Processing
   *
   * @param {Number} [niceness=0] niceness value between -20 (highest priority) and 20 (lowest priority)
   * @return FfmpegCommand
   */
  proto.renice = function (this: ProcessorCommand, niceness?: number) {
    if (!utils.isWindows) {
      niceness = niceness || 0;

      if (niceness < -20 || niceness > 20) {
        this.logger.warn('Invalid niceness value: ' + niceness + ', must be between -20 and 20');
      }

      niceness = Math.min(20, Math.max(-20, niceness));
      this.options.niceness = niceness;

      if (this.ffmpegProc) {
        var logger = this.logger;
        var pid = this.ffmpegProc.pid;
        var renice = spawn('renice', [niceness, '-p', pid!], { windowsHide: true });

        renice.on('error', function (err) {
          logger.warn('could not renice process ' + pid + ': ' + err.message);
        });

        renice.on('exit', function (code, signal) {
          if (signal) {
            logger.warn('could not renice process ' + pid + ': renice was killed by signal ' + signal);
          } else if (code) {
            logger.warn('could not renice process ' + pid + ': renice exited with ' + code);
          } else {
            logger.info('successfully reniced process ' + pid + ' to ' + niceness + ' niceness');
          }
        });
      }
    }

    return this;
  };


  /**
   * Kill current ffmpeg process, if any
   *
   * @method FfmpegCommand#kill
   * @category Processing
   *
   * @param {String} [signal=SIGKILL] signal name
   * @return FfmpegCommand
   */
  proto.kill = function (this: ProcessorCommand, signal?: NodeJS.Signals | number) {
    if (!this.ffmpegProc) {
      this.logger.warn('No running ffmpeg process, cannot send signal');
    } else {
      this.ffmpegProc.kill(signal || 'SIGKILL');
    }

    return this;
  };
}

declare namespace install {
  export type Prototype = ProcessorPrototype;
  export type Command = ProcessorCommand;
}

export = install;
