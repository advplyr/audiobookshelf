import path from 'node:path';
import type { RequestHandler } from 'express';
import isEligibleRequest from './isEligibleRequest';
import processMultipart from './processMultipart';
import utilities from './utilities';
import '../busboy';

const { buildOptions, debugLog } = utilities;
type UploadOptions = Parameters<typeof processMultipart>[0];

const DEFAULT_OPTIONS = {
  debug: false,
  uploadTimeout: 60000,
  fileHandler: false,
  uriDecodeFileNames: false,
  safeFileNames: false,
  preserveExtension: false,
  abortOnLimit: false,
  responseOnLimit: 'File size limit has been reached',
  limitHandler: false,
  createParentPath: false,
  parseNested: false,
  useTempFiles: false,
  tempFileDir: path.join(process.cwd(), 'tmp')
};

/**
 * Expose the file upload middleware
 * @param {DEFAULT_OPTIONS & busboy.BusboyConfig} options - Middleware options.
 * @returns {Function} - express-fileupload middleware.
 */
export = (options?: Partial<UploadOptions> | null): RequestHandler => {
  const uploadOptions = buildOptions(DEFAULT_OPTIONS, options) as ReturnType<typeof buildOptions> & UploadOptions;
  return (req, res, next) => {
    if (!isEligibleRequest(req)) {
      debugLog(uploadOptions, 'Request is not eligible for file upload!');
      return next();
    }
    processMultipart(uploadOptions, req, res, next);
  };
};
