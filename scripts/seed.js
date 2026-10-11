#!/usr/bin/env node
// Seed script untuk TKA Quiz: baca seed_fisika.json, seed_bindo.json, seed_quizzes.json
// Insert/update ke data/tka.db (tabel auto-migrate sudah di lib/db.js)

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'tka.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Auto-migrate tables (same schema as lib/db.js)
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

// Helper: idempotent upsert untuk questions
const upsertQuestion = db.prepare(`
  INSERT INTO questions (id, quizId, subject, category, subcategory, difficulty, question, options, correctAnswer, explanation, source, tags, createdAt, updatedAt)
  VALUES (@id, @quizId, @subject, @category, @subcategory, @difficulty, @question, @options, @correctAnswer, @explanation, @source, @tags, @createdAt, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    quizId = excluded.quizId,
    subject = excluded.subject,
    category = excluded.category,
    subcategory = excluded.subcategory,
    difficulty = excluded.difficulty,
    question = excluded.question,
    options = excluded.options,
    correctAnswer = excluded.correctAnswer,
    explanation = excluded.explanation,
    source = excluded.source,
    tags = excluded.tags,
    updatedAt = excluded.updatedAt
`);

// Helper: idempotent upsert untuk quizzes
const upsertQuiz = db.prepare(`
  INSERT INTO quizzes (id, title, date, subject, category, difficulty, timeLimit, createdAt, updatedAt)
  VALUES (@id, @title, @date, @subject, @category, @difficulty, @timeLimit, @createdAt, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    date = excluded.date,
    subject = excluded.subject,
    category = excluded.category,
    difficulty = excluded.difficulty,
    timeLimit = excluded.timeLimit,
    updatedAt = excluded.updatedAt
`);

// Helper: idempotent upsert untuk quiz_questions
const upsertQuizQuestion = db.prepare(`
  INSERT INTO quiz_questions (quizId, questionId, sortOrder)
  VALUES (@quizId, @questionId, @sortOrder)
  ON CONFLICT(quizId, questionId) DO UPDATE SET
    sortOrder = excluded.sortOrder
`);

// ---- Load seed data ----
const now = new Date().toISOString();

const fisika = JSON.parse(fs.readFileSync(path.join(dataDir, 'seed_fisika.json'), 'utf8'));
const bindo = JSON.parse(fs.readFileSync(path.join(dataDir, 'seed_bindo.json'), 'utf8'));
const quizzes = JSON.parse(fs.readFileSync(path.join(dataDir, 'seed_quizzes.json'), 'utf8'));

console.log(`📚 Loaded: Fisika ${fisika.length} soal, B.Indo ${bindo.length} soal, Quizzes ${quizzes.length}`);

// ---- Insert questions ----
let qCount = 0;
for (const q of [...fisika, ...bindo]) {
  upsertQuestion.run({
    id: q.id,
    quizId: null,
    subject: q.subject,
    category: q.category,
    subcategory: q.subcategory,
    difficulty: q.difficulty,
    question: q.question,
    options: JSON.stringify(q.options),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    source: q.source,
    tags: Array.isArray(q.tags) ? JSON.stringify(q.tags) : q.tags,
    createdAt: now,
    updatedAt: now
  });
  qCount++;
}
console.log(`✅ Questions inserted/updated: ${qCount}`);

// ---- Insert quizzes ----
let zCount = 0;
for (const z of quizzes) {
  upsertQuiz.run({
    id: z.id,
    title: z.title,
    date: z.date,
    subject: z.subject,
    category: z.category,
    difficulty: z.difficulty,
    timeLimit: z.timeLimit,
    createdAt: now,
    updatedAt: now
  });
  zCount++;
  
  // Link questions ke quiz via quiz_questions
  z.questionIds.forEach((qid, idx) => {
    upsertQuizQuestion.run({
      quizId: z.id,
      questionId: qid,
      sortOrder: idx
    });
  });
}
console.log(`✅ Quizzes inserted/updated: ${zCount}`);
console.log(`✅ Quiz-Question links created for all quizzes`);

// ---- Verify counts ----
const qTotal = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
const zTotal = db.prepare('SELECT COUNT(*) as c FROM quizzes').get().c;
const qqTotal = db.prepare('SELECT COUNT(*) as c FROM quiz_questions').get().c;
const uTotal = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

console.log(`\n📊 Database summary:`);
console.log(`   Users: ${uTotal}`);
console.log(`   Questions: ${qTotal}`);
console.log(`   Quizzes: ${zTotal}`);
console.log(`   Quiz-Questions: ${qqTotal}`);

// Per subject breakdown
const subj = db.prepare('SELECT subject, COUNT(*) as c FROM questions GROUP BY subject').all();
for (const s of subj) {
  console.log(`   ${s.subject}: ${s.c} soal`);
}

console.log(`\n🎉 Seed complete. Run: node server.js untuk start server.`);