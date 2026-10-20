const bcrypt = require('bcryptjs');
const db = require('./_db');
const { signToken, verifyToken, setCorsHeaders } = require('./_auth');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const action = (req.query.action || (req.body && req.body.action) || '').toLowerCase();

        // -------------------------------------------------------------
        // GET /api/auth?action=me (Validate session & get current pilot)
        // -------------------------------------------------------------
        if (req.method === 'GET' || action === 'me') {
            const decoded = verifyToken(req);
            if (!decoded) {
                return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
            }

            const user = await db.findUserById(decoded.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found.' });
            }

            const userScore = await db.getUserScore(user.id);
            return res.status(200).json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    bestScore: userScore ? userScore.score : 0,
                    characterId: userScore ? userScore.characterId : 'cube01',
                    rank: userScore ? userScore.rank : null,
                    isPostgres: db.isPostgresConnected()
                }
            });
        }

        // -------------------------------------------------------------
        // POST /api/auth (Login & Registration)
        // -------------------------------------------------------------
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const targetAction = (action || body.action || '').toLowerCase();
            const username = String(body.username || '').trim();
            const password = String(body.password || '');

            if (!targetAction || (targetAction !== 'login' && targetAction !== 'register')) {
                return res.status(400).json({ error: 'Invalid action. Must be "login" or "register".' });
            }

            // Validation
            if (!username || username.length < 3 || username.length > 20) {
                return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
            }

            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
            }

            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            }

            // Register logic
            if (targetAction === 'register') {
                const existing = await db.findUserByUsername(username);
                if (existing) {
                    return res.status(409).json({ error: 'Username already taken. Please choose another.' });
                }

                const passwordHash = await bcrypt.hash(password, 10);
                const newUser = await db.createUser(username, passwordHash);
                const token = signToken(newUser);

                return res.status(201).json({
                    success: true,
                    token,
                    user: {
                        id: newUser.id,
                        username: newUser.username,
                        bestScore: 0,
                        rank: null
                    }
                });
            }

            // Login logic
            if (targetAction === 'login') {
                const user = await db.findUserByUsername(username);
                if (!user) {
                    return res.status(401).json({ error: 'Invalid username or password.' });
                }

                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) {
                    return res.status(401).json({ error: 'Invalid username or password.' });
                }

                const userScore = await db.getUserScore(user.id);
                const token = signToken(user);

                return res.status(200).json({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        bestScore: userScore ? userScore.score : 0,
                        characterId: userScore ? userScore.characterId : 'cube01',
                        rank: userScore ? userScore.rank : null
                    }
                });
            }
        }

        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (err) {
        console.error('[API Auth Error]:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
};
