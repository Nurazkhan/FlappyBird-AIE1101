const db = require('./_db');
const { verifyToken, setCorsHeaders } = require('./_auth');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // -------------------------------------------------------------
        // GET /api/leaderboard (Fetch top global pilots & personal rank)
        // -------------------------------------------------------------
        if (req.method === 'GET') {
            const limit = req.query.limit || 50;
            const topList = await db.getLeaderboard(limit);

            let currentUserInfo = null;
            const decoded = verifyToken(req);
            if (decoded && decoded.userId) {
                const userScore = await db.getUserScore(decoded.userId);
                currentUserInfo = {
                    userId: decoded.userId,
                    username: decoded.username,
                    bestScore: userScore ? userScore.score : 0,
                    characterId: userScore ? userScore.characterId : 'cube01',
                    rank: userScore ? userScore.rank : null
                };
            }

            return res.status(200).json({
                success: true,
                leaderboard: topList,
                currentUser: currentUserInfo,
                isPostgres: db.isPostgresConnected()
            });
        }

        // -------------------------------------------------------------
        // POST /api/leaderboard (Submit high score for authenticated pilot)
        // -------------------------------------------------------------
        if (req.method === 'POST') {
            const decoded = verifyToken(req);
            if (!decoded || !decoded.userId) {
                return res.status(401).json({ error: 'Unauthorized. You must log in to submit a score.' });
            }

            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const score = parseInt(body.score, 10);
            const characterId = String(body.characterId || 'cube01').slice(0, 30);

            if (isNaN(score) || score < 0) {
                return res.status(400).json({ error: 'Invalid score value.' });
            }

            // High sanity limit check
            if (score > 100000) {
                return res.status(400).json({ error: 'Score exceeds maximum allowed threshold.' });
            }

            const result = await db.upsertScore(decoded.userId, score, characterId);

            return res.status(200).json({
                success: true,
                score: result.score,
                characterId: result.characterId,
                rank: result.rank,
                isNewBest: result.isNewBest
            });
        }

        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (err) {
        console.error('[API Leaderboard Error]:', err);
        return res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
};
