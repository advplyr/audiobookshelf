/*!
 * is.js 0.9.0
 * Author: Aras Atasaygin
 */
type Modifier = 'not' | 'all' | 'any';
type Predicate = { test(this: unknown, ...values: unknown[]): boolean }['test'] & { api?: Modifier[] };
type Test = { test(value: string): boolean };
type Variants = Record<string, Predicate>;

interface Is {
    VERSION: string;
    not: Variants;
    all: Variants;
    any: Variants;
    array: (value: unknown) => value is unknown[];
    char: Predicate;
    date: (value: unknown) => value is Date;
    object: (value: unknown) => value is object;
    string: (value: unknown) => value is string;
    existy: <Value>(value: Value) => value is NonNullable<Value>;
    ip: <Value>(this: void, value: Value) => value is NonNullable<Value>;
    setNamespace: (this: Is) => Is;
    setRegexp: (pattern: Test, name: string) => void;
}

declare const DocumentTouch: { new (): object };

var is = {} as Is & Record<string, Predicate>;

is.VERSION = "0.8.0";

is.not = {};

is.all = {};

is.any = {};

const objectMethods = Object.prototype as { toString: (this: unknown) => string; hasOwnProperty: (this: unknown, key: PropertyKey) => boolean };
var classTag = objectMethods.toString;

var sliceArguments: (this: IArguments) => unknown[] = Array.prototype.slice;

var hasOwn = objectMethods.hasOwnProperty;

function negate(n: Predicate) { return function () { return !n.apply(null, sliceArguments.call(arguments)); }; }

function matchAll(n: Predicate) { return function () { var t = expandArguments(arguments); var e = t.length; for (var r = 0; r < e; r++) {
    if (!n.call(null, t[r])) {
        return false;
    }
} return true; }; }

function matchAny(n: Predicate) { return function () { var t = expandArguments(arguments); var e = t.length; for (var r = 0; r < e; r++) {
    if (n.call(null, t[r])) {
        return true;
    }
} return false; }; }

var comparisons: Record<string, (left: string | number, right: string | number) => boolean> = { "<": function (n, t) { return n < t; }, "<=": function (n, t) { return n <= t; }, ">": function (n, t) { return n > t; }, ">=": function (n, t) { return n >= t; } };

function matchesVersion(n: string | number, t?: unknown) { var e = (t as string) + ""; var r = +(e.match(/\d+/) || NaN); var a = e.match(/^[<>]=?|/)![0]; return comparisons[a] ? comparisons[a](n, r) : n == r || r !== r; }

function expandArguments(t: IArguments) { var r = sliceArguments.call(t); var a = r.length; if (a === 1 && is.array(r[0])) {
    r = r[0];
} return r; }

is.arguments = function (n: unknown) { return classTag.call(n) === "[object Arguments]" || n != null && typeof n === "object" && "callee" in n; };

is.array = Array.isArray || function (n: unknown): n is unknown[] { return classTag.call(n) === "[object Array]"; };

is.boolean = function (n: unknown) { return n === true || n === false || classTag.call(n) === "[object Boolean]"; };

is.char = function (t: unknown) { return is.string(t) && t.length === 1; };

is.date = function (n: unknown): n is Date { return classTag.call(n) === "[object Date]"; };

is.domNode = function (t: { nodeType: number }) { return is.object(t) && t.nodeType > 0; };

is.error = function (n: unknown) { return classTag.call(n) === "[object Error]"; };

is["function"] = function (n: unknown) { return classTag.call(n) === "[object Function]" || typeof n === "function"; };

is.json = function (n: unknown) { return classTag.call(n) === "[object Object]"; };

is.nan = function (n: unknown) { return n !== n; };

is["null"] = function (n: unknown) { return n === null; };

is.number = function (e: unknown) { return is.not.nan(e) && classTag.call(e) === "[object Number]"; };

