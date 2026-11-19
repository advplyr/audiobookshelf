var XML_CHARACTER_MAP = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
  '<': '&lt;',
  '>': '&gt;'
} as const;

function escapeForXML(value: string): string;
function escapeForXML(value: string | null | undefined): string | null | undefined;
function escapeForXML(value: string | number | boolean | null | undefined): string | number | boolean | null | undefined;
function escapeForXML(value: unknown): unknown;
function escapeForXML(value: unknown): unknown {
  // The original helper also accepts objects with a string-like replace method.
  const string = value as { replace?: (pattern: RegExp, replacement: (match: string, character: keyof typeof XML_CHARACTER_MAP) => string) => unknown } | null | undefined;
  return string && string.replace
    ? string.replace(/([&"<>'])/g, function (_match, item) {
      return XML_CHARACTER_MAP[item];
    })
    : value;
}

export = escapeForXML;
