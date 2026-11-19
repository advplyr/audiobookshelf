/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-compress-commons/blob/master/LICENSE-MIT
 */
interface ArchiveEntry {
  getName(): string | null | undefined;
  getSize(): number | undefined;
  getLastModifiedDate(): Date | number | undefined;
  isDirectory(): boolean | undefined;
}

const constructor: unknown = function ArchiveEntry() {};
const ArchiveEntry = constructor as {
  new (): ArchiveEntry;
  (this: ArchiveEntry): void;
  prototype: ArchiveEntry;
};

ArchiveEntry.prototype.getName = function() { return undefined; };

ArchiveEntry.prototype.getSize = function() { return undefined; };

ArchiveEntry.prototype.getLastModifiedDate = function() { return undefined; };

ArchiveEntry.prototype.isDirectory = function() { return undefined; };

export = ArchiveEntry;
