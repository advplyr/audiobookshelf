/*
  sanitize-html (Apostrophe Technologies)
  SOURCE: https://github.com/apostrophecms/sanitize-html
  LICENSE: https://github.com/apostrophecms/sanitize-html/blob/main/LICENSE

  Modified for audiobookshelf
*/

import { Parser } from 'htmlparser2';
import type { ParserOptions } from 'htmlparser2';

type Attributes = Record<string, string>;
type AttributeRule = { name: string; values: string[]; multiple?: boolean };
type AttributeList = (string | AttributeRule)[];
type TagTransform = (tagName: string, attributes: Attributes) => { tagName: string; attribs: Attributes; text?: string };

interface FrameState {
  tag: string;
  name?: string;
  attribs: Attributes;
  tagPosition: number;
  text: string;
  innerText?: string;
  mediaChildren: string[];
  updateParentNodeText: () => void;
  updateParentNodeMediaChildren: (this: FrameState) => void;
}

interface Options {
  parser?: ParserOptions;
  allowedTags?: string[] | false;
  allowVulnerableTags?: boolean;
  nonTextTags?: string[];
  allowedAttributes?: Record<string, AttributeList> | false;
  allowedClasses?: Record<string, (string | RegExp)[]>;
  transformTags?: Record<string, string | TagTransform>;
  enforceHtmlBoundary?: boolean;
  disallowedTagsMode?: string;
  nestingLimit?: number | null;
  allowedScriptHostnames?: string[];
  allowedScriptDomains?: string[];
  allowedIframeHostnames?: string[];
  allowedIframeDomains?: string[];
  allowIframeRelativeUrls?: boolean;
  allowedSchemes?: string[] | false;
  allowedSchemesByTag?: Record<string, string[]>;
  allowedSchemesAppliedToAttributes?: string[];
  allowProtocolRelative?: boolean;
  selfClosing?: string[];
  textFilter?: (text: string, tag?: string) => string;
  exclusiveFilter?: (frame: FrameState) => unknown;
}

type Defaults = Options & Required<Pick<Options, 'selfClosing' | 'allowedSchemesByTag' | 'allowedSchemesAppliedToAttributes'>>;

// ABS UPDATE: Packages not necessary
// SOURCE: https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
function escapeStringRegexp(string: unknown) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d');
}

// SOURCE: https://github.com/jonschlinkert/is-plain-object/blob/master/is-plain-object.js
function isObject(o: unknown) {
  return Object.prototype.toString.call(o) === '[object Object]';
}

