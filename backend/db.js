const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'zapi.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id                    TEXT PRIMARY KEY,
    owner_email           TEXT UNIQUE NOT NULL,
    password_hash         TEXT NOT NULL,
    name                  TEXT,
    website_url           TEXT,
    api_key               TEXT UNIQUE NOT NULL,
    plan                  TEXT    DEFAULT 'trial',
    trial_ends_at         INTEGER,
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    config                TEXT    DEFAULT '{}',
    created_at            INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id     TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    price       REAL,
    description TEXT,
    category    TEXT,
    url         TEXT,
    in_stock    INTEGER DEFAULT 1,
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id    TEXT    NOT NULL,
    question   TEXT    NOT NULL,
    answer     TEXT    NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT    PRIMARY KEY,
    shop_id    TEXT    NOT NULL,
    session_id TEXT    NOT NULL,
    status     TEXT    DEFAULT 'active',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    ai_score        REAL,
    tokens_used     INTEGER,
    created_at      INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_products_shop   ON products(shop_id);
  CREATE INDEX IF NOT EXISTS idx_faqs_shop       ON faqs(shop_id);
  CREATE INDEX IF NOT EXISTS idx_convs_shop      ON conversations(shop_id);
  CREATE INDEX IF NOT EXISTS idx_convs_session   ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_msgs_conv       ON messages(conversation_id);
`);

module.exports = db;
