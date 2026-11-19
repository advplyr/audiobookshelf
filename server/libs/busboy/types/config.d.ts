import type { IncomingHttpHeaders } from 'node:http';
import type utils from '../utils';

export type ContentType = NonNullable<ReturnType<typeof utils.parseContentType>>;

export interface BusboyOptions {
  limits?: {
    fieldNameSize?: number;
    fieldSize?: number;
    fields?: number;
    fileSize?: number;
    files?: number;
    parts?: number;
    headerPairs?: number;
  };
  highWaterMark?: number;
  fileHwm?: number;
  defCharset?: string;
  defParamCharset?: string;
  preservePath?: boolean;
}

export interface ParserConfig extends BusboyOptions {
  headers: IncomingHttpHeaders;
  conType: ContentType;
}

// Busboy calls Node's internal Buffer method to decode raw header bytes.
export interface Latin1Buffer extends Buffer {
  latin1Slice(start: number, end: number): string;
}
