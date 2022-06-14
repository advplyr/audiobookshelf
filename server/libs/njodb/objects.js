"use strict";

const {
    convertSize,
    max,
    min
} = require("./utils");

const Randomizer = (data, replacement) => {
    var mutable = [...data];
    if (replacement === undefined || typeof replacement !== "boolean") replacement = true;

    function _next() {
        var selection;
        const index = Math.floor(Math.random() * mutable.length);

        if (replacement) {
            selection = mutable.slice(index, index + 1)[0];
        } else {
            selection = mutable.splice(index, 1)[0];
            if (mutable.length === 0) mutable = [...data];
        }

        return selection;
    }

    return {
        next: _next
    };
};

const Result = (type) => {
    var _result;

    switch (type) {
        case "stats":
            _result = {
                size: 0,
                lines: 0,
                records: 0,
                errors: [],
                blanks: 0,
                created: undefined,
                modified: undefined,
                start: Date.now(),
                end: undefined,
                elapsed: 0
            };
            break;
        case "distribute":
            _result = {
                stores: undefined,
                records: 0,
                errors: [],
                start: Date.now(),
                end: undefined,
                elapsed: undefined
            };
            break;
        case "insert":
            _result = {
                inserted: 0,
                start: Date.now(),
                end: undefined,
                elapsed: 0
            };
            break;
        case "insertFile":
            _result = {
                lines: 0,
                inserted: 0,
                errors: [],
                blanks: 0,
                start: Date.now(),
                end: undefined
            };
            break;
        case "select":
            _result = {
                lines: 0,
                selected: 0,
                ignored: 0,
                errors: [],
                blanks: 0,
                start: Date.now(),
                end: undefined,
                elapsed: 0,
                data: [],
            };
            break;
        case "update":
            _result = {
                lines: 0,
                selected: 0,
                updated: 0,
                unchanged: 0,
                errors: [],
                blanks: 0,
                start: Date.now(),
                end: undefined,
                elapsed: 0,
                data: [],
                records: []
            };
            break;
        case "delete":
            _result = {
                lines: 0,
                deleted: 0,
                retained: 0,
                errors: [],
                blanks: 0,
                start: Date.now(),
                end: undefined,
                elapsed: 0,
                data: [],
                records: []
            };
            break;
        case "aggregate":
            _result = {
                lines: 0,
                aggregates: {},
                indexed: 0,
                unindexed: 0,
                errors: [],
                blanks: 0,
                start: Date.now(),
                end: undefined,
                elapsed: 0
            };
            break;
    }

    return _result;
}

const Reduce = (type) => {
    var _reduce;

    switch (type) {
        case "stats":
            _reduce = Object.assign(Result("stats"), {
                stores: 0,
                min: undefined,
                max: undefined,
                mean: undefined,
                var: undefined,
                std: undefined,
                m2: 0
            });
            break;
        case "drop":
            _reduce = {
                dropped: false,
                start: Date.now(),
                end: 0,
                elapsed: 0
            };
            break;
        case "aggregate":
            _reduce = Object.assign(Result("aggregate"), {
                data: []
            });
            break;
        default:
            _reduce = Result(type);
            break;
    }

    _reduce.details = undefined;

    return _reduce;
};

const Handler = (type, ...functions) => {
    var _results = Result(type);

    const _next = (record, writer) => {
        record = new Record(record);
        _results.lines++;

        if (record.length === 0) {
            _results.blanks++;
        } else {
            if (record.data) {
                switch (type) {
                    case "stats":
                        statsHandler(record, _results);
                        break;
                    case "select":
                        selectHandler(record, functions[0], functions[1], _results);
                        break;
                    case "update":
                        updateHandler(record, functions[0], functions[1], writer, _results);
                        break;
                    case "delete":
                        deleteHandler(record, functions[0], writer, _results);
                        break;
                    case "aggregate":
                        aggregateHandler(record, functions[0], functions[1], functions[2], _results);
                        break;
                }
            } else {
                _results.errors.push({ error: record.error, line: _results.lines, data: record.source });

                if (type === "update" || type === "delete") {
                    if (writer) {
                        writer.write(record.source + "\n");
                    } else {
                        _results.data.push(record.source);
                    }
                }
            }
        }
    };

    const _return = () => {
        _results.end = Date.now();
        _results.elapsed = _results.end - _results.start;
        return _results;
    }

    return {
        next: _next,
        return: _return
    };
};

const statsHandler = (record, results) => {
    results.records++;
    return results;
};

const selectHandler = (record, selecter, projecter, results) => {
    if (record.select(selecter)) {
        if (projecter) {
            results.data.push(record.project(projecter));
        } else {
            results.data.push(record.data);
        }
        results.selected++;
    } else {
        results.ignored++;
    }
};