is.object = function (n: unknown): n is object { return Object(n) === n; };

is.regexp = function (n: unknown) { return classTag.call(n) === "[object RegExp]"; };

is.sameType = function (e: unknown, r: unknown) { var a = classTag.call(e); if (a !== classTag.call(r)) {
    return false;
} if (a === "[object Number]") {
    return !is.any.nan(e, r) || is.all.nan(e, r);
} return true; };

is.sameType.api = ["not"];

is.string = function (n: unknown): n is string { return classTag.call(n) === "[object String]"; };

is.undefined = function (n: unknown) { return n === void 0; };

is.windowObject = function (n: unknown) { return n != null && typeof n === "object" && "setInterval" in n; };

is.empty = function (t: unknown) { if (is.object(t)) {
    var e = Object.getOwnPropertyNames(t).length;
    if (e === 0 || e === 1 && is.array(t) || e === 2 && is.arguments(t)) {
        return true;
    }
    return false;
} return t === ""; };

is.existy = function <Value>(n: Value): n is NonNullable<Value> { return n != null; };

is.falsy = function (n: unknown) { return !n; };

is.truthy = negate(is.falsy);

is.above = function (t: number, e: number) { return is.all.number(t, e) && t > e; };

is.above.api = ["not"];

is.decimal = function (t: number) { return is.number(t) && t % 1 !== 0; };

is.equal = function (t: number, e: number) { if (is.all.number(t, e)) {
    return t === e && 1 / t === 1 / e;
} if (is.all.string(t, e) || is.all.regexp(t, e)) {
    return "" + t === "" + e;
} if (is.all.boolean(t, e)) {
    return t === e;
} return false; };

is.equal.api = ["not"];

is.even = function (t: number) { return is.number(t) && t % 2 === 0; };

is.finite = isFinite || function (t: unknown) { return is.not.infinite(t) && is.not.nan(t); };

is.infinite = function (n: unknown) { return n === Infinity || n === -Infinity; };

is.integer = function (t: number) { return is.number(t) && t % 1 === 0; };

is.negative = function (t: number) { return is.number(t) && t < 0; };

is.odd = function (t: number) { return is.number(t) && t % 2 === 1; };

is.positive = function (t: number) { return is.number(t) && t > 0; };

is.under = function (t: number, e: number) { return is.all.number(t, e) && t < e; };

is.under.api = ["not"];

is.within = function (t: number, e: number, r: number) { return is.all.number(t, e, r) && t > e && t < r; };

is.within.api = ["not"];

var patterns: Record<string, Test> = {
  affirmative: /^(?:1|t(?:rue)?|y(?:es)?|ok(?:ay)?)$/,
  alphaNumeric: /^[A-Za-z0-9]+$/,
  caPostalCode: /^(?!.*[DFIOQU])[A-VXY][0-9][A-Z]\s?[0-9][A-Z][0-9]$/,
  creditCard: /^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/,
  dateString: /^(1[0-2]|0?[1-9])([\/-])(3[01]|[12][0-9]|0?[1-9])(?:\2)(?:[0-9]{2})?[0-9]{2}$/,
  email: /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i,
  eppPhone: /^\+[0-9]{1,3}\.[0-9]{4,14}(?:x.+)?$/,
  hexadecimal: /^(?:0x)?[0-9a-fA-F]+$/,
  hexColor: /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
  ipv4: /^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/,
  ipv6: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i,
  nanpPhone: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  socialSecurityNumber: /^(?!000|666)[0-8][0-9]{2}-?(?!00)[0-9]{2}-?(?!0000)[0-9]{4}$/,
  timeString: /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9]):([0-5]?[0-9])$/,
  ukPostCode: /^[A-Z]{1,2}[0-9RCHNQ][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2}$|^[A-Z]{2}-?[0-9]{4}$/,
  url: /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i,
  usZipCode: /^[0-9]{5}(?:-[0-9]{4})?$/
};

