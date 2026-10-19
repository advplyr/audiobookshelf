// Callable boundary: the embedded UAParser returns getResult() when used without new.
declare function UAParser(userAgent?: string): UAParser.Result

declare namespace UAParser {
  interface Result {
    ua: string
    browser: { name?: string; version?: string; major?: string }
    os: { name?: string; version?: string }
    device: { type?: string; model?: string; vendor?: string }
    engine: { name?: string; version?: string }
    cpu: { architecture?: string }
  }
}
export = UAParser
