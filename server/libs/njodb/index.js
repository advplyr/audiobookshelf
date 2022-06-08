"use strict";

const {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync
} = require("graceful-fs");

const {
    join,
    resolve
} = require("path");

const {
    aggregateStoreData,
    aggregateStoreDataSync,
    distributeStoreData,
    distributeStoreDataSync,
    deleteStoreData,
    deleteStoreDataSync,
    dropEverything,
    dropEverythingSync,
    getStoreNames,
    getStoreNamesSync,
    insertStoreData,
    insertStoreDataSync,
    insertFileData,
    selectStoreData,
    selectStoreDataSync,
    statsStoreData,
    statsStoreDataSync,
    updateStoreData,
    updateStoreDataSync
} = require("./njodb");

const {
    Randomizer,
    Reducer,
    Result
} = require("./objects");

const {
    validateArray,
    validateFunction,
    validateName,
    validateObject,
    validatePath,
    validateSize
} = require("./validators");

const defaults = {
    "datadir": "data",
    "dataname": "data",
    "datastores": 5,
    "tempdir": "tmp",
    "lockoptions": {
        "stale": 5000,
        "update": 1000,
        "retries": {
            "retries": 5000,
            "minTimeout": 250,
            "maxTimeout": 5000,
            "factor": 0.15,
            "randomize": false
        }
    }
};

const mergeProperties = (defaults, userProperties) => {
    var target = Object.assign({}, defaults);

    for (let key of Object.keys(userProperties)) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            if (typeof userProperties[key] !== 'object' && !Array.isArray(userProperties[key])) {
                Object.assign(target, { [key]: userProperties[key] });
            } else {
                target[key] = mergeProperties(target[key], userProperties[key]);
            }
        }
    }

    return target;
}

const saveProperties = (root, properties) => {
    properties = {
        "datadir": properties.datadir,
        "dataname": properties.dataname,
        "datastores": properties.datastores,
        "tempdir": properties.tempdir,
        "lockoptions": properties.lockoptions
    };
    const propertiesFile = join(root, "njodb.properties");
    writeFileSync(propertiesFile, JSON.stringify(properties, null, 4));
    return properties;
}

process.on("uncaughtException", error => {
    if (error.code === "ECOMPROMISED") {
        console.error(Object.assign(new Error("Stale lock or attempt to update it after release"), { code: error.code }));
    } else {
        throw error;
    }
});

class Database {

    constructor(root, properties = {}) {
        validateObject(properties);

        this.properties = {};

        if (root !== undefined && root !== null) {
            validateName(root);
            this.properties.root = root;
        } else {
            this.properties.root = process.cwd();
        }

        if (!existsSync(this.properties.root)) mkdirSync(this.properties.root);

        const propertiesFile = join(this.properties.root, "njodb.properties");

        if (existsSync(propertiesFile)) {
            this.setProperties(JSON.parse(readFileSync(propertiesFile)));
        } else {
            this.setProperties(mergeProperties(defaults, properties));
        }

        if (!existsSync(this.properties.datapath)) mkdirSync(this.properties.datapath);
        if (!existsSync(this.properties.temppath)) mkdirSync(this.properties.temppath);

        this.properties.storenames = getStoreNamesSync(this.properties.datapath, this.properties.dataname);

        return this;
    }

    // Database management methods

    getProperties() {
        return this.properties;
    }

    setProperties(properties) {
        validateObject(properties);

        this.properties.datadir = (validateName(properties.datadir)) ? properties.datadir : defaults.datadir;
        this.properties.dataname = (validateName(properties.dataname)) ? properties.dataname : defaults.dataname;
        this.properties.datastores = (validateSize(properties.datastores)) ? properties.datastores : defaults.datastores;
        this.properties.tempdir = (validateName(properties.tempdir)) ? properties.tempdir : defaults.tempdir;
        this.properties.lockoptions = (validateObject(properties.lockoptions)) ? properties.lockoptions : defaults.lockoptions;
        this.properties.datapath = join(this.properties.root, this.properties.datadir);
        this.properties.temppath = join(this.properties.root, this.properties.tempdir);

        saveProperties(this.properties.root, this.properties);

        return this.properties;
    }

