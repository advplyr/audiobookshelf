'use strict';

// SOURCE: https://github.com/node-cron/node-cron
// LICENSE: https://github.com/node-cron/node-cron/blob/master/LICENSE.md

const monthNamesConversion = require('./month-names-conversion');
const weekDayNamesConversion = require('./week-day-names-conversion');
const convertAsterisksToRanges = require('./asterisk-to-range-conversion');
const convertRanges = require('./range-conversion');
const convertSteps = require('./step-values-conversion');

module.exports = (() => {

    function appendSeccondExpression(expressions) {
        if (expressions.length === 5) {
            return ['0'].concat(expressions);
        }
        return expressions;
    }

    function removeSpaces(str) {
        return str.replace(/\s{2,}/g, ' ').trim();
    }

    // Function that takes care of normalization.
    function normalizeIntegers(expressions) {
        for (let i = 0; i < expressions.length; i++) {
            const numbers = expressions[i].split(',');
            for (let j = 0; j < numbers.length; j++) {
                numbers[j] = parseInt(numbers[j]);
            }
            expressions[i] = numbers;
        }
        return expressions;
    }

    /*
   * The node-cron core allows only numbers (including multiple numbers e.g 1,2).
   * This module is going to translate the month names, week day names and ranges
   * to integers relatives.
   *
   * Month names example:
   *  - expression 0 1 1 January,Sep *
   *  - Will be translated to 0 1 1 1,9 *
   *
   * Week day names example:
   *  - expression 0 1 1 2 Monday,Sat
   *  - Will be translated to 0 1 1 1,5 *
   *
   * Ranges example:
   *  - expression 1-5 * * * *
   *  - Will be translated to 1,2,3,4,5 * * * *
   */
    function interprete(expression) {
        let expressions = removeSpaces(expression).split(' ');
        expressions = appendSeccondExpression(expressions);
        expressions[4] = monthNamesConversion(expressions[4]);
        expressions[5] = weekDayNamesConversion(expressions[5]);
        expressions = convertAsterisksToRanges(expressions);
        expressions = convertRanges(expressions);
        expressions = convertSteps(expressions);

        expressions = normalizeIntegers(expressions);

        return expressions.join(' ');
    }

    return interprete;
})();
