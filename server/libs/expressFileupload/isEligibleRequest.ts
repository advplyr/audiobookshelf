import type { IncomingHttpHeaders } from 'node:http';

interface UploadRequest {
  headers: IncomingHttpHeaders;
  method?: string;
}

const ACCEPTABLE_CONTENT_TYPE = /^(multipart\/.+);(.*)$/i;
const UNACCEPTABLE_METHODS: readonly (string | undefined)[] = ['GET', 'HEAD'];

/**
 * Ensures the request contains a content body
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasBody = (req: UploadRequest) => {
  return ('transfer-encoding' in req.headers) ||
    ('content-length' in req.headers && req.headers['content-length'] !== '0');
};

/**
 * Ensures the request is not using a non-compliant multipart method
 * such as GET or HEAD
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
const hasAcceptableMethod = (req: UploadRequest) => !UNACCEPTABLE_METHODS.includes(req.method);

/**
 * Ensures that only multipart requests are processed by express-fileupload
 * @param  {Object}  req Express req object
 * @returns {Boolean}
 */
// RegExp.test coerces an absent header to a string, which does not match.
const hasAcceptableContentType = (req: UploadRequest) => ACCEPTABLE_CONTENT_TYPE.test(req.headers['content-type'] as string);

/**
 * Ensures that the request in question is eligible for file uploads
 * @param {Object} req Express req object
 * @returns {Boolean}
 */
export = (req: UploadRequest) => hasBody(req) && hasAcceptableMethod(req) && hasAcceptableContentType(req);
