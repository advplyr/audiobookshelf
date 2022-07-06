/*jshint node:true*/
'use strict';

/*
 *! Size helpers
 */


/**
 * Return filters to pad video to width*height,
 *
 * @param {Number} width output width
 * @param {Number} height output height
 * @param {Number} aspect video aspect ratio (without padding)
 * @param {Number} color padding color
 * @return scale/pad filters
 * @private
 */
function getScalePadFilters(width, height, aspect, color) {
  /*
    let a be the input aspect ratio, A be the requested aspect ratio

    if a > A, padding is done on top and bottom
    if a < A, padding is done on left and right
   */

  return [
    /*
      In both cases, we first have to scale the input to match the requested size.
      When using computed width/height, we truncate them to multiples of 2
     */
    {
      filter: 'scale',
      options: {
        w: 'if(gt(a,' + aspect + '),' + width + ',trunc(' + height + '*a/2)*2)',
        h: 'if(lt(a,' + aspect + '),' + height + ',trunc(' + width + '/a/2)*2)'
      }
    },

    /*
      Then we pad the scaled input to match the target size
      (here iw and ih refer to the padding input, i.e the scaled output)
     */

    {
      filter: 'pad',
      options: {
        w: width,
        h: height,
        x: 'if(gt(a,' + aspect + '),0,(' + width + '-iw)/2)',
        y: 'if(lt(a,' + aspect + '),0,(' + height + '-ih)/2)',
        color: color
      }
    }
  ];
}


/**
 * Recompute size filters
 *
 * @param {Object} output
 * @param {String} key newly-added parameter name ('size', 'aspect' or 'pad')
 * @param {String} value newly-added parameter value
 * @return filter string array
 * @private
 */
function createSizeFilters(output, key, value) {
  // Store parameters
  var data = output.sizeData = output.sizeData || {};
  data[key] = value;

  if (!('size' in data)) {
    // No size requested, keep original size
    return [];
  }

  // Try to match the different size string formats
  var fixedSize = data.size.match(/([0-9]+)x([0-9]+)/);
  var fixedWidth = data.size.match(/([0-9]+)x\?/);
  var fixedHeight = data.size.match(/\?x([0-9]+)/);
  var percentRatio = data.size.match(/\b([0-9]{1,3})%/);
  var width, height, aspect;

  if (percentRatio) {
    var ratio = Number(percentRatio[1]) / 100;
    return [{
      filter: 'scale',
      options: {
        w: 'trunc(iw*' + ratio + '/2)*2',
        h: 'trunc(ih*' + ratio + '/2)*2'
      }
    }];
  } else if (fixedSize) {
    // Round target size to multiples of 2
    width = Math.round(Number(fixedSize[1]) / 2) * 2;
    height = Math.round(Number(fixedSize[2]) / 2) * 2;

    aspect = width / height;

    if (data.pad) {
      return getScalePadFilters(width, height, aspect, data.pad);
    } else {
      // No autopad requested, rescale to target size
      return [{ filter: 'scale', options: { w: width, h: height }}];
    }
  } else if (fixedWidth || fixedHeight) {
    if ('aspect' in data) {
      // Specified aspect ratio
      width = fixedWidth ? fixedWidth[1] : Math.round(Number(fixedHeight[1]) * data.aspect);
      height = fixedHeight ? fixedHeight[1] : Math.round(Number(fixedWidth[1]) / data.aspect);

      // Round to multiples of 2
      width = Math.round(width / 2) * 2;
      height = Math.round(height / 2) * 2;

      if (data.pad) {
        return getScalePadFilters(width, height, data.aspect, data.pad);
      } else {
        // No autopad requested, rescale to target size
        return [{ filter: 'scale', options: { w: width, h: height }}];
      }
    } else {
      // Keep input aspect ratio

      if (fixedWidth) {
        return [{
          filter: 'scale',
          options: {
            w: Math.round(Number(fixedWidth[1]) / 2) * 2,
            h: 'trunc(ow/a/2)*2'
          }
        }];
      } else {
        return [{
          filter: 'scale',
          options: {
            w: 'trunc(oh*a/2)*2',
            h: Math.round(Number(fixedHeight[1]) / 2) * 2
          }
        }];
      }
    }
  } else {
    throw new Error('Invalid size specified: ' + data.size);
  }
}


