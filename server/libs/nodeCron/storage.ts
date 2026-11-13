import { createRequire } from 'node:module';
import type ScheduledTask from './scheduled-task';
import type BackgroundScheduledTask from './background-scheduled-task';
import type { CronOptions } from './options';

type RegisteredTask = ScheduledTask | BackgroundScheduledTask;
type TaskToRegister = { options?: CronOptions };

interface TaskRegistry {
    save(task: RegisteredTask): void;
    getTasks(): Map<string | undefined, RegisteredTask>;
}

declare global {
    var scheduledTasks: Map<string | undefined, RegisteredTask>;
}

const load = createRequire(__filename);

const storage: TaskRegistry = (() => {
    if(!global.scheduledTasks){
        global.scheduledTasks = new Map();
    }

    return {
        save: (task: RegisteredTask) => {
            if(!(task as TaskToRegister).options){
                const uuid = load('uuid') as typeof import('uuid');
                task.options = {};
                task.options.name = uuid.v4();
            }
            global.scheduledTasks.set(task.options.name, task);
        },
        getTasks: () => {
            return global.scheduledTasks;
        }
    };
})();
export = storage;
