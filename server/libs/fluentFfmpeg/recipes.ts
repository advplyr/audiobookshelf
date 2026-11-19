import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import * as Async from '../async';
import type Ffmpeg from '../fluentFfmpeg';
import type Probe from './ffprobe';
import type Processor from './processor';
import utils from './utils';
import type { CommandOutput, MediaFilterSpec, PipeOptions } from './options/types';

type TimeMark = string | number;
type ScreenshotConfig = Omit<Ffmpeg.ScreenshotsConfig, 'timemarks' | 'timestamps'> & {
  timemarks?: TimeMark[];
  timestamps?: TimeMark[];
};
type OutputTarget = NonNullable<CommandOutput['target']>;
type WritableTarget = Exclude<OutputTarget, string>;

type Screenshot = (config?: number | ScreenshotConfig, folder?: string) => Processor.Command;
type Pipe = (stream?: WritableTarget | PipeOptions, options?: PipeOptions) => WritableTarget;
type Concat = (target: OutputTarget, options?: PipeOptions) => Processor.Command;

interface RecipesPrototype {
  save(output: string): Processor.Command;
  saveToFile(output: string): Processor.Command;
  writeToStream: Pipe;
  pipe: Pipe;
  stream: Pipe;
  takeScreenshots: Screenshot;
  thumbnail: Screenshot;
  thumbnails: Screenshot;
  screenshot: Screenshot;
  screenshots: Screenshot;
  mergeToFile: Concat;
  concatenate: Concat;
  concat: Concat;
}

type Next<Values extends unknown[] = []> =
  (...args: [error: Error] | [error: null, ...values: Values] | (Values extends [] ? [] : never)) => void;
type Dimensions = [pattern: string, width: string | number, height: string | number];

interface ScreenshotAsync {
  waterfall(tasks: [
    (next: Next) => void,
    (next: Next) => void,
    (next: Next<[string]>) => void,
    (pattern: string, next: Next<[string]>) => void,
    (pattern: string, next: Next<Dimensions>) => void,
    (...args: [...Dimensions, next: Next<[string]>]) => void,
    (pattern: string, next: Next<[string[]]>) => void,
    (filenames: string[], next: Next<[string[]]>) => void,
  ], done: Next<[string[]]>): void;
}

const async: ScreenshotAsync = Async;

/*
 * Useful recipes for commands
 */