function isPlainObject(o: AttributeList[number]): o is AttributeRule {

  if (isObject(o) === false) return false;

  // If has modified constructor
  const ctor = (o as { constructor?: { prototype?: unknown } }).constructor;
  if (ctor === undefined) return true;

  // If has modified prototype
  const prot = ctor.prototype;
  if (isObject(prot) === false) return false;

  // If constructor does not have an Object-specific method
  if ((prot as { hasOwnProperty: (property: string) => boolean }).hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
};


const mediaTags = [
  'img', 'audio', 'video', 'picture', 'svg',
  'object', 'map', 'iframe', 'embed'
];
// Tags that are inherently vulnerable to being used in XSS attacks.
const vulnerableTags = ['script', 'style'];

function each<Value>(obj: Record<string, Value> | false | null | undefined, cb: (value: Value, key: string) => void) {
  if (obj) {
    Object.keys(obj).forEach(function (key) {
      cb(obj[key], key);
    });
  }
}

// Avoid false positives with .__proto__, .hasOwnProperty, etc.
function has(obj: unknown, key: PropertyKey) {
  return ({}).hasOwnProperty.call(obj, key);
}

function isEmptyObject(obj: object) {
  for (const key in obj) {
    if (has(obj, key)) {
      return false;
    }
  }
  return true;
}

// A valid attribute name.
// We use a tolerant definition based on the set of strings defined by
// html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state
// and html.spec.whatwg.org/multipage/parsing.html#attribute-name-state .
// The characters accepted are ones which can be appended to the attribute
// name buffer without triggering a parse error:
//   * unexpected-equals-sign-before-attribute-name
//   * unexpected-null-character
//   * unexpected-character-in-attribute-name
// We exclude the empty string because it's impossible to get to the after
// attribute name state with an empty attribute name buffer.
const VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;

// Ignore the _recursing flag; it's there for recursive
// invocation as a guard against this exploit:
// https://github.com/fb55/htmlparser2/issues/105

function sanitizeHtml(html: string | null | undefined, options?: Options | null, _recursing?: boolean) {
  void _recursing;
  if (html == null) {
    return '';
  }

  let result = '';
  // Used for hot swapping the result variable with an empty string in order to "capture" the text written to it.
  let tempResult = '';

  const Frame = function Frame(this: FrameState, tag: string, attribs: Attributes) {
    this.tag = tag;
    this.attribs = attribs || {};
    this.tagPosition = result.length;
    this.text = ''; // Node inner text
    this.mediaChildren = [];

    this.updateParentNodeText = () => {
      if (stack.length) {
        const parentFrame = stack[stack.length - 1];
        parentFrame.text += this.text;
      }
    };

    this.updateParentNodeMediaChildren = function () {
      if (stack.length && mediaTags.includes(this.tag)) {
        const parentFrame = stack[stack.length - 1];
        parentFrame.mediaChildren.push(this.tag);
      }
    };
  } as unknown as new (tag: string, attribs: Attributes) => FrameState;

  const settings = Object.assign({}, sanitizeHtml.defaults, options);
  const parserOptions = Object.assign({}, htmlParserDefaults, settings.parser);
  settings.parser = parserOptions;

  // vulnerableTags
  vulnerableTags.forEach(function (tag) {
    if (
      settings.allowedTags && settings.allowedTags.indexOf(tag) > -1 &&
      !settings.allowVulnerableTags
    ) {
      console.warn(`\n\n⚠️ Your \`allowedTags\` option includes, \`${tag}\`, which is inherently\nvulnerable to XSS attacks. Please remove it from \`allowedTags\`.\nOr, to disable this warning, add the \`allowVulnerableTags\` option\nand ensure you are accounting for this risk.\n\n`);
    }
  });

  // Tags that contain something other than HTML, or where discarding
  // the text when the tag is disallowed makes sense for other reasons.
  // If we are not allowing these tags, we should drop their content too.
  // For other tags you would drop the tag but keep its content.
  const nonTextTagsArray = settings.nonTextTags || [
    'script',
    'style',
    'textarea',
    'option'
  ];
  let allowedAttributesMap: Record<string, AttributeList> | undefined;
  let allowedAttributesGlobMap: Record<string, RegExp>;
  if (settings.allowedAttributes) {
    allowedAttributesMap = {};
    allowedAttributesGlobMap = {};
    each(settings.allowedAttributes, function (attributes, tag) {
      allowedAttributesMap![tag] = [];
      const globRegex: string[] = [];
      attributes.forEach(function (obj) {
        if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
          globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
        } else {
          allowedAttributesMap![tag].push(obj);
        }
      });
      if (globRegex.length) {
        allowedAttributesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
      }
    });
  }
  const allowedClassesMap: Record<string, string[]> = {};
  const allowedClassesGlobMap: Record<string, RegExp> = {};
  const allowedClassesRegexMap: Record<string, RegExp[]> = {};
  each(settings.allowedClasses, function (classes, tag) {
    // Implicitly allows the class attribute
    if (allowedAttributesMap) {
      if (!has(allowedAttributesMap, tag)) {
        allowedAttributesMap[tag] = [];
      }
      allowedAttributesMap[tag].push('class');
    }

    allowedClassesMap[tag] = [];
    allowedClassesRegexMap[tag] = [];
    const globRegex: string[] = [];
    classes.forEach(function (obj) {
      if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
        globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
      } else if (obj instanceof RegExp) {
        allowedClassesRegexMap[tag].push(obj);
      } else {
        allowedClassesMap[tag].push(obj);
      }
    });
    if (globRegex.length) {
      allowedClassesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
    }
  });

  const transformTagsMap: Record<string, TagTransform | undefined> = {};
  let transformTagsAll: TagTransform | undefined;
  each(settings.transformTags, function (transform, tag) {
    let transFun: TagTransform | undefined;
    if (typeof transform === 'function') {
      transFun = transform;
    } else if (typeof transform === 'string') {
      transFun = sanitizeHtml.simpleTransform(transform);
    }
    if (tag === '*') {
      transformTagsAll = transFun;
    } else {
      transformTagsMap[tag] = transFun;
    }
  });

  let depth: number;
  let stack: FrameState[];
  let skipMap: Record<number, boolean>;
  let transformMap: Record<number, string>;
  let skipText: boolean;
  let skipTextDepth: number;
  let addedText = false;

  initializeState();

  const parser = new Parser({
    onopentag: function (name, attribs) {
      // If `enforceHtmlBoundary` is `true` and this has found the opening
      // `html` tag, reset the state.
      if (settings.enforceHtmlBoundary && name === 'html') {
        initializeState();
      }

      if (skipText) {
        skipTextDepth++;
        return;
      }
      const frame = new Frame(name, attribs);
      stack.push(frame);

      let skip = false;
      const hasText = !!frame.text;
      let transformedTag;
      if (has(transformTagsMap, name)) {
        transformedTag = transformTagsMap[name]!(name, attribs);

        frame.attribs = attribs = transformedTag.attribs;

        if (transformedTag.text !== undefined) {
          frame.innerText = transformedTag.text;
        }

        if (name !== transformedTag.tagName) {
          frame.name = name = transformedTag.tagName;
          transformMap[depth] = transformedTag.tagName;
        }
      }
      if (transformTagsAll) {
        transformedTag = transformTagsAll(name, attribs);

        frame.attribs = attribs = transformedTag.attribs;
        if (name !== transformedTag.tagName) {
          frame.name = name = transformedTag.tagName;
          transformMap[depth] = transformedTag.tagName;
        }
      }

      if ((settings.allowedTags && settings.allowedTags.indexOf(name) === -1) || (settings.disallowedTagsMode === 'recursiveEscape' && !isEmptyObject(skipMap)) || (settings.nestingLimit != null && depth >= settings.nestingLimit)) {
        skip = true;
        skipMap[depth] = true;
        if (settings.disallowedTagsMode === 'discard') {
          if (nonTextTagsArray.indexOf(name) !== -1) {
            skipText = true;
            skipTextDepth = 1;
          }
        }
        skipMap[depth] = true;
      }
      depth++;
      if (skip) {
        if (settings.disallowedTagsMode === 'discard') {
          // We want the contents but not this tag
          return;
        }
        tempResult = result;
        result = '';
      }
      result += '<' + name;

      if (name === 'script') {
        if (settings.allowedScriptHostnames || settings.allowedScriptDomains) {
          frame.innerText = '';
        }
      }

      if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap['*']) {
        each(attribs, function (value, a) {
          if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
            // This prevents part of an attribute name in the output from being
            // interpreted as the end of an attribute, or end of a tag.
            Reflect.deleteProperty(frame.attribs, a);
            return;
          }
          // check allowedAttributesMap for the element and attribute and modify the value
          // as necessary if there are specific values defined.
          let passedAllowedAttributesMapCheck = false;
          if (!allowedAttributesMap ||
            (has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1) ||
            (allowedAttributesMap['*'] && allowedAttributesMap['*'].indexOf(a) !== -1) ||
            (has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a)) ||
            (allowedAttributesGlobMap['*'] && allowedAttributesGlobMap['*'].test(a))) {
            passedAllowedAttributesMapCheck = true;
          } else if (allowedAttributesMap && allowedAttributesMap[name]) {
            for (const o of allowedAttributesMap[name]) {
              if (isPlainObject(o) && o.name && (o.name === a)) {
                passedAllowedAttributesMapCheck = true;
                let newValue = '';
                if (o.multiple === true) {
                  // verify the values that are allowed
                  const splitStrArray = value.split(' ');
                  for (const s of splitStrArray) {
                    if (o.values.indexOf(s) !== -1) {
                      if (newValue === '') {
                        newValue = s;
                      } else {
                        newValue += ' ' + s;
                      }
                    }
                  }
                } else if (o.values.indexOf(value) >= 0) {
                  // verified an allowed value matches the entire attribute value
                  newValue = value;
                }
                value = newValue;
              }
            }
          }
          if (passedAllowedAttributesMapCheck) {
            if (settings.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
              if (naughtyHref(name, value)) {
                Reflect.deleteProperty(frame.attribs, a);
                return;
              }
            }

            if (name === 'script' && a === 'src') {

              let allowed: boolean | string | undefined = true;

              try {
                const parsed = new URL(value);

                if (settings.allowedScriptHostnames || settings.allowedScriptDomains) {
                  const allowedHostname = (settings.allowedScriptHostnames || []).find(function (hostname) {
                    return hostname === parsed.hostname;
                  });
                  const allowedDomain = (settings.allowedScriptDomains || []).find(function (domain) {
                    return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
                  });
                  allowed = allowedHostname || allowedDomain;
                }
              } catch {
                allowed = false;
              }

              if (!allowed) {
                Reflect.deleteProperty(frame.attribs, a);
                return;
              }
            }

            if (name === 'iframe' && a === 'src') {
              let allowed: boolean | string | undefined = true;
              try {
                // Chrome accepts \ as a substitute for / in the // at the
                // start of a URL, so rewrite accordingly to prevent exploit.
                // Also drop any whitespace at that point in the URL
                value = value.replace(/^(\w+:)?\s*[\\/]\s*[\\/]/, '$1//');
                if (value.startsWith('relative:')) {
                  // An attempt to exploit our workaround for base URLs being
                  // mandatory for relative URL validation in the WHATWG
                  // URL parser, reject it
                  throw new Error('relative: exploit attempt');
                }
                // naughtyHref is in charge of whether protocol relative URLs
                // are cool. Here we are concerned just with allowed hostnames and
                // whether to allow relative URLs.
                //
                // Build a placeholder "base URL" against which any reasonable
                // relative URL may be parsed successfully
                let base = 'relative://relative-site';
                for (let i = 0; (i < 100); i++) {
                  base += `/${i}`;
                }
                const parsed = new URL(value, base);
                const isRelativeUrl = parsed && parsed.hostname === 'relative-site' && parsed.protocol === 'relative:';
                if (isRelativeUrl) {
                  // default value of allowIframeRelativeUrls is true
                  // unless allowedIframeHostnames or allowedIframeDomains specified
                  allowed = has(settings, 'allowIframeRelativeUrls')
                    ? settings.allowIframeRelativeUrls
                    : (!settings.allowedIframeHostnames && !settings.allowedIframeDomains);
                } else if (settings.allowedIframeHostnames || settings.allowedIframeDomains) {
                  const allowedHostname = (settings.allowedIframeHostnames || []).find(function (hostname) {
                    return hostname === parsed.hostname;
                  });
                  const allowedDomain = (settings.allowedIframeDomains || []).find(function (domain) {
                    return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
                  });
                  allowed = allowedHostname || allowedDomain;
                }
              } catch {
                // Unparseable iframe src
                allowed = false;
              }
              if (!allowed) {
                Reflect.deleteProperty(frame.attribs, a);
                return;
              }
            }
            if (a === 'srcset') {
              Reflect.deleteProperty(frame.attribs, a);

              // ABS UPDATE: srcset not necessary
              // try {
              //   parsed = parseSrcset(value);
              //   parsed.forEach(function (value) {
              //     if (naughtyHref('srcset', value.url)) {
              //       value.evil = true;
              //     }
              //   });
              //   parsed = filter(parsed, function (v) {
              //     return !v.evil;
              //   });
              //   if (!parsed.length) {
              //     delete frame.attribs[a];
              //     return;
              //   } else {
              //     value = stringifySrcset(filter(parsed, function (v) {
              //       return !v.evil;
              //     }));
              //     frame.attribs[a] = value;
              //   }
              // } catch {
              //   // Unparseable srcset
              //   delete frame.attribs[a];
              //   return;
              // }
            }
            if (a === 'class') {
              const allowedSpecificClasses = allowedClassesMap[name];
              const allowedWildcardClasses = allowedClassesMap['*'];
              const allowedSpecificClassesGlob = allowedClassesGlobMap[name];
              const allowedSpecificClassesRegex = allowedClassesRegexMap[name];
              const allowedWildcardClassesGlob = allowedClassesGlobMap['*'];
              const allowedClassesGlobs = [
                allowedSpecificClassesGlob,
                allowedWildcardClassesGlob
              ]
                .concat(allowedSpecificClassesRegex)
                .filter(function (t) {
                  return t;
                });
              if (allowedSpecificClasses && allowedWildcardClasses) {
                // ABS UPDATE: classes and wildcard classes not necessary now
                // value = filterClasses(value, deepmerge(allowedSpecificClasses, allowedWildcardClasses), allowedClassesGlobs);
              } else {
                value = filterClasses(value, allowedSpecificClasses || allowedWildcardClasses, allowedClassesGlobs);
              }
              if (!value.length) {
                Reflect.deleteProperty(frame.attribs, a);
                return;
              }
            }
            if (a === 'style') {
              Reflect.deleteProperty(frame.attribs, a);

              // ABS UPDATE: Styles not necessary
              // try {
              //   const abstractSyntaxTree = postcssParse(name + ' {' + value + '}');
              //   const filteredAST = filterCss(abstractSyntaxTree, options.allowedStyles);

              //   value = stringifyStyleAttributes(filteredAST);

              //   if (value.length === 0) {
              //     delete frame.attribs[a];
              //     return;
              //   }
              // } catch {
              //   delete frame.attribs[a];
              //   return;
              // }
            }
            result += ' ' + a;
            if (value && value.length) {
              result += '="' + escapeHtml(value, true) + '"';
            }
          } else {
            Reflect.deleteProperty(frame.attribs, a);
          }
        });
      }
      if (settings.selfClosing.indexOf(name) !== -1) {
        result += ' />';
      } else {
        result += '>';
        if (frame.innerText && !hasText && !settings.textFilter) {
          result += escapeHtml(frame.innerText);
          addedText = true;
        }
      }
      if (skip) {
        result = tempResult + escapeHtml(result);
        tempResult = '';
      }
    },
    ontext: function (text) {
      if (skipText) {
        return;
      }
      const lastFrame = stack[stack.length - 1];
      let tag;

      if (lastFrame) {
        tag = lastFrame.tag;
        // If inner text was set by transform function then let's use it
        text = lastFrame.innerText !== undefined ? lastFrame.innerText : text;
      }

      if (settings.disallowedTagsMode === 'discard' && ((tag === 'script') || (tag === 'style'))) {
        // htmlparser2 gives us these as-is. Escaping them ruins the content. Allowing
        // script tags is, by definition, game over for XSS protection, so if that's
        // your concern, don't allow them. The same is essentially true for style tags
        // which have their own collection of XSS vectors.
        result += text;
      } else {
        const escaped = escapeHtml(text, false);
        if (settings.textFilter && !addedText) {
          result += settings.textFilter(escaped, tag);
        } else if (!addedText) {
          result += escaped;
        }
      }
      if (stack.length) {
        const frame = stack[stack.length - 1];
        frame.text += text;
      }
    },
    onclosetag: function (name) {

      if (skipText) {
        skipTextDepth--;
        if (!skipTextDepth) {
          skipText = false;
        } else {
          return;
        }
      }

      const frame = stack.pop();
      if (!frame) {
        // Do not crash on bad markup
        return;
      }
      skipText = settings.enforceHtmlBoundary ? name === 'html' : false;
      depth--;
      const skip = skipMap[depth];
      if (skip) {
        delete skipMap[depth];
        if (settings.disallowedTagsMode === 'discard') {
          frame.updateParentNodeText();
          return;
        }
        tempResult = result;
        result = '';
      }

      if (transformMap[depth]) {
        name = transformMap[depth];
        delete transformMap[depth];
      }

      if (settings.exclusiveFilter && settings.exclusiveFilter(frame)) {
        result = result.substr(0, frame.tagPosition);
        return;
      }

      frame.updateParentNodeMediaChildren();
      frame.updateParentNodeText();

      if (settings.selfClosing.indexOf(name) !== -1) {
        // Already output />
        if (skip) {
          result = tempResult;
          tempResult = '';
        }
        return;
      }

      result += '</' + name + '>';
      if (skip) {
        result = tempResult + escapeHtml(result);
        tempResult = '';
      }
      addedText = false;
    }
  }, parserOptions);
  parser.write(html);
  parser.end();

  return result;

  function initializeState() {
    result = '';
    depth = 0;
    stack = [];
    skipMap = {};
    transformMap = {};
    skipText = false;
    skipTextDepth = 0;
  }

  function escapeHtml(value: unknown, quote?: boolean) {
    let s = typeof value === 'string' ? value : (value as string) + '';
    if (parserOptions.decodeEntities) {
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (quote) {
        s = s.replace(/"/g, '&quot;');
      }
    }
    // TODO: this is inadequate because it will pass `&0;`. This approach
    // will not work, each & must be considered with regard to whether it
    // is followed by a 100% syntactically valid entity or not, and escaped
    // if it is not. If this bothers you, don't set parser.decodeEntities
    // to false. (The default is true.)
    s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, '&amp;') // Match ampersands not part of existing HTML entity
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (quote) {
      s = s.replace(/"/g, '&quot;');
    }
    return s;
  }

  function naughtyHref(name: string, href: string) {
    // Browsers ignore character codes of 32 (space) and below in a surprising
    // number of situations. Start reading here:
    // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet#Embedded_tab
    href = href.replace(/[\x00-\x20]+/g, '');
    // Clobber any comments in URLs, which the browser might
    // interpret inside an XML data island, allowing
    // a javascript: URL to be snuck through
    href = href.replace(/<!--.*?-->/g, '');
    // Case insensitive so we don't get faked out by JAVASCRIPT #1
    // Allow more characters after the first so we don't get faked
    // out by certain schemes browsers accept
    const matches = href.match(/^([a-zA-Z][a-zA-Z0-9.\-+]*):/);
    if (!matches) {
      // Protocol-relative URL starting with any combination of '/' and '\'
      if (href.match(/^[/\\]{2}/)) {
        return !settings.allowProtocolRelative;
      }

      // No scheme
      return false;
    }
    const scheme = matches[1].toLowerCase();

    if (has(settings.allowedSchemesByTag, name)) {
      return settings.allowedSchemesByTag[name].indexOf(scheme) === -1;
    }

    return !settings.allowedSchemes || settings.allowedSchemes.indexOf(scheme) === -1;
  }

  function filterClasses(classes: string, allowed: string[] | undefined, allowedGlobs: RegExp[]) {
    if (!allowed) {
      // The class attribute is allowed without filtering on this tag
      return classes;
    }
    const names = classes.split(/\s+/);
    return names.filter(function (clss) {
      return allowed.indexOf(clss) !== -1 || allowedGlobs.some(function (glob) {
        return glob.test(clss);
      });
    }).join(' ');
  }
}