function addPattern(t: string, e: Record<string, Test>) { is[t] = function (n: unknown) { return e[t].test(n as string); }; }

for (var s in patterns) {
    if (hasOwn.call(patterns, s)) {
        addPattern(s, patterns);
    }
}

is.ip = function <Value>(t: Value): t is NonNullable<Value> { return is.ipv4(t) || is.ipv6(t); };

is.capitalized = function (t: string) { if (is.not.string(t)) {
    return false;
} var e = t.split(" "); for (var r = 0; r < e.length; r++) {
    var a = e[r];
    if (a.length) {
        var u = a.charAt(0);
        if (u !== u.toUpperCase()) {
            return false;
        }
    }
} return true; };

is.endWith = function (t: string, e: string) { if (is.not.string(t)) {
    return false;
} e += ""; var r = t.length - e.length; return r >= 0 && t.indexOf(e, r) === r; };

is.endWith.api = ["not"];

is.include = function (n: { indexOf(value: unknown): number }, t: unknown) { return n.indexOf(t) > -1; };

is.include.api = ["not"];

is.lowerCase = function (t: unknown) { return is.string(t) && t === t.toLowerCase(); };

is.palindrome = function (t: string) { if (is.not.string(t)) {
    return false;
} t = t.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase(); var e = t.length - 1; for (var r = 0, a = Math.floor(e / 2); r <= a; r++) {
    if (t.charAt(r) !== t.charAt(e - r)) {
        return false;
    }
} return true; };

is.space = function (t: string) { if (is.not.char(t)) {
    return false;
} var e = t.charCodeAt(0); return e > 8 && e < 14 || e === 32; };

is.startWith = function (t: unknown, e: string) { return is.string(t) && t.indexOf(e) === 0; };

is.startWith.api = ["not"];

is.upperCase = function (t: unknown) { return is.string(t) && t === t.toUpperCase(); };

var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

var months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

is.day = function (t: unknown, e: string) { return is.date(t) && e.toLowerCase() === days[t.getDay()]; };

is.day.api = ["not"];

is.dayLightSavingTime = function (n: Date) { var t = new Date(n.getFullYear(), 0, 1); var e = new Date(n.getFullYear(), 6, 1); var r = Math.max(t.getTimezoneOffset(), e.getTimezoneOffset()); return n.getTimezoneOffset() < r; };

is.future = function (t: unknown) { var e = new Date; return is.date(t) && t.getTime() > e.getTime(); };

is.inDateRange = function (t: Date, e: Date, r: Date) { if (is.not.date(t) || is.not.date(e) || is.not.date(r)) {
    return false;
} var a = t.getTime(); return a > e.getTime() && a < r.getTime(); };

is.inDateRange.api = ["not"];

is.inLastMonth = function (t: unknown) { return is.inDateRange(t, new Date((new Date).setMonth((new Date).getMonth() - 1)), new Date); };

is.inLastWeek = function (t: unknown) { return is.inDateRange(t, new Date((new Date).setDate((new Date).getDate() - 7)), new Date); };

is.inLastYear = function (t: unknown) { return is.inDateRange(t, new Date((new Date).setFullYear((new Date).getFullYear() - 1)), new Date); };

is.inNextMonth = function (t: unknown) { return is.inDateRange(t, new Date, new Date((new Date).setMonth((new Date).getMonth() + 1))); };

is.inNextWeek = function (t: unknown) { return is.inDateRange(t, new Date, new Date((new Date).setDate((new Date).getDate() + 7))); };

is.inNextYear = function (t: unknown) { return is.inDateRange(t, new Date, new Date((new Date).setFullYear((new Date).getFullYear() + 1))); };

is.leapYear = function (t: number) { return is.number(t) && (t % 4 === 0 && t % 100 !== 0 || t % 400 === 0); };

is.month = function (t: unknown, e: string) { return is.date(t) && e.toLowerCase() === months[t.getMonth()]; };