const updateHandler = (record, selecter, updater, writer, results) => {
    if (record.select(selecter)) {
        results.selected++;
        if (record.update(updater)) {
            results.updated++;
            results.records.push(record.data);
        } else {
            results.unchanged++;
        }
    } else {
        results.unchanged++;
    }

    if (writer) {
        writer.write(JSON.stringify(record.data) + "\n");
    } else {
        results.data.push(JSON.stringify(record.data));
    }
};

const deleteHandler = (record, selecter, writer, results) => {
    if (record.select(selecter)) {
        results.deleted++;
        results.records.push(record.data);
    } else {
        results.retained++;

        if (writer) {
            writer.write(JSON.stringify(record.data) + "\n");
        } else {
            results.data.push(JSON.stringify(record.data));
        }
    }
};

const aggregateHandler = (record, selecter, indexer, projecter, results) => {
    if (record.select(selecter)) {
        const index = record.index(indexer);

        if (!index) {
            results.unindexed++;
        } else {
            var projection;
            var fields;

            if (results.aggregates[index]) {
                results.aggregates[index].count++;
            } else {
                results.aggregates[index] = {
                    count: 1,
                    aggregates: {}
                };
            }

            if (projecter) {
                projection = record.project(projecter);
                fields = Object.keys(projection);
            } else {
                projection = record.data;
                fields = Object.keys(record.data);
            }

            for (const field of fields) {
                if (projection[field] !== undefined) {
                    if (results.aggregates[index].aggregates[field]) {
                        accumulateAggregate(results.aggregates[index].aggregates[field], projection[field]);
                    } else {
                        results.aggregates[index].aggregates[field] = {
                            min: projection[field],
                            max: projection[field],
                            count: 1
                        };
                        if (typeof projection[field] === "number") {
                            results.aggregates[index].aggregates[field]["sum"] = projection[field];
                            results.aggregates[index].aggregates[field]["mean"] = projection[field];
                            results.aggregates[index].aggregates[field]["m2"] = 0;
                        }
                    }
                }
            }

            results.indexed++;
        }
    }
}

const accumulateAggregate = (index, projection) => {
    index["min"] = min(index["min"], projection);
    index["max"] = max(index["max"], projection);
    index["count"]++;

    // Welford's algorithm
    if (typeof projection === "number") {
        const delta1 = projection - index["mean"];
        index["sum"] += projection;
        index["mean"] += delta1 / index["count"];
        const delta2 = projection - index["mean"];
        index["m2"] += delta1 * delta2;
    }

    return index;
};

class Record {
    constructor(record) {
        this.source = record.trim();
        this.length = this.source.length
        this.data = {};
        this.error = "";

        try {
            this.data = JSON.parse(this.source)
        } catch (e) {
            this.data = undefined;
            this.error = e.message;
        }
    }
}

Record.prototype.select = function (selecter) {
    var result;

    try {
        result = selecter(this.data);
    } catch {
        return false;
    }

    if (typeof result !== "boolean") {
        throw new TypeError("Selecter must return a boolean");
    } else {
        return result;
    }
};

Record.prototype.update = function (updater) {
    var result;

    try {
        result = updater(this.data);
    } catch {
        return false;
    }

    if (typeof result !== "object") {
        throw new TypeError("Updater must return an object");
    } else {
        this.data = result;
        return true;
    }
}

Record.prototype.project = function (projecter) {
    var result;

    try {
        result = projecter(this.data);
    } catch {
        return undefined;
    }

    if (Array.isArray(result) || typeof result !== "object") {
        throw new TypeError("Projecter must return an object");
    } else {
        return result;
    }
};

Record.prototype.index = function (indexer) {
    try {
        return indexer(this.data);
    } catch {
        return undefined;
    }
};

const Reducer = (type, results) => {
    var _reduce = Reduce(type);

    var i = 0;
    var aggregates = {};

    for (const result of results) {
        switch (type) {
            case "stats":
                statsReducer(_reduce, result, i);
                break;
            case "insert":
                insertReducer(_reduce, result);
                break;
            case "select":
                selectReducer(_reduce, result);
                break;
            case "update":
                updateReducer(_reduce, result);
                break;
            case "delete":
                deleteReducer(_reduce, result);
                break;
            case "aggregate":
                aggregateReducer(_reduce, result, aggregates);
                break
        }

        if (type === "stats") {
            _reduce.stores++;
            i++;
        }

        if (type === "drop") {
            _reduce.dropped = true;
        } else if (type !== "insert") {
            _reduce.lines += result.lines;
            _reduce.errors = _reduce.errors.concat(result.errors);
            _reduce.blanks += result.blanks;
        }

        _reduce.start = min(_reduce.start, result.start);
        _reduce.end = max(_reduce.end, result.end);
    }

    if (type === "stats") {
        _reduce.size = convertSize(_reduce.size);
        _reduce.var = _reduce.m2 / (results.length);
        _reduce.std = Math.sqrt(_reduce.m2 / (results.length));
        delete _reduce.m2;
    } else if (type === "aggregate") {
        for (const index of Object.keys(aggregates)) {
            var aggregate = {
                index: index,
                count: aggregates[index].count,
                aggregates: []
            };
            for (const field of Object.keys(aggregates[index].aggregates)) {
                delete aggregates[index].aggregates[field].m2;
                aggregate.aggregates.push({ field: field, data: aggregates[index].aggregates[field] });
            }
            _reduce.data.push(aggregate);
        }
        delete _reduce.aggregates;
    }

    _reduce.elapsed = _reduce.end - _reduce.start;
    _reduce.details = results;

    return _reduce;
};

