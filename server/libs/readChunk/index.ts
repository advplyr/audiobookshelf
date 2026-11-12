// https://github.com/sindresorhus/read-chunk

import fs from 'node:fs';
import type { PathLike, ReadPosition } from 'node:fs';
import pify from './pify';
import withOpenFile from './withOpenFile';

// Select the positional fs.read overload that returns bytesRead and the supplied buffer.
const read: (fd: number, buffer: Buffer, offset: number, length: number, position: ReadPosition | null, callback: (error: NodeJS.ErrnoException | null, bytesRead: number, buffer: Buffer) => void) => void = fs.read;
const fsReadP = pify(read, { multiArgs: true });

const readChunk = (filePath: PathLike, startPosition: ReadPosition | null, length: number) => {
  const buffer = Buffer.alloc(length);

  return withOpenFile(filePath, 'r', fileDescriptor =>
    fsReadP(fileDescriptor, buffer, 0, length, startPosition)
  )
    .then(([bytesRead, buffer]) => {
      if (bytesRead < length) {
        buffer = buffer.slice(0, bytesRead);
      }

      return buffer;
    });
};

const sync = (filePath: PathLike, startPosition: number | null, length: number) => {
  let buffer = Buffer.alloc(length);

  const bytesRead = withOpenFile.sync(filePath, 'r', fileDescriptor =>
    fs.readSync(fileDescriptor, buffer, 0, length, startPosition)
  );

  if (bytesRead < length) {
    buffer = buffer.slice(0, bytesRead);
  }

  return buffer;
};

// TODO: Remove the default alias for the next major release.
export = Object.assign(readChunk, { default: readChunk, sync });