    async stats() {
        var stats = {
            root: resolve(this.properties.root),
            data: resolve(this.properties.datapath),
            temp: resolve(this.properties.temppath)
        };

        var promises = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            promises.push(statsStoreData(storepath, this.properties.lockoptions));
        }

        const results = await Promise.all(promises);

        return Object.assign(stats, Reducer("stats", results));
    }

    statsSync() {
        var stats = {
            root: resolve(this.properties.root),
            data: resolve(this.properties.datapath),
            temp: resolve(this.properties.temppath)
        };

        var results = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            results.push(statsStoreDataSync(storepath));
        }

        return Object.assign(stats, Reducer("stats", results));
    }

    async grow() {
        this.properties.datastores++;
        const results = await distributeStoreData(this.properties);
        this.properties.storenames = await getStoreNames(this.properties.datapath, this.properties.dataname);
        saveProperties(this.properties.root, this.properties);
        return results;
    }

    growSync() {
        this.properties.datastores++;
        const results = distributeStoreDataSync(this.properties);
        this.properties.storenames = getStoreNamesSync(this.properties.datapath, this.properties.dataname);
        saveProperties(this.properties.root, this.properties);
        return results;
    }

    async shrink() {
        if (this.properties.datastores > 1) {
            this.properties.datastores--;
            const results = await distributeStoreData(this.properties);
            this.properties.storenames = await getStoreNames(this.properties.datapath, this.properties.dataname);
            saveProperties(this.properties.root, this.properties);
            return results;
        } else {
            throw new Error("Database cannot shrink any further");
        }
    }

    shrinkSync() {
        if (this.properties.datastores > 1) {
            this.properties.datastores--;
            const results = distributeStoreDataSync(this.properties);
            this.properties.storenames = getStoreNamesSync(this.properties.datapath, this.properties.dataname);
            saveProperties(this.properties.root, this.properties);
            return results;
        } else {
            throw new Error("Database cannot shrink any further");
        }
    }

    async resize(size) {
        validateSize(size);
        this.properties.datastores = size;
        const results = await distributeStoreData(this.properties);
        this.properties.storenames = await getStoreNames(this.properties.datapath, this.properties.dataname);
        saveProperties(this.properties.root, this.properties);
        return results;
    }

    resizeSync(size) {
        validateSize(size);
        this.properties.datastores = size;
        const results = distributeStoreDataSync(this.properties);
        this.properties.storenames = getStoreNamesSync(this.properties.datapath, this.properties.dataname);
        saveProperties(this.properties.root, this.properties);
        return results;
    }

    async drop() {
        const results = await dropEverything(this.properties);
        return Reducer("drop", results);
    }

    dropSync() {
        const results = dropEverythingSync(this.properties);
        return Reducer("drop", results);
    }

    // Data manipulation methods

    async insert(data) {
        validateArray(data);

        var promises = [];
        var records = [];

        for (let i = 0; i < this.properties.datastores; i++) {
            records[i] = "";
        }

        for (let i = 0; i < data.length; i++) {
            records[i % this.properties.datastores] += JSON.stringify(data[i]) + "\n";
        }

        const randomizer = Randomizer(Array.from(Array(this.properties.datastores).keys()), false);

        for (var j = 0; j < records.length; j++) {
            if (records[j] !== "") {
                const storenumber = randomizer.next();
                const storename = [this.properties.dataname, storenumber, "json"].join(".");
                const storepath = join(this.properties.datapath, storename)
                promises.push(insertStoreData(storepath, records[j], this.properties.lockoptions));
            }
        }

        const results = await Promise.all(promises);

        this.properties.storenames = await getStoreNames(this.properties.datapath, this.properties.dataname);

        return Reducer("insert", results);
    }

    insertSync(data) {
        validateArray(data);

        var results = [];
        var records = [];

        for (let i = 0; i < this.properties.datastores; i++) {
            records[i] = "";
        }

        for (let i = 0; i < data.length; i++) {
            records[i % this.properties.datastores] += JSON.stringify(data[i]) + "\n";
        }

        const randomizer = Randomizer(Array.from(Array(this.properties.datastores).keys()), false);

        for (var j = 0; j < records.length; j++) {
            if (records[j] !== "") {
                const storenumber = randomizer.next();
                const storename = [this.properties.dataname, storenumber, "json"].join(".");
                const storepath = join(this.properties.datapath, storename)
                results.push(insertStoreDataSync(storepath, records[j], this.properties.lockoptions));
            }
        }

        this.properties.storenames = getStoreNamesSync(this.properties.datapath, this.properties.dataname);

        return Reducer("insert", results);
    }

    async insertFile(file) {
        validatePath(file);

        const results = await insertFileData(file, this.properties.datapath, this.properties.storenames, this.properties.lockoptions);

        return results;
    }

    insertFileSync(file) {
        validatePath(file);

        const data = readFileSync(file, "utf8").split("\n");
        var records = [];

        var results = Result("insertFile");

        for (var record of data) {
            record = record.trim()

            results.lines++;

            if (record.length > 0) {
                try {
                    records.push(JSON.parse(record));
                } catch (error) {
                    results.errors.push({ error: error.message, line: results.lines, data: record });
                }
            } else {
                results.blanks++;
            }
        }

        return Object.assign(results, this.insertSync(records));
    }

    async select(match, project) {
        validateFunction(match);
        if (project) validateFunction(project);

        var promises = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            promises.push(selectStoreData(storepath, match, project, this.properties.lockoptions));
        }

        const results = await Promise.all(promises);
        return Reducer("select", results);
    }

    selectSync(match, project) {
        validateFunction(match);
        if (project) validateFunction(project);

        var results = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            results.push(selectStoreDataSync(storepath, match, project));
        }

        return Reducer("select", results);
    }

    async update(match, update) {
        validateFunction(match);
        validateFunction(update);

        var promises = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            const tempstorename = [storename, Date.now(), "tmp"].join(".");
            const tempstorepath = join(this.properties.temppath, tempstorename);
            promises.push(updateStoreData(storepath, match, update, tempstorepath, this.properties.lockoptions));
        }

        const results = await Promise.all(promises);
        return Reducer("update", results);
    }

    updateSync(match, update) {
        validateFunction(match);
        validateFunction(update);

        var results = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            const tempstorename = [storename, Date.now(), "tmp"].join(".");
            const tempstorepath = join(this.properties.temppath, tempstorename);
            results.push(updateStoreDataSync(storepath, match, update, tempstorepath));
        }

        return Reducer("update", results);
    }

    async delete(match) {
        validateFunction(match);

        var promises = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            const tempstorename = [storename, Date.now(), "tmp"].join(".");
            const tempstorepath = join(this.properties.temppath, tempstorename);
            promises.push(deleteStoreData(storepath, match, tempstorepath, this.properties.lockoptions));
        }

        const results = await Promise.all(promises);
        return Reducer("delete", results);
    }

    deleteSync(match) {
        validateFunction(match);

        var results = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            const tempstorename = [storename, Date.now(), "tmp"].join(".");
            const tempstorepath = join(this.properties.temppath, tempstorename);
            results.push(deleteStoreDataSync(storepath, match, tempstorepath));
        }

        return Reducer("delete", results);
    }

    async aggregate(match, index, project) {
        validateFunction(match);
        validateFunction(index);
        if (project) validateFunction(project);

        var promises = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            promises.push(aggregateStoreData(storepath, match, index, project, this.properties.lockoptions));
        }

        const results = await Promise.all(promises);
        return Reducer("aggregate", results);
    }

    aggregateSync(match, index, project) {
        validateFunction(match);
        validateFunction(index);
        if (project) validateFunction(project);

        var results = [];

        for (const storename of this.properties.storenames) {
            const storepath = join(this.properties.datapath, storename);
            results.push(aggregateStoreDataSync(storepath, match, index, project));
        }

        return Reducer("aggregate", results);
    }
}

exports.Database = Database;
