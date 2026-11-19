import type Ffmpeg from '../../fluentFfmpeg';
import utils from '../utils';
import type { CommandWithMediaOutput, MediaFilter } from './types';

/*
 *! Audio-related methods
 */

function install(proto: Ffmpeg.FfmpegCommand) {
  /**
   * Disable audio in the output
   *
   * @method FfmpegCommand#noAudio
   * @category Audio
   * @aliases withNoAudio
   * @return FfmpegCommand
   */
  proto.withNoAudio =
  proto.noAudio = function(this: CommandWithMediaOutput) {
    this._currentOutput.audio.clear();
    this._currentOutput.audioFilters.clear();
    this._currentOutput.audio('-an');

    return this;
  };


  /**
   * Specify audio codec
   *
   * @method FfmpegCommand#audioCodec
   * @category Audio
   * @aliases withAudioCodec
   *
   * @param {String} codec audio codec name
   * @return FfmpegCommand
   */
  proto.withAudioCodec =
  proto.audioCodec = function(this: CommandWithMediaOutput, codec: string) {
    this._currentOutput.audio('-acodec', codec);

    return this;
  };


  /**
   * Specify audio bitrate
   *
   * @method FfmpegCommand#audioBitrate
   * @category Audio
   * @aliases withAudioBitrate
   *
   * @param {String|Number} bitrate audio bitrate in kbps (with an optional 'k' suffix)
   * @return FfmpegCommand
   */
  proto.withAudioBitrate =
  proto.audioBitrate = function(this: CommandWithMediaOutput, bitrate: string | number) {
    this._currentOutput.audio('-b:a', ('' + bitrate).replace(/k?$/, 'k'));
    return this;
  };


  /**
   * Specify audio channel count
   *
   * @method FfmpegCommand#audioChannels
   * @category Audio
   * @aliases withAudioChannels
   *
   * @param {Number} channels channel count
   * @return FfmpegCommand
   */
  proto.withAudioChannels =
  proto.audioChannels = function(this: CommandWithMediaOutput, channels: number) {
    this._currentOutput.audio('-ac', channels);
    return this;
  };


  /**
   * Specify audio frequency
   *
   * @method FfmpegCommand#audioFrequency
   * @category Audio
   * @aliases withAudioFrequency
   *
   * @param {Number} freq audio frequency in Hz
   * @return FfmpegCommand
   */
  proto.withAudioFrequency =
  proto.audioFrequency = function(this: CommandWithMediaOutput, freq: number) {
    this._currentOutput.audio('-ar', freq);
    return this;
  };


  /**
   * Specify audio quality
   *
   * @method FfmpegCommand#audioQuality
   * @category Audio
   * @aliases withAudioQuality
   *
   * @param {Number} quality audio quality factor
   * @return FfmpegCommand
   */
  proto.withAudioQuality =
  proto.audioQuality = function(this: CommandWithMediaOutput, quality: number) {
    this._currentOutput.audio('-aq', quality);
    return this;
  };


  /**
   * Specify custom audio filter(s)
   *
   * Can be called both with one or many filters, or a filter array.
   *
   * @example
   * command.audioFilters('filter1');
   *
   * @example
   * command.audioFilters('filter1', 'filter2=param1=value1:param2=value2');
   *
   * @example
   * command.audioFilters(['filter1', 'filter2']);
   *
   * @example
   * command.audioFilters([
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
   * command.audioFilters(
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
   * @method FfmpegCommand#audioFilters
   * @aliases withAudioFilter,withAudioFilters,audioFilter
   * @category Audio
   *
   * @param {...String|String[]|Object[]} filters audio filter strings, string array or
   *   filter specification array, each with the following properties:
   * @param {String} filters.filter filter name
   * @param {String|String[]|Object} [filters.options] filter option string, array, or object
   * @return FfmpegCommand
   */
  proto.withAudioFilter =
  proto.withAudioFilters =
  proto.audioFilter =
  proto.audioFilters = function(this: CommandWithMediaOutput, filters: MediaFilter | MediaFilter[], ...more: MediaFilter[]) {
    const list = more.length ? [filters as MediaFilter, ...more] : Array.isArray(filters) ? filters : [filters];

    this._currentOutput.audioFilters(utils.makeFilterStrings(list));
    return this;
  };
}

export = install;
