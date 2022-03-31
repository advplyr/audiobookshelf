"use strict";

const {
    appendFile,
    appendFileSync,
    createReadStream,
    createWriteStream,
    readFileSync,
    readdir,
    readdirSync,
    stat,
    statSync,
    writeFile
} = require("graceful-fs");

const {
    join,
    resolve
} = require("path");

const { createInterface } = require("readline");

const { promisify } = require("util");

const {
    check,
    checkSync,
    lock,
    lockSync
} = require("proper-lockfile");

const {
    deleteFile,
    deleteFileSync,
    deleteDirectory,
    deleteDirectorySync,
    fileExists,
    fileExistsSync,
    moveFile,
    moveFileSync,
    releaseLock,
    releaseLockSync,
    replaceFile,
    replaceFileSync
} = require("./utils");

const {
    Handler,
    Randomizer,
    Result
} = require("./objects");

const filterStoreNames = (files, dataname) => {
    var storenames = [];
    const re = new RegExp("^" + [dataname, "\\d+", "json"].join(".") + "$");
    for (const file of files) {
        if (re.test(file)) storenames.push(file);
    }
    return storenames;
};

const getStoreNames = async (datapath, dataname) => {
    const files = await promisify(readdir)(datapath);
    return filterStoreNames(files, dataname);
}

const getStoreNamesSync = (datapath, dataname) => {
    const files = readdirSync(datapath);
    return filterStoreNames(files, dataname);
};

// Database management

const statsStoreData = async (store, lockoptions) => {
    var release, stats, results;

    release = await lock(store, lockoptions);

    const handlerResults = await new Promise((resolve, reject) => {
        const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });
        const handler = Handler("stats");

        reader.on("line", record => handler.next(record));
        reader.on("close", () => resolve(handler.return()));
        reader.on("error", error => reject(error));
    });

    if (await check(store, lockoptions)) await releaseLock(store, release);

    results = Object.assign({ store: resolve(store) }, handlerResults)

    stats = await promisify(stat)(store);
    results.size = stats.size;
    results.created = stats.birthtime;
    results.modified = stats.mtime;

    results.end = Date.now()

    return results;
};

const statsStoreDataSync = (store) => {
    var file, release, results;

    release = lockSync(store);
    file = readFileSync(store, "utf8");

    if (checkSync(store)) releaseLockSync(store, release);

    const data = file.split("\n");
    const handler = Handler("stats");

    for (var record of data) {
        handler.next(record)
    }

    results = Object.assign({ store: resolve(store) }, handler.return());

    const stats = statSync(store);
    results.size = stats.size;
    results.created = stats.birthtime;
    results.modified = stats.mtime;

    results.end = Date.now();

    return results;
};

const distributeStoreData = async (properties) => {
    var results = Result("distribute");

    var storepaths = [];
    var tempstorepaths = [];

    var locks = [];

    for (let storename of properties.storenames) {
        const storepath = join(properties.datapath, storename);
        storepaths.push(storepath);
        locks.push(lock(storepath, properties.lockoptions));
    }

    const releases = await Promise.all(locks);

    var writes = [];
    var writers = [];

    for (let i = 0; i < properties.datastores; i++) {
        const tempstorepath = join(properties.temppath, [properties.dataname, i, results.start, "json"].join("."));
        tempstorepaths.push(tempstorepath);
        await promisify(writeFile)(tempstorepath, "");
        writers.push(createWriteStream(tempstorepath, { flags: "r+" }));
    }

    for (let storename of properties.storenames) {
        writes.push(new Promise((resolve, reject) => {
            var line = 0;
            const store = join(properties.datapath, storename);
            const randomizer = Randomizer(Array.from(Array(properties.datastores).keys()), false);
            const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });

            reader.on("line", record => {
                const storenumber = randomizer.next();

                line++;
                try {
                    record = JSON.stringify(JSON.parse(record));
                    results.records++;
                } catch {
                    results.errors.push({ line: line, data: record });
                } finally {
                    writers[storenumber].write(record + "\n");
                }
            });

            reader.on("close", () => {
                resolve(true);
            });

            reader.on("error", error => {
                reject(error);
            });
        }));
    }

    await Promise.all(writes);

    for (let writer of writers) {
        writer.end();
    }

    var deletes = [];

    for (let storepath of storepaths) {
        deletes.push(deleteFile(storepath));
    }

    await Promise.all(deletes);

    for (const release of releases) {
        release();
    }

    var moves = [];

    for (let i = 0; i < tempstorepaths.length; i++) {
        moves.push(moveFile(tempstorepaths[i], join(properties.datapath, [properties.dataname, i, "json"].join("."))))
    }

    await Promise.all(moves);

    results.stores = tempstorepaths.length,
        results.end = Date.now();
    results.elapsed = results.end - results.start;

    return results;

};

