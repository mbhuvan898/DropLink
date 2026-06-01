import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), 'droplink.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS files (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            token         TEXT UNIQUE NOT NULL,
            owner_token   TEXT NOT NULL DEFAULT '',
            original_name TEXT NOT NULL,
            stored_name   TEXT NOT NULL,
            size          INTEGER NOT NULL,
            mimetype      TEXT,
            downloads     INTEGER DEFAULT 0,
            expires_in    TEXT DEFAULT '24h',
            expires_at    TEXT NOT NULL,
            created_at    TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS daily_usage (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ip          TEXT NOT NULL,
            date        TEXT NOT NULL,
            tokens_used INTEGER DEFAULT 0,
            UNIQUE(ip, date)
        );
    ''')
    for col, defn in [('owner_token', "TEXT NOT NULL DEFAULT ''"),
                      ('expires_in',  "TEXT DEFAULT '24h'")]:
        try:
            db.execute(f'ALTER TABLE files ADD COLUMN {col} {defn}')
        except Exception:
            pass
    db.commit()
    db.close()
