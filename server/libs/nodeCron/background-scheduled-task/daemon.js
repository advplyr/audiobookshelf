const ScheduledTask = require('../scheduled-task');

let scheduledTask;

function register(message){
    const script = require(message.path);
    scheduledTask = new ScheduledTask(message.cron, script.task, message.options);
    scheduledTask.on('task-done', (result) => {
        process.send({ type: 'task-done', result});
    });
    process.send({ type: 'registred' });
}

process.on('message', (message) => {
    switch(message.type){
    case 'register':
        return register(message);
    }
});
