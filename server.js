const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3000;

// ---- Data dir ----
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ---- Init DB (auto-migrate on import) ----
require('./lib/db');
const { apiKeys } = require('./lib/auth');

// ---- Middleware ----
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ---- API routes ----
app.use('/api', require('./routes/api'));

// ---- Healthz ----
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ---- Start ----
app.listen(port, '0.0.0.0', () => {
  console.log(`TKA Quiz running at http://0.0.0.0:${port}`);
  console.log(`Health: http://0.0.0.0:${port}/healthz`);
  const mask = (k) => (k ? k.substring(0, 8) + '...' + k.substring(k.length - 4) : '-');
  console.log(`API Keys: USER=${mask(apiKeys.USER)} AI=${mask(apiKeys.AI)} ADMIN=${mask(apiKeys.ADMIN)}`);
  console.log('(full keys in data/keys.json)');
});

module.exports = app;
