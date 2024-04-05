CREATE TABLE IF NOT EXISTS "Users" (
        "id"    TEXT PRIMARY KEY,
        "name"  TEXT NOT NULL,
        "customer_id"   TEXT,
        "email" TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS "Businesses" (
        "id"    INTEGER PRIMARY KEY,
        "name"  TEXT NOT NULL,
        "joincode"      TEXT NOT NULL UNIQUE,
        "subscriptionId"        TEXT NOT NULL UNIQUE,
        "requireJoin"     INTEGER DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS "Events" (
        "id"    INTEGER PRIMARY KEY,
        "business_id"   INTEGER NOT NULL,
        "name"  TEXT NOT NULL,
        "description"   TEXT NOT NULL,
        "starttimestamp"        TEXT NOT NULL,
        "endtimestamp"  TEXT NOT NULL,
        "repeat_id"     TEXT,
        "tag"   TEXT,
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id")
);
CREATE TABLE IF NOT EXISTS "Members" (
        "business_id"   INTEGER NOT NULL,
        "user_id"       TEXT NOT NULL,
        "role"  TEXT NOT NULL,
        "custom_data"     TEXT DEFAULT "{}" NOT NULL,
        PRIMARY KEY("business_id", "user_id") ON CONFLICT REPLACE,
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id"),
        FOREIGN KEY("user_id") REFERENCES "Users"("id")
);
CREATE TABLE IF NOT EXISTS "Records" (
        "event_id"      INTEGER NOT NULL,
        "business_id"   INTEGER NOT NULL,
        "user_id"       TEXT NOT NULL,
        "timestamp"     TEXT NOT NULL,
        "status"        TEXT NOT NULL,
        PRIMARY KEY("event_id", "user_id") ON CONFLICT REPLACE,
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id"),
        FOREIGN KEY("event_id") REFERENCES "Events"("id"),
        FOREIGN KEY("user_id") REFERENCES "Users"("id")
);
