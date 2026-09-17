const { expect } = require('chai')

const cron = require('../../../../server/libs/nodeCron')
const convertExpression = require('../../../../server/libs/nodeCron/convert-expression')
const patternValidation = require('../../../../server/libs/nodeCron/pattern-validation')
const TimeMatcher = require('../../../../server/libs/nodeCron/time-matcher')

/**
 * The conversion prepends a seconds field, so the resulting fields are
 * [seconds, minutes, hours, days, months, weekdays]
 */
function fieldsOf(expression) {
  return convertExpression(expression).split(' ')
}

function minutesOf(expression) {
  return fieldsOf(expression)[1]
}

function hoursOf(expression) {
  return fieldsOf(expression)[2]
}

describe('nodeCron convert-expression', () => {
  describe('ranges with a step value', () => {
    it('steps from the start of the range', () => {
      expect(hoursOf('0 1-23/2 * * *')).to.equal('1,3,5,7,9,11,13,15,17,19,21,23')
      expect(hoursOf('0 4-10/3 * * *')).to.equal('4,7,10')
      expect(minutesOf('5-59/10 * * * *')).to.equal('5,15,25,35,45,55')
    })

    it('keeps ranges starting at zero unchanged', () => {
      expect(hoursOf('0 0-23/2 * * *')).to.equal('0,2,4,6,8,10,12,14,16,18,20,22')
    })

    it('applies the step to the range it is attached to', () => {
      expect(hoursOf('0 1-5,10-20/2 * * *')).to.equal('1,2,3,4,5,10,12,14,16,18,20')
    })

    // Documents existing behavior: this parser expands a reversed range ascending from the
    // lower bound instead of wrapping around. Real cron (and node-cron 4.x) would wrap 23 -> 1.
    it('expands a reversed range ascending (wraparound is not supported by this vendored parser)', () => {
      expect(hoursOf('0 23-1/2 * * *')).to.equal('1,3,5,7,9,11,13,15,17,19,21,23')
    })

    it('rejects a step value of zero', () => {
      expect(cron.validate('0-59/0 * * * *')).to.equal(false)
      expect(() => patternValidation('0-59/0 * * * *')).to.throw('0-59/0 is a invalid expression for minute')
    })

    it('rejects a non-numeric step value', () => {
      expect(cron.validate('0 1-5/2x * * *')).to.equal(false)
      expect(cron.validate('*/2x * * * *')).to.equal(false)
      // The library throws a plain string rather than an Error for invalid step values.
      expect(() => patternValidation('1-5/2x * * * *')).to.throw()
      try {
        patternValidation('1-5/2x * * * *')
      } catch (error) {
        expect(error).to.equal('2x is not a valid step value')
      }
    })
  })

  describe('expressions without a range step', () => {
    it('converts asterisks with a step value', () => {
      expect(minutesOf('*/15 * * * *')).to.equal('0,15,30,45')
      expect(hoursOf('0 */2 * * *')).to.equal('0,2,4,6,8,10,12,14,16,18,20,22')
    })

    it('expands a plain range', () => {
      expect(hoursOf('0 1-5 * * *')).to.equal('1,2,3,4,5')
    })

    it('leaves lists untouched', () => {
      expect(hoursOf('0 1,5,9 * * *')).to.equal('1,5,9')
    })
  })
})

describe('nodeCron TimeMatcher', () => {
  it('matches the odd hours of 1-23/2', () => {
    const timeMatcher = new TimeMatcher('0 1-23/2 * * *')
    expect(timeMatcher.match(new Date(2026, 7, 11, 1, 0, 0))).to.equal(true)
    expect(timeMatcher.match(new Date(2026, 7, 11, 2, 0, 0))).to.equal(false)
    expect(timeMatcher.match(new Date(2026, 7, 11, 23, 0, 0))).to.equal(true)
  })

  it('matches the even hours of 0-23/2', () => {
    const timeMatcher = new TimeMatcher('0 0-23/2 * * *')
    expect(timeMatcher.match(new Date(2026, 7, 11, 0, 0, 0))).to.equal(true)
    expect(timeMatcher.match(new Date(2026, 7, 11, 1, 0, 0))).to.equal(false)
  })
})
