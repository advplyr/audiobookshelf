//
// Used by fluentFfmpeg and archiver
// Source: https://github.com/caolan/async/tree/v3.2.4
//

type Task = { run(this: unknown, ...args: unknown[]): unknown }['run'];
type Callback = { call(err?: unknown, ...args: unknown[]): void }['call'] & { [PROMISE_SYMBOL]?: Promise<unknown> };
type Key = string | number;
type Collection = ArrayLike<unknown> | Iterable<unknown> | AsyncIterable<unknown> | Record<string, unknown> | null | undefined;
type Iterate = { run(value: unknown, key: Key, callback: Callback): void }['run'];
type IterateValue = { run(value: unknown, callback: Callback): void }['run'];
type Each = (collection: Collection, iteratee: Iterate, callback: Callback) => unknown;
type DependencyTask = Task | (string | Task)[];
type TaskGraph = Record<string, DependencyTask>;
type EventName = 'error' | 'drain' | 'saturated' | 'unsaturated' | 'empty';
type QueueNode = { data: unknown; callback: Callback; prev?: QueueNode | null; next?: QueueNode | null; priority?: number; pushCount?: number };
type QueueStorage = {
    length: number;
    push(node: QueueNode): unknown;
    unshift(node: QueueNode): unknown;
    shift(): QueueNode | null | undefined;
    empty(): unknown;
    remove(testFn: (node: QueueNode) => boolean): unknown;
    [Symbol.iterator](): IterableIterator<unknown>;
};
type RetryOptions = { times?: number | string; interval?: number | string | ((attempt: number) => number); errorFilter?: (error: unknown) => boolean; arity?: number };
type RetryPolicy = { times: number; intervalFunc(attempt: number): number; errorFilter?: (error: unknown) => boolean };

// Function arguments supplied by callers are interpreted according to the operation's arity.

function apply(fn: Task, ...args: unknown[]) {
    return (...callArgs: unknown[]) => fn(...args, ...callArgs);
}
function initialParams(this: unknown, fn: (this: unknown, args: unknown[], callback: Callback) => unknown) {
    return function (this: unknown, ...args: unknown[]) {
        var callback = args.pop() as Callback;
        return fn.call(this, args, callback);
    };
}
var hasQueueMicrotask = typeof queueMicrotask === 'function' && queueMicrotask;
var hasSetImmediate = typeof setImmediate === 'function' && setImmediate;
var hasNextTick = typeof process === 'object' && typeof process.nextTick === 'function';
function fallback(fn: () => void) {
    setTimeout(fn, 0);
}
function wrap(defer: (callback: () => void) => unknown) {
    return (fn: Task, ...args: unknown[]) => defer(() => fn(...args));
}
var _defer: (callback: () => void) => unknown;
if (hasQueueMicrotask) {
    _defer = queueMicrotask;
}
else if (hasSetImmediate) {
    _defer = setImmediate;
}
else if (hasNextTick) {
    _defer = callback => process.nextTick(callback);
}
else {
    _defer = fallback;
}
var setImmediate$1 = wrap(_defer);
function asyncify(this: unknown, func: Task) {
    if (isAsync(func)) {
        return function (this: unknown, ...args: unknown[]) {
            const callback = args.pop() as Callback;
            const promise = func.apply(this, args) as PromiseLike<unknown>;
            return handlePromise(promise, callback);
        };
    }
    return initialParams(function (this: unknown, args: unknown[], callback: Callback) {
        var result: unknown;
        try {
            result = func.apply(this, args);
        }
        catch (e) {
            return callback(e);
        }
        if (result && typeof (result as Partial<PromiseLike<unknown>>).then === 'function') {
            return handlePromise(result as PromiseLike<unknown>, callback);
        }
        else {
            callback(null, result);
        }
    });
}
function handlePromise(promise: PromiseLike<unknown>, callback: Callback) {
    return promise.then((value: unknown) => {
        invokeCallback(callback, null, value);
    }, (err: unknown) => {
        invokeCallback(callback, err && (err as { message?: unknown }).message ? err : new Error(err as string));
    });
}
function invokeCallback(callback: Callback, error: unknown, value?: unknown) {
    try {
        callback(error, value);
    }
    catch (err) {
        setImmediate$1((e: unknown) => { throw e; }, err);
    }
}
function isAsync(fn: unknown) {
    return (fn as { [Symbol.toStringTag]?: string })[Symbol.toStringTag] === 'AsyncFunction';
}
function isAsyncGenerator(fn: Collection): fn is AsyncGenerator<unknown, unknown, unknown> {
    return (fn as { [Symbol.toStringTag]?: string })[Symbol.toStringTag] === 'AsyncGenerator';
}
function isAsyncIterable(obj: Collection): obj is AsyncIterable<unknown> {
    return typeof (obj as Partial<AsyncIterable<unknown>>)[Symbol.asyncIterator] === 'function';
}
function wrapAsync(asyncFn: unknown): Task {
    if (typeof asyncFn !== 'function')
        throw new Error('expected a function');
    return isAsync(asyncFn) ? asyncify(asyncFn as Task) : asyncFn as Task;
}
// Async callbacks may report arbitrary values as errors. Preserve the original rejection reason.
function rejectCallbackError(reject: (reason: unknown) => void, error: unknown) {
    reject(error);
}

type Awaitable<Inputs extends unknown[]> = {
    (...args: [...Inputs, Callback]): void;
    (...args: Inputs): Promise<unknown>;
};

function awaitify<Inputs extends unknown[]>(asyncFn: (...args: [...Inputs, Callback]) => unknown, arity = asyncFn.length): Awaitable<Inputs> {
    const invoke: Task = asyncFn;
    if (!arity)
        throw new Error('arity is undefined');
    function awaitable(this: unknown, ...args: unknown[]) {
        if (typeof args[arity - 1] === 'function') {
            return invoke.apply(this, args);
        }
        return new Promise((resolve, reject) => {
            args[arity - 1] = (err: unknown, ...cbArgs: unknown[]) => {
                if (err)
                    return rejectCallbackError(reject, err);
                resolve(cbArgs.length > 1 ? cbArgs : cbArgs[0]);
            };
            invoke.apply(this, args);
        });
    }
    return awaitable as Awaitable<Inputs>;
}
function applyEach(eachfn: (collection: Collection, iteratee: IterateValue, callback: Callback) => unknown) {
    return function applyEach(this: unknown, fns: Collection, ...callArgs: unknown[]) {
        const go = awaitify(function (this: unknown, callback: Callback) {
            return eachfn(fns, (fn: Task, cb: Callback) => {
                wrapAsync(fn).apply(this, callArgs.concat(cb));
            }, callback);
        });
        return go;
    };
}
function _asyncMap(eachfn: Each, arr: Collection, iteratee: Task, callback: Callback) {
    arr = arr || [];
    var results: unknown[] = [];
    var counter = 0;
    var _iteratee = wrapAsync(iteratee);
    return eachfn(arr, (value: unknown, _: unknown, iterCb: Callback) => {
        var index = counter++;
        _iteratee(value, (err: unknown, v: unknown) => {
            results[index] = v;
            iterCb(err);
        });
    }, (err: unknown) => {
        callback(err, results);
    });
}
function isArrayLike(input: unknown): input is ArrayLike<unknown> {
    const value = input as ArrayLike<unknown> | null | undefined;
    return !!value &&
        typeof value.length === 'number' &&
        value.length >= 0 &&
        value.length % 1 === 0;
}
const breakLoop = {};
function once(this: unknown, fn: Task | null) {
    function wrapper(this: unknown, ...args: unknown[]) {
        if (fn === null)
            return;
        var callFn = fn;
        fn = null;
        callFn.apply(this, args);
    }
    Object.assign(wrapper, fn);
    return wrapper;
}
function getIterator(coll: Collection) {
    const iterable = coll as Partial<Iterable<unknown>>;
    return iterable[Symbol.iterator] && iterable[Symbol.iterator]!();
}
function createArrayIterator(coll: ArrayLike<unknown>) {
    var i = -1;
    var len = coll.length;
    return function next() {
        return ++i < len ? { value: coll[i], key: i } : null;
    };
}
function createES2015Iterator(iterator: Iterator<unknown, unknown, unknown>) {
    var i = -1;
    return function next() {
        var item = iterator.next();
        if (item.done)
            return null;
        i++;
        return { value: item.value, key: i };
    };
}
function createObjectIterator(obj: Collection) {
    var okeys = obj ? Object.keys(obj) : [];
    var i = -1;
    var len = okeys.length;
    return function next() {
        var key = okeys[++i];
        if (key === '__proto__') {
            return next();
        }
        return i < len ? { value: (obj as Record<string, unknown>)[key], key } : null;
    };
}
function createIterator(coll: Collection) {
    if (isArrayLike(coll)) {
        return createArrayIterator(coll);
    }
    var iterator = getIterator(coll);
    return iterator ? createES2015Iterator(iterator) : createObjectIterator(coll);
}
function onlyOnce(this: unknown, fn: Task | null) {
    return function (this: unknown, ...args: unknown[]) {
        if (fn === null)
            throw new Error("Callback was already called.");
        var callFn = fn;
        fn = null;
        callFn.apply(this, args);
    };
}
function asyncEachOfLimit(generator: AsyncIterator<unknown, unknown, unknown>, limit: number, iteratee: Iterate, callback: Callback) {
    let done = false;
    let canceled = false;
    let awaiting = false;
    let running = 0;
    let idx = 0;
    function replenish() {
        if (running >= limit || awaiting || done)
            return;
        awaiting = true;
        generator.next().then(({ value, done: iterDone }) => {
            if (canceled || done)
                return;
            awaiting = false;
            if (iterDone) {
                done = true;
                if (running <= 0) {
                    callback(null);
                }
                return;
            }
            running++;
            iteratee(value, idx, iterateeCallback);
            idx++;
            replenish();
        }).catch(handleError);
    }
    function iterateeCallback(err: unknown, result: unknown) {
        running -= 1;
        if (canceled)
            return;
        if (err)
            return handleError(err);
        if (err === false) {
            done = true;
            canceled = true;
            return;
        }
        if (result === breakLoop || (done && running <= 0)) {
            done = true;
            return callback(null);
        }
        replenish();
    }
    function handleError(err: unknown) {
        if (canceled)
            return;
        awaiting = false;
        done = true;
        callback(err);
    }
    replenish();
}
var eachOfLimit = (limit: number) => {
    return (obj: Collection, iteratee: Iterate, callback: Callback) => {
        callback = once(callback);
        if (limit <= 0) {
            throw new RangeError('concurrency limit cannot be less than 1');
        }
        if (!obj) {
            return callback(null);
        }
        if (isAsyncGenerator(obj)) {
            return asyncEachOfLimit(obj, limit, iteratee, callback);
        }
        if (isAsyncIterable(obj)) {
            return asyncEachOfLimit(obj[Symbol.asyncIterator](), limit, iteratee, callback);
        }
        var nextElem = createIterator(obj);
        var done = false;
        var canceled = false;
        var running = 0;
        var looping = false;
        function iterateeCallback(err: unknown, value: unknown) {
            if (canceled)
                return;
            running -= 1;
            if (err) {
                done = true;
                callback(err);
            }
            else if (err === false) {
                done = true;
                canceled = true;
            }
            else if (value === breakLoop || (done && running <= 0)) {
                done = true;
                return callback(null);
            }
            else if (!looping) {
                replenish();
            }
        }
        function replenish() {
            looping = true;
            while (running < limit && !done) {
                var elem = nextElem();
                if (elem === null) {
                    done = true;
                    if (running <= 0) {
                        callback(null);
                    }
                    return;
                }
                running += 1;
                iteratee(elem.value, elem.key, onlyOnce(iterateeCallback));
            }
            looping = false;
        }
        replenish();
    };
};
function eachOfLimit$1(coll: Collection, limit: number, iteratee: Iterate, callback: Callback) {
    return eachOfLimit(limit)(coll, wrapAsync(iteratee), callback);
}
var eachOfLimit$2 = awaitify(eachOfLimit$1, 4);
function eachOfArrayLike(coll: ArrayLike<unknown>, iteratee: Iterate, callback: Callback) {
    callback = once(callback);
    var index = 0, completed = 0, { length } = coll, canceled = false;
    if (length === 0) {
        callback(null);
    }
    function iteratorCallback(err: unknown, value: unknown) {
        if (err === false) {
            canceled = true;
        }
        if (canceled === true)
            return;
        if (err) {
            callback(err);
        }
        else if ((++completed === length) || value === breakLoop) {
            callback(null);
        }
    }
    for (; index < length; index++) {
        iteratee(coll[index], index, onlyOnce(iteratorCallback));
    }
}
function eachOfGeneric(coll: Collection, iteratee: Iterate, callback: Callback) {
    return eachOfLimit$2(coll, Infinity, iteratee, callback);
}
function eachOf(coll: Collection, iteratee: Iterate, callback: Callback) {
    var eachOfImplementation = isArrayLike(coll) ? eachOfArrayLike : eachOfGeneric;
    return eachOfImplementation(coll as ArrayLike<unknown>, wrapAsync(iteratee), callback);
}
var eachOf$1 = awaitify(eachOf, 3);
function map(coll: Collection, iteratee: Task, callback: Callback) {
    return _asyncMap(eachOf$1, coll, iteratee, callback);
}
var map$1 = awaitify(map, 3);
var applyEach$1 = applyEach(map$1);
function eachOfSeries(coll: Collection, iteratee: Iterate, callback: Callback) {
    return eachOfLimit$2(coll, 1, iteratee, callback);
}
var eachOfSeries$1 = awaitify(eachOfSeries, 3);
function mapSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return _asyncMap(eachOfSeries$1, coll, iteratee, callback);
}
var mapSeries$1 = awaitify(mapSeries, 3);
var applyEachSeries = applyEach(mapSeries$1);
const PROMISE_SYMBOL = Symbol('promiseCallback');
function promiseCallback() {
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    const callback: Callback = (err, ...args) => {
        if (err)
            return rejectCallbackError(reject, err);
        resolve(args.length > 1 ? args : args[0]);
    };
    callback[PROMISE_SYMBOL] = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return callback;
}
function auto(tasks: TaskGraph, concurrency?: number | Callback | null, callback?: Callback) {
    if (typeof concurrency !== 'number') {
        callback = concurrency as Callback | undefined;
        concurrency = null;
    }
    const complete = once(callback || promiseCallback()) as Callback;
    var numTasks = Object.keys(tasks).length;
    if (!numTasks) {
        return complete(null);
    }
    if (!concurrency) {
        concurrency = numTasks;
    }
    var results: Record<string, unknown> = {};
    var runningTasks = 0;
    var canceled = false;
    var hasError = false;
    var listeners = Object.create(null) as Record<string, (() => void)[]>;
    var readyTasks: (() => void)[] = [];
    var readyToCheck: string[] = [];
    var uncheckedDependencies: Record<string, number> = {};
    Object.keys(tasks).forEach((key) => {
        var task = tasks[key];
        if (!Array.isArray(task)) {
            enqueueTask(key, [task]);
            readyToCheck.push(key);
            return;
        }
        var dependencies = task.slice(0, task.length - 1) as string[];
        var remainingDependencies = dependencies.length;
        if (remainingDependencies === 0) {
            enqueueTask(key, task);
            readyToCheck.push(key);
            return;
        }
        uncheckedDependencies[key] = remainingDependencies;
        dependencies.forEach((dependencyName) => {
            if (!tasks[dependencyName]) {
                throw new Error('async.auto task `' + key +
                    '` has a non-existent dependency `' +
                    dependencyName + '` in ' +
                    dependencies.join(', '));
            }
            addListener(dependencyName, () => {
                remainingDependencies--;
                if (remainingDependencies === 0) {
                    enqueueTask(key, task as (string | Task)[]);
                }
            });
        });
    });
    checkForDeadlocks();
    processQueue();
    function enqueueTask(key: string, task: (string | Task)[]) {
        readyTasks.push(() => runTask(key, task));
    }
    function processQueue() {
        if (canceled)
            return;
        if (readyTasks.length === 0 && runningTasks === 0) {
            return complete(null, results);
        }
        while (readyTasks.length && runningTasks < (concurrency as number)) {
            var run = readyTasks.shift()!;
            run();
        }
    }
    function addListener(taskName: string, fn: () => void) {
        var taskListeners = listeners[taskName];
        if (!taskListeners) {
            taskListeners = listeners[taskName] = [];
        }
        taskListeners.push(fn);
    }
    function taskComplete(taskName: string) {
        var taskListeners = listeners[taskName] || [];
        taskListeners.forEach((fn: Task) => fn());
        processQueue();
    }
    function runTask(key: string, task: (string | Task)[]) {
        if (hasError)
            return;
        var taskCallback = onlyOnce((err: unknown, ...values: unknown[]) => {
            runningTasks--;
            if (err === false) {
                canceled = true;
                return;
            }
            const result = values.length < 2 ? values[0] : values;
            if (err) {
                var safeResults: Record<string, unknown> = {};
                Object.keys(results).forEach((rkey) => {
                    safeResults[rkey] = results[rkey];
                });
                safeResults[key] = result;
                hasError = true;
                listeners = Object.create(null) as typeof listeners;
                if (canceled)
                    return;
                complete(err, safeResults);
            }
            else {
                results[key] = result;
                taskComplete(key);
            }
        });
        runningTasks++;
        var taskFn = wrapAsync(task[task.length - 1]);
        if (task.length > 1) {
            taskFn(results, taskCallback);
        }
        else {
            taskFn(taskCallback);
        }
    }
    function checkForDeadlocks() {
        var currentTask;
        var counter = 0;
        while (readyToCheck.length) {
            currentTask = readyToCheck.pop()!;
            counter++;
            getDependents(currentTask).forEach((dependent) => {
                if (--uncheckedDependencies[dependent] === 0) {
                    readyToCheck.push(dependent);
                }
            });
        }
        if (counter !== numTasks) {
            throw new Error('async.auto cannot execute tasks due to a recursive dependency');
        }
    }
    function getDependents(taskName: string) {
        var result: string[] = [];
        Object.keys(tasks).forEach(key => {
            const task = tasks[key];
            if (Array.isArray(task) && task.indexOf(taskName) >= 0) {
                result.push(key);
            }
        });
        return result;
    }
    return complete[PROMISE_SYMBOL];
}
var FN_ARGS = /^(?:async\s+)?(?:function)?\s*\w*\s*\(\s*([^)]+)\s*\)(?:\s*{)/;
var ARROW_FN_ARGS = /^(?:async\s+)?\(?\s*([^)=]+)\s*\)?(?:\s*=>)/;
var FN_ARG_SPLIT = /,/;
var FN_ARG = /(=.+)?(\s*)$/;
function stripComments(string: string) {
    let stripped = '';
    let index = 0;
    let endBlockComment = string.indexOf('*/');
    while (index < string.length) {
        if (string[index] === '/' && string[index + 1] === '/') {
            let endIndex = string.indexOf('\n', index);
            index = (endIndex === -1) ? string.length : endIndex;
        }
        else if ((endBlockComment !== -1) && (string[index] === '/') && (string[index + 1] === '*')) {
            let endIndex = string.indexOf('*/', index);
            if (endIndex !== -1) {
                index = endIndex + 2;
                endBlockComment = string.indexOf('*/', index);
            }
            else {
                stripped += string[index];
                index++;
            }
        }
        else {
            stripped += string[index];
            index++;
        }
    }
    return stripped;
}
function parseParams(func: Task) {
    const src = stripComments(func.toString());
    let match = src.match(FN_ARGS);
    if (!match) {
        match = src.match(ARROW_FN_ARGS);
    }
    if (!match)
        throw new Error('could not parse args in autoInject\nSource:\n' + src);
    let [, args] = match;
    return args
        .replace(/\s/g, '')
        .split(FN_ARG_SPLIT)
        .map((arg) => arg.replace(FN_ARG, '').trim());
}
function autoInject(tasks: TaskGraph, callback?: Callback) {
    var newTasks: TaskGraph = {};
    Object.keys(tasks).forEach(key => {
        var taskFn = tasks[key];
        var params: string[];
        var fnIsAsync = isAsync(taskFn);
        var hasNoDeps = (!fnIsAsync && taskFn.length === 1) ||
            (fnIsAsync && taskFn.length === 0);
        if (Array.isArray(taskFn)) {
            const taskParts = [...taskFn];
            taskFn = taskParts.pop() as Task;
            params = taskParts as string[];
            newTasks[key] = [...params, params.length > 0 ? newTask : taskFn];
        }
        else if (hasNoDeps) {
            newTasks[key] = taskFn;
        }
        else {
            params = parseParams(taskFn);
            if ((taskFn.length === 0 && !fnIsAsync) && params.length === 0) {
                throw new Error("autoInject task functions require explicit parameters.");
            }
            if (!fnIsAsync)
                params.pop();
            newTasks[key] = [...params, newTask];
        }
        function newTask(results: Record<string, unknown>, taskCb: Callback) {
            var newArgs = params.map((name: string) => results[name]);
            newArgs.push(taskCb);
            wrapAsync(taskFn)(...newArgs);
        }
    });
    return auto(newTasks, callback);
}
class DLL {
    declare head: QueueNode | null | undefined;
    declare tail: QueueNode | null | undefined;
    declare length: number;

