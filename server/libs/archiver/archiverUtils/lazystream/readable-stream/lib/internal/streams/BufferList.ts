import { createRequire } from 'node:module';
import util from 'node:util';

interface Entry<Chunk = unknown> {
  data: Chunk;
  next: Entry<Chunk> | null;
}

interface BufferList {
  head: Entry | null;
  tail: Entry | null;
  length: number;
  push(value: unknown): void;
  unshift(value: unknown): void;
  shift(): unknown;
  clear(): void;
  join(separator: string): string;
  concat(size: number): Buffer;
  [util.inspect.custom](): string;
}

const { Buffer } = createRequire(__filename)('../../../../../safeBuffer') as Pick<typeof import('node:buffer'), 'Buffer'>;

function copyBuffer(src: Buffer, target: Buffer, offset: number) {
  src.copy(target, offset);
}

const BufferList = function () {
  const BufferList = function (this: BufferList) {
    if (!(this instanceof BufferList)) { throw new TypeError("Cannot call a class as a function"); }

    this.head = null;
    this.tail = null;
    this.length = 0;
  } as unknown as { new (): BufferList; prototype: BufferList };

  BufferList.prototype.push = function push(v) {
    var entry: Entry = { data: v, next: null };
    if (this.length > 0) this.tail!.next = entry; else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    const head = this.head!;
    var ret = head.data;
    if (this.length === 1) this.head = this.tail = null; else this.head = head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head as Entry<string> | null;
    var ret = '' + p!.data;
    while (p = p!.next) {
      ret += s + p.data;
    } return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head!.data as Buffer;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      const chunk = p.data as Buffer;
      copyBuffer(chunk, ret, i);
      i += chunk.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();

if (util && util.inspect && util.inspect.custom) {
  BufferList.prototype[util.inspect.custom] = function () {
    var obj = util.inspect({ length: this.length });
    return this.constructor.name + ' ' + obj;
  };
}

export = BufferList;
