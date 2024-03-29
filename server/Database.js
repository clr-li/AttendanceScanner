'use strict';

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// ============================ INIT SQLite DATABASE ============================
/** @type { import('sqlite3').Database } */
let db;
/**
 * Reinitializes the database if the database file does not exist.
 * @param {string} dbFile path to the database file or ':memory:' for an in-memory database
 * @param {string} schemaFile path to the database schema file
 * @returns true if the database file already existed, false otherwise
 */
async function reinitializeIfNotExists(
    dbFile = ':memory:',
    schemaFile = './server/databaseSchema.sql',
) {
    const exists = dbFile !== ':memory:' && fs.existsSync(dbFile);
    if (exists) console.log('Database file found: ' + dbFile);
    if (db)
        await new Promise((resolve, reject) => {
            db.close(err => {
                if (err) console.error('Failed to close previous database connection: ' + err);
                else console.log('Closed previous database connection');
                resolve();
            });
        });
    await new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbFile, err => {
            if (err) console.error('Failed to open database: ' + err);
            resolve();
        });
    });
    if (!exists) {
        await new Promise((resolve, reject) => {
            console.log(
                'No database file found, writing a new one using the schema file: ' +
                    schemaFile +
                    ' and the database file: ' +
                    dbFile +
                    '!',
            );
            const schema = fs.readFileSync(schemaFile, 'utf8');
            db.serialize(() => {
                let resolvedCount = 0;
                let shouldResolveCount = schema.split(';').filter(x => x).length;
                for (const sql of schema.split(';')) {
                    if (sql)
                        db.run(sql, err => {
                            if (err)
                                console.error(
                                    'Failed to initialize database: ' + err + '\n SQL: ' + sql,
                                );
                            resolvedCount++;
                            if (resolvedCount === shouldResolveCount) resolve();
                        });
                }
            });
        });
    }
    return exists;
}

// ============================ ASYNC DATABASE FUNCTIONS ============================
/**
 * Gets the first result of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an object representing the first result of the sql query.
 */
function asyncGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) {
                console.log('sql error: ' + sql);
                reject(err);
            } else resolve(result);
        });
    });
}

/**
 * Gets all the results of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an array representing all the results of the sql query.
 */
function asyncAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, result) => {
            if (err) {
                console.log('sql error: ' + sql);
                reject(err);
            } else resolve(result);
        });
    });
}

/**
 * Runs a sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns Promise<void>
 */
function asyncRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, err => {
            if (err) {
                console.log('sql error: ' + sql);
                reject(err);
            } else resolve();
        });
    });
}

/**
 * Runs a sql query on the database and gets the id of the last inserted row.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT statement
 * @returns a Promise of the id of the last inserted row (if the sql query was an INSERT statement!).
 */
function asyncRunWithID(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.log('sql error: ' + sql);
                reject(err);
            } else resolve(this.lastID);
        });
    });
}

/**
 * Runs a sql query on the database and gets the number of rows changed.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT, UPDATE, or DELETE statement
 * @returns a Promise of the number of rows changed by the sql query.
 */
function asyncRunWithChanges(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.log('sql error: ' + sql);
                reject(err);
            } else resolve(this.changes);
        });
    });
}

// ============================ MODULE EXPORTS ============================
exports.reinitializeIfNotExists = reinitializeIfNotExists;
exports.asyncGet = asyncGet;
exports.asyncAll = asyncAll;
exports.asyncRun = asyncRun;
exports.asyncRunWithChanges = asyncRunWithChanges;
exports.asyncRunWithID = asyncRunWithID;