/*
 *! Video size-related methods
 */

module.exports = function(proto) {
  /**
   * Keep display aspect ratio
   *
   * This method is useful when converting an input with non-square pixels to an output format
   * that does not support non-square pixels.  It rescales the input so that the display aspect
   * ratio is the same.
   *
   * @method FfmpegCommand#keepDAR
   * @category Video size
   * @aliases keepPixelAspect,keepDisplayAspect,keepDisplayAspectRatio
   *
   * @return FfmpegCommand
   */
  proto.keepPixelAspect = // Only for compatibility, this is not about keeping _pixel_ aspect ratio
  proto.keepDisplayAspect =
  proto.keepDisplayAspectRatio =
  proto.keepDAR = function() {
    return this.videoFilters([
      {
        filter: 'scale',
        options: {
          w: 'if(gt(sar,1),iw*sar,iw)',
          h: 'if(lt(sar,1),ih/sar,ih)'
        }
      },
      {
        filter: 'setsar',
        options: '1'
      }
    ]);
  };


  /**
   * Set output size
   *
   * The 'size' parameter can have one of 4 forms:
   * - 'X%': rescale to xx % of the original size
   * - 'WxH': specify width and height
   * - 'Wx?': specify width and compute height from input aspect ratio
   * - '?xH': specify height and compute width from input aspect ratio
   *
   * Note: both dimensions will be truncated to multiples of 2.
   *
   * @method FfmpegCommand#size
   * @category Video size
   * @aliases withSize,setSize
   *
   * @param {String} size size string, eg. '33%', '320x240', '320x?', '?x240'
   * @return FfmpegCommand
   */
  proto.withSize =
  proto.setSize =
  proto.size = function(size) {
    var filters = createSizeFilters(this._currentOutput, 'size', size);

    this._currentOutput.sizeFilters.clear();
    this._currentOutput.sizeFilters(filters);

    return this;
  };


  /**
   * Set output aspect ratio
   *
   * @method FfmpegCommand#aspect
   * @category Video size
   * @aliases withAspect,withAspectRatio,setAspect,setAspectRatio,aspectRatio
   *
   * @param {String|Number} aspect aspect ratio (number or 'X:Y' string)
   * @return FfmpegCommand
   */
  proto.withAspect =
  proto.withAspectRatio =
  proto.setAspect =
  proto.setAspectRatio =
  proto.aspect =
  proto.aspectRatio = function(aspect) {
    var a = Number(aspect);
    if (isNaN(a)) {
      var match = aspect.match(/^(\d+):(\d+)$/);
      if (match) {
        a = Number(match[1]) / Number(match[2]);
      } else {
        throw new Error('Invalid aspect ratio: ' + aspect);
      }
    }

    var filters = createSizeFilters(this._currentOutput, 'aspect', a);

    this._currentOutput.sizeFilters.clear();
    this._currentOutput.sizeFilters(filters);

    return this;
  };


  /**
   * Enable auto-padding the output
   *
   * @method FfmpegCommand#autopad
   * @category Video size
   * @aliases applyAutopadding,applyAutoPadding,applyAutopad,applyAutoPad,withAutopadding,withAutoPadding,withAutopad,withAutoPad,autoPad
   *
   * @param {Boolean} [pad=true] enable/disable auto-padding
   * @param {String} [color='black'] pad color
   */
  proto.applyAutopadding =
  proto.applyAutoPadding =
  proto.applyAutopad =
  proto.applyAutoPad =
  proto.withAutopadding =
  proto.withAutoPadding =
  proto.withAutopad =
  proto.withAutoPad =
  proto.autoPad =
  proto.autopad = function(pad, color) {
    // Allow autopad(color)
    if (typeof pad === 'string') {
      color = pad;
      pad = true;
    }

    // Allow autopad() and autopad(undefined, color)
    if (typeof pad === 'undefined') {
      pad = true;
    }

    var filters = createSizeFilters(this._currentOutput, 'pad', pad ? color || 'black' : false);

    this._currentOutput.sizeFilters.clear();
    this._currentOutput.sizeFilters(filters);

    return this;
  };
};
