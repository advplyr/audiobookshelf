/*
 date-and-time (c) KNOWLEDGECODE | MIT
*/

interface Resources {
  MMMM: string[];
  MMM: string[];
  dddd: string[];
  ddd: string[];
  dd: string[];
  A: string[];
}

interface ParsedToken {
  value: number;
  length: number;
  token?: string;
}

interface ParsedDate extends Record<string, number> {
  Y: number;
  M: number;
  D: number;
  H: number;
  A: number;
  h: number;
  m: number;
  s: number;
  S: number;
  Z: number;
  _index: number;
  _length: number;
  _match: number;
}

interface Formatter {
  res: Resources;
  post(value: string): string;
}

interface Parser {
  res: Resources;
  h12(hour: number, period: number): number;
  exec(pattern: RegExp, value: string): ParsedToken;
  find(values: string[], input: string): ParsedToken;
  pre(value: string): string;
}

type FormatToken = (this: Formatter, date: Date, pattern: string) => string;
type ParseToken = (this: Parser, value: string, pattern: string) => ParsedToken;
type Format = string | string[];
type Duration = { toMilliseconds(): number; toSeconds(): number; toMinutes(): number; toHours(): number; toDays(): number };

interface DateMethods {
  _formatter: Formatter;
  _parser: Parser;
  compile(pattern: string): string[];
  format(this: DateMethods | void, value: Date, format: Format, utc?: boolean): string;
  preparse(this: DateMethods | void, value: string, format: Format): ParsedDate;
  parse(this: DateMethods | void, value: string, format: Format, utc?: boolean): Date;
  isValid(this: DateMethods | void, value: string | ParsedDate, format?: Format): boolean;
  transform(this: DateMethods | void, value: string, from: Format, to: Format, utc?: boolean): string;
  addYears(this: DateMethods | void, date: Date, amount: number): Date;
  addMonths(date: Date, amount: number): Date;
  addDays(date: Date, amount: number): Date;
  addHours(this: DateMethods | void, date: Date, amount: number): Date;
  addMinutes(this: DateMethods | void, date: Date, amount: number): Date;
  addSeconds(this: DateMethods | void, date: Date, amount: number): Date;
  addMilliseconds(date: Date, amount: number): Date;
  subtract(left: Date, right: Date): Duration;
  isLeapYear(year: number): boolean;
  isSameDay(left: Date, right: Date): boolean;
}

interface Extension {
  res?: Partial<Resources>;
  formatter?: Record<string, FormatToken>;
  parser?: Record<string, ParseToken>;
  extender?: Record<string, unknown>;
}

interface Workshop extends DateMethods {
  locale(name: string, extension: Extension): void;
  plugin(name: string, extension: Extension): void;
}

type Locale = (workshop: Workshop) => string;
type Plugin = (workshop: Workshop, environment: Workshop) => string;

interface DateApi extends DateMethods {
  locale(selection?: string | Locale): string;
  plugin(selection: string | Plugin): void;
  extend(extension: Extension): void;
}

const locales: Record<string, Extension | undefined> = {};
const plugins: Record<string, Extension | undefined> = {};
let activeLocale = 'en';
const resources = {
  MMMM: 'January February March April May June July August September October November December'.split(' '),
  MMM: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
  dddd: 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' '),
  ddd: 'Sun Mon Tue Wed Thu Fri Sat'.split(' '),
  dd: 'Su Mo Tu We Th Fr Sa'.split(' '),
  A: ['AM', 'PM']
};

