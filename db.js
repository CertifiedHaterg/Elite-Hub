const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('keys.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        used INTEGER DEFAULT 0,
        used_by TEXT,
        hwid TEXT,
        expiry TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = db;
