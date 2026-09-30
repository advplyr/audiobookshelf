const { expect } = require('chai')
const constants = require('../../../server/utils/constants')
const globals = require('../../../server/utils/globals')
const areEquivalent = require('../../../server/utils/areEquivalent')
const seriesParser = require('../../../server/utils/parsers/parseSeriesString')

describe('foundation utilities', () => {
  it('preserves CommonJS export shapes and constant values', () => {
    expect(Object.keys(constants)).to.deep.equal(['ScanResult', 'BookCoverAspectRatio', 'BookshelfView', 'LogLevel', 'PlayMethod', 'AudioMimeType'])
    expect(constants).to.deep.equal({
      ScanResult: { NOTHING: 0, ADDED: 1, UPDATED: 2, REMOVED: 3, UPTODATE: 4 },
      BookCoverAspectRatio: { STANDARD: 0, SQUARE: 1 },
      BookshelfView: { STANDARD: 0, DETAIL: 1 },
      LogLevel: { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5, NOTE: 6 },
      PlayMethod: { DIRECTPLAY: 0, DIRECTSTREAM: 1, TRANSCODE: 2, LOCAL: 3 },
      AudioMimeType: {
        MP3: 'audio/mpeg', M4B: 'audio/mp4', M4A: 'audio/mp4', MP4: 'audio/mp4',
        OGG: 'audio/ogg', OGA: 'audio/ogg', OPUS: 'audio/ogg', AAC: 'audio/aac',
        FLAC: 'audio/flac', WMA: 'audio/x-ms-wma', AIFF: 'audio/x-aiff', AIF: 'audio/x-aiff',
        WEBM: 'audio/webm', WEBMA: 'audio/webm', MKA: 'audio/x-matroska',
        AWB: 'audio/amr-wb', CAF: 'audio/x-caf', MPEG: 'audio/mpeg', MPG: 'audio/mpeg'
      }
    })
    expect(areEquivalent).to.be.a('function')
    expect(Object.keys(areEquivalent)).to.deep.equal([])
    expect(Object.keys(seriesParser)).to.deep.equal(['parse'])
  })

  it('preserves the extension lists and direct globals export', () => {
    expect(globals).to.deep.equal({
      SupportedImageTypes: ['png', 'jpg', 'jpeg', 'webp'],
      SupportedAudioTypes: ['m4b', 'mp3', 'm4a', 'flac', 'opus', 'ogg', 'oga', 'mp4', 'aac', 'wma', 'aiff', 'aif', 'wav', 'webm', 'webma', 'mka', 'awb', 'caf', 'mpg', 'mpeg'],
      SupportedEbookTypes: ['epub', 'pdf', 'mobi', 'azw3', 'cbr', 'cbz'],
      TextFileTypes: ['txt', 'nfo'],
      MetadataFileTypes: ['opf', 'abs', 'xml', 'json']
    })
    expect(Object.keys(globals)).to.deep.equal(['SupportedImageTypes', 'SupportedAudioTypes', 'SupportedEbookTypes', 'TextFileTypes', 'MetadataFileTypes'])
  })

  it('keeps constants and extension arrays mutable', () => {
    const original = constants.LogLevel.INFO
    try {
      constants.LogLevel.INFO = 100
      globals.SupportedImageTypes.push('test-extension')
      expect(constants.LogLevel.INFO).to.equal(100)
      expect(globals.SupportedImageTypes[globals.SupportedImageTypes.length - 1]).to.equal('test-extension')
    } finally {
      constants.LogLevel.INFO = original
      if (globals.SupportedImageTypes[globals.SupportedImageTypes.length - 1] === 'test-extension') globals.SupportedImageTypes.pop()
    }
  })

  describe('areEquivalent', () => {
    it('compares primitives and identical references', () => {
      const symbol = Symbol('same')
      for (const value of [null, undefined, 0, -0, 1, '', 'name', true, false, 1n, symbol, {}, [], () => {}]) {
        expect(areEquivalent(value, value)).to.equal(true)
      }
      for (const [left, right] of [[null, undefined], [null, {}], [0, false], [1, '1'], [1, 2], ['a', 'b'], [true, false], [1n, 2n], [symbol, Symbol('same')]]) {
        expect(areEquivalent(left, right)).to.equal(false)
      }
      expect(areEquivalent(NaN, NaN)).to.equal(true)
      expect(areEquivalent(NaN, 0)).to.equal(false)
    })

    it('preserves coercive numeric string comparisons', () => {
      for (const [left, right, expected] of [
        [1, '1', true], [false, 'false', true], [true, '1', false],
        ['', 0, false], [null, 0, false], [undefined, NaN, false], [NaN, NaN, true],
        [[1], '1', true], [[], '', true], [{ valueOf: () => 1, toString: () => 'one' }, 'one', true],
        [{ valueOf: () => 1 }, '[object Object]', true],
        [{ part: 1 }, { part: '1' }, true]
      ]) {
        expect(areEquivalent(left, right, true)).to.equal(expected)
      }
    })

    it('preserves native conversion errors, including identical values', () => {
      for (const value of [Symbol('value'), 1n, Object(1n), { [Symbol.toPrimitive]: () => 1n }, { [Symbol.toPrimitive]: () => Symbol('value') }]) {
        expect(() => areEquivalent(value, value, true)).to.throw(TypeError)
        expect(() => areEquivalent(null, value, true)).to.throw(TypeError)
      }
      const failure = new Error('conversion failed')
      expect(() => areEquivalent({ valueOf() { throw failure } }, 1, true)).to.throw(failure)
    })

    it('compares functions by their own toString methods', () => {
      const makeFunction = () => function same() { return 1 }
      expect(areEquivalent(makeFunction(), makeFunction())).to.equal(true)
      expect(areEquivalent(makeFunction(), function different() { return 2 })).to.equal(false)
      const left = () => 1
      const right = () => 2
      left.toString = right.toString = () => 'custom source'
      expect(areEquivalent(left, right)).to.equal(true)
    })

    it('compares valid and invalid dates and preserves asymmetric object checks', () => {
      expect(areEquivalent(new Date(123), new Date(123))).to.equal(true)
      expect(areEquivalent(new Date(123), new Date(124))).to.equal(false)
      expect(areEquivalent(new Date(NaN), new Date(NaN))).to.equal(true)
      expect(areEquivalent(new Date(NaN), new Date(0))).to.equal(false)
      expect(areEquivalent(new Date(0), {})).to.equal(false)
      expect(areEquivalent({}, new Date(0))).to.equal(true)
    })

    it('compares nested enumerable properties regardless of order or prototype', () => {
      expect(areEquivalent({ a: [1, { b: 'two' }], c: true }, { c: true, a: [1, { b: 'two' }] })).to.equal(true)
      expect(areEquivalent({ a: 1 }, { b: 1 })).to.equal(false)
      expect(areEquivalent({ a: 1 }, { a: 1, b: 2 })).to.equal(false)
      expect(areEquivalent({ a: 1 }, { a: 2 })).to.equal(false)
      expect(areEquivalent({ a: 1 }, Object.assign(Object.create(null), { a: 1 }))).to.equal(true)
      expect(areEquivalent(Object.create({ inherited: 1 }), {})).to.equal(true)
      expect(areEquivalent({ [Symbol('hidden')]: 1 }, {})).to.equal(true)
      expect(areEquivalent({ get a() { return 1 } }, { a: 1 })).to.equal(true)
    })

    it('compares array indices and preserves holes and object asymmetry', () => {
      const left = [1]
      left.extra = 'ignored'
      expect(areEquivalent(left, [1])).to.equal(true)
      expect(areEquivalent([1], [2])).to.equal(false)
      expect(areEquivalent([1], [1, 2])).to.equal(false)
      expect(areEquivalent(new Array(1), [undefined])).to.equal(true)
      expect(areEquivalent([], {})).to.equal(false)
      expect(areEquivalent({}, [])).to.equal(true)
    })

    it('preserves circular detection and repeated-reference stack behavior', () => {
      const left = {}
      const right = {}
      left.self = left
      right.self = right
      expect(() => areEquivalent(left, right)).to.throw(Error, 'areEquivalent value1 is circular')
      expect(areEquivalent(left, left)).to.equal(true)
      for (const shared of [[], {}]) {
        expect(() => areEquivalent({ a: shared, b: shared }, { a: [], b: [] })).to.throw(Error, 'areEquivalent value1 is circular')
      }
      const shared = { value: 1 }
      expect(areEquivalent({ a: shared, b: shared }, { a: { value: 1 }, b: { value: 1 } })).to.equal(true)
      expect(areEquivalent({ a: {} }, right)).to.equal(false)
    })

    it('preserves caller-supplied stack mutations', () => {
      const stack = []
      const array = [1]
      expect(areEquivalent(array, [1], false, stack)).to.equal(true)
      expect(stack).to.deep.equal([array])
      const empty = {}
      expect(areEquivalent(empty, {}, false, stack)).to.equal(true)
      expect(stack).to.deep.equal([array, empty])
      expect(areEquivalent({ a: 1 }, { a: 1 }, false, stack)).to.equal(true)
      expect(stack).to.deep.equal([array, empty])
      expect(() => areEquivalent(array, [1], false, stack)).to.throw(Error, 'areEquivalent value1 is circular')
    })
  })

  describe('parseSeriesString', () => {
    it('parses names and trailing sequences without trimming', () => {
      for (const [input, expected] of [
        ['Name #1', { name: 'Name', sequence: '1' }],
        ['Name #1a', { name: 'Name', sequence: '1a' }],
        ['Name #1.5', { name: 'Name', sequence: '1.5' }],
        ['Name', { name: 'Name', sequence: null }],
        [' Name ', { name: ' Name ', sequence: null }],
        [' ', { name: ' ', sequence: null }],
        [' #1', { name: '', sequence: '1' }],
        ['Name #1 #2', { name: 'Name #1', sequence: '2' }]
      ]) {
        expect(seriesParser.parse(input)).to.deep.equal(expected)
      }
    })

    it('keeps malformed sequences as part of the name', () => {
      for (const input of ['Name #1#a', 'Name #1 a', 'Name #', 'Name#1', 'Name #1 ', 'Name #1\n']) {
        expect(seriesParser.parse(input)).to.deep.equal({ name: input, sequence: null })
      }
    })

    it('rejects empty strings and all non-string inputs', () => {
      for (const input of ['', null, undefined, 0, 42, false, true, NaN, 1n, Symbol('name'), [], {}, new String('Name #1'), () => 'Name']) {
        expect(seriesParser.parse(input)).to.equal(null)
      }
    })
  })
})
