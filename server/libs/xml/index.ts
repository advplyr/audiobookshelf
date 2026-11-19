// node-xml
// SOURCE: https://github.com/dylang/node-xml
// LICENSE: https://github.com/dylang/node-xml/blob/master/LICENSE

import escapeForXML from './escapeForXML';
import { Stream } from 'node:stream';

interface XmlDeclaration {
  encoding?: string;
  standalone?: string | boolean;
}

interface XmlOptions {
  indent?: string | boolean;
  stream?: boolean;
  declaration?: XmlDeclaration | boolean;
}

type XmlText = string | number | boolean | null | undefined;
type Append = (interrupt: boolean, output?: XmlText) => void;
type XmlStream = Stream & { readable?: boolean };

interface ResolvedElement {
  name?: string;
  interrupt: XmlElement | false;
  attributes: string[];
  content: unknown[];
  icount: number;
  indents: string;
  indent?: string;
}

interface XmlElement {
  _elem: ResolvedElement;
  append?: Append;
  end?: () => void;
  push(input: unknown): void;
  close(input?: unknown): void;
}

type XmlObject = Record<string, unknown> & {
  _elem?: ResolvedElement;
  _attr?: Record<string, XmlText>;
  _cdata?: XmlText;
  forEach?: (callback: (value: unknown, index: number) => void) => void;
  length?: number;
};

var DEFAULT_INDENT = '    ';

function xml(input: unknown, options?: XmlOptions | string | boolean): string | XmlStream {

  if (typeof options !== 'object') {
    options = {
      indent: options
    };
  }

  var stream: XmlStream | null = options.stream ? new Stream() : null,
    output = "",
    interrupted = false,
    indent = !options.indent ? ''
      : options.indent === true ? DEFAULT_INDENT
        : options.indent,
    instant = true;


  function delay(func: () => void) {
    if (!instant) {
      func();
    } else {
      process.nextTick(func);
    }
  }

  function append(interrupt: boolean, out?: XmlText) {
    if (out !== undefined) {
      output += out;
    }
    if (interrupt && !interrupted) {
      stream = stream || new Stream();
      interrupted = true;
    }
    if (interrupt && interrupted && stream) {
      var data = output;
      const currentStream = stream;
      delay(function () { currentStream.emit('data', data) });
      output = "";
    }
  }

  function add(value: unknown, last?: () => void) {
    format(append, resolve(value, indent, indent ? 1 : 0), last);
  }

  function end() {
    if (stream) {
      var data = output;
      const currentStream = stream;
      delay(function () {
        currentStream.emit('data', data);
        currentStream.emit('end');
        currentStream.readable = false;
        currentStream.emit('close');
      });
    }
  }

  function addXmlDeclaration(declaration: XmlDeclaration) {
    var encoding = declaration.encoding || 'UTF-8',
      attr: XmlDeclaration & { version: string } = { version: '1.0', encoding: encoding };

    if (declaration.standalone) {
      attr.standalone = declaration.standalone;
    }

    add({ '?xml': { _attr: attr } });
    output = output.replace('/>', '?>');
  }

  // disable delay delayed
  delay(function () { instant = false });

  if (options.declaration) {
    addXmlDeclaration(options.declaration === true ? {} : options.declaration);
  }

  const collection = input as XmlObject | null | undefined;
  if (collection && collection.forEach) {
    collection.forEach(function (value, i) {
      var last;
      if (i + 1 === collection.length)
        last = end;
      add(value, last);
    });
  } else {
    add(input, end);
  }

  if (stream) {
    stream.readable = true;
    return stream;
  }
  return output;
}

function element(...input: unknown[]): XmlElement {
  const self: XmlElement = {
    _elem: resolve(input),
    push: function (input) {
      if (!this.append) {
        throw new Error("not assigned to a parent!");
      }
      const attached = this as XmlElement & { append: Append };
      const indent = this._elem.indent;
      format(this.append, resolve(
        input, indent, this._elem.icount + (indent ? 1 : 0)),
        () => attached.append(true));
    },
    close: function (input) {
      if (input !== undefined) {
        this.push(input);
      }
      if (this.end) {
        this.end();
      }
    }
  };

  return self;
}

