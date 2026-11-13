import convertExpression from './convert-expression';

const validationRegex = /^(?:\d+|\*|\*\/\d+)$/;

/**
 * @param {string} expression The Cron-Job expression.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {boolean}
 */
function isValidExpression(expression: string, min: number, max: number) {
    const options = expression.split(',');

    for (const option of options) {
        const optionAsInt = parseInt(option, 10);

        if (
            (!Number.isNaN(optionAsInt) &&
                (optionAsInt < min || optionAsInt > max)) ||
            !validationRegex.test(option)
        )
            return false;
    }

    return true;
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidSecond(expression: string) {
    return !isValidExpression(expression, 0, 59);
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidMinute(expression: string) {
    return !isValidExpression(expression, 0, 59);
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidHour(expression: string) {
    return !isValidExpression(expression, 0, 23);
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidDayOfMonth(expression: string) {
    return !isValidExpression(expression, 1, 31);
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidMonth(expression: string) {
    return !isValidExpression(expression, 1, 12);
}

/**
 * @param {string} expression The Cron-Job expression.
 * @returns {boolean}
 */
function isInvalidWeekDay(expression: string) {
    return !isValidExpression(expression, 0, 7);
}

/**
 * @param {string[]} patterns The Cron-Job expression patterns.
 * @param {string[]} executablePatterns The executable Cron-Job expression
 * patterns.
 * @returns {void}
 */
function validateFields(patterns: string[], executablePatterns: string[]) {
    if (isInvalidSecond(executablePatterns[0]))
        throw new Error(`${patterns[0]} is a invalid expression for second`);

    if (isInvalidMinute(executablePatterns[1]))
        throw new Error(`${patterns[1]} is a invalid expression for minute`);

    if (isInvalidHour(executablePatterns[2]))
        throw new Error(`${patterns[2]} is a invalid expression for hour`);

    if (isInvalidDayOfMonth(executablePatterns[3]))
        throw new Error(
            `${patterns[3]} is a invalid expression for day of month`
        );

    if (isInvalidMonth(executablePatterns[4]))
        throw new Error(`${patterns[4]} is a invalid expression for month`);

    if (isInvalidWeekDay(executablePatterns[5]))
        throw new Error(`${patterns[5]} is a invalid expression for week day`);
}

/**
 * Validates a Cron-Job expression pattern.
 *
 * @param {string} pattern The Cron-Job expression pattern.
 * @returns {void}
 */
function validate(pattern: unknown) {
    if (typeof pattern !== 'string')
        throw new TypeError('pattern must be a string!');

    const patterns = pattern.split(' ');
    const executablePatterns = convertExpression(pattern).split(' ');

    if (patterns.length === 5) patterns.unshift('0');

    validateFields(patterns, executablePatterns);
}

export = validate;
