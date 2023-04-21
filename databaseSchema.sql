CREATE TABLE IF NOT EXISTS "Users" (
        "id"    TEXT NOT NULL UNIQUE,
        "name"  TEXT NOT NULL,
        "customer_id"   TEXT,
        PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "Businesses" (
        "id"    INTEGER NOT NULL UNIQUE,
        "name"  TEXT NOT NULL,
        "joincode"      TEXT NOT NULL UNIQUE,
        "subscriptionId"        TEXT NOT NULL UNIQUE,
        PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "Events" (
        "business_id"   INTEGER NOT NULL,
        "id"    INTEGER NOT NULL UNIQUE,
        "name"  TEXT NOT NULL,
        "description"   TEXT NOT NULL,
        "starttimestamp"        TEXT NOT NULL,
        "endtimestamp"  TEXT NOT NULL,
        "repeat_id"     TEXT,
        PRIMARY KEY("id" AUTOINCREMENT),
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id")
);
CREATE TABLE IF NOT EXISTS "Members" (
        "business_id"   INTEGER NOT NULL,
        "user_id"       TEXT NOT NULL,
        "role"  TEXT NOT NULL,
        UNIQUE("business_id", "user_id") ON CONFLICT REPLACE,
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id"),
        FOREIGN KEY("user_id") REFERENCES "Events"("id")
);
CREATE TABLE IF NOT EXISTS "Records" (
        "event_id"      INTEGER NOT NULL,
        "business_id"   INTEGER NOT NULL,
        "user_id"       TEXT NOT NULL,
        "timestamp"     TEXT NOT NULL,
        "status"        TEXT NOT NULL,
        FOREIGN KEY("business_id") REFERENCES "Businesses"("id"),
        FOREIGN KEY("event_id") REFERENCES "Events"("id"),
        FOREIGN KEY("user_id") REFERENCES "Users"("id")
);