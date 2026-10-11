const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysPath = path.join(__dirname, '..', 'data', 'keys.json');

function loadOrCreateKeys() {
  try {
    if (fs.existsSync(keysPath)) {
      const raw = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
      if (raw && raw.USER && raw.AI && raw.ADMIN) return raw;
      if (Array.isArray(raw) && raw.length >= 3) {
        return { USER: String(raw[0]), AI: String(raw[1]), ADMIN: String(raw[2]) };
      }
    }
  } catch (_) { /* regenerate below */ }
  const gen = () => 'tka_' + crypto.randomBytes(24).toString('hex');
  const keys = { USER: gen(), AI: gen(), ADMIN: gen() };
  try {
    fs.mkdirSync(path.dirname(keysPath), { recursive: true });
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
  } catch (_) { /* read-only env, keep in memory */ }
  return keys;
}

const apiKeys = loadOrCreateKeys();

function getKeyRole(key) {
  if (!key) return null;
  if (key === apiKeys.ADMIN) return 'ADMIN';
  if (key === apiKeys.AI) return 'AI';
  if (key === apiKeys.USER) return 'USER';
  return null;
}

// Middleware: POST/PUT/DELETE wajib header x-api-key valid.
// GET terbuka (single-user lokal). AI key dilarang DELETE attempts/history.
function requireWrite(req, res, next) {
  const key = req.headers['x-api-key'];
  const role = getKeyRole(key);
  if (!role) return res.status(401).json({ error: 'Missing or invalid x-api-key' });
  if (role === 'AI' && req.method === 'DELETE') {
    const p = req.path || '';
    if (p.includes('attempt') || p.includes('histor')) {
      return res.status(403).json({ error: 'AI key cannot delete attempts/history' });
    }
  }
  req.apiKeyRole = role;
  next();
}

module.exports = { apiKeys, keysPath, getKeyRole, requireWrite };