const statsReducer = (reduce, result, i) => {
    reduce.size += result.size;
    reduce.records += result.records;
    reduce.min = min(reduce.min, result.records);
    reduce.max = max(reduce.max, result.records);
    if (reduce.mean === undefined) reduce.mean = result.records;
    const delta1 = result.records - reduce.mean;
    reduce.mean += delta1 / (i + 2);
    const delta2 = result.records - reduce.mean;
    reduce.m2 += delta1 * delta2;
    reduce.created = min(reduce.created, result.created);
    reduce.modified = max(reduce.modified, result.modified);
};

const insertReducer = (reduce, result) => {
    reduce.inserted += result.inserted;
};

const selectReducer = (reduce, result) => {
    reduce.selected += result.selected;
    reduce.ignored += result.ignored;
    reduce.data = reduce.data.concat(result.data);
    delete result.data;
};

const updateReducer = (reduce, result) => {
    reduce.selected += result.selected;
    reduce.updated += result.updated;
    reduce.unchanged += result.unchanged;
};

const deleteReducer = (reduce, result) => {
    reduce.deleted += result.deleted;
    reduce.retained += result.retained;
};

const aggregateReducer = (reduce, result, aggregates) => {
    reduce.indexed += result.indexed;
    reduce.unindexed += result.unindexed;

    const indexes = Object.keys(result.aggregates);

    for (const index of indexes) {
        if (aggregates[index]) {
            aggregates[index].count += result.aggregates[index].count;
        } else {
            aggregates[index] = {
                count: result.aggregates[index].count,
                aggregates: {}
            };
        }

        const fields = Object.keys(result.aggregates[index].aggregates);

        for (const field of fields) {
            const aggregateObject = aggregates[index].aggregates[field];
            const resultObject = result.aggregates[index].aggregates[field];

            if (aggregateObject) {
                reduceAggregate(aggregateObject, resultObject);
            } else {
                aggregates[index].aggregates[field] = {
                    min: resultObject["min"],
                    max: resultObject["max"],
                    count: resultObject["count"]
                };

                if (resultObject["m2"] !== undefined) {
                    aggregates[index].aggregates[field]["sum"] = resultObject["sum"];
                    aggregates[index].aggregates[field]["mean"] = resultObject["mean"];
                    aggregates[index].aggregates[field]["varp"] = resultObject["m2"] / resultObject["count"];
                    aggregates[index].aggregates[field]["vars"] = resultObject["m2"] / (resultObject["count"] - 1);
                    aggregates[index].aggregates[field]["stdp"] = Math.sqrt(resultObject["m2"] / resultObject["count"]);
                    aggregates[index].aggregates[field]["stds"] = Math.sqrt(resultObject["m2"] / (resultObject["count"] - 1));
                    aggregates[index].aggregates[field]["m2"] = resultObject["m2"];
                }
            }
        }
    }

    delete result.aggregates;
};

const reduceAggregate = (aggregate, result) => {
    const n = aggregate["count"] + result["count"];

    aggregate["min"] = min(aggregate["min"], result["min"]);
    aggregate["max"] = max(aggregate["max"], result["max"]);

    // Parallel version of Welford's algorithm
    if (result["m2"] !== undefined) {
        const delta = result["mean"] - aggregate["mean"];
        const m2 = aggregate["m2"] + result["m2"] + (Math.pow(delta, 2) * ((aggregate["count"] * result["count"]) / n));
        aggregate["m2"] = m2;
        aggregate["varp"] = m2 / n;
        aggregate["vars"] = m2 / (n - 1);
        aggregate["stdp"] = Math.sqrt(m2 / n);
        aggregate["stds"] = Math.sqrt(m2 / (n - 1));
    }

    if (result["sum"] !== undefined) {
        aggregate["mean"] = (aggregate["sum"] + result["sum"]) / n;
        aggregate["sum"] += result["sum"];
    }

    aggregate["count"] = n;
};

exports.Randomizer = Randomizer;
exports.Result = Result;
exports.Reduce = Reduce;
exports.Handler = Handler;
exports.Reducer = Reducer;