const distributeStoreDataSync = (properties) => {
    var results = Result("distribute");

    var storepaths = [];
    var tempstorepaths = [];

    var releases = [];
    var data = [];

    for (let storename of properties.storenames) {
        const storepath = join(properties.datapath, storename);
        storepaths.push(storepath);
        releases.push(lockSync(storepath));
        const file = readFileSync(storepath, "utf8").trimEnd();
        if (file.length > 0) data = data.concat(file.split("\n"));
    }

    var records = [];

    for (var i = 0; i < data.length; i++) {
        try {
            data[i] = JSON.stringify(JSON.parse(data[i]));
            results.records++;
        } catch (error) {
            results.errors.push({ line: i, data: data[i] });
        } finally {
            if (i === i % properties.datastores) records[i] = [];
            records[i % properties.datastores] += data[i] + "\n";
        }

    }

    const randomizer = Randomizer(Array.from(Array(properties.datastores).keys()), false);

    for (var j = 0; j < records.length; j++) {
        const storenumber = randomizer.next();
        const tempstorepath = join(properties.temppath, [properties.dataname, storenumber, results.start, "json"].join("."));
        tempstorepaths.push(tempstorepath);
        appendFileSync(tempstorepath, records[j]);
    }

    for (let storepath of storepaths) {
        deleteFileSync(storepath);
    }

    for (const release of releases) {
        release();
    }

    for (let i = 0; i < tempstorepaths.length; i++) {
        moveFileSync(tempstorepaths[i], join(properties.datapath, [properties.dataname, i, "json"].join(".")));
    }

    results.stores = tempstorepaths.length,
        results.end = Date.now();
    results.elapsed = results.end - results.start;

    return results;

};

const dropEverything = async (properties) => {
    var locks = [];

    for (let storename of properties.storenames) {
        locks.push(lock(join(properties.datapath, storename), properties.lockoptions));
    }

    const releases = await Promise.all(locks);

    var deletes = [];

    for (let storename of properties.storenames) {
        deletes.push(deleteFile(join(properties.datapath, storename)));
    }

    var results = await Promise.all(deletes);

    for (const release of releases) {
        release();
    }

    deletes = [
        deleteDirectory(properties.temppath),
        deleteDirectory(properties.datapath),
        deleteFile(join(properties.root, "njodb.properties"))
    ];

    results = results.concat(await Promise.all(deletes));

    return results;
}

const dropEverythingSync = (properties) => {
    var results = [];
    var releases = [];

    for (let storename of properties.storenames) {
        releases.push(lockSync(join(properties.datapath, storename)));
    }

    for (let storename of properties.storenames) {
        results.push(deleteFileSync(join(properties.datapath, storename)));
    }

    for (const release of releases) {
        release();
    }

    results.push(deleteDirectorySync(properties.temppath));
    results.push(deleteDirectorySync(properties.datapath));
    results.push(deleteFileSync(join(properties.root, "njodb.properties")));

    return results;
}

// Data manipulation

const insertStoreData = async (store, data, lockoptions) => {
    let release, results;

    results = Object.assign({ store: resolve(store) }, Result("insert"));

    if (await fileExists(store)) release = await lock(store, lockoptions);

    await promisify(appendFile)(store, data, "utf8");

    if (await check(store, lockoptions)) await releaseLock(store, release);

    results.inserted = (data.length > 0) ? data.split("\n").length - 1 : 0;
    results.end = Date.now();

    return results;
};

const insertStoreDataSync = (store, data) => {
    let release, results;

    results = Object.assign({ store: resolve(store) }, Result("insert"));

    if (fileExistsSync(store)) release = lockSync(store);

    appendFileSync(store, data, "utf8");

    if (checkSync(store)) releaseLockSync(store, release);

    results.inserted = (data.length > 0) ? data.split("\n").length - 1 : 0;
    results.end = Date.now();

    return results;
};

const insertFileData = async (file, datapath, storenames, lockoptions) => {
    let datastores, locks, releases, writers, results;

    results = Result("insertFile");

    datastores = storenames.length;
    locks = [];
    writers = [];

    for (let storename of storenames) {
        const storepath = join(datapath, storename);
        locks.push(lock(storepath, lockoptions));
        writers.push(createWriteStream(storepath, { flags: "r+" }));
    }

    releases = await Promise.all(locks);

    await new Promise((resolve, reject) => {
        const randomizer = Randomizer(Array.from(Array(datastores).keys()), false);
        const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity });

        reader.on("line", record => {
            record = record.trim();

            const storenumber = randomizer.next();
            results.lines++;

            if (record.length > 0) {
                try {
                    record = JSON.parse(record);
                    results.inserted++;
                } catch (error) {
                    results.errors.push({ error: error.message, line: results.lines, data: record });
                } finally {
                    writers[storenumber].write(JSON.stringify(record) + "\n");
                }
            } else {
                results.blanks++;
            }
        });

        reader.on("close", () => {
            resolve(true);
        });

        reader.on("error", error => {
            reject(error);
        });
    });

    for (const writer of writers) {
        writer.end();
    }

    for (const release of releases) {
        release();
    }

    results.end = Date.now();
    results.elapsed = results.end - results.start;

    return results;
}

const selectStoreData = async (store, match, project, lockoptions) => {
    let release, results;

    release = await lock(store, lockoptions);

    const handlerResults = await new Promise((resolve, reject) => {
        const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });
        const handler = Handler("select", match, project);

        reader.on("line", record => handler.next(record));
        reader.on("close", () => resolve(handler.return()));
        reader.on("error", error => reject(error));
    });

    if (await check(store, lockoptions)) await releaseLock(store, release);

    results = Object.assign({ store: store }, handlerResults);

    return results;
};

const selectStoreDataSync = (store, match, project) => {
    let file, release, results;

    release = lockSync(store);

    file = readFileSync(store, "utf8");

    if (checkSync(store)) releaseLockSync(store, release);

    const records = file.split("\n");
    const handler = Handler("select", match, project);

    for (var record of records) {
        handler.next(record);
    }

    results = Object.assign({ store: store }, handler.return());

    return results;
};

const updateStoreData = async (store, match, update, tempstore, lockoptions) => {
    let release, results;

    release = await lock(store, lockoptions);

    // console.log('Start updateStoreData for tempstore', tempstore, 'real store', store)
    const handlerResults = await new Promise((resolve, reject) => {

        const writer = createWriteStream(tempstore);
        const handler = Handler("update", match, update);

        writer.on("open", () => {
            // Reader was opening and closing before writer ever opened
            const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });

            // console.log('Writer opened for tempstore', tempstore)
            reader.on("line", record => {
                handler.next(record, writer)
            });


            reader.on("close", () => {
                // console.log('Closing reader for store', store)
                writer.end();
                resolve(handler.return());
            });

            reader.on("error", error => reject(error));
        });

        // writer.on('close', () => {
        // console.log('Writer closed for tempstore', tempstore)
        // })

        writer.on("error", error => reject(error));

    });

    results = Object.assign({ store: store, tempstore: tempstore }, handlerResults);

    if (results.updated > 0) {
        if (!await replaceFile(store, tempstore)) {
            results.errors = [...results.records];
            results.updated = 0;
        }
    } else {
        await deleteFile(tempstore);
    }

    if (await check(store, lockoptions)) await releaseLock(store, release);

    results.end = Date.now();
    delete results.data;
    delete results.records;

    return results;
};

const updateStoreDataSync = (store, match, update, tempstore) => {
    let file, release, results;

    release = lockSync(store);
    file = readFileSync(store, "utf8").trimEnd();

    if (checkSync(store)) releaseLockSync(store, release);


    const records = file.split("\n");
    const handler = Handler("update", match, update);

    for (var record of records) {
        handler.next(record);
    }

    results = Object.assign({ store: store, tempstore: tempstore }, handler.return());

    if (results.updated > 0) {
        let append, replace;

        try {
            appendFileSync(tempstore, results.data.join("\n") + "\n", "utf8");
            append = true;
        } catch {
            append = false;
        }

        if (append) replace = replaceFileSync(store, tempstore);

        if (!(append || replace)) {
            results.errors = [...results.records];
            results.updated = 0;
        }
    }

    results.end = Date.now();
    delete results.data;
    delete results.records;

    return results;

};

