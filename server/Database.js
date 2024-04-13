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
async function reinitializeIfNotExists(dbFile = ':memory:', schemaFile = './server/schema.sql') {
    const { Migrator, Database } = await import('sqlite-auto-migrator');

    const exists = dbFile !== ':memory:' && fs.existsSync(dbFile);
    if (exists) console.log('Database file found: ' + dbFile);
    else console.log('Database file not found (creating a new one): ' + dbFile);

    if (db) await db.close();
    db = await Database.connect(dbFile);
    await db.run('PRAGMA foreign_keys = ON;');

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

// ============================ MODULE EXPORTS ============================
exports.reinitializeIfNotExists = reinitializeIfNotExists;
exports.db = () => db;
