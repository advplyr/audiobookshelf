'use strict';

const EventEmitter = require('events');
const Task = require('./task');
const Scheduler = require('./scheduler');
const { getId } = require('../../utils/index')

class ScheduledTask extends EventEmitter {
    constructor(cronExpression, func, options) {
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

    now(now = 'manual') {
        let result = this._task.execute(now);
        this.emit('task-done', result);
    }

    start() {
        this._scheduler.start();
    }

    stop() {
        this._scheduler.stop();
    }
}

module.exports = ScheduledTask;