is.month.api = ["not"];

is.past = function (t: unknown) { var e = new Date; return is.date(t) && t.getTime() < e.getTime(); };

is.quarterOfYear = function (t: unknown, e: number) { return is.date(t) && is.number(e) && e === Math.floor((t.getMonth() + 3) / 3); };

is.quarterOfYear.api = ["not"];

is.today = function (t: unknown) { var e = new Date; var r = e.toDateString(); return is.date(t) && t.toDateString() === r; };

is.tomorrow = function (t: unknown) { var e = new Date; var r = new Date(e.setDate(e.getDate() + 1)).toDateString(); return is.date(t) && t.toDateString() === r; };

is.weekend = function (t: unknown) { return is.date(t) && (t.getDay() === 6 || t.getDay() === 0); };

is.weekday = negate(is.weekend);

is.year = function (t: unknown, e: number) { return is.date(t) && is.number(e) && e === t.getFullYear(); };

is.year.api = ["not"];

is.yesterday = function (t: unknown) { var e = new Date; var r = new Date(e.setDate(e.getDate() - 1)).toDateString(); return is.date(t) && t.toDateString() === r; };

var nodeGlobal = is.windowObject(typeof global == "object" && global) && global;

var browserGlobal = is.windowObject(typeof self == "object" && self) && self;

var receiverGlobal = is.windowObject(typeof this == "object" && this) && this;

var root = (nodeGlobal || browserGlobal || receiverGlobal || globalThis) as { is?: unknown };

var documentValue = browserGlobal && browserGlobal.document;

var originalNamespace = root.is;

var browserNavigator = browserGlobal && browserGlobal.navigator;

var appVersion = (browserNavigator && browserNavigator.appVersion || "").toLowerCase();

var userAgent = (browserNavigator && browserNavigator.userAgent || "").toLowerCase();

var vendor = (browserNavigator && browserNavigator.vendor || "").toLowerCase();

is.android = function () { return /android/.test(userAgent); };

is.android.api = ["not"];

is.androidPhone = function () { return /android/.test(userAgent) && /mobile/.test(userAgent); };

is.androidPhone.api = ["not"];

is.androidTablet = function () { return /android/.test(userAgent) && !/mobile/.test(userAgent); };

is.androidTablet.api = ["not"];

is.blackberry = function () { return /blackberry/.test(userAgent) || /bb10/.test(userAgent); };

is.blackberry.api = ["not"];

is.chrome = function (n?: unknown) { var t = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null; return t !== null && matchesVersion(t[1], n); };

is.chrome.api = ["not"];

is.desktop = function () { return is.not.mobile() && is.not.tablet(); };

is.desktop.api = ["not"];

is.edge = function (n?: unknown) { var t = userAgent.match(/edge\/(\d+)/); return t !== null && matchesVersion(t[1], n); };

is.edge.api = ["not"];

is.firefox = function (n?: unknown) { var t = userAgent.match(/(?:firefox|fxios)\/(\d+)/); return t !== null && matchesVersion(t[1], n); };

is.firefox.api = ["not"];

is.ie = function (n?: unknown) { var t = userAgent.match(/(?:msie |trident.+?; rv:)(\d+)/); return t !== null && matchesVersion(t[1], n); };

is.ie.api = ["not"];

is.ios = function () { return is.iphone() || is.ipad() || is.ipod(); };

is.ios.api = ["not"];

is.ipad = function (n?: unknown) { var t = userAgent.match(/ipad.+?os (\d+)/); return t !== null && matchesVersion(t[1], n); };

is.ipad.api = ["not"];

is.iphone = function (n?: unknown) { var t = userAgent.match(/iphone(?:.+?os (\d+))?/); return t !== null && matchesVersion(t[1] || 1, n); };

is.iphone.api = ["not"];

