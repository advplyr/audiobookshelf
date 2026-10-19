const { expect } = require('chai')
const stringifySequelizeQuery = require('../../../server/utils/stringifySequelizeQuery')
const Sequelize = require('sequelize')

class DummyClass {}

describe('stringifySequelizeQuery', () => {
  it('should stringify a sequelize query containing an op', () => {
    const query = {
      where: {
        name: 'John',
        age: {
          [Sequelize.Op.gt]: 20
        }
      }
    }

    const result = stringifySequelizeQuery(query)
    expect(result).to.equal('{"where":{"name":"John","age":{"Symbol(gt)":20}}}')
  })

  it('should stringify a sequelize query containing a literal', () => {
    const query = {
      order: [[Sequelize.literal('libraryItem.title'), 'ASC']]
    }

    const result = stringifySequelizeQuery(query)
    expect(result).to.equal('{"order":{"0":{"0":{"val":"libraryItem.title"},"1":"ASC"}}}')
  })

  it('should stringify a sequelize query containing a class', () => {
    const query = {
      include: [
        {
          model: DummyClass
        }
      ]
    }

    const result = stringifySequelizeQuery(query)
    expect(result).to.equal('{"include":{"0":{"model":"DummyClass"}}}')
  })

  it('should ignore non-class functions', () => {
    const query = {
      logging: (query) => console.log(query)
    }

    const result = stringifySequelizeQuery(query)
    expect(result).to.equal('{}')
  })

  it('should preserve primitive JSON results and undefined root results', () => {
    expect(stringifySequelizeQuery(null)).to.equal('null')
    expect(stringifySequelizeQuery('query')).to.equal('"query"')
    expect(stringifySequelizeQuery(42)).to.equal('42')
    expect(stringifySequelizeQuery(undefined)).to.equal(undefined)
    expect(stringifySequelizeQuery(() => {})).to.equal(undefined)
    expect(stringifySequelizeQuery(Symbol('query'))).to.equal(undefined)
  })

  it('should include non-enumerable symbol values and prefer symbols on name collisions', () => {
    const operator = Symbol('operator')
    const query = { 'Symbol(operator)': 'string value' }
    Object.defineProperty(query, operator, { value: 'symbol value' })

    expect(stringifySequelizeQuery(query)).to.equal('{"Symbol(operator)":"symbol value"}')
  })

  it('should preserve errors for circular structures and bigint values', () => {
    const query = {}
    query.where = query

    // The replacer copies objects, so cycles exhaust the stack rather than reaching JSON's cycle check.
    expect(() => stringifySequelizeQuery(query)).to.throw(RangeError)
    expect(() => stringifySequelizeQuery({ id: 1n })).to.throw(TypeError)
  })
})
