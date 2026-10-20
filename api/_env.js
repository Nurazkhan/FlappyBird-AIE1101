const fs = require('fs');
const path = require('path');

let envLoaded = false;

function loadEnv() {
    if (envLoaded) return;
    envLoaded = true;

    // First try dotenv if installed
    try {
        const dotenv = require('dotenv');
        dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
        dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    } catch (e) {}

    // Also manually parse .env.local and .env as a bulletproof fallback
    ['.env.local', '.env'].forEach(filename => {
        try {
            const filepath = path.resolve(process.cwd(), filename);
            if (fs.existsSync(filepath)) {
                const content = fs.readFileSync(filepath, 'utf8');
                const lines = content.split('\n');
                for (let line of lines) {
                    line = line.trim();
                    if (!line || line.startsWith('#')) continue;
                    const eqIdx = line.indexOf('=');
                    if (eqIdx > 0) {
                        const key = line.slice(0, eqIdx).trim();
                        let val = line.slice(eqIdx + 1).trim();
                        // Strip quotes if present
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.slice(1, -1);
                        }
                        if (!process.env[key]) {
                            process.env[key] = val;
                        }
                    }
                }
            }
        } catch (err) {}
    });
}

loadEnv();

module.exports = {
    loadEnv
};
