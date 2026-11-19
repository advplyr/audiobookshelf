import type Ffmpeg from '../../fluentFfmpeg';
import utils from '../utils';
import type { CommandWithMediaOutput, MediaFilter } from './types';

/*
 *! Video-related methods
 */

function install(proto: Ffmpeg.FfmpegCommand) {
  /**
   * Disable video in the output
   *
   * @method FfmpegCommand#noVideo
   * @category Video
   * @aliases withNoVideo
   *
   * @return FfmpegCommand
   */
  proto.withNoVideo =
  proto.noVideo = function(this: CommandWithMediaOutput) {
    this._currentOutput.video.clear();
    this._currentOutput.videoFilters.clear();
    this._currentOutput.video('-vn');

    return this;
  };


  /**
   * Specify video codec
   *
   * @method FfmpegCommand#videoCodec
   * @category Video
   * @aliases withVideoCodec
   *
   * @param {String} codec video codec name
   * @return FfmpegCommand
   */
  proto.withVideoCodec =
  proto.videoCodec = function(this: CommandWithMediaOutput, codec: string) {
    this._currentOutput.video('-vcodec', codec);
    return this;
  };


  /**
   * Specify video bitrate
   *
   * @method FfmpegCommand#videoBitrate
   * @category Video
   * @aliases withVideoBitrate
   *
   * @param {String|Number} bitrate video bitrate in kbps (with an optional 'k' suffix)
   * @param {Boolean} [constant=false] enforce constant bitrate
   * @return FfmpegCommand
   */
  proto.withVideoBitrate =
  proto.videoBitrate = function(this: CommandWithMediaOutput, bitrate: string | number, constant?: boolean) {
    bitrate = ('' + bitrate).replace(/k?$/, 'k');

    this._currentOutput.video('-b:v', bitrate);
    if (constant) {
      this._currentOutput.video(
        '-maxrate', bitrate,
        '-minrate', bitrate,
        '-bufsize', '3M'
      );
    }

    return this;
  };


  /**
   * Specify custom video filter(s)
   *
   * Can be called both with one or many filters, or a filter array.
   *
   * @example
   * command.videoFilters('filter1');
   *
   * @example
   * command.videoFilters('filter1', 'filter2=param1=value1:param2=value2');
   *
   * @example
   * command.videoFilters(['filter1', 'filter2']);
   *
   * @example
   * command.videoFilters([
   *   {
   *     filter: 'filter1'
   *   },
   *   {
   *     filter: 'filter2',
   *     options: 'param=value:param=value'
   *   }
   * ]);
   *
   * @example
   * command.videoFilters(
   *   {
   *     filter: 'filter1',
   *     options: ['value1', 'value2']
   *   },
   *   {
   *     filter: 'filter2',
   *     options: { param1: 'value1', param2: 'value2' }
   *   }
   * );
   *
   * @method FfmpegCommand#videoFilters
   * @category Video
   * @aliases withVideoFilter,withVideoFilters,videoFilter
   *
   * @param {...String|String[]|Object[]} filters video filter strings, string array or
   *   filter specification array, each with the following properties:
   * @param {String} filters.filter filter name
   * @param {String|String[]|Object} [filters.options] filter option string, array, or object
   * @return FfmpegCommand
   */
  proto.withVideoFilter =
  proto.withVideoFilters =
  proto.videoFilter =
  proto.videoFilters = function(this: CommandWithMediaOutput, filters: MediaFilter | MediaFilter[], ...more: MediaFilter[]) {
    const list = more.length ? [filters, ...more] : Array.isArray(filters) ? filters : [filters];

    this._currentOutput.videoFilters(utils.makeFilterStrings(list));

    return this;
  };


  /**
   * Specify output FPS
   *
   * @method FfmpegCommand#fps
   * @category Video
   * @aliases withOutputFps,withOutputFPS,withFpsOutput,withFPSOutput,withFps,withFPS,outputFPS,outputFps,fpsOutput,FPSOutput,FPS
   *
   * @param {Number} fps output FPS
   * @return FfmpegCommand
   */
  proto.withOutputFps =
  proto.withOutputFPS =
  proto.withFpsOutput =
  proto.withFPSOutput =
  proto.withFps =
  proto.withFPS =
  proto.outputFPS =
  proto.outputFps =
  proto.fpsOutput =
  proto.FPSOutput =
  proto.fps =
  proto.FPS = function(this: CommandWithMediaOutput, fps: number) {
    this._currentOutput.video('-r', fps);
    return this;
  };


  /**
   * Only transcode a certain number of frames
   *
   * @method FfmpegCommand#frames
   * @category Video
   * @aliases takeFrames,withFrames
   *
   * @param {Number} frames frame count
   * @return FfmpegCommand
   */
  proto.takeFrames =
  proto.withFrames =
  proto.frames = function(this: CommandWithMediaOutput, frames: number) {
    this._currentOutput.video('-vframes', frames);
    return this;
  };
}

export = install;