const deleteStoreData = async (store, match, tempstore, lockoptions) => {
    let release, results;

    release = await lock(store, lockoptions);

    const handlerResults = await new Promise((resolve, reject) => {
        const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });
        const writer = createWriteStream(tempstore);
        const handler = Handler("delete", match);

        writer.on("open", () => {
            reader.on("line", record => handler.next(record, writer));
        });

        writer.on("error", error => reject(error));

        reader.on("close", () => {
            writer.end();
            resolve(handler.return());
        });

        reader.on("error", error => reject(error));
    });

    results = Object.assign({ store: store, tempstore: tempstore }, handlerResults);

    if (results.deleted > 0) {
        if (!await replaceFile(store, tempstore)) {
            results.errors = [...results.records];
            results.deleted = 0;
        }
    } else {
        await deleteFile(tempstore);
    }

    if (await check(store, lockoptions)) await releaseLock(store, release);

    results.end = Date.now();
    delete results.data;
    delete results.records;

    return results;

};

const deleteStoreDataSync = (store, match, tempstore) => {
    let file, release, results;

    release = lockSync(store);
    file = readFileSync(store, "utf8");

    if (checkSync(store)) releaseLockSync(store, release);

    const records = file.split("\n");
    const handler = Handler("delete", match);

    for (var record of records) {
        handler.next(record)
    }

    results = Object.assign({ store: store, tempstore: tempstore }, handler.return());

    if (results.deleted > 0) {
        let append, replace;

        try {
            appendFileSync(tempstore, results.data.join("\n") + "\n", "utf8");
            append = true;
        } catch {
            append = false;
        }

        if (append) replace = replaceFileSync(store, tempstore);

        if (!(append || replace)) {
            results.errors = [...results.records];
            results.updated = 0;
        }
    }

    results.end = Date.now();
    delete results.data;
    delete results.records;

    return results;
};

const aggregateStoreData = async (store, match, index, project, lockoptions) => {
    let release, results;

    release = await lock(store, lockoptions);

    const handlerResults = await new Promise((resolve, reject) => {
        const reader = createInterface({ input: createReadStream(store), crlfDelay: Infinity });
        const handler = Handler("aggregate", match, index, project);

        reader.on("line", record => handler.next(record));
        reader.on("close", () => resolve(handler.return()));
        reader.on("error", error => reject(error));
    });

    if (await check(store, lockoptions)) releaseLock(store, release);

    results = Object.assign({ store: store }, handlerResults);

    return results;
}

const aggregateStoreDataSync = (store, match, index, project) => {
    let file, release, results;

    release = lockSync(store);
    file = readFileSync(store, "utf8");

    if (checkSync(store)) releaseLockSync(store, release);

    const records = file.split("\n");
    const handler = Handler("aggregate", match, index, project);

    for (var record of records) {
        handler.next(record);
    }

    results = Object.assign({ store: store }, handler.return());

    return results;
}

exports.getStoreNames = getStoreNames;
exports.getStoreNamesSync = getStoreNamesSync;

// Database management
exports.statsStoreData = statsStoreData;
exports.statsStoreDataSync = statsStoreDataSync;
exports.distributeStoreData = distributeStoreData;
exports.distributeStoreDataSync = distributeStoreDataSync;
exports.dropEverything = dropEverything;
exports.dropEverythingSync = dropEverythingSync;

// Data manipulation
exports.insertStoreData = insertStoreData;
exports.insertStoreDataSync = insertStoreDataSync;
exports.insertFileData = insertFileData;
exports.selectStoreData = selectStoreData;
exports.selectStoreDataSync = selectStoreDataSync;
exports.updateStoreData = updateStoreData;
exports.updateStoreDataSync = updateStoreDataSync;
exports.deleteStoreData = deleteStoreData;
exports.deleteStoreDataSync = deleteStoreDataSync;
exports.aggregateStoreData = aggregateStoreData;
exports.aggregateStoreDataSync = aggregateStoreDataSync;

