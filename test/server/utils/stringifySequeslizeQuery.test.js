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
})
