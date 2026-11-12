import fileType from './fileType';

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

const imageType = (input: unknown) => {
  const ret = fileType(input);
  return ret && imageExts.has(ret.ext) ? ret : null;
};

// TODO: Remove this for the next major release
const detector = Object.assign(imageType, { default: imageType });

Object.defineProperty(imageType, 'minimumBytes', { value: fileType.minimumBytes });

export = detector as typeof detector & { readonly minimumBytes: number };