const formatter = {
  YYYY: function (date: Date) { return ('000' + date.getFullYear()).slice(-4); },
  YY: function (date: Date) { return ('0' + date.getFullYear()).slice(-2); },
  Y: function (date: Date) { return '' + date.getFullYear(); },
  MMMM: function (this: Formatter, date: Date) { return this.res.MMMM[date.getMonth()]; },
  MMM: function (this: Formatter, date: Date) { return this.res.MMM[date.getMonth()]; },
  MM: function (date: Date) { return ('0' + (date.getMonth() + 1)).slice(-2); },
  M: function (date: Date) { return '' + (date.getMonth() + 1); },
  DD: function (date: Date) { return ('0' + date.getDate()).slice(-2); },
  D: function (date: Date) { return '' + date.getDate(); },
  HH: function (date: Date) { return ('0' + date.getHours()).slice(-2); },
  H: function (date: Date) { return '' + date.getHours(); },
  A: function (this: Formatter, date: Date) { return this.res.A[(11 < date.getHours()) ? 1 : 0]; },
  hh: function (date: Date) { return ('0' + (date.getHours() % 12 || 12)).slice(-2); },
  h: function (date: Date) { return '' + (date.getHours() % 12 || 12); },
  mm: function (date: Date) { return ('0' + date.getMinutes()).slice(-2); },
  m: function (date: Date) { return '' + date.getMinutes(); },
  ss: function (date: Date) { return ('0' + date.getSeconds()).slice(-2); },
  s: function (date: Date) { return '' + date.getSeconds(); },
  SSS: function (date: Date) { return ('00' + date.getMilliseconds()).slice(-3); },
  SS: function (date: Date) { return ('0' + (date.getMilliseconds() / 10 | 0)).slice(-2); },
  S: function (date: Date) { return '' + (date.getMilliseconds() / 100 | 0); },
  dddd: function (this: Formatter, date: Date) { return this.res.dddd[date.getDay()]; },
  ddd: function (this: Formatter, date: Date) { return this.res.ddd[date.getDay()]; },
  dd: function (this: Formatter, date: Date) { return this.res.dd[date.getDay()]; },
  Z: function (date: Date) {
    const offset = date.getTimezoneOffset() / .6 | 0;
    return (0 < offset ? '-' : '+') + ('000' + Math.abs(offset - (offset % 100 * .4 | 0))).slice(-4);
  },
  ZZ: function (date: Date) {
    const offset = date.getTimezoneOffset();
    const absolute = Math.abs(offset);
    return (0 < offset ? '-' : '+') + ('0' + (absolute / 60 | 0)).slice(-2) + ':' + ('0' + absolute % 60).slice(-2);
  },
  post: function (value: string) { return value; },
  res: resources
};

const parser = {
  YYYY: function (this: Parser, value: string) { return this.exec(/^\d{4}/, value); },
  Y: function (this: Parser, value: string) { return this.exec(/^\d{1,4}/, value); },
  MMMM: function (this: Parser, value: string) { const token = this.find(this.res.MMMM, value); token.value++; return token; },
  MMM: function (this: Parser, value: string) { const token = this.find(this.res.MMM, value); token.value++; return token; },
  MM: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  M: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  DD: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  D: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  HH: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  H: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  A: function (this: Parser, value: string) { return this.find(this.res.A, value); },
  hh: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  h: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  mm: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  m: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  ss: function (this: Parser, value: string) { return this.exec(/^\d\d/, value); },
  s: function (this: Parser, value: string) { return this.exec(/^\d\d?/, value); },
  SSS: function (this: Parser, value: string) { return this.exec(/^\d{1,3}/, value); },
  SS: function (this: Parser, value: string) { const token = this.exec(/^\d\d?/, value); token.value *= 10; return token; },
  S: function (this: Parser, value: string) { const token = this.exec(/^\d/, value); token.value *= 100; return token; },
  Z: function (this: Parser, value: string) {
    const token = this.exec(/^[+-]\d{2}[0-5]\d/, value);
    token.value = -60 * (token.value / 100 | 0) - token.value % 100;
    return token;
  },
  ZZ: function (value: string) {
    const parts = /^([+-])(\d{2}):([0-5]\d)/.exec(value) || ['', '', '', ''];
    return { value: -(60 * (((parts[1] + parts[2]) as unknown as number) | 0) + (((parts[1] + parts[3]) as unknown as number) | 0)), length: parts[0].length };
  },
  h12: function (hour: number, period: number) { return (12 === hour ? 0 : hour) + 12 * period; },
  exec: function (pattern: RegExp, input: string) {
    const value = (pattern.exec(input) || [''])[0];
    return { value: (value as unknown as number) | 0, length: value.length };
  },
  find: function (values: string[], input: string) {
    let found = -1;
    let length = 0;
    for (let index = 0, size = values.length; index < size; index++) {
      const value = values[index];
      if (!input.indexOf(value) && value.length > length) {
        found = index;
        length = value.length;
      }
    }
    return { value: found, length };
  },
  pre: function (value: string) { return value; },
  res: resources
};