function recipes(proto: RecipesPrototype) {
  /**
   * Execute ffmpeg command and save output to a file
   *
   * @method FfmpegCommand#save
   * @category Processing
   * @aliases saveToFile
   *
   * @param {String} output file path
   * @return FfmpegCommand
   */
  proto.saveToFile =
    proto.save = function (this: Processor.Command, output: string) {
      this.output(output).run();
      return this;
    };


  /**
   * Execute ffmpeg command and save output to a stream
   *
   * If 'stream' is not specified, a PassThrough stream is created and returned.
   * 'options' will be used when piping ffmpeg output to the output stream
   * (@see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
   *
   * @method FfmpegCommand#pipe
   * @category Processing
   * @aliases stream,writeToStream
   *
   * @param {stream.Writable} [stream] output stream
   * @param {Object} [options={}] pipe options
   * @return Output stream
   */
  proto.writeToStream =
    proto.pipe =
    proto.stream = function (this: Processor.Command, stream?: WritableTarget | PipeOptions, options?: PipeOptions) {
      if (stream && !('writable' in stream)) {
        options = stream;
        stream = undefined;
      }

      if (!stream && process.version.match(/v0\.8\./)) {
        throw new Error('PassThrough stream is not supported on node v0.8');
      }

      // Duplex streams implement the writable API expected by fluent-ffmpeg.
      const output: unknown = stream || new PassThrough();
      const destination = output as WritableTarget;
      this.output(destination, options).run();
      return destination;
    };


  /**
   * Generate images from a video
   *
   * Note: this method makes the command emit a 'filenames' event with an array of
   * the generated image filenames.
   *
   * @method FfmpegCommand#screenshots
   * @category Processing
   * @aliases takeScreenshots,thumbnail,thumbnails,screenshot
   *
   * @param {Number|Object} [config=1] screenshot count or configuration object with
   *   the following keys:
   * @param {Number} [config.count] number of screenshots to take; using this option
   *   takes screenshots at regular intervals (eg. count=4 would take screens at 20%, 40%,
   *   60% and 80% of the video length).
   * @param {String} [config.folder='.'] output folder
   * @param {String} [config.filename='tn.png'] output filename pattern, may contain the following
   *   tokens:
   *   - '%s': offset in seconds
   *   - '%w': screenshot width
   *   - '%h': screenshot height
   *   - '%r': screenshot resolution (same as '%wx%h')
   *   - '%f': input filename
   *   - '%b': input basename (filename w/o extension)
   *   - '%i': index of screenshot in timemark array (can be zero-padded by using it like `%000i`)
   * @param {Number[]|String[]} [config.timemarks] array of timemarks to take screenshots
   *   at; each timemark may be a number of seconds, a '[[hh:]mm:]ss[.xxx]' string or a
   *   'XX%' string.  Overrides 'count' if present.
   * @param {Number[]|String[]} [config.timestamps] alias for 'timemarks'
   * @param {Boolean} [config.fastSeek] use fast seek (less accurate)
   * @param {String} [config.size] screenshot size, with the same syntax as {@link FfmpegCommand#size}
   * @param {String} [folder] output folder (legacy alias for 'config.folder')
   * @return FfmpegCommand
   */
  proto.takeScreenshots =
    proto.thumbnail =
    proto.thumbnails =
    proto.screenshot =
    proto.screenshots = function (this: Processor.Command, config?: number | ScreenshotConfig, folder?: string) {
      var source = this._currentInput!.source;
      config = config || { count: 1 };

      // Accept a number of screenshots instead of a config object
      if (typeof config === 'number') {
        config = {
          count: config
        };
      }

      // Accept a second 'folder' parameter instead of config.folder
      if (!('folder' in config)) {
        config.folder = folder || '.';
      }

      // Accept 'timestamps' instead of 'timemarks'
      if ('timestamps' in config) {
        config.timemarks = config.timestamps;
      }

      // Compute timemarks from count if not present
      if (!('timemarks' in config)) {
        if (!config.count) {
          throw new Error('Cannot take screenshots: neither a count nor a timemark list are specified');
        }

        var interval = 100 / (1 + config.count);
        config.timemarks = [];
        for (var i = 0; i < config.count; i++) {
          config.timemarks.push((interval * (i + 1)) + '%');
        }
      }

      // Timemarks have been supplied or populated above.
      const settings = config as ScreenshotConfig & { timemarks: TimeMark[] };
      let fixedSize: RegExpMatchArray | null | undefined;
      let fixedWidth: RegExpMatchArray | null | undefined;
      let fixedHeight: RegExpMatchArray | null | undefined;
      let percentSize: RegExpMatchArray | null | undefined;

      // Parse size option
      if ('size' in settings) {
        const size = settings.size!;
        fixedSize = size.match(/^(\d+)x(\d+)$/);
        fixedWidth = size.match(/^(\d+)x\?$/);
        fixedHeight = size.match(/^\?x(\d+)$/);
        percentSize = size.match(/^(\d+)%$/);

        if (!fixedSize && !fixedWidth && !fixedHeight && !percentSize) {
          throw new Error('Invalid size parameter: ' + settings.size);
        }
      }

      // Metadata helper
      let metadata: Probe.Data | undefined;
      const getMetadata = (cb: Probe.Callback) => {
        if (metadata) {
          cb(null, metadata);
        } else {
          this.ffprobe((err, meta) => {
            metadata = meta;
            cb(err, meta);
          });
        }
      };

      async.waterfall([
        // Compute percent timemarks if any
        (next) => {
          if (settings.timemarks.some(function (t) { return ('' + t).match(/^[\d.]+%$/); })) {
            if (typeof source !== 'string') {
              return next(new Error('Cannot compute screenshot timemarks with an input stream, please specify fixed timemarks'));
            }

            getMetadata(function (err, probed) {
              if (err) {
                next(err);
              } else {
                const meta = probed!;
                // Select video stream with the highest resolution
                var vstream = meta.streams.reduce(function (biggest, stream) {
                  if (stream.codec_type === 'video' && Number(stream.width) * Number(stream.height) > Number(biggest.width) * Number(biggest.height)) {
                    return stream;
                  } else {
                    return biggest;
                  }
                }, { width: 0, height: 0 });

                if (vstream.width === 0) {
                  return next(new Error('No video stream in input, cannot take screenshots'));
                }

                var duration = Number(vstream.duration);
                if (isNaN(duration)) {
                  duration = Number(meta.format.duration);
                }

                if (isNaN(duration)) {
                  return next(new Error('Could not get input duration, please specify fixed timemarks'));
                }

                settings.timemarks = settings.timemarks.map(function (mark) {
                  if (('' + mark).match(/^([\d.]+)%$/)) {
                    return duration * parseFloat(String(mark)) / 100;
                  } else {
                    return mark;
                  }
                });

                next();
              }
            });
          } else {
            next();
          }
        },

        // Turn all timemarks into numbers and sort them
        (next) => {
          settings.timemarks = settings.timemarks.map(function (mark) {
            return utils.timemarkToSeconds(mark);
          }).sort(function (a, b) { return a - b; });

          next();
        },

        // Add '_%i' to pattern when requesting multiple screenshots and no variable token is present
        (next) => {
          var pattern = settings.filename || 'tn.png';

          if (pattern.indexOf('.') === -1) {
            pattern += '.png';
          }

          if (settings.timemarks.length > 1 && !pattern.match(/%(s|0*i)/)) {
            var ext = path.extname(pattern);
            pattern = path.join(path.dirname(pattern), path.basename(pattern, ext) + '_%i' + ext);
          }

          next(null, pattern);
        },

        // Replace filename tokens (%f, %b) in pattern
        (pattern, next) => {
          if (pattern.match(/%[bf]/)) {
            if (typeof source !== 'string') {
              return next(new Error('Cannot replace %f or %b when using an input stream'));
            }

            pattern = pattern
              .replace(/%f/g, path.basename(source))
              .replace(/%b/g, path.basename(source, path.extname(source)));
          }

          next(null, pattern);
        },

        // Compute size if needed
        (pattern, next) => {
          if (pattern.match(/%[whr]/)) {
            if (fixedSize) {
              return next(null, pattern, fixedSize[1], fixedSize[2]);
            }

            getMetadata(function (err, probed) {
              if (err) {
                return next(new Error('Could not determine video resolution to replace %w, %h or %r'));
              }

              const meta = probed!;
              var vstream = meta.streams.reduce(function (biggest, stream) {
                if (stream.codec_type === 'video' && Number(stream.width) * Number(stream.height) > Number(biggest.width) * Number(biggest.height)) {
                  return stream;
                } else {
                  return biggest;
                }
              }, { width: 0, height: 0 });

              if (vstream.width === 0) {
                return next(new Error('No video stream in input, cannot replace %w, %h or %r'));
              }

              var width = Number(vstream.width);
              var height = Number(vstream.height);

              if (fixedWidth) {
                height = height * Number(fixedWidth[1]) / width;
                width = Number(fixedWidth[1]);
              } else if (fixedHeight) {
                width = width * Number(fixedHeight[1]) / height;
                height = Number(fixedHeight[1]);
              } else if (percentSize) {
                width = width * Number(percentSize[1]) / 100;
                height = height * Number(percentSize[1]) / 100;
              }

              next(null, pattern, Math.round(width / 2) * 2, Math.round(height / 2) * 2);
            });
          } else {
            next(null, pattern, -1, -1);
          }
        },

        // Replace size tokens (%w, %h, %r) in pattern
        (pattern, width, height, next) => {
          pattern = pattern
            .replace(/%r/g, '%wx%h')
            .replace(/%w/g, String(width))
            .replace(/%h/g, String(height));

          next(null, pattern);
        },

        // Replace variable tokens in pattern (%s, %i) and generate filename list
        (pattern, next) => {
          var filenames = settings.timemarks.map(function (t, i) {
            return pattern
              .replace(/%s/g, String(utils.timemarkToSeconds(t)))
              .replace(/%(0*)i/g, function (_match, padding: string) {
                var idx = '' + (i + 1);
                return padding.substr(0, Math.max(0, padding.length + 1 - idx.length)) + idx;
              });
          });

          this.emit('filenames', filenames);
          next(null, filenames);
        },

        // Create output directory
        (filenames, next) => {
          fs.exists(settings.folder!, function (exists) {
            if (!exists) {
              fs.mkdir(settings.folder!, function (err) {
                if (err) {
                  next(err);
                } else {
                  next(null, filenames);
                }
              });
            } else {
              next(null, filenames);
            }
          });
        }
      ], (...[err, filenames]) => {
        if (err) {
          return this.emit('error', err);
        }

        // The normalization step has converted every timemark to seconds.
        const seconds = settings.timemarks as number[];
        var count = seconds.length;
        const split: MediaFilterSpec & { outputs: string[] } = {
          filter: 'split',
          options: count,
          outputs: []
        };
        let filters: MediaFilterSpec[] = [split];

        if ('size' in settings) {
          // Set size to generate size filters
          this.size(settings.size!);

          // Get size filters and chain them with 'sizeN' stream names
          var sizeFilters = this._currentOutput.sizeFilters.get().map(function (f, i) {
            if (i > 0) {
              f.inputs = 'size' + (i - 1);
            }

            f.outputs = 'size' + i;

            return f;
          });

          // Input last size filter output into split filter
          split.inputs = 'size' + (sizeFilters.length - 1);

          // Add size filters in front of split filter
          filters = sizeFilters.concat(filters);

          // Remove size filters
          this._currentOutput.sizeFilters.clear();
        }

        var first = 0;
        for (var i = 0; i < count; i++) {
          var stream = 'screen' + i;
          split.outputs.push(stream);

          if (i === 0) {
            first = seconds[i];
            this.seekInput(first);
          }

          this.output(path.join(settings.folder!, filenames[i]))
            .frames(1)
            .map(stream);

          if (i > 0) {
            this.seek(seconds[i] - first);
          }
        }

        this.complexFilter(filters);
        this.run();
      });

      return this;
    };


  /**
   * Merge (concatenate) inputs to a single file
   *
   * @method FfmpegCommand#concat
   * @category Processing
   * @aliases concatenate,mergeToFile
   *
   * @param {String|Writable} target output file or writable stream
   * @param {Object} [options] pipe options (only used when outputting to a writable stream)
   * @return FfmpegCommand
   */
  proto.mergeToFile =
    proto.concatenate =
    proto.concat = function (this: Processor.Command, target: OutputTarget, options?: PipeOptions) {
      // Find out which streams are present in the first non-stream input
      var fileInput = this._inputs.filter(function (input) {
        return !input.isStream;
      })[0];

      this.ffprobe(this._inputs.indexOf(fileInput), (err, result) => {
        if (err) {
          return this.emit('error', err);
        }

        const data = result!;
        var hasAudioStreams = data.streams.some(function (stream) {
          return stream.codec_type === 'audio';
        });

        var hasVideoStreams = data.streams.some(function (stream) {
          return stream.codec_type === 'video';
        });

        // Setup concat filter and start processing
        this.output(target, options)
          .complexFilter({
            filter: 'concat',
            options: {
              n: this._inputs.length,
              v: hasVideoStreams ? 1 : 0,
              a: hasAudioStreams ? 1 : 0
            }
          })
          .run();
      });

      return this;
    };
}

declare namespace recipes {
  export type Prototype = RecipesPrototype;
}

export = recipes;