function create_indent(character: string | undefined, count: number) {
  return (new Array(count || 0).join(character || ''))
}

function resolve(data: unknown, indent?: string, indent_count = 0): ResolvedElement {
  indent_count = indent_count || 0;
  var indent_spaces = create_indent(indent, indent_count);
  var name;
  var values = data;

  if (typeof data === 'object') {
    const object = data as XmlObject;
    var keys = Object.keys(object);
    name = keys[0];
    values = object[name];

    const element = values as XmlElement | undefined;
    if (element && element._elem) {
      element._elem.name = name;
      element._elem.icount = indent_count;
      element._elem.indent = indent;
      element._elem.indents = indent_spaces;
      element._elem.interrupt = element;
      return element._elem;
    }
  }

  var attributes: string[] = [],
    content: unknown[] = [];

  var isStringContent;

  function get_attributes(obj: Record<string, XmlText>) {
    var keys = Object.keys(obj);
    keys.forEach(function (key) {
      attributes.push(attribute(key, obj[key]));
    });
  }

  switch (typeof values) {
    case 'object': {
      if (values === null) break;
      const object = values as XmlObject;

      if (object._attr) {
        get_attributes(object._attr);
      }

      if (object._cdata) {
        content.push(
          ('<![CDATA[' + object._cdata).replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>'
        );
      }

      if (object.forEach) {
        isStringContent = false;
        content.push('');
        object.forEach(function (value) {
          if (typeof value == 'object') {
            const child = value as XmlObject;
            var _name = Object.keys(child)[0];

            if (_name == '_attr') {
              get_attributes(child._attr as Record<string, XmlText>);
            } else {
              content.push(resolve(
                value, indent, indent_count + 1));
            }
          } else {
            //string
            content.pop();
            isStringContent = true;
            content.push(escapeForXML(value));
          }

        });
        if (!isStringContent) {
          content.push('');
        }
      }
      break;
    }

    default:
      //string
      content.push(escapeForXML(values));

  }

  return {
    name: name,
    interrupt: false,
    attributes: attributes,
    content: content,
    icount: indent_count,
    indents: indent_spaces,
    indent: indent
  };
}

function format(append: Append, value: unknown, end?: () => void) {

  if (typeof value != 'object') {
    // Text nodes are concatenated using the original JavaScript coercion rules.
    return append(false, value as XmlText);
  }
  const elem = value as ResolvedElement;

  var len = elem.interrupt ? 1 : elem.content.length;

  function proceed() {
    while (elem.content.length) {
      var value = elem.content.shift();

      if (value === undefined) continue;
      if (interrupt(value)) return;

      format(append, value);
    }

    append(false, (len > 1 ? elem.indents : '')
      + (elem.name ? '</' + elem.name + '>' : '')
      + (elem.indent && !end ? '\n' : ''));

    if (end) {
      end();
    }
  }

  function interrupt(content: unknown) {
    const value = content as ResolvedElement;
    if (value.interrupt) {
      value.interrupt.append = append;
      value.interrupt.end = proceed;
      value.interrupt = false;
      append(true);
      return true;
    }
    return false;
  }

  append(false, elem.indents
    + (elem.name ? '<' + elem.name : '')
    + (elem.attributes.length ? ' ' + elem.attributes.join(' ') : '')
    + (len ? (elem.name ? '>' : '') : (elem.name ? '/>' : ''))
    + (elem.indent && len > 1 ? '\n' : ''));

  if (!len) {
    return append(false, elem.indent ? '\n' : '');
  }

  if (!interrupt(elem)) {
    proceed();
  }
}

function attribute(key: string, value: XmlText) {
  return key + '=' + '"' + escapeForXML(value) + '"';
}

export = Object.assign(xml, { Element: element, element });
