import type { CronOptions } from '../options';

export interface RegisterMessage {
    type: 'register';
    path: string;
    cron: string;
    options: CronOptions;
}

export interface TaskDoneMessage {
    type: 'task-done';
    result: unknown;
}
