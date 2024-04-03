'use strict';

const fs = require('fs');

// ============================ INIT SQLite DATABASE ============================
/** @type { import('sqlite-auto-migrator').Database } */
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
    const { Migrator, Database } = await import('sqlite-auto-migrator');

    const exists = dbFile !== ':memory:' && fs.existsSync(dbFile);
    if (exists) console.log('Database file found: ' + dbFile);
    else console.log('Database file not found (creating a new one): ' + dbFile);

    if (db) await db.close();
    db = await Database.connect(dbFile);

    if (dbFile === ':memory:' || dbFile === '') {
        const schema = fs.readFileSync(schemaFile, 'utf8');
        await db.exec(schema);
    } else {
        const migrator = new Migrator({
            dbPath: dbFile,
            schemaPath: schemaFile,
        });
        await migrator.make();
        await migrator.migrate();
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
async function asyncGet(sql, params = []) {
    return await db.get(sql, params);
}

/**
 * Gets all the results of the sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns a Promise of an array representing all the results of the sql query.
 */
async function asyncAll(sql, params = []) {
    return await db.all(sql, params);
}

/**
 * Runs a sql query on the database.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @returns Promise<void>
 */
async function asyncRun(sql, params = []) {
    await db.run(sql, params);
}

/**
 * Runs a sql query on the database and gets the id of the last inserted row.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT statement
 * @returns a Promise of the id of the last inserted row (if the sql query was an INSERT statement!).
 */
async function asyncRunWithID(sql, params = []) {
    const { lastID } = await db.run(sql, params);
    return lastID;
}

/**
 * Runs a sql query on the database and gets the number of rows changed.
 * @param {string} sql the query to perform
 * @param {any[]} params optional list of sql parameters
 * @requires sql should be an INSERT, UPDATE, or DELETE statement
 * @returns a Promise of the number of rows changed by the sql query.
 */
async function asyncRunWithChanges(sql, params = []) {
    const { changes } = await db.run(sql, params);
    return changes;
}

// ============================ MODULE EXPORTS ============================
exports.reinitializeIfNotExists = reinitializeIfNotExists;
exports.asyncGet = asyncGet;
exports.asyncAll = asyncAll;
exports.asyncRun = asyncRun;
exports.asyncRunWithChanges = asyncRunWithChanges;
exports.asyncRunWithID = asyncRunWithID;
