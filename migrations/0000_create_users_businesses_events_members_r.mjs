// Automatically created by 'sqlite auto migrator (SAM)' on 2024-04-03T09:32:18.206Z

import { Database } from 'sqlite-auto-migrator';

// Pragmas can't be changed in transactions, so they are tracked separately.
// Note that most pragmas are not persisted in the database file and will have to be set on each new connection.
export const PRAGMAS = {"analysis_limit":0,"application_id":0,"auto_vacuum":0,"automatic_index":1,"timeout":1000,"cache_size":-2000,"cache_spill":483,"cell_size_check":0,"checkpoint_fullfsync":0,"seq":0,"name":"Records","compile_options":"ATOMIC_INTRINSICS=1","count_changes":0,"data_version":1,"file":"","defer_foreign_keys":0,"empty_result_callbacks":0,"encoding":"UTF-8","foreign_keys":0,"freelist_count":0,"full_column_names":0,"fullfsync":0,"builtin":1,"type":"table","enc":"utf8","narg":2,"flags":2099200,"hard_heap_limit":0,"ignore_check_constraints":0,"integrity_check":"ok","journal_mode":"delete","journal_size_limit":-1,"legacy_alter_table":0,"locking_mode":"normal","max_page_count":1073741823,"page_count":15,"page_size":4096,"query_only":0,"quick_check":"ok","read_uncommitted":0,"recursive_triggers":0,"reverse_unordered_selects":0,"schema_version":5,"secure_delete":0,"short_column_names":1,"soft_heap_limit":0,"synchronous":2,"schema":"main","ncol":5,"wr":0,"strict":0,"temp_store":0,"threads":0,"trusted_schema":1,"user_version":0,"wal_autocheckpoint":1000,"busy":0,"log":-1,"checkpointed":-1,"writable_schema":1};

/**
 * Runs the necessary SQL commands to migrate the database up to this version from the previous version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function up(db) {
    await db.run("CREATE TABLE users(id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,customer_id TEXT,email TEXT NOT NULL UNIQUE,PRIMARY KEY(id))");
    await db.run("CREATE TABLE businesses(id INTEGER NOT NULL UNIQUE,name TEXT NOT NULL,joincode TEXT NOT NULL UNIQUE,subscriptionId TEXT NOT NULL UNIQUE,requireJoin INTEGER DEFAULT 0 NOT NULL,PRIMARY KEY(id AUTOINCREMENT))");
    await db.run("CREATE TABLE events(business_id INTEGER NOT NULL,id INTEGER NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT NOT NULL,starttimestamp TEXT NOT NULL,endtimestamp TEXT NOT NULL,repeat_id TEXT,tag TEXT,PRIMARY KEY(id AUTOINCREMENT),FOREIGN KEY(business_id)REFERENCES Businesses(id))");
    await db.run("CREATE TABLE members(business_id INTEGER NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL,custom_data TEXT DEFAULT \"{}\" NOT NULL,PRIMARY KEY(business_id,user_id)ON CONFLICT REPLACE,FOREIGN KEY(business_id)REFERENCES Businesses(id),FOREIGN KEY(user_id)REFERENCES Events(id))");
    await db.run("CREATE TABLE records(event_id INTEGER NOT NULL,business_id INTEGER NOT NULL,user_id TEXT NOT NULL,timestamp TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(event_id,user_id)ON CONFLICT REPLACE,FOREIGN KEY(business_id)REFERENCES Businesses(id),FOREIGN KEY(event_id)REFERENCES Events(id),FOREIGN KEY(user_id)REFERENCES Users(id))");
}

/**
 * Runs the necessary SQL commands to migrate the database down to the previous version from this version.
 * Automatically runs in a transaction with deferred foreign keys.
 * @param {Database} db database instance to run SQL commands on
 */
export async function down(db) {
    await db.run("DROP TABLE \"users\"");
    await db.run("DROP TABLE \"businesses\"");
    await db.run("DROP TABLE \"events\"");
    await db.run("DROP TABLE \"members\"");
    await db.run("DROP TABLE \"records\"");
}