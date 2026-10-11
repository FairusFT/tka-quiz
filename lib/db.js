const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'tka.db');

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Auto-migrate: CREATE TABLE IF NOT EXISTS (runnable meski DB kosong)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    displayName TEXT,
    profilePicture TEXT,
    passwordHash TEXT,
    role TEXT,
    apiKey TEXT UNIQUE,
    createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT,
    date TEXT,
    subject TEXT,
    category TEXT,
    difficulty TEXT,
    timeLimit INTEGER,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    quizId TEXT,
    subject TEXT,
    category TEXT,
    subcategory TEXT,
    difficulty TEXT,
    question TEXT,
    options TEXT,
    correctAnswer TEXT,
    explanation TEXT,
    source TEXT,
    tags TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS quiz_questions (
    quizId TEXT,
    questionId TEXT,
    sortOrder INTEGER,
    PRIMARY KEY (quizId, questionId)
  );
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    userId INTEGER,
    quizId TEXT,
    score INTEGER,
    accuracy REAL,
    correct INTEGER,
    incorrect INTEGER,
    totalTime INTEGER,
    averageResponseTime REAL,
    completedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS answer_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attemptId TEXT,
    questionId TEXT,
    selectedAnswer TEXT,
    correctAnswer TEXT,
    isCorrect INTEGER,
    responseTime INTEGER
  );
`);

// Seed 1 user default: id 1, username fairus, displayName Fairus, role ADMIN
function seedDefaultUser() {
  try {
    const row = db.prepare('SELECT id FROM users WHERE id = 1').get();
    if (!row) {
      const now = new Date().toISOString();
      const passwordHash = bcrypt.hashSync('fairus123', 10);
      db.prepare(
        'INSERT INTO users (id, username, displayName, profilePicture, passwordHash, role, apiKey, createdAt) VALUES (1, ?, ?, ?, ?, ?, ?, ?)'
      ).run('fairus', 'Fairus', '', passwordHash, 'ADMIN', null, now);
    }
  } catch (e) {
    // username fairus mungkin sudah ada dengan id lain — pastikan ada
    try {
      const byName = db.prepare('SELECT id FROM users WHERE username = ?').get('fairus');
      if (!byName) {
        const now = new Date().toISOString();
        const passwordHash = bcrypt.hashSync('fairus123', 10);
        db.prepare(
          'INSERT INTO users (username, displayName, profilePicture, passwordHash, role, apiKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run('fairus', 'Fairus', '', passwordHash, 'ADMIN', null, now);
      }
    } catch (_) { /* DB kosong tetap runnable */ }
  }
}

seedDefaultUser();

module.exports = { db, dbPath };
