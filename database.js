// database.js
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { DB_FILE } = require('./config');

let db;

async function initDb() {
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS memecoins (
            ca_address TEXT PRIMARY KEY,
            symbol TEXT,
            name TEXT,
            genesis_mention_by TEXT,
            first_seen TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memecoin_ca TEXT,
            channel_id INTEGER,
            channel_name TEXT,
            mention_time TIMESTAMP,
            FOREIGN KEY (memecoin_ca) REFERENCES memecoins (ca_address) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_memecoin_ca ON mentions (memecoin_ca);
    `);
    console.log("Base de datos SQLite inicializada correctamente.");
    return db;
}

async function addMemecoinToDb(ca, symbol, name) {
    const now = new Date().toISOString();
    return db.run(
        "INSERT OR IGNORE INTO memecoins (ca_address, symbol, name, first_seen) VALUES (?, ?, ?, ?)",
        [ca, symbol, name, now]
    );
}

async function addMentionToDb(ca, channelId, channelName) {
    const now = new Date().toISOString();
    return db.run(
        "INSERT INTO mentions (memecoin_ca, channel_id, channel_name, mention_time) VALUES (?, ?, ?, ?)",
        [ca, channelId, channelName, now]
    );
}

async function getMemecoinFromDb(ca) {
    return db.get("SELECT * FROM memecoins WHERE ca_address = ?", ca);
}

async function getMentionsFromDb(ca) {
    return db.all("SELECT * FROM mentions WHERE memecoin_ca = ?", ca);
}

async function updateGenesisMentionInDb(ca, userName) {
    return db.run("UPDATE memecoins SET genesis_mention_by = ? WHERE ca_address = ?", [userName, ca]);
}

async function getAllMemecoinCas() {
    return db.all("SELECT ca_address, symbol, name FROM memecoins");
}

async function deleteMemecoinFromDb(ca) {
    const result = await db.run("DELETE FROM memecoins WHERE ca_address = ?", ca);
    return result.changes > 0;
}

module.exports = {
    initDb,
    addMemecoinToDb,
    addMentionToDb,
    getMemecoinFromDb,
    getMentionsFromDb,
    updateGenesisMentionInDb,
    getAllMemecoinCas,
    deleteMemecoinFromDb,
};
