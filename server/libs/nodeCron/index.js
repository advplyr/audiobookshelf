'use strict';

const ScheduledTask = require('./scheduled-task');
const BackgroundScheduledTask = require('./background-scheduled-task');
const validation = require('./pattern-validation');
const storage = require('./storage');

/**
 * @typedef {Object} CronScheduleOptions
 * @prop {boolean} [scheduled] if a scheduled task is ready and running to be
 *  performed when the time matches the cron expression.
 * @prop {string} [timezone] the timezone to execute the task in.
 */

/**
 * Creates a new task to execute the given function when the cron
 *  expression ticks.
 *
 * @param {string} expression The cron expression.
 * @param {Function} func The task to be executed.
 * @param {CronScheduleOptions} [options] A set of options for the scheduled task.
 * @returns {ScheduledTask} The scheduled task.
 */
function schedule(expression, func, options) {
    const task = createTask(expression, func, options);

    storage.save(task);

    return task;
}

function createTask(expression, func, options) {
    if (typeof func === 'string')
        return new BackgroundScheduledTask(expression, func, options);

    return new ScheduledTask(expression, func, options);
}

/**
 * Check if a cron expression is valid.
 *
 * @param {string} expression The cron expression.
 * @returns {boolean} Whether the expression is valid or not.
 */
function validate(expression) {
    try {
        validation(expression);

        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Gets the scheduled tasks.
 *
 * @returns {ScheduledTask[]} The scheduled tasks.
 */
function getTasks() {
    return storage.getTasks();
}

module.exports = { schedule, validate, getTasks };
