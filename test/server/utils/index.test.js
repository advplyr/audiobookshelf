const { expect } = require('chai')
const utils = require('../../../server/utils/index')

describe('general utilities', () => {
  it('preserves the CommonJS export surface', () => {
    expect(Object.keys(utils)).to.deep.equal([
      'levenshteinDistance', 'levenshteinSimilarity', 'isObject', 'comparePaths',
      'isNullOrNaN', 'clampPositiveInt', 'xmlToJSON', 'getId', 'elapsedPretty',
      'secondsToTimestamp', 'reqSupportsWebp', 'areEquivalent', 'copyValue',
      'toNumber', 'cleanStringForSearch', 'getTitleIgnorePrefix', 'getTitlePrefixAtEnd',
      'escapeRegExp', 'validateUrl', 'isUUID', 'isValidASIN', 'timestampToSeconds',
      'ValidationError', 'NotFoundError', 'getQueryParamAsString'
    ])
  })

  it('preserves string conversion and distance calculations', () => {
    expect(utils.levenshteinDistance('Kitten', 'sitting')).to.equal(3)
    expect(utils.levenshteinDistance(null, 'null')).to.equal(0)
    expect(utils.levenshteinDistance('A', 'a', true)).to.equal(1)
    expect(utils.levenshteinSimilarity('', '')).to.equal(1)
    expect(utils.levenshteinSimilarity('abc', 'abd')).to.be.closeTo(2 / 3, 1e-12)
  })

  it('preserves coercive numeric checks and their native errors', () => {
    for (const [value, expected] of [[null, true], [undefined, true], ['', false], [false, false], ['12', false], ['bad', true]]) {
      expect(utils.isNullOrNaN(value)).to.equal(expected)
    }
    expect(utils.toNumber(null, 7)).to.equal(7)
    expect(utils.toNumber('', 7)).to.equal(0)
    expect(utils.toNumber('bad', 7)).to.equal(7)
    for (const value of [1n, Symbol('value'), { valueOf: () => 1n }]) {
      expect(() => utils.isNullOrNaN(value)).to.throw(TypeError)
      expect(() => utils.toNumber(value)).to.throw(TypeError)
    }
    expect(utils.clampPositiveInt(4.9, 3)).to.equal(3)
    for (const value of [null, undefined, NaN, Infinity, 0, -1]) {
      expect(utils.clampPositiveInt(value, 3)).to.equal(null)
    }
  })

  it('copies enumerable inherited fields, preserves primitives, and normalizes empty values', () => {
    const source = Object.assign(Object.create({ inherited: '' }), { nested: [undefined, false, { value: 1 }] })
    const result = utils.copyValue(source)
    expect(result).to.deep.equal({ inherited: null, nested: [null, false, { value: 1 }] })
    expect(result.nested).not.to.equal(source.nested)
    const fn = () => 1
    expect(utils.copyValue(fn)).to.equal(fn)
    expect(utils.copyValue(new Date(0))).to.deep.equal({})
  })

  it('keeps recursive copying connected to mutable exports', () => {
    const original = utils.copyValue
    try {
      utils.copyValue = () => 'replacement'
      expect(original([1, 2])).to.deep.equal(['replacement', 'replacement'])
    } finally {
      utils.copyValue = original
    }
  })

  it('parses XML and resolves malformed or empty XML as null', async () => {
    expect(await utils.xmlToJSON('<root><name>Book</name></root>')).to.deep.equal({ root: { name: ['Book'] } })
    expect(await utils.xmlToJSON(Buffer.from('<root/>'))).to.deep.equal({ root: '' })
    expect(await utils.xmlToJSON('')).to.equal(null)
    expect(await utils.xmlToJSON('<root>')).to.equal(null)
  })

  it('preserves sorting prefixes and the initialization requirement', () => {
    const previous = global.ServerSettings
    try {
      global.ServerSettings = { sortingPrefixes: ['the', 'a'] }
      expect(utils.getTitleIgnorePrefix('The Book')).to.equal('Book')
      expect(utils.getTitlePrefixAtEnd('The Book')).to.equal('Book, The')
      expect(utils.getTitlePrefixAtEnd('Other')).to.equal('Other')
      delete global.ServerSettings
      expect(utils.getTitleIgnorePrefix('')).to.equal('')
      expect(() => utils.getTitleIgnorePrefix('Book')).to.throw(TypeError)
    } finally {
      if (previous === undefined) delete global.ServerSettings
      else global.ServerSettings = previous
    }
  })

  it('preserves query validation and string conversion', () => {
    expect(utils.getQueryParamAsString({}, 'q', 'fallback')).to.equal('fallback')
    expect(utils.getQueryParamAsString({ q: { value: 1 } }, 'q')).to.equal('[object Object]')
    expect(() => utils.getQueryParamAsString({ q: ['a'] }, 'q')).to.throw(utils.ValidationError)
    expect(() => utils.getQueryParamAsString({}, 'q', '', true)).to.throw(utils.ValidationError)
    expect(() => utils.getQueryParamAsString({ q: 'a'.repeat(1001) }, 'q')).to.throw(utils.ValidationError)
    const error = new utils.ValidationError('q', 'is required')
    expect(error.paramName).to.equal('q')
    expect(error.status).to.equal(400)
    expect(new utils.NotFoundError('missing').status).to.equal(404)
  })

  it('preserves timestamp formatting and parsing', () => {
    expect(utils.secondsToTimestamp(3661)).to.equal('1:01:01')
    // Preserve the existing millisecond calculation, including its negative fraction.
    expect(utils.secondsToTimestamp(61.25, true)).to.equal('1:01.750')
    expect(utils.secondsToTimestamp(1, false, true)).to.equal('00:00:01')
    expect(utils.timestampToSeconds('1:01:01')).to.equal(3661)
    for (const value of [null, 'bad', '1:2:3:4']) expect(utils.timestampToSeconds(value)).to.equal(null)
    expect(utils.elapsedPretty(0.5)).to.equal('500 ms')
    expect(utils.elapsedPretty(4200)).to.equal('1 hr 10 min')
  })

  it('preserves guarded string and request helpers', () => {
    expect(utils.reqSupportsWebp(null)).to.equal(false)
    expect(utils.reqSupportsWebp({ headers: { accept: '*/*' } })).to.equal(true)
    expect(utils.escapeRegExp('a.b')).to.equal('a\\.b')
    expect(utils.escapeRegExp(null)).to.equal('')
    expect(utils.validateUrl(null)).to.equal(null)
    expect(utils.isUUID('00000000-0000-0000-0000-000000000000')).to.equal(true)
    expect(utils.isValidASIN('B012345678')).to.equal(true)
    expect(utils.isValidASIN(null)).to.equal(false)
  })
})