    constructor() {
        this.head = this.tail = null;
        this.length = 0;
    }
    removeLink(node: QueueNode) {
        if (node.prev)
            node.prev.next = node.next;
        else
            this.head = node.next;
        if (node.next)
            node.next.prev = node.prev;
        else
            this.tail = node.prev;
        node.prev = node.next = null;
        this.length -= 1;
        return node;
    }
    empty() {
        while (this.head)
            this.shift();
        return this;
    }
    insertAfter(node: QueueNode, newNode: QueueNode) {
        newNode.prev = node;
        newNode.next = node.next;
        if (node.next)
            node.next.prev = newNode;
        else
            this.tail = newNode;
        node.next = newNode;
        this.length += 1;
    }
    insertBefore(node: QueueNode, newNode: QueueNode) {
        newNode.prev = node.prev;
        newNode.next = node;
        if (node.prev)
            node.prev.next = newNode;
        else
            this.head = newNode;
        node.prev = newNode;
        this.length += 1;
    }
    unshift(node: QueueNode) {
        if (this.head)
            this.insertBefore(this.head, node);
        else
            setInitial(this, node);
    }
    push(node: QueueNode) {
        if (this.tail)
            this.insertAfter(this.tail, node);
        else
            setInitial(this, node);
    }
    shift() {
        return this.head && this.removeLink(this.head);
    }
    pop() {
        return this.tail && this.removeLink(this.tail);
    }
    toArray() {
        return [...this];
    }
    *[Symbol.iterator]() {
        var cur = this.head;
        while (cur) {
            yield cur.data;
            cur = cur.next;
        }
    }
    remove(testFn: (node: QueueNode) => boolean) {
        var curr = this.head;
        while (curr) {
            var { next } = curr;
            if (testFn(curr)) {
                this.removeLink(curr);
            }
            curr = next;
        }
        return this;
    }
}
function setInitial(dll: DLL, node: QueueNode) {
    dll.length = 1;
    dll.head = dll.tail = node;
}
function queue(worker: Task, concurrency?: number | null, payload?: number) {
    if (concurrency == null) {
        concurrency = 1;
    }
    else if (concurrency === 0) {
        throw new RangeError('Concurrency must not be zero');
    }
    var _worker = wrapAsync(worker);
    var numRunning = 0;
    var workersList: QueueNode[] = [];
    const events: Record<EventName, Task[]> = {
        error: [],
        drain: [],
        saturated: [],
        unsaturated: [],
        empty: []
    };
    function on(event: EventName, handler: Task) {
        events[event].push(handler);
    }
    function once(event: EventName, handler: Task) {
        const handleAndRemove = (...args: unknown[]) => {
            off(event, handleAndRemove);
            handler(...args);
        };
        events[event].push(handleAndRemove);
    }
    function off(event?: EventName, handler?: Task) {
        if (!event)
            return (Object.keys(events) as EventName[]).forEach(ev => events[ev] = []);
        if (!handler)
            return events[event] = [];
        events[event] = events[event].filter((ev: unknown) => ev !== handler);
    }
    function trigger(event: EventName, ...args: unknown[]) {
        events[event].forEach(handler => handler(...args));
    }
    var processingScheduled = false;
    function _insert(data: unknown, insertAtFront: boolean, rejectOnError: boolean, callback: Callback | undefined) {
        if (callback != null && typeof callback !== 'function') {
            throw new Error('task callback must be a function');
        }
        q.started = true;
        var res!: (value?: unknown) => void;
        var rej!: (error: unknown) => void;
        function promiseCallback(err: unknown, ...args: unknown[]) {
            if (err)
                return rejectOnError ? rej(err) : res();
            if (args.length <= 1)
                return res(args[0]);
            res(args);
        }
        var item = q._createTaskItem(data, rejectOnError ? promiseCallback :
            (callback || promiseCallback));
        if (insertAtFront) {
            q._tasks.unshift(item);
        }
        else {
            q._tasks.push(item);
        }
        if (!processingScheduled) {
            processingScheduled = true;
            setImmediate$1(() => {
                processingScheduled = false;
                q.process();
            });
        }
        if (rejectOnError || !callback) {
            return new Promise((resolve, reject) => {
                res = resolve;
                rej = reject;
            });
        }
    }
    function _createCB(tasks: QueueNode[]) {
        return function (err: unknown, ...args: unknown[]) {
            numRunning -= 1;
            for (var i = 0, l = tasks.length; i < l; i++) {
                var task = tasks[i];
                var index = workersList.indexOf(task);
                if (index === 0) {
                    workersList.shift();
                }
                else if (index > 0) {
                    workersList.splice(index, 1);
                }
                task.callback(err, ...args);
                if (err != null) {
                    trigger('error', err, task.data);
                }
            }
            if (numRunning <= (q.concurrency - q.buffer)) {
                trigger('unsaturated');
            }
            if (q.idle()) {
                trigger('drain');
            }
            q.process();
        };
    }
    function _maybeDrain(data: unknown[]) {
        if (data.length === 0 && q.idle()) {
            setImmediate$1(() => trigger('drain'));
            return true;
        }
        return false;
    }
    const eventMethod = (name: EventName) => (handler?: Task) => {
        if (!handler) {
            return new Promise((resolve, reject) => {
                once(name, (err: unknown, data: unknown) => {
                    if (err)
                        return rejectCallbackError(reject, err);
                    resolve(data);
                });
            });
        }
        off(name);
        on(name, handler);
    };
    var isProcessing = false;
    var q = {
        _tasks: new DLL() as QueueStorage,
        _createTaskItem(data: unknown, callback: Callback) {
            return {
                data,
                callback
            };
        },
        *[Symbol.iterator]() {
            yield* q._tasks[Symbol.iterator]();
        },
        concurrency,
        payload,
        buffer: concurrency / 4,
        started: false,
        paused: false,
        push(this: void, data: unknown, callback?: Callback) {
            if (Array.isArray(data)) {
                if (_maybeDrain(data))
                    return;
                return data.map((datum: unknown) => _insert(datum, false, false, callback));
            }
            return _insert(data, false, false, callback);
        },
        pushAsync(this: void, data: unknown, callback?: Callback) {
            if (Array.isArray(data)) {
                if (_maybeDrain(data))
                    return;
                return data.map((datum: unknown) => _insert(datum, false, true, callback));
            }
            return _insert(data, false, true, callback);
        },
        kill() {
            off();
            q._tasks.empty();
        },
        unshift(data: unknown, callback?: Callback) {
            if (Array.isArray(data)) {
                if (_maybeDrain(data))
                    return;
                return data.map((datum: unknown) => _insert(datum, true, false, callback));
            }
            return _insert(data, true, false, callback);
        },
        unshiftAsync(data: unknown, callback?: Callback) {
            if (Array.isArray(data)) {
                if (_maybeDrain(data))
                    return;
                return data.map((datum: unknown) => _insert(datum, true, true, callback));
            }
            return _insert(data, true, true, callback);
        },
        remove(testFn: (node: QueueNode) => boolean) {
            q._tasks.remove(testFn);
        },
        process(this: void) {
            if (isProcessing) {
                return;
            }
            isProcessing = true;
            while (!q.paused && numRunning < q.concurrency && q._tasks.length) {
                var tasks: QueueNode[] = [], data: unknown[] = [];
                var l = q._tasks.length;
                if (q.payload)
                    l = Math.min(l, q.payload);
                for (var i = 0; i < l; i++) {
                    var node = q._tasks.shift()!;
                    tasks.push(node);
                    workersList.push(node);
                    data.push(node.data);
                }
                numRunning += 1;
                if (q._tasks.length === 0) {
                    trigger('empty');
                }
                if (numRunning === q.concurrency) {
                    trigger('saturated');
                }
                var cb = onlyOnce(_createCB(tasks));
                _worker(data, cb);
            }
            isProcessing = false;
        },
        length() {
            return q._tasks.length;
        },
        running() {
            return numRunning;
        },
        workersList() {
            return workersList;
        },
        idle() {
            return q._tasks.length + numRunning === 0;
        },
        pause() {
            q.paused = true;
        },
        resume() {
            if (q.paused === false) {
                return;
            }
            q.paused = false;
            setImmediate$1(q.process);
        }
    };
    Object.defineProperties(q, {
        saturated: {
            writable: false,
            value: eventMethod('saturated')
        },
        unsaturated: {
            writable: false,
            value: eventMethod('unsaturated')
        },
        empty: {
            writable: false,
            value: eventMethod('empty')
        },
        drain: {
            writable: false,
            value: eventMethod('drain')
        },
        error: {
            writable: false,
            value: eventMethod('error')
        },
    });
    return q as typeof q & Record<EventName, (handler?: Task) => void | Promise<unknown>>;
}
function cargo(worker: Task, payload?: number) {
    return queue(worker, 1, payload);
}
function cargo$1(worker: Task, concurrency?: number | null, payload?: number) {
    return queue(worker, concurrency, payload);
}
function reduce(coll: Collection, memo: unknown, iteratee: Task, callback: Callback) {
    callback = once(callback);
    var _iteratee = wrapAsync(iteratee);
    return eachOfSeries$1(coll, (x: unknown, i: number, iterCb: Callback) => {
        _iteratee(memo, x, (err: unknown, v: unknown) => {
            memo = v;
            iterCb(err);
        });
    }, (err: unknown) => callback(err, memo));
}
var reduce$1 = awaitify(reduce, 4);
function seq(this: unknown, ...functions: Task[]) {
    var _functions = functions.map(wrapAsync);
    return function (this: unknown, ...args: unknown[]) {
        var cb = args[args.length - 1] as Callback;
        if (typeof cb == 'function') {
            args.pop();
        }
        else {
            cb = promiseCallback();
        }
        reduce$1(_functions, args, (newargs: unknown[], fn: Task, iterCb: Callback) => {
            fn.apply(this, newargs.concat((err: unknown, ...nextargs: unknown[]) => {
                iterCb(err, nextargs);
            }));
        }, (err: unknown, results: unknown) => cb(err, ...(results as unknown[])));
        return cb[PROMISE_SYMBOL];
    };
}
function compose(...args: Task[]) {
    return seq(...args.reverse());
}
function mapLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return _asyncMap(eachOfLimit(limit), coll, iteratee, callback);
}
var mapLimit$1 = awaitify(mapLimit, 4);
function concatLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    var _iteratee = wrapAsync(iteratee);
    return mapLimit$1(coll, limit, (val: unknown, iterCb: Callback) => {
        _iteratee(val, (err: unknown, ...args: unknown[]) => {
            if (err)
                return iterCb(err);
            return iterCb(err, args);
        });
    }, (err: unknown, mapResults: (unknown[] | undefined)[]) => {
        var result: unknown[] = [];
        for (var i = 0; i < mapResults.length; i++) {
            if (mapResults[i]) {
                result = result.concat(...mapResults[i]!);
            }
        }
        return callback(err, result);
    });
}
var concatLimit$1 = awaitify(concatLimit, 4);
function concat(coll: Collection, iteratee: Task, callback: Callback) {
    return concatLimit$1(coll, Infinity, iteratee, callback);
}
var concat$1 = awaitify(concat, 3);
function concatSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return concatLimit$1(coll, 1, iteratee, callback);
}
var concatSeries$1 = awaitify(concatSeries, 3);
function constant(...args: unknown[]) {
    return function (...ignoredArgs: unknown[]) {
        var callback = ignoredArgs.pop() as Callback;
        return callback(null, ...args);
    };
}
function _createTester(check: (value: unknown) => unknown, getResult: (passed: boolean, value?: unknown) => unknown) {
    return (eachfn: Each, arr: Collection, _iteratee: Task, cb: Callback) => {
        var testPassed = false;
        var testResult: unknown;
        const iteratee = wrapAsync(_iteratee);
        eachfn(arr, (value: unknown, _: unknown, callback: Callback) => {
            iteratee(value, (err: unknown, result: unknown) => {
                if (err || err === false)
                    return callback(err);
                if (check(result) && !testResult) {
                    testPassed = true;
                    testResult = getResult(true, value);
                    return callback(null, breakLoop);
                }
                callback();
            });
        }, (err: unknown) => {
            if (err)
                return cb(err);
            cb(null, testPassed ? testResult : getResult(false));
        });
    };
}
function detect(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => bool, (res: unknown, item: unknown) => item)(eachOf$1, coll, iteratee, callback);
}
var detect$1 = awaitify(detect, 3);
function detectLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => bool, (res: unknown, item: unknown) => item)(eachOfLimit(limit), coll, iteratee, callback);
}
var detectLimit$1 = awaitify(detectLimit, 4);
function detectSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => bool, (res: unknown, item: unknown) => item)(eachOfLimit(1), coll, iteratee, callback);
}
var detectSeries$1 = awaitify(detectSeries, 3);
function consoleFunc(name: 'log' | 'dir') {
    return (fn: Task, ...args: unknown[]) => wrapAsync(fn)(...args, (err: unknown, ...resultArgs: unknown[]) => {
        if (typeof console === 'object') {
            if (err) {
                if (console.error) {
                    console.error(err);
                }
            }
            else if (console[name]) {
                resultArgs.forEach((x: unknown) => console[name](x));
            }
        }
    });
}
var dir = consoleFunc('dir');
function doWhilst(iteratee: Task, test: Task, callback: Callback) {
    callback = onlyOnce(callback);
    var _fn = wrapAsync(iteratee);
    var _test = wrapAsync(test);
    var results: unknown[];
    function next(err: unknown, ...args: unknown[]) {
        if (err)
            return callback(err);
        if (err === false)
            return;
        results = args;
        _test(...args, check);
    }
    function check(err: unknown, truth: unknown) {
        if (err)
            return callback(err);
        if (err === false)
            return;
        if (!truth)
            return callback(null, ...results);
        _fn(next);
    }
    return check(null, true);
}
var doWhilst$1 = awaitify(doWhilst, 3);
function doUntil(iteratee: Task, test: Task, callback: Callback) {
    const _test = wrapAsync(test);
    return doWhilst$1(iteratee, (...args: unknown[]) => {
        const cb = args.pop() as Callback;
        _test(...args, (err: unknown, truth: unknown) => cb(err, !truth));
    }, callback);
}
function _withoutIndex(iteratee: Task) {
    return (value: unknown, index: number, callback: Callback) => iteratee(value, callback);
}
function eachLimit(coll: Collection, iteratee: Task, callback: Callback) {
    return eachOf$1(coll, _withoutIndex(wrapAsync(iteratee)), callback);
}
var each = awaitify(eachLimit, 3);
function eachLimit$1(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return eachOfLimit(limit)(coll, _withoutIndex(wrapAsync(iteratee)), callback);
}
var eachLimit$2 = awaitify(eachLimit$1, 4);
function eachSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return eachLimit$2(coll, 1, iteratee, callback);
}
var eachSeries$1 = awaitify(eachSeries, 3);
function ensureAsync(this: unknown, fn: Task) {
    if (isAsync(fn))
        return fn;
    return function (this: unknown, ...args: unknown[]) {
        var callback = args.pop() as Callback;
        var sync = true;
        args.push((...innerArgs: unknown[]) => {
            if (sync) {
                setImmediate$1(() => callback(...innerArgs));
            }
            else {
                callback(...innerArgs);
            }
        });
        fn.apply(this, args);
        sync = false;
    };
}
function every(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => !bool, (res: unknown) => !res)(eachOf$1, coll, iteratee, callback);
}
var every$1 = awaitify(every, 3);
function everyLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => !bool, (res: unknown) => !res)(eachOfLimit(limit), coll, iteratee, callback);
}
var everyLimit$1 = awaitify(everyLimit, 4);
function everySeries(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester((bool: unknown) => !bool, (res: unknown) => !res)(eachOfSeries$1, coll, iteratee, callback);
}
var everySeries$1 = awaitify(everySeries, 3);
function filterArray(eachfn: Each, arr: ArrayLike<unknown>, iteratee: Task, callback: Callback) {
    var truthValues = new Array<boolean>(arr.length);
    eachfn(arr, (x: unknown, index: number, iterCb: Callback) => {
        iteratee(x, (err: unknown, v: unknown) => {
            truthValues[index] = !!v;
            iterCb(err);
        });
    }, (err: unknown) => {
        if (err)
            return callback(err);
        var results: unknown[] = [];
        for (var i = 0; i < arr.length; i++) {
            if (truthValues[i])
                results.push(arr[i]);
        }
        callback(null, results);
    });
}
function filterGeneric(eachfn: Each, coll: Collection, iteratee: Task, callback: Callback) {
    var results: { index: Key; value: unknown }[] = [];
    eachfn(coll, (x: unknown, index: number, iterCb: Callback) => {
        iteratee(x, (err: unknown, v: unknown) => {
            if (err)
                return iterCb(err);
            if (v) {
                results.push({ index, value: x });
            }
            iterCb(err);
        });
    }, (err: unknown) => {
        if (err)
            return callback(err);
        callback(null, results
            .sort((a, b) => Number(a.index) - Number(b.index))
            .map(v => v.value));
    });
}
function _filter(eachfn: Each, coll: Collection, iteratee: Task, callback: Callback) {
    var filter = isArrayLike(coll) ? filterArray : filterGeneric;
    return filter(eachfn, coll as ArrayLike<unknown>, wrapAsync(iteratee), callback);
}
function filter(coll: Collection, iteratee: Task, callback: Callback) {
    return _filter(eachOf$1, coll, iteratee, callback);
}
var filter$1 = awaitify(filter, 3);
function filterLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return _filter(eachOfLimit(limit), coll, iteratee, callback);
}
var filterLimit$1 = awaitify(filterLimit, 4);
function filterSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return _filter(eachOfSeries$1, coll, iteratee, callback);
}
var filterSeries$1 = awaitify(filterSeries, 3);
function forever(fn: Task, errback: Callback) {
    var done = onlyOnce(errback);
    var task = wrapAsync(ensureAsync(fn));
    function next(err?: unknown) {
        if (err)
            return done(err);
        if (err === false)
            return;
        task(next);
    }
    return next();
}
var forever$1 = awaitify(forever, 2);
function groupByLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    var _iteratee = wrapAsync(iteratee);
    return mapLimit$1(coll, limit, (val: unknown, iterCb: Callback) => {
        _iteratee(val, (err: unknown, key: Key) => {
            if (err)
                return iterCb(err);
            return iterCb(err, { key, val });
        });
    }, (err: unknown, mapResults: ({ key: PropertyKey; val: unknown } | undefined)[]) => {
        var result: Record<PropertyKey, unknown[]> = {};
        for (var i = 0; i < mapResults.length; i++) {
            if (mapResults[i]) {
                var { key, val } = mapResults[i]!;
                if (Object.prototype.hasOwnProperty.call(result, key)) {
                    result[key].push(val);
                }
                else {
                    result[key] = [val];
                }
            }
        }
        return callback(err, result);
    });
}
var groupByLimit$1 = awaitify(groupByLimit, 4);
function groupBy(coll: Collection, iteratee: Task, callback: Callback) {
    return groupByLimit$1(coll, Infinity, iteratee, callback);
}
function groupBySeries(coll: Collection, iteratee: Task, callback: Callback) {
    return groupByLimit$1(coll, 1, iteratee, callback);
}
var log = consoleFunc('log');
function mapValuesLimit(obj: Collection, limit: number, iteratee: Task, callback: Callback) {
    callback = once(callback);
    var newObj: Record<Key, unknown> = {};
    var _iteratee = wrapAsync(iteratee);
    return eachOfLimit(limit)(obj, (val: unknown, key: Key, next: Callback) => {
        _iteratee(val, key, (err: unknown, result: unknown) => {
            if (err)
                return next(err);
            newObj[key] = result;
            next(err);
        });
    }, (err: unknown) => callback(err, newObj));
}
var mapValuesLimit$1 = awaitify(mapValuesLimit, 4);
function mapValues(obj: Collection, iteratee: Task, callback: Callback) {
    return mapValuesLimit$1(obj, Infinity, iteratee, callback);
}
function mapValuesSeries(obj: Collection, iteratee: Task, callback: Callback) {
    return mapValuesLimit$1(obj, 1, iteratee, callback);
}
function memoize(fn: Task, hasher: Task = (v: unknown) => v) {
    var memo = Object.create(null) as Record<PropertyKey, unknown[]>;
    var queues = Object.create(null) as Record<PropertyKey, Callback[]>;
    var _fn = wrapAsync(fn);
    var memoized = initialParams((args: unknown[], callback: Callback) => {
        var key = hasher(...args) as PropertyKey;
        if (key in memo) {
            setImmediate$1(() => callback(null, ...memo[key]));
        }
        else if (key in queues) {
            queues[key].push(callback);
        }
        else {
            queues[key] = [callback];
            _fn(...args, (err: unknown, ...resultArgs: unknown[]) => {
                if (!err) {
                    memo[key] = resultArgs;
                }
                var q = queues[key];
                delete queues[key];
                for (var i = 0, l = q.length; i < l; i++) {
                    q[i](err, ...resultArgs);
                }
            });
        }
    });
    return Object.assign(memoized, { memo, unmemoized: fn });
}
var _defer$1: (callback: () => void) => unknown;
if (hasNextTick) {
    _defer$1 = callback => process.nextTick(callback);
}
else if (hasSetImmediate) {
    _defer$1 = setImmediate;
}
else {
    _defer$1 = fallback;
}
var nextTick = wrap(_defer$1);
var parallel = awaitify((eachfn: Each, tasks: Collection, callback: Callback) => {
    var results = (isArrayLike(tasks) ? [] : {}) as Record<Key, unknown>;
    eachfn(tasks, (task: Task, key: Key, taskCb: Callback) => {
        wrapAsync(task)((err: unknown, ...values: unknown[]) => {
            const result = values.length < 2 ? values[0] : values;
            results[key] = result;
            taskCb(err);
        });
    }, (err: unknown) => callback(err, results));
}, 3);
function parallel$1(tasks: Collection, callback: Callback) {
    return parallel(eachOf$1, tasks, callback);
}
function parallelLimit(tasks: Collection, limit: number, callback: Callback) {
    return parallel(eachOfLimit(limit), tasks, callback);
}
function queue$1(worker: Task, concurrency?: number | null) {
    var _worker = wrapAsync(worker);
    return queue((items: unknown[], cb: Callback) => {
        _worker(items[0], cb);
    }, concurrency, 1);
}
class Heap {
    declare heap: QueueNode[];
    declare pushCount: number;

