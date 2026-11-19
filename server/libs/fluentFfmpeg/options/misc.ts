import { createRequire } from 'node:module';
import path from 'node:path';
import type Ffmpeg from '../../fluentFfmpeg';

const load = createRequire(__filename);
type PresetCommand = Ffmpeg.FfmpegCommand & { options: { presets: string } };

/*
 *! Miscellaneous methods
 */

function install(proto: Ffmpeg.FfmpegCommand) {
  /**
   * Use preset
   *
   * @method FfmpegCommand#preset
   * @category Miscellaneous
   * @aliases usingPreset
   *
   * @param {String|Function} preset preset name or preset function
   */
  proto.usingPreset =
  proto.preset = function(this: PresetCommand, preset: string | Ffmpeg.PresetFunction) {
    if (typeof preset === 'function') {
      preset(this);
    } else {
      let modulePath: string | undefined;
      try {
        modulePath = path.join(this.options.presets, preset);
        const module = load(modulePath) as { load?: Ffmpeg.PresetFunction };

        if (typeof module.load === 'function') {
          module.load(this);
        } else {
          throw new Error('preset ' + modulePath + ' has no load() function');
        }
      } catch (err) {
        throw new Error('preset ' + modulePath + ' could not be loaded: ' + (err as Error).message);
      }
    }

    return this;
  };
}

export = install;
