import { createRequire } from 'node:module';
import ScheduledTask from '../scheduled-task';
import type Task from '../task';
import type { RegisterMessage, TaskDoneMessage } from './messages';

const load = createRequire(__filename);

let scheduledTask: ScheduledTask;

function register(message: RegisterMessage){
    const script = load(message.path) as { task: Task.Execution };
    scheduledTask = new ScheduledTask(message.cron, script.task, message.options);
    scheduledTask.on('task-done', (result) => {
        process.send?.({ type: 'task-done', result } satisfies TaskDoneMessage);
    });
    process.send?.({ type: 'registred' });
}

process.on('message', (message: RegisterMessage) => {
    switch(message.type){
    case 'register':
        return register(message);
    }
});
