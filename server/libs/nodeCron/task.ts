import { EventEmitter } from 'node:events';

type Execution = (now: Date | string) => unknown;

class Task extends EventEmitter<{ 'task-finished': []; 'task-failed': [unknown] }>{
    _execution: Execution;

    constructor(execution: Execution){
        super();
        if(typeof execution !== 'function') {
            throw new TypeError('execution must be a function');
        }
        this._execution = execution;
    }

    execute(now: Date | string) {
        let exec;
        try {
            exec = this._execution(now);
        } catch (error) {
            return this.emit('task-failed', error);
        }
        
        if (exec instanceof Promise) {
            return exec
                .then(() => this.emit('task-finished'))
                .catch((error) => this.emit('task-failed', error));
        } else {
            this.emit('task-finished');
            return exec;
        }
    }
}

declare namespace Task {
    export type { Execution };
}

export = Task;
