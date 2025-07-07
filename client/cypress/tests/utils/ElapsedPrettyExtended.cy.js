import Vue from 'vue'
import '@/plugins/utils'

// This is the actual function that is being tested
const elapsedPrettyExtended = Vue.prototype.$elapsedPrettyExtended

// Helper function to convert days, hours, minutes, seconds to total seconds
function DHMStoSeconds(days, hours, minutes, seconds) {
  return seconds + minutes * 60 + hours * 3600 + days * 86400
}

describe('$elapsedPrettyExtended', () => {
  describe('function is on the Vue Prototype', () => {
    it('exists as a function on Vue.prototype', () => {
      expect(Vue.prototype.$elapsedPrettyExtended).to.exist
      expect(Vue.prototype.$elapsedPrettyExtended).to.be.a('function')
    })
  })

  describe('param default values', () => {
    const testSeconds = DHMStoSeconds(0, 25, 1, 5) // 25h 1m 5s = 90065 seconds

    it('uses useDays=true showSeconds=true by default', () => {
      expect(elapsedPrettyExtended(testSeconds)).to.equal('1d 1h 1m 5s')
    })

    it('only useDays=false overrides useDays but keeps showSeconds=true', () => {
      expect(elapsedPrettyExtended(testSeconds, false)).to.equal('25h 1m 5s')
    })

    it('explicit useDays=false showSeconds=false overrides both', () => {
      expect(elapsedPrettyExtended(testSeconds, false, false)).to.equal('25h 1m')
    })
  })

  describe('useDays=false showSeconds=true', () => {
    const useDaysFalse = false
    const showSecondsTrue = true
    const testCases = [
      [[0, 0, 0, 0], '', '0s -> ""'],
      [[0, 1, 0, 1], '1h 1s', '1h 1s -> 1h 1s'],
      [[0, 25, 0, 1], '25h 1s', '25h 1s -> 25h 1s']
    ]

    testCases.forEach(([dhms, expected, description]) => {
      it(description, () => {
        expect(elapsedPrettyExtended(DHMStoSeconds(...dhms), useDaysFalse, showSecondsTrue)).to.equal(expected)
      })
    })
  })

  describe('useDays=true showSeconds=true', () => {
    const useDaysTrue = true
    const showSecondsTrue = true
    const testCases = [
      [[0, 0, 0, 0], '', '0s -> ""'],
      [[0, 1, 0, 1], '1h 1s', '1h 1s -> 1h 1s'],
      [[0, 25, 0, 1], '1d 1h 1s', '25h 1s -> 1d 1h 1s']
    ]

    testCases.forEach(([dhms, expected, description]) => {
      it(description, () => {
        expect(elapsedPrettyExtended(DHMStoSeconds(...dhms), useDaysTrue, showSecondsTrue)).to.equal(expected)
      })
    })
  })

  describe('useDays=true showSeconds=false', () => {
    const useDaysTrue = true
    const showSecondsFalse = false
    const testCases = [
      [[0, 0, 0, 0], '', '0s -> ""'],
      [[0, 1, 0, 0], '1h', '1h -> 1h'],
      [[0, 1, 0, 1], '1h', '1h 1s -> 1h'],
      [[0, 1, 1, 0], '1h 1m', '1h 1m -> 1h 1m'],
      [[0, 25, 0, 0], '1d 1h', '25h -> 1d 1h'],
      [[0, 25, 0, 1], '1d 1h', '25h 1s -> 1d 1h'],
      [[2, 0, 0, 0], '2d', '2d -> 2d']
    ]

    testCases.forEach(([dhms, expected, description]) => {
      it(description, () => {
        expect(elapsedPrettyExtended(DHMStoSeconds(...dhms), useDaysTrue, showSecondsFalse)).to.equal(expected)
      })
    })
  })

  describe('rounding useDays=true showSeconds=true', () => {
    const useDaysTrue = true
    const showSecondsTrue = true
    const testCases = [
      // Seconds rounding
      [[0, 0, 0, 1], '1s', '1s -> 1s'],
      [[0, 0, 0, 29.9], '30s', '29.9s -> 30s'],
      [[0, 0, 0, 30], '30s', '30s -> 30s'],
      [[0, 0, 0, 30.1], '30s', '30.1s -> 30s'],
      [[0, 0, 0, 59.4], '59s', '59.4s -> 59s'],
      [[0, 0, 0, 59.5], '1m', '59.5s -> 1m'],

      // Minutes rounding
      [[0, 0, 59, 29], '59m 29s', '59m 29s -> 59m 29s'],
      [[0, 0, 59, 30], '59m 30s', '59m 30s -> 59m 30s'],
      [[0, 0, 59, 59.5], '1h', '59m 59.5s -> 1h'],

      // Hours rounding
      [[0, 23, 59, 29], '23h 59m 29s', '23h 59m 29s -> 23h 59m 29s'],
      [[0, 23, 59, 30], '23h 59m 30s', '23h 59m 30s -> 23h 59m 30s'],
      [[0, 23, 59, 59.5], '1d', '23h 59m 59.5s -> 1d'],

      // The actual bug case
      [[44, 23, 59, 30], '44d 23h 59m 30s', '44d 23h 59m 30s -> 44d 23h 59m 30s']
    ]

    testCases.forEach(([dhms, expected, description]) => {
      it(description, () => {
        expect(elapsedPrettyExtended(DHMStoSeconds(...dhms), useDaysTrue, showSecondsTrue)).to.equal(expected)
      })
    })
  })

  describe('rounding useDays=true showSeconds=false', () => {
    const useDaysTrue = true
    const showSecondsFalse = false
    const testCases = [
      // Seconds rounding - these cases changed behavior from original
      [[0, 0, 0, 1], '', '1s -> ""'],
      [[0, 0, 0, 29.9], '', '29.9s -> ""'],
      [[0, 0, 0, 30], '', '30s -> ""'],
      [[0, 0, 0, 30.1], '', '30.1s -> ""'],
      [[0, 0, 0, 59.4], '', '59.4s -> ""'],
      [[0, 0, 0, 59.5], '1m', '59.5s -> 1m'],
      // This is unexpected behavior, but it's consistent with the original behavior
      // We preserved the test case, to document the current behavior
      // - with showSeconds=false,
      // one might expect: 1m 29.5s --round(1.4901m)-> 1m
      // actual implementation: 1h 29.5s --roundSeconds-> 1h 30s --roundMinutes-> 2m
      // So because of the separate rounding of seconds, and then minutes, it returns 2m
      [[0, 0, 1, 29.5], '2m', '1m 29.5s -> 2m'],

      // Minutes carry - actual bug fixes below
      [[0, 0, 59, 29], '59m', '59m 29s -> 59m'],
      [[0, 0, 59, 30], '1h', '59m 30s -> 1h'], // This was an actual bug, used to return 60m
      [[0, 0, 59, 59.5], '1h', '59m 59.5s -> 1h'],

      // Hours carry
      [[0, 23, 59, 29], '23h 59m', '23h 59m 29s -> 23h 59m'],
      [[0, 23, 59, 30], '1d', '23h 59m 30s -> 1d'], // This was an actual bug, used to return 23h 60m
      [[0, 23, 59, 59.5], '1d', '23h 59m 59.5s -> 1d'],

      // The actual bug case
      [[44, 23, 59, 30], '45d', '44d 23h 59m 30s -> 45d'] // This was an actual bug, used to return 44d 23h 60m
    ]

    testCases.forEach(([dhms, expected, description]) => {
      it(description, () => {
        expect(elapsedPrettyExtended(DHMStoSeconds(...dhms), useDaysTrue, showSecondsFalse)).to.equal(expected)
      })
    })
  })

  describe('empty values', () => {
    const paramCombos = [
      // useDays, showSeconds, description
      [true, true, 'with days and seconds'],
      [true, false, 'with days, no seconds'],
      [false, true, 'no days, with seconds'],
      [false, false, 'no days, no seconds']
    ]

    const emptyInputs = [
      // input, description
      [null, 'null input'],
      [undefined, 'undefined input'],
      [0, 'zero'],
      [0.49, 'rounds to zero'] // Just under rounding threshold
    ]

    paramCombos.forEach(([useDays, showSeconds, paramDesc]) => {
      describe(paramDesc, () => {
        emptyInputs.forEach(([input, desc]) => {
          it(desc, () => {
            expect(elapsedPrettyExtended(input, useDays, showSeconds)).to.equal('')
          })
        })
      })
    })
  })
})
