/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-compress-commons/blob/master/LICENSE-MIT
 */
const util = {
  dateToDos(d: Date, forceLocalTime?: boolean) {
    forceLocalTime = forceLocalTime || false;

    var year = forceLocalTime ? d.getFullYear() : d.getUTCFullYear();

    if (year < 1980) {
      return 2162688; // 1980-1-1 00:00:00
    } else if (year >= 2044) {
      return 2141175677; // 2043-12-31 23:59:58
    }

    var val = {
      year: year,
      month: forceLocalTime ? d.getMonth() : d.getUTCMonth(),
      date: forceLocalTime ? d.getDate() : d.getUTCDate(),
      hours: forceLocalTime ? d.getHours() : d.getUTCHours(),
      minutes: forceLocalTime ? d.getMinutes() : d.getUTCMinutes(),
      seconds: forceLocalTime ? d.getSeconds() : d.getUTCSeconds()
    };

    return ((val.year - 1980) << 25) | ((val.month + 1) << 21) | (val.date << 16) |
      (val.hours << 11) | (val.minutes << 5) | (val.seconds / 2);
  },

  dosToDate(dos: number) {
    return new Date(((dos >> 25) & 0x7f) + 1980, ((dos >> 21) & 0x0f) - 1, (dos >> 16) & 0x1f, (dos >> 11) & 0x1f, (dos >> 5) & 0x3f, (dos & 0x1f) << 1);
  },

  fromDosTime(buf: Buffer) {
    return util.dosToDate(buf.readUInt32LE(0));
  },

  getEightBytes(v: number) {
    var buf = Buffer.alloc(8);
    buf.writeUInt32LE(v % 0x0100000000, 0);
    buf.writeUInt32LE((v / 0x0100000000) | 0, 4);

    return buf;
  },

  getShortBytes(v: number) {
    var buf = Buffer.alloc(2);
    buf.writeUInt16LE((v & 0xFFFF) >>> 0, 0);

    return buf;
  },

  getShortBytesValue(buf: Buffer, offset?: number) {
    return buf.readUInt16LE(offset);
  },

  getLongBytes(v: number) {
    var buf = Buffer.alloc(4);
    buf.writeUInt32LE((v & 0xFFFFFFFF) >>> 0, 0);

    return buf;
  },

  getLongBytesValue(buf: Buffer, offset?: number) {
    return buf.readUInt32LE(offset);
  },

  toDosTime(d: Date) {
    return util.getLongBytes(util.dateToDos(d));
  }
};

export = util;
