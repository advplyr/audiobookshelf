/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-compress-commons/blob/master/LICENSE-MIT
 */
import zipUtil from './util';

var DATA_DESCRIPTOR_FLAG = 1 << 3;
var ENCRYPTION_FLAG = 1 << 0;
var NUMBER_OF_SHANNON_FANO_TREES_FLAG = 1 << 2;
var SLIDING_DICTIONARY_SIZE_FLAG = 1 << 1;
var STRONG_ENCRYPTION_FLAG = 1 << 6;
var UFT8_NAMES_FLAG = 1 << 11;

interface GeneralPurposeBit {
  descriptor: boolean;
  encryption: boolean;
  utf8: boolean;
  numberOfShannonFanoTrees: number;
  strongEncryption: boolean;
  slidingDictionarySize: number;
  encode(): Buffer;
  parse(buffer: Buffer, offset?: number): GeneralPurposeBit;
  setNumberOfShannonFanoTrees(value: number): void;
  getNumberOfShannonFanoTrees(): number;
  setSlidingDictionarySize(value: number): void;
  getSlidingDictionarySize(): number;
  useDataDescriptor(enabled: boolean): void;
  usesDataDescriptor(): boolean;
  useEncryption(enabled: boolean): void;
  usesEncryption(): boolean;
  useStrongEncryption(enabled: boolean): void;
  usesStrongEncryption(): boolean;
  useUTF8ForNames(enabled: boolean): void;
  usesUTF8ForNames(): boolean;
}

const constructor: unknown = function GeneralPurposeBit(this: GeneralPurposeBit) {
  if (!(this instanceof createFlags)) {
    return new createFlags();
  }

  this.descriptor = false;
  this.encryption = false;
  this.utf8 = false;
  this.numberOfShannonFanoTrees = 0;
  this.strongEncryption = false;
  this.slidingDictionarySize = 0;

  return this;
};

const createFlags = constructor as {
  new (): GeneralPurposeBit;
  (): GeneralPurposeBit;
  prototype: GeneralPurposeBit;
};

createFlags.prototype.encode = function() {
  return zipUtil.getShortBytes(
    (this.descriptor ? DATA_DESCRIPTOR_FLAG : 0) |
    (this.utf8 ? UFT8_NAMES_FLAG : 0) |
    (this.encryption ? ENCRYPTION_FLAG : 0) |
    (this.strongEncryption ? STRONG_ENCRYPTION_FLAG : 0)
  );
};

createFlags.prototype.parse = function(buf: Buffer, offset?: number) {
  var flag = zipUtil.getShortBytesValue(buf, offset);
  var gbp = new createFlags();

  gbp.useDataDescriptor((flag & DATA_DESCRIPTOR_FLAG) !== 0);
  gbp.useUTF8ForNames((flag & UFT8_NAMES_FLAG) !== 0);
  gbp.useStrongEncryption((flag & STRONG_ENCRYPTION_FLAG) !== 0);
  gbp.useEncryption((flag & ENCRYPTION_FLAG) !== 0);
  gbp.setSlidingDictionarySize((flag & SLIDING_DICTIONARY_SIZE_FLAG) !== 0 ? 8192 : 4096);
  gbp.setNumberOfShannonFanoTrees((flag & NUMBER_OF_SHANNON_FANO_TREES_FLAG) !== 0 ? 3 : 2);

  return gbp;
};

createFlags.prototype.setNumberOfShannonFanoTrees = function(n) {
  this.numberOfShannonFanoTrees = n;
};

createFlags.prototype.getNumberOfShannonFanoTrees = function() {
  return this.numberOfShannonFanoTrees;
};

createFlags.prototype.setSlidingDictionarySize = function(n) {
  this.slidingDictionarySize = n;
};

createFlags.prototype.getSlidingDictionarySize = function() {
  return this.slidingDictionarySize;
};

createFlags.prototype.useDataDescriptor = function(b) {
  this.descriptor = b;
};

createFlags.prototype.usesDataDescriptor = function() {
  return this.descriptor;
};

createFlags.prototype.useEncryption = function(b) {
  this.encryption = b;
};

createFlags.prototype.usesEncryption = function() {
  return this.encryption;
};

createFlags.prototype.useStrongEncryption = function(b) {
  this.strongEncryption = b;
};

createFlags.prototype.usesStrongEncryption = function() {
  return this.strongEncryption;
};

createFlags.prototype.useUTF8ForNames = function(b) {
  this.utf8 = b;
};

createFlags.prototype.usesUTF8ForNames = function() {
  return this.utf8;
};

export = createFlags;