function merge<Base extends object>(base: Base, additions?: object, overwrite?: boolean, sharedResources?: Resources): Base {
  const result: Record<string, unknown> = {};
  const original = base as Record<string, unknown>;
  const overlay = additions as Record<string, unknown>;
  for (const key in original) result[key] = original[key];
  for (const key in overlay || {}) {
    if (!!overwrite === !!result[key]) result[key] = overlay[key];
  }
  if (sharedResources) result.res = sharedResources;
  return result as Base;
}

const workshop = { _formatter: formatter, _parser: parser } as unknown as Workshop;
workshop.compile = function (pattern) {
  const matcher = /\[([^\[\]]|\[[^\[\]]*])*]|([A-Za-z])\2+|\.{3}|./g;
  const compiled = [pattern];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(pattern))) compiled[compiled.length] = match[0];
  return compiled;
};
workshop.format = function (value, format, utc) {
  const receiver = this || date;
  const tokens = typeof format === 'string' ? receiver.compile(format) : format;
  const offset = value.getTimezoneOffset();
  const local = receiver.addMinutes(value, utc ? offset : 0);
  const formatter = receiver._formatter;
  const formatters = formatter as unknown as Record<string, FormatToken | undefined>;
  let result = '';
  local.getTimezoneOffset = function () { return utc ? 0 : offset; };
  for (let index = 1, size = tokens.length; index < size; index++) {
    const key = tokens[index];
    const format = formatters[key];
    result += format ? formatter.post(format.call(formatter, local, tokens[0])) : key.replace(/\[(.*)]/, '$1');
  }
  return result;
};
workshop.preparse = function (value, format) {
  const receiver = this || date;
  const tokens = typeof format === 'string' ? receiver.compile(format) : format;
  const fields: ParsedDate = { Y: 1970, M: 1, D: 1, H: 0, A: 0, h: 0, m: 0, s: 0, S: 0, Z: 0, _index: 0, _length: 0, _match: 0 };
  const literal = /\[(.*)]/;
  const parser = receiver._parser;
  const parsers = parser as unknown as Record<string, ParseToken | undefined>;
  let position = 0;
  value = parser.pre(value);
  for (let index = 1, size = tokens.length; index < size; index++) {
    const key = tokens[index];
    const parse = parsers[key];
    if (parse) {
      const parsed = parse.call(parser, value.slice(position), tokens[0]);
      if (!parsed.length) break;
      position += parsed.length;
      fields[parsed.token || key.charAt(0)] = parsed.value;
      fields._match++;
    } else if (key === value.charAt(position) || ' ' === key) {
      position++;
    } else if (literal.test(key) && !value.slice(position).indexOf(literal.exec(key)![1])) {
      position += key.length - 2;
    } else {
      if ('...' === key) position = value.length;
      break;
    }
  }
  fields.H = fields.H || parser.h12(fields.h, fields.A);
  fields._index = position;
  fields._length = value.length;
  return fields;
};
workshop.parse = function (value, format, utc) {
  const receiver = this || date;
  const tokens = typeof format === 'string' ? receiver.compile(format) : format;
  const fields = receiver.preparse(value, tokens);
  if (!receiver.isValid(fields)) return new Date(NaN);
  // Date treats years 0-99 as 1900-1999. Adjust the month by the corresponding 1900 years.
  fields.M -= 100 > fields.Y ? 22801 : 1;
  return utc || ~receiver._parser.find(tokens, 'ZZ').value
    ? new Date(Date.UTC(fields.Y, fields.M, fields.D, fields.H, fields.m + fields.Z, fields.s, fields.S))
    : new Date(fields.Y, fields.M, fields.D, fields.H, fields.m, fields.s, fields.S);
};
workshop.isValid = function (value, format) {
  const receiver = this || date;
  const fields = typeof value === 'string' ? receiver.preparse(value, format!) : value;
  const february = 28 + (receiver.isLeapYear(fields.Y) as unknown as number) | 0;
  const limit = [31, february, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][fields.M - 1];
  return !(1 > fields._index || 1 > fields._length || fields._index - fields._length || 1 > fields._match ||
    1 > fields.Y || 9999 < fields.Y || 1 > fields.M || 12 < fields.M || 1 > fields.D ||
    fields.D > limit || 0 > fields.H || 23 < fields.H || 0 > fields.m || 59 < fields.m ||
    0 > fields.s || 59 < fields.s || 0 > fields.S || 999 < fields.S || -840 > fields.Z || 720 < fields.Z);
};
workshop.transform = function (value, from, to, utc) {
  const receiver = this || date;
  return receiver.format(receiver.parse(value, from), to, utc);
};
workshop.addYears = function (value, amount) { return (this || date).addMonths(value, 12 * amount); };
workshop.addMonths = function (value, amount) { value = new Date(value.getTime()); value.setMonth(value.getMonth() + amount); return value; };
workshop.addDays = function (value, amount) { value = new Date(value.getTime()); value.setDate(value.getDate() + amount); return value; };
workshop.addHours = function (value, amount) { return (this || date).addMinutes(value, 60 * amount); };
workshop.addMinutes = function (value, amount) { return (this || date).addSeconds(value, 60 * amount); };
workshop.addSeconds = function (value, amount) { return (this || date).addMilliseconds(value, 1E3 * amount); };
workshop.addMilliseconds = function (value, amount) { return new Date(value.getTime() + amount); };
workshop.subtract = function (left, right) {
  const elapsed = left.getTime() - right.getTime();
  return {
    toMilliseconds: function () { return elapsed; },
    toSeconds: function () { return elapsed / 1E3; },
    toMinutes: function () { return elapsed / 6E4; },
    toHours: function () { return elapsed / 36E5; },
    toDays: function () { return elapsed / 864E5; }
  };
};
workshop.isLeapYear = function (year) { return !(year % 4) && !!(year % 100) || !(year % 400); };
workshop.isSameDay = function (left, right) { return left.toDateString() === right.toDateString(); };
workshop.locale = function (name, extension) { if (!locales[name]) locales[name] = extension; };
workshop.plugin = function (name, extension) { if (!plugins[name]) plugins[name] = extension; };

