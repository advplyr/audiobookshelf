'use strict';
const fileType = require('./fileType');

const imageExts = new Set([
  'jpg',
  'png',
  'gif',
  'webp',
  'flif',
  'cr2',
  'tif',
  'bmp',
  'jxr',
  'psd',
  'ico',
  'bpg',
  'jp2',
  'jpm',
  'jpx',
  'heic',
  'cur',
  'dcm'
]);

const imageType = input => {
  const ret = fileType(input);
  return imageExts.has(ret && ret.ext) ? ret : null;
};

module.exports = imageType;
// TODO: Remove this for the next major release
module.exports.default = imageType;

Object.defineProperty(imageType, 'minimumBytes', { value: fileType.minimumBytes });