is.ipod = function (n?: unknown) { var t = userAgent.match(/ipod.+?os (\d+)/); return t !== null && matchesVersion(t[1], n); };

is.ipod.api = ["not"];

is.linux = function () { return /linux/.test(appVersion); };

is.linux.api = ["not"];

is.mac = function () { return /mac/.test(appVersion); };

is.mac.api = ["not"];

is.mobile = function () { return is.iphone() || is.ipod() || is.androidPhone() || is.blackberry() || is.windowsPhone(); };

is.mobile.api = ["not"];

is.offline = negate(is.online);

is.offline.api = ["not"];

is.online = function () { return !browserNavigator || browserNavigator.onLine === true; };

is.online.api = ["not"];

is.opera = function (n?: unknown) { var t = userAgent.match(/(?:^opera.+?version|opr)\/(\d+)/); return t !== null && matchesVersion(t[1], n); };

is.opera.api = ["not"];

is.phantom = function (n?: unknown) { var t = userAgent.match(/phantomjs\/(\d+)/); return t !== null && matchesVersion(t[1], n); };

is.phantom.api = ["not"];

is.safari = function (n?: unknown) { var t = userAgent.match(/version\/(\d+).+?safari/); return t !== null && matchesVersion(t[1], n); };

is.safari.api = ["not"];

is.tablet = function () { return is.ipad() || is.androidTablet() || is.windowsTablet(); };

is.tablet.api = ["not"];

is.touchDevice = function () { return !!documentValue && ("ontouchstart" in (browserGlobal as Window) || "DocumentTouch" in (browserGlobal as Window) && documentValue instanceof DocumentTouch); };

is.touchDevice.api = ["not"];

is.windows = function () { return /win/.test(appVersion); };

is.windows.api = ["not"];

is.windowsPhone = function () { return is.windows() && /phone/.test(userAgent); };

is.windowsPhone.api = ["not"];

is.windowsTablet = function () { return is.windows() && is.not.windowsPhone() && /touch/.test(userAgent); };

is.windowsTablet.api = ["not"];

is.propertyCount = function (t: object, e: number) { if (is.not.object(t) || is.not.number(e)) {
    return false;
} var a = 0; for (var u in t) {
    if (hasOwn.call(t, u) && ++a > e) {
        return false;
    }
} return a === e; };

is.propertyCount.api = ["not"];

is.propertyDefined = function (t: unknown, e: string) { return is.object(t) && is.string(e) && e in t; };

is.propertyDefined.api = ["not"];

is.inArray = function (t: unknown, e: unknown[]) { if (is.not.array(e)) {
    return false;
} for (var r = 0; r < e.length; r++) {
    if (e[r] === t) {
        return true;
    }
} return false; };

is.inArray.api = ["not"];

is.sorted = function (t: unknown[], e?: string) { if (is.not.array(t)) {
    return false;
} var r = comparisons[e as string] || comparisons[">="]; for (var a = 1; a < t.length; a++) {
    if (!r(t[a] as string | number, t[a - 1] as string | number)) {
        return false;
    }
} return true; };

function addVariants() { var t: Record<string, unknown> = is; for (var e in t) {
    if (hasOwn.call(t, e) && is["function"](t[e])) {
        var i = (t[e] as Predicate).api || ["not", "all", "any"];
        for (var f = 0; f < i.length; f++) {
            if (i[f] === "not") {
                is.not[e] = negate(is[e]);
            }
            if (i[f] === "all") {
                is.all[e] = matchAll(is[e]);
            }
            if (i[f] === "any") {
                is.any[e] = matchAny(is[e]);
            }
        }
    }
} }

addVariants();

is.setNamespace = function (this: Is) { root.is = originalNamespace; return this; };

is.setRegexp = function (n: Test, t: string) { for (var e in patterns) {
    if (hasOwn.call(patterns, e) && t === e) {
        patterns[e] = n;
    }
} };

export = is;
