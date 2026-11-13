import ScheduledTask from './scheduled-task';
import BackgroundScheduledTask from './background-scheduled-task';
import validation from './pattern-validation';
import storage from './storage';
import type Task from './task';
import type { CronOptions } from './options';

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
function schedule(expression: string, func: Task.Execution, options?: CronOptions): ScheduledTask;
function schedule(expression: string, func: string, options?: CronOptions): BackgroundScheduledTask;
function schedule(expression: string, func: string | Task.Execution, options?: CronOptions): ScheduledTask | BackgroundScheduledTask {
    const task = createTask(expression, func, options);

    storage.save(task);

    return task;
}

function createTask(expression: string, func: string | Task.Execution, options?: CronOptions) {
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
function validate(expression: unknown) {
    try {
        validation(expression);

        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the scheduled tasks.
 *
 * @returns {ScheduledTask[]} The scheduled tasks.
 */
function getTasks(): Map<string | undefined, ScheduledTask | BackgroundScheduledTask> {
    return storage.getTasks();
}

export = { schedule, validate, getTasks };