    constructor() {
        this.heap = [];
        this.pushCount = Number.MIN_SAFE_INTEGER;
    }
    get length() {
        return this.heap.length;
    }
    empty() {
        this.heap = [];
        return this;
    }
    percUp(index: number) {
        let p;
        while (index > 0 && smaller(this.heap[index], this.heap[p = parent(index)])) {
            let t = this.heap[index];
            this.heap[index] = this.heap[p];
            this.heap[p] = t;
            index = p;
        }
    }
    percDown(index: number) {
        let l;
        while ((l = leftChi(index)) < this.heap.length) {
            if (l + 1 < this.heap.length && smaller(this.heap[l + 1], this.heap[l])) {
                l = l + 1;
            }
            if (smaller(this.heap[index], this.heap[l])) {
                break;
            }
            let t = this.heap[index];
            this.heap[index] = this.heap[l];
            this.heap[l] = t;
            index = l;
        }
    }
    push(node: QueueNode) {
        node.pushCount = ++this.pushCount;
        this.heap.push(node);
        this.percUp(this.heap.length - 1);
    }
    unshift(node: QueueNode) {
        return this.heap.push(node);
    }
    shift() {
        let [top] = this.heap;
        this.heap[0] = this.heap[this.heap.length - 1];
        this.heap.pop();
        this.percDown(0);
        return top;
    }
    toArray() {
        return [...this];
    }
    *[Symbol.iterator]() {
        for (let i = 0; i < this.heap.length; i++) {
            yield this.heap[i].data;
        }
    }
    remove(testFn: (node: QueueNode) => boolean) {
        let j = 0;
        for (let i = 0; i < this.heap.length; i++) {
            if (!testFn(this.heap[i])) {
                this.heap[j] = this.heap[i];
                j++;
            }
        }
        this.heap.splice(j);
        for (let i = parent(this.heap.length - 1); i >= 0; i--) {
            this.percDown(i);
        }
        return this;
    }
}
function leftChi(i: number) {
    return (i << 1) + 1;
}
function parent(i: number) {
    return ((i + 1) >> 1) - 1;
}
function smaller(x: QueueNode, y: QueueNode) {
    if (x.priority !== y.priority) {
        return x.priority! < y.priority!;
    }
    else {
        return x.pushCount! < y.pushCount!;
    }
}
function priorityQueue(worker: Task, concurrency?: number | null) {
    var q = queue$1(worker, concurrency);
    var { push, pushAsync } = q;
    q._tasks = new Heap();
    q._createTaskItem = (item, callback: Callback) => {
        const { data, priority } = item as Pick<QueueNode, 'data' | 'priority'>;
        return {
            data,
            priority,
            callback
        };
    };
    function createDataItems(tasks: unknown, priority: number) {
        if (!Array.isArray(tasks)) {
            return { data: tasks, priority };
        }
        return tasks.map((data: unknown) => { return { data, priority }; });
    }
    const pushPriority = function (data: unknown, priority = 0, callback?: Callback) {
        return push(createDataItems(data, priority), callback);
    };
    const pushAsyncPriority = function (data: unknown, priority = 0, callback?: Callback) {
        return pushAsync(createDataItems(data, priority), callback);
    };
    Reflect.deleteProperty(q, 'unshift');
    Reflect.deleteProperty(q, 'unshiftAsync');
    return Object.assign(q, { push: pushPriority, pushAsync: pushAsyncPriority });
}
function race(tasks: Collection, callback: Callback) {
    callback = once(callback);
    if (!Array.isArray(tasks))
        return callback(new TypeError('First argument to race must be an array of functions'));
    if (!tasks.length)
        return callback();
    for (var i = 0, l = tasks.length; i < l; i++) {
        wrapAsync(tasks[i])(callback);
    }
}
var race$1 = awaitify(race, 2);
function reduceRight(array: Iterable<unknown>, memo: unknown, iteratee: Task, callback: Callback) {
    var reversed = [...array].reverse();
    return reduce$1(reversed, memo, iteratee, callback);
}
function reflect(this: unknown, fn: Task) {
    var _fn = wrapAsync(fn);
    return initialParams(function reflectOn(this: unknown, args: unknown[], reflectCallback: Callback) {
        args.push((error: unknown, ...cbArgs: unknown[]) => {
            let retVal: { error?: unknown; value?: unknown } = {};
            if (error) {
                retVal.error = error;
            }
            if (cbArgs.length > 0) {
                var value: unknown = cbArgs;
                if (cbArgs.length <= 1) {
                    [value] = cbArgs;
                }
                retVal.value = value;
            }
            reflectCallback(null, retVal);
        });
        return _fn.apply(this, args);
    });
}
function reflectAll(this: unknown, tasks: Task[] | Record<string, Task>) {
    var results: Task[] | Record<string, Task>;
    if (Array.isArray(tasks)) {
        results = tasks.map(reflect);
    }
    else {
        const mapped: Record<string, Task> = {};
        Object.keys(tasks).forEach(key => {
            mapped[key] = reflect.call(this, tasks[key]);
        });
        results = mapped;
    }
    return results;
}
function reject(eachfn: Each, arr: Collection, _iteratee: Task, callback: Callback) {
    const iteratee = wrapAsync(_iteratee);
    return _filter(eachfn, arr, (value: unknown, cb: Callback) => {
        iteratee(value, (err: unknown, v: unknown) => {
            cb(err, !v);
        });
    }, callback);
}
function reject$1(coll: Collection, iteratee: Task, callback: Callback) {
    return reject(eachOf$1, coll, iteratee, callback);
}
var reject$2 = awaitify(reject$1, 3);
function rejectLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return reject(eachOfLimit(limit), coll, iteratee, callback);
}
var rejectLimit$1 = awaitify(rejectLimit, 4);
function rejectSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return reject(eachOfSeries$1, coll, iteratee, callback);
}
var rejectSeries$1 = awaitify(rejectSeries, 3);
function constant$1(value: number) {
    return function () {
        return value;
    };
}
const DEFAULT_TIMES = 5;
const DEFAULT_INTERVAL = 0;
function retry(opts: RetryOptions | number | string | Task, task?: Task | Callback, callback?: Callback) {
    var options: RetryPolicy = {
        times: DEFAULT_TIMES,
        intervalFunc: constant$1(DEFAULT_INTERVAL)
    };
    if (arguments.length < 3 && typeof opts === 'function') {
        callback = task || promiseCallback();
        task = opts;
    }
    else {
        parseTimes(options, opts as RetryOptions | number | string);
        callback = callback || promiseCallback();
    }
    if (typeof task !== 'function') {
        throw new Error("Invalid arguments for async.retry");
    }
    var _task = wrapAsync(task);
    var attempt = 1;
    function retryAttempt() {
        _task((err: unknown, ...args: unknown[]) => {
            if (err === false)
                return;
            if (err && attempt++ < options.times &&
                (typeof options.errorFilter != 'function' ||
                    options.errorFilter(err))) {
                setTimeout(retryAttempt, options.intervalFunc(attempt - 1));
            }
            else {
                callback!(err, ...args);
            }
        });
    }
    retryAttempt();
    return callback[PROMISE_SYMBOL];
}
function parseTimes(acc: RetryPolicy, t: RetryOptions | number | string) {
    if (typeof t === 'object') {
        acc.times = +(t.times as number) || DEFAULT_TIMES;
        acc.intervalFunc = typeof t.interval === 'function' ?
            t.interval :
            constant$1(+(t.interval as number) || DEFAULT_INTERVAL);
        acc.errorFilter = t.errorFilter;
    }
    else if (typeof t === 'number' || typeof t === 'string') {
        acc.times = +t || DEFAULT_TIMES;
    }
    else {
        throw new Error("Invalid arguments for async.retry");
    }
}
function retryable(opts: RetryOptions | Task | null, task?: Task) {
    if (!task) {
        task = opts as Task;
        opts = null;
    }
    let arity = (opts && (opts as RetryOptions).arity) || task.length;
    if (isAsync(task)) {
        arity += 1;
    }
    var _task = wrapAsync(task);
    return initialParams((args: unknown[], callback: Callback) => {
        if (args.length < arity - 1 || callback == null) {
            args.push(callback);
            callback = promiseCallback();
        }
        function taskFn(cb: Callback) {
            _task(...args, cb);
        }
        if (opts)
            void retry(opts, taskFn, callback);
        else
            void retry(taskFn, callback);
        return callback[PROMISE_SYMBOL];
    });
}
function series(tasks: Collection, callback: Callback) {
    return parallel(eachOfSeries$1, tasks, callback);
}
function some(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester(Boolean, (res: unknown) => res)(eachOf$1, coll, iteratee, callback);
}
var some$1 = awaitify(some, 3);
function someLimit(coll: Collection, limit: number, iteratee: Task, callback: Callback) {
    return _createTester(Boolean, (res: unknown) => res)(eachOfLimit(limit), coll, iteratee, callback);
}
var someLimit$1 = awaitify(someLimit, 4);
function someSeries(coll: Collection, iteratee: Task, callback: Callback) {
    return _createTester(Boolean, (res: unknown) => res)(eachOfSeries$1, coll, iteratee, callback);
}
var someSeries$1 = awaitify(someSeries, 3);
function sortBy(coll: Collection, iteratee: Task, callback: Callback) {
    var _iteratee = wrapAsync(iteratee);
    return map$1(coll, (x: unknown, iterCb: Callback) => {
        _iteratee(x, (err: unknown, criteria: unknown) => {
            if (err)
                return iterCb(err);
            iterCb(err, { value: x, criteria });
        });
    }, (err: unknown, results: { criteria: string | number; value: unknown }[]) => {
        if (err)
            return callback(err);
        callback(null, results.sort(comparator).map(v => v.value));
    });
    function comparator(left: { criteria: string | number }, right: { criteria: string | number }) {
        var a = left.criteria, b = right.criteria;
        return a < b ? -1 : a > b ? 1 : 0;
    }
}
var sortBy$1 = awaitify(sortBy, 3);
function timeout(asyncFn: Task, milliseconds: number, info: unknown) {
    var fn = wrapAsync(asyncFn);
    return initialParams((args: unknown[], callback: Callback) => {
        var timedOut = false;
        var timer: ReturnType<typeof setTimeout>;
        function timeoutCallback() {
            var name = asyncFn.name || 'anonymous';
            var error: Error & { code?: string; info?: unknown } = new Error('Callback function "' + name + '" timed out.');
            error.code = 'ETIMEDOUT';
            if (info) {
                error.info = info;
            }
            timedOut = true;
            callback(error);
        }
        args.push((...cbArgs: unknown[]) => {
            if (!timedOut) {
                callback(...cbArgs);
                clearTimeout(timer);
            }
        });
        timer = setTimeout(timeoutCallback, milliseconds);
        fn(...args);
    });
}
function range(size: number) {
    var result = new Array<number>(size);
    while (size--) {
        result[size] = size;
    }
    return result;
}
function timesLimit(count: number, limit: number, iteratee: Task, callback: Callback) {
    var _iteratee = wrapAsync(iteratee);
    return mapLimit$1(range(count), limit, _iteratee, callback);
}
function times(n: number, iteratee: Task, callback: Callback) {
    return timesLimit(n, Infinity, iteratee, callback);
}
function timesSeries(n: number, iteratee: Task, callback: Callback) {
    return timesLimit(n, 1, iteratee, callback);
}
function transform(coll: Collection, accumulator: unknown, iteratee: Task | Callback, callback?: Callback) {
    if (arguments.length <= 3 && typeof accumulator === 'function') {
        callback = iteratee;
        iteratee = accumulator as Task;
        accumulator = Array.isArray(coll) ? [] : {};
    }
    const complete = once(callback || promiseCallback()) as Callback;
    var _iteratee = wrapAsync(iteratee);
    eachOf$1(coll, (v: unknown, k: unknown, cb: Callback) => {
        _iteratee(accumulator, v, k, cb);
    }, (err: unknown) => complete(err, accumulator));
    return complete[PROMISE_SYMBOL];
}
function tryEach(tasks: Collection, callback: Callback) {
    var error: unknown = null;
    var result: unknown;
    return eachSeries$1(tasks, (task: Task, taskCb: Callback) => {
        wrapAsync(task)((err: unknown, ...args: unknown[]) => {
            if (err === false)
                return taskCb(err);
            if (args.length < 2) {
                [result] = args;
            }
            else {
                result = args;
            }
            error = err;
            taskCb(err ? null : {});
        });
    }, () => callback(error, result));
}
var tryEach$1 = awaitify(tryEach);
function unmemoize(fn: Task & { unmemoized?: Task }) {
    return (...args: unknown[]) => {
        return (fn.unmemoized || fn)(...args);
    };
}
function whilst(test: Task, iteratee: Task, callback: Callback) {
    callback = onlyOnce(callback);
    var _fn = wrapAsync(iteratee);
    var _test = wrapAsync(test);
    var results: unknown[] = [];
    function next(err: unknown, ...rest: unknown[]) {
        if (err)
            return callback(err);
        results = rest;
        if (err === false)
            return;
        _test(check);
    }
    function check(err: unknown, truth: unknown) {
        if (err)
            return callback(err);
        if (err === false)
            return;
        if (!truth)
            return callback(null, ...results);
        _fn(next);
    }
    return _test(check);
}
var whilst$1 = awaitify(whilst, 3);
function until(test: Task, iteratee: Task, callback: Callback) {
    const _test = wrapAsync(test);
    return whilst$1((cb: Callback) => _test((err: unknown, truth: unknown) => cb(err, !truth)), iteratee, callback);
}
function waterfall(tasks: Task[], callback: Callback) {
    callback = once(callback);
    if (!Array.isArray(tasks))
        return callback(new Error('First argument to waterfall must be an array of functions'));
    if (!tasks.length)
        return callback();
    var taskIndex = 0;
    function nextTask(args: unknown[]) {
        var task = wrapAsync(tasks[taskIndex++]);
        task(...args, onlyOnce(next));
    }
    function next(err: unknown, ...args: unknown[]) {
        if (err === false)
            return;
        if (err || taskIndex === tasks.length) {
            return callback(err, ...args);
        }
        nextTask(args);
    }
    nextTask([]);
}
var waterfall$1 = awaitify(waterfall);
var index = {
    apply,
    applyEach: applyEach$1,
    applyEachSeries,
    asyncify,
    auto,
    autoInject,
    cargo,
    cargoQueue: cargo$1,
    compose,
    concat: concat$1,
    concatLimit: concatLimit$1,
    concatSeries: concatSeries$1,
    constant,
    detect: detect$1,
    detectLimit: detectLimit$1,
    detectSeries: detectSeries$1,
    dir,
    doUntil,
    doWhilst: doWhilst$1,
    each,
    eachLimit: eachLimit$2,
    eachOf: eachOf$1,
    eachOfLimit: eachOfLimit$2,
    eachOfSeries: eachOfSeries$1,
    eachSeries: eachSeries$1,
    ensureAsync,
    every: every$1,
    everyLimit: everyLimit$1,
    everySeries: everySeries$1,
    filter: filter$1,
    filterLimit: filterLimit$1,
    filterSeries: filterSeries$1,
    forever: forever$1,
    groupBy,
    groupByLimit: groupByLimit$1,
    groupBySeries,
    log,
    map: map$1,
    mapLimit: mapLimit$1,
    mapSeries: mapSeries$1,
    mapValues,
    mapValuesLimit: mapValuesLimit$1,
    mapValuesSeries,
    memoize,
    nextTick,
    parallel: parallel$1,
    parallelLimit,
    priorityQueue,
    queue: queue$1,
    race: race$1,
    reduce: reduce$1,
    reduceRight,
    reflect,
    reflectAll,
    reject: reject$2,
    rejectLimit: rejectLimit$1,
    rejectSeries: rejectSeries$1,
    retry,
    retryable,
    seq,
    series,
    setImmediate: setImmediate$1,
    some: some$1,
    someLimit: someLimit$1,
    someSeries: someSeries$1,
    sortBy: sortBy$1,
    timeout,
    times,
    timesLimit,
    timesSeries,
    transform,
    tryEach: tryEach$1,
    unmemoize,
    until,
    waterfall: waterfall$1,
    whilst: whilst$1,
    all: every$1,
    allLimit: everyLimit$1,
    allSeries: everySeries$1,
    any: some$1,
    anyLimit: someLimit$1,
    anySeries: someSeries$1,
    find: detect$1,
    findLimit: detectLimit$1,
    findSeries: detectSeries$1,
    flatMap: concat$1,
    flatMapLimit: concatLimit$1,
    flatMapSeries: concatSeries$1,
    forEach: each,
    forEachSeries: eachSeries$1,
    forEachLimit: eachLimit$2,
    forEachOf: eachOf$1,
    forEachOfSeries: eachOfSeries$1,
    forEachOfLimit: eachOfLimit$2,
    inject: reduce$1,
    foldl: reduce$1,
    foldr: reduceRight,
    select: filter$1,
    selectLimit: filterLimit$1,
    selectSeries: filterSeries$1,
    wrapSync: asyncify,
    during: whilst$1,
    doDuring: doWhilst$1
};
const exported = {
    default: index,
    apply: apply,
    applyEach: applyEach$1,
    applyEachSeries: applyEachSeries,
    asyncify: asyncify,
    auto: auto,
    autoInject: autoInject,
    cargo: cargo,
    cargoQueue: cargo$1,
    compose: compose,
    concat: concat$1,
    concatLimit: concatLimit$1,
    concatSeries: concatSeries$1,
    constant: constant,
    detect: detect$1,
    detectLimit: detectLimit$1,
    detectSeries: detectSeries$1,
    dir: dir,
    doUntil: doUntil,
    doWhilst: doWhilst$1,
    each: each,
    eachLimit: eachLimit$2,
    eachOf: eachOf$1,
    eachOfLimit: eachOfLimit$2,
    eachOfSeries: eachOfSeries$1,
    eachSeries: eachSeries$1,
    ensureAsync: ensureAsync,
    every: every$1,
    everyLimit: everyLimit$1,
    everySeries: everySeries$1,
    filter: filter$1,
    filterLimit: filterLimit$1,
    filterSeries: filterSeries$1,
    forever: forever$1,
    groupBy: groupBy,
    groupByLimit: groupByLimit$1,
    groupBySeries: groupBySeries,
    log: log,
    map: map$1,
    mapLimit: mapLimit$1,
    mapSeries: mapSeries$1,
    mapValues: mapValues,
    mapValuesLimit: mapValuesLimit$1,
    mapValuesSeries: mapValuesSeries,
    memoize: memoize,
    nextTick: nextTick,
    parallel: parallel$1,
    parallelLimit: parallelLimit,
    priorityQueue: priorityQueue,
    queue: queue$1,
    race: race$1,
    reduce: reduce$1,
    reduceRight: reduceRight,
    reflect: reflect,
    reflectAll: reflectAll,
    reject: reject$2,
    rejectLimit: rejectLimit$1,
    rejectSeries: rejectSeries$1,
    retry: retry,
    retryable: retryable,
    seq: seq,
    series: series,
    setImmediate: setImmediate$1,
    some: some$1,
    someLimit: someLimit$1,
    someSeries: someSeries$1,
    sortBy: sortBy$1,
    timeout: timeout,
    times: times,
    timesLimit: timesLimit,
    timesSeries: timesSeries,
    transform: transform,
    tryEach: tryEach$1,
    unmemoize: unmemoize,
    until: until,
    waterfall: waterfall$1,
    whilst: whilst$1,
    all: every$1,
    allLimit: everyLimit$1,
    allSeries: everySeries$1,
    any: some$1,
    anyLimit: someLimit$1,
    anySeries: someSeries$1,
    find: detect$1,
    findLimit: detectLimit$1,
    findSeries: detectSeries$1,
    flatMap: concat$1,
    flatMapLimit: concatLimit$1,
    flatMapSeries: concatSeries$1,
    forEach: each,
    forEachSeries: eachSeries$1,
    forEachLimit: eachLimit$2,
    forEachOf: eachOf$1,
    forEachOfSeries: eachOfSeries$1,
    forEachOfLimit: eachOfLimit$2,
    inject: reduce$1,
    foldl: reduce$1,
    foldr: reduceRight,
    select: filter$1,
    selectLimit: filterLimit$1,
    selectSeries: filterSeries$1,
    wrapSync: asyncify,
    during: whilst$1,
    doDuring: doWhilst$1,
};
Object.defineProperty(exported, "__esModule", { value: true });
export = exported;
