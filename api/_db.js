require('./_env');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_PRISMA_URL;

let pool = null;
let isInitialized = false;

if (connectionString) {
    try {
        pool = new Pool({
            connectionString,
            ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
        console.log('[DB] PostgreSQL pool configured with', connectionString.split('@')[1] || 'remote host');
    } catch (err) {
        console.warn('[DB] Failed to initialize Postgres pool, falling back to local store:', err.message);
        pool = null;
    }
}

async function ensurePostgresTables() {
    if (!pool || isInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                score INTEGER NOT NULL,
                character_id VARCHAR(50) NOT NULL DEFAULT 'cube01',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_user_best UNIQUE (user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON scores(score DESC);
        `);
        isInitialized = true;
        console.log('[DB] PostgreSQL tables verified and ready.');
    } catch (err) {
        console.error('[DB] Error initializing PostgreSQL tables:', err.message);
    }
}

// -------------------------------------------------------------
// LOCAL DEV FALLBACK STORE (Active if POSTGRES_URL is not set)
// -------------------------------------------------------------
const localStorePath = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), '.dev_db.json');

function readLocalStore() {
    try {
        if (fs.existsSync(localStorePath)) {
            const data = fs.readFileSync(localStorePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {}
    return { users: [], scores: [] };
}

function writeLocalStore(data) {
    try {
        fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[DB] Could not write local store:', e.message);
    }
}

// -------------------------------------------------------------
// UNIFIED DATABASE INTERFACE
// -------------------------------------------------------------
async function findUserByUsername(username) {
    const cleanUsername = String(username).trim();
    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(
            'SELECT id, username, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [cleanUsername]
        );
        return res.rows[0] || null;
    }

    const store = readLocalStore();
    return store.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase()) || null;
}

async function findUserById(id) {
    const userId = parseInt(id, 10);
    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(
            'SELECT id, username, created_at FROM users WHERE id = $1 LIMIT 1',
            [userId]
        );
        return res.rows[0] || null;
    }

    const store = readLocalStore();
    const user = store.users.find(u => u.id === userId);
    if (!user) return null;
    return { id: user.id, username: user.username, created_at: user.created_at };
}

async function createUser(username, passwordHash) {
    const cleanUsername = String(username).trim();
    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
            [cleanUsername, passwordHash]
        );
        return res.rows[0];
    }

    const store = readLocalStore();
    const newId = store.users.length > 0 ? Math.max(...store.users.map(u => u.id)) + 1 : 1;
    const newUser = {
        id: newId,
        username: cleanUsername,
        password_hash: passwordHash,
        created_at: new Date().toISOString()
    };
    store.users.push(newUser);
    writeLocalStore(store);
    return { id: newUser.id, username: newUser.username, created_at: newUser.created_at };
}

async function getLeaderboard(limit = 50) {
    const maxRows = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(`
            SELECT 
                u.username,
                s.score,
                s.character_id,
                s.created_at
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.score DESC, s.created_at ASC
            LIMIT $1
        `, [maxRows]);

        return res.rows.map((row, idx) => ({
            rank: idx + 1,
            username: row.username,
            score: row.score,
            characterId: row.character_id,
            createdAt: row.created_at
        }));
    }

    const store = readLocalStore();
    // Sort scores descending
    const sorted = [...store.scores].sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
    const slice = sorted.slice(0, maxRows);

    return slice.map((entry, idx) => {
        const user = store.users.find(u => u.id === entry.user_id);
        return {
            rank: idx + 1,
            username: user ? user.username : 'UNKNOWN PILOT',
            score: entry.score,
            characterId: entry.character_id,
            createdAt: entry.created_at
        };
    });
}

async function getUserScore(userId) {
    const uid = parseInt(userId, 10);
    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(`
            SELECT 
                s.score,
                s.character_id,
                s.created_at,
                (SELECT COUNT(*) + 1 FROM scores WHERE score > s.score) AS rank
            FROM scores s
            WHERE s.user_id = $1
        `, [uid]);

        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            score: row.score,
            characterId: row.character_id,
            rank: parseInt(row.rank, 10) || 1,
            createdAt: row.created_at
        };
    }

    const store = readLocalStore();
    const sorted = [...store.scores].sort((a, b) => b.score - a.score);
    const index = sorted.findIndex(s => s.user_id === uid);
    if (index === -1) return null;

    const entry = sorted[index];
    return {
        score: entry.score,
        characterId: entry.character_id,
        rank: index + 1,
        createdAt: entry.created_at
    };
}

async function upsertScore(userId, score, characterId = 'cube01') {
    const uid = parseInt(userId, 10);
    const validScore = Math.max(0, parseInt(score, 10) || 0);
    const validChar = String(characterId || 'cube01').slice(0, 30);

    if (pool) {
        await ensurePostgresTables();
        const res = await pool.query(`
            INSERT INTO scores (user_id, score, character_id, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                character_id = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.character_id ELSE scores.character_id END,
                created_at = CASE WHEN EXCLUDED.score > scores.score THEN NOW() ELSE scores.created_at END,
                score = GREATEST(scores.score, EXCLUDED.score)
            RETURNING score, character_id, created_at;
        `, [uid, validScore, validChar]);

        const updatedRow = res.rows[0];
        const rankRes = await pool.query('SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > $1', [updatedRow.score]);
        const rank = parseInt(rankRes.rows[0].rank, 10) || 1;

        return {
            score: updatedRow.score,
            characterId: updatedRow.character_id,
            rank,
            isNewBest: updatedRow.score === validScore
        };
    }

    const store = readLocalStore();
    let entry = store.scores.find(s => s.user_id === uid);
    let isNewBest = false;

    if (!entry) {
        entry = {
            id: store.scores.length + 1,
            user_id: uid,
            score: validScore,
            character_id: validChar,
            created_at: new Date().toISOString()
        };
        store.scores.push(entry);
        isNewBest = true;
    } else {
        if (validScore > entry.score) {
            entry.score = validScore;
            entry.character_id = validChar;
            entry.created_at = new Date().toISOString();
            isNewBest = true;
        }
    }
    writeLocalStore(store);

    const sorted = [...store.scores].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(s => s.user_id === uid) + 1;

    return {
        score: entry.score,
        characterId: entry.character_id,
        rank,
        isNewBest
    };
}

module.exports = {
    findUserByUsername,
    findUserById,
    createUser,
    getLeaderboard,
    getUserScore,
    upsertScore,
    isPostgresConnected: () => pool !== null
};