// Defaults are accessible to you so that you can use them as a starting point
// programmatically if you wish

const htmlParserDefaults: ParserOptions = {
  decodeEntities: true
};
sanitizeHtml.defaults = {
  allowedTags: [
    // Sections derived from MDN element categories and limited to the more
    // benign categories.
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element
    // Content sectioning
    'address', 'article', 'aside', 'footer', 'header',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup',
    'main', 'nav', 'section',
    // Text content
    'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
    'hr', 'li', 'main', 'ol', 'p', 'pre', 'ul',
    // Inline text semantics
    'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
    'em', 'i', 'kbd', 'mark', 'q',
    'rb', 'rp', 'rt', 'rtc', 'ruby',
    's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
    // Table content
    'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr'
  ],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    // We don't currently allow img itself by default, but
    // these attributes would make sense if we did.
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading']
  },
  // Lots of these won't come up by default because we don't allow them
  selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
  // URL schemes we permit
  allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: true,
  enforceHtmlBoundary: false
} as Defaults;

sanitizeHtml.simpleTransform = function (newTagName: string, newAttribs?: Attributes | null, merge?: boolean): TagTransform {
  merge = (merge === undefined) ? true : merge;
  const replacements = newAttribs || {};

  return function (tagName, attribs) {
    void tagName;
    let attrib;
    if (merge) {
      for (attrib in replacements) {
        Reflect.set(attribs, attrib, replacements[attrib]);
      }
    } else {
      attribs = replacements;
    }

    return {
      tagName: newTagName,
      attribs: attribs
    };
  };
};

export = sanitizeHtml;
