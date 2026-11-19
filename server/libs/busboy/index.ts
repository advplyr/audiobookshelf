//
// used by expressFileUpload
// Source: https://github.com/mscdex/busboy
//

import type { IncomingHttpHeaders } from 'node:http';
import utils from './utils.js';
import Multipart from './types/multipart';
import URLEncoded from './types/urlencoded';
import type { BusboyOptions, ParserConfig } from './types/config';

type Config = BusboyOptions & { headers?: IncomingHttpHeaders };
type ConfigWithContentType = BusboyOptions & { headers: IncomingHttpHeaders & { 'content-type': string } };

const { parseContentType } = utils;

function getInstance(cfg: ConfigWithContentType) {
  const headers = cfg.headers;
  const conType = parseContentType(headers['content-type']);
  if (!conType)
    throw new Error('Malformed content type');

  for (const type of TYPES) {
    const matched = type.detect(conType);
    if (!matched)
      continue;

    const instanceCfg: ParserConfig = {
      limits: cfg.limits,
      headers,
      conType,
      highWaterMark: undefined,
      fileHwm: undefined,
      defCharset: undefined,
      defParamCharset: undefined,
      preservePath: false,
    };
    if (cfg.highWaterMark)
      instanceCfg.highWaterMark = cfg.highWaterMark;
    if (cfg.fileHwm)
      instanceCfg.fileHwm = cfg.fileHwm;
    instanceCfg.defCharset = cfg.defCharset;
    instanceCfg.defParamCharset = cfg.defParamCharset;
    instanceCfg.preservePath = cfg.preservePath;
    return new type(instanceCfg);
  }

  throw new Error(`Unsupported content type: ${headers['content-type']}`);
}

// Note: types are explicitly listed here for easier bundling
// See: https://github.com/mscdex/busboy/issues/121
const TYPES = [
  Multipart,
  URLEncoded,
].filter(function (typemod) { return typeof typemod.detect === 'function'; });

export = (cfg?: Config | null) => {
  if (typeof cfg !== 'object' || cfg === null)
    cfg = {};

  if (typeof cfg.headers !== 'object'
    || cfg.headers === null
    || typeof cfg.headers['content-type'] !== 'string') {
    throw new Error('Missing Content-Type');
  }

  return getInstance(cfg as ConfigWithContentType);
};
