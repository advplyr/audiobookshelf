import { EventEmitter } from 'node:events';
import Task from './task';
import Scheduler from './scheduler';
import { getId } from '../../utils/index'
import type { CronOptions } from './options';

class ScheduledTask extends EventEmitter<{ 'task-done': [unknown] }> {
    options: CronOptions;
    _task: Task;
    _scheduler: Scheduler;

    constructor(cronExpression: string, func: Task.Execution, options?: CronOptions) {
        super();
        if (!options) {
            options = {
                scheduled: true,
                recoverMissedExecutions: false
            };
        }

        this.options = options;
        this.options.name = this.options.name || getId()

        this._task = new Task(func);
        this._scheduler = new Scheduler(cronExpression, options.timezone, options.recoverMissedExecutions);

        this._scheduler.on('scheduled-time-matched', (now) => {
            this.now(now);
        });

        if (options.scheduled !== false) {
            this._scheduler.start();
        }

        if (options.runOnInit === true) {
            this.now('init');
        }
    }

    now(now: Date | string = 'manual') {
        const result = this._task.execute(now);
        this.emit('task-done', result);
    }

    start() {
        this._scheduler.start();
    }

    stop() {
        this._scheduler.stop();
    }
}

export = ScheduledTask;
