require('./_env');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'flappy_pixel_secret_key_development_2026';

function signToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function verifyToken(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return null;
    }

    try {
        const decoded = jwt.verify(parts[1], JWT_SECRET);
        return decoded;
    } catch (err) {
        return null;
    }
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = {
    signToken,
    verifyToken,
    setCorsHeaders
};