const environment = merge(workshop);
const date = merge(workshop) as unknown as DateApi;
date.locale = function (selection) {
  const apply = typeof selection === 'function' ? selection : (date.locale as unknown as Record<string, Locale | undefined>)[selection as string];
  if (!apply) return activeLocale;
  activeLocale = apply(workshop);
  const locale = locales[activeLocale] || {};
  const shared = merge(resources, locale.res, true);
  date._formatter = environment._formatter = merge(formatter, locale.formatter, true, shared);
  date._parser = environment._parser = merge(parser, locale.parser, true, shared);
  for (const name in plugins) date.extend(plugins[name]!);
  return activeLocale;
};
date.extend = function (extension) {
  const shared = merge(date._parser.res, extension.res);
  const extra = extension.extender || {};
  date._formatter = merge(date._formatter, extension.formatter, false, shared);
  date._parser = merge(date._parser, extension.parser, false, shared);
  const methods = date as unknown as Record<string, unknown>;
  for (const key in extra) {
    if (!methods[key]) methods[key] = extra[key];
  }
};
date.plugin = function (selection) {
  const apply = typeof selection === 'function' ? selection : (date.plugin as unknown as Record<string, Plugin | undefined>)[selection];
  if (apply) date.extend(plugins[apply(workshop, environment)] || {});
};

export = date;
