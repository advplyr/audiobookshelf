import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { getId } from '../../../utils/index'
import type { CronOptions } from '../options';
import type { RegisterMessage, TaskDoneMessage } from './messages';

const daemonPath = `${__dirname}/daemon.js`;

class BackgroundScheduledTask extends EventEmitter<{ 'task-done': [unknown] }> {
    cronExpression: string;
    taskPath: string;
    options: CronOptions;
    declare forkProcess: ChildProcess | undefined;

    constructor(cronExpression: string, taskPath: string, options?: CronOptions) {
        super();
        if (!options) {
            options = {
                scheduled: true,
                recoverMissedExecutions: false,
            };
        }
        this.cronExpression = cronExpression;
        this.taskPath = taskPath;
        this.options = options;
        this.options.name = this.options.name || getId()

        if (options.scheduled) {
            this.start();
        }
    }

    start() {
        this.stop();
        this.forkProcess = fork(daemonPath);

        this.forkProcess.on('message', (message: TaskDoneMessage | { type: 'registred' }) => {
            switch (message.type) {
                case 'task-done':
                    this.emit('task-done', message.result);
                    break;
            }
        });

        const options = this.options;
        options.scheduled = true;

        this.forkProcess.send({
            type: 'register',
            path: path.resolve(this.taskPath),
            cron: this.cronExpression,
            options: options
        } satisfies RegisterMessage);
    }

    stop() {
        if (this.forkProcess) {
            this.forkProcess.kill();
        }
    }

    pid() {
        if (this.forkProcess) {
            return this.forkProcess.pid;
        }
    }

    isRunning() {
        return !this.forkProcess!.killed;
    }
}

export = BackgroundScheduledTask;
