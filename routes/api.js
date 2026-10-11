const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../lib/db');
const { requireWrite } = require('../lib/auth');

const nid = (p) => p + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
const now = () => new Date().toISOString();
const parseOpts = (r) => {
  if (!r) return r;
  try { r.options = typeof r.options === 'string' ? JSON.parse(r.options) : r.options; } catch (_) { /* keep raw */ }
  return r;
};
const hideAnswer = (r) => {
  const { correctAnswer, explanation, ...rest } = r;
  return rest;
};

// ---------- health & meta ----------
router.get('/health', (req, res) => res.json({ ok: true, time: now() }));
router.get('/meta', (req, res) => {
  const subjects = ['Fisika', 'Bahasa Indonesia'];
  const difficulties = ['Mudah', 'Sedang', 'Sulit', 'TKA'];
  const fisika = ['Besaran dan satuan','Vektor','Kinematika','Dinamika','Hukum Newton','Usaha dan energi','Momentum dan impuls','Gerak melingkar','Fluida','Suhu dan kalor','Termodinamika','Getaran dan gelombang','Bunyi','Optik','Listrik statis','Listrik dinamis','Medan magnet','Induksi elektromagnetik','Arus bolak-balik','Fisika modern','Relativitas','Atom dan inti','Radioaktivitas'];
  const bindo = ['Pemahaman bacaan','Ide pokok','Informasi tersurat','Informasi tersirat','Inferensi','Makna kata','Makna kalimat','Hubungan antarparagraf','Struktur teks','Analisis argumen','Simpulan','Ejaan','Kata baku','Kalimat efektif','Tata bahasa','Diksi','Kohesi dan koherensi','Analisis teks','Evaluasi informasi','Interpretasi teks'];
  res.json({ subjects, difficulties, categories: { Fisika: fisika, 'Bahasa Indonesia': bindo } });
});

// ---------- quizzes ----------
router.get('/quizzes', (req, res) => {
  const { date, subject, difficulty } = req.query;
  let sql = 'SELECT * FROM quizzes WHERE 1=1';
  const p = [];
  if (date) { sql += ' AND date = ?'; p.push(date); }
  if (subject) { sql += ' AND subject = ?'; p.push(subject); }
  if (difficulty) { sql += ' AND difficulty = ?'; p.push(difficulty); }
  sql += ' ORDER BY date DESC, createdAt DESC';
  const rows = db.prepare(sql).all(...p);
  // sertakan jumlah soal
  const out = rows.map((q) => {
    const c = db.prepare('SELECT COUNT(*) c FROM quiz_questions WHERE quizId = ?').get(q.id);
    return { ...q, questionCount: c ? c.c : 0 };
  });
  res.json(out);
});

router.get('/quizzes/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Quiz not found' });
  const qs = db.prepare(
    `SELECT q.* FROM questions q JOIN quiz_questions qq ON qq.questionId = q.id WHERE qq.quizId = ? ORDER BY qq.sortOrder ASC`
  ).all(q.id).map(parseOpts).map(hideAnswer);
  res.json({ ...q, questionCount: qs.length, questions: qs });
});

router.post('/quizzes', requireWrite, (req, res) => {
  const b = req.body || {};
  const id = b.id || nid('QZ');
  const t = now();
  db.prepare(
    'INSERT INTO quizzes (id,title,date,subject,category,difficulty,timeLimit,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id, b.title || 'Untitled Quiz', b.date || t.slice(0, 10), b.subject || 'Mixed',
    b.category || '', b.difficulty || 'TKA', b.timeLimit || 30, t, t);
  if (Array.isArray(b.questionIds)) {
    const ins = db.prepare('INSERT OR REPLACE INTO quiz_questions (quizId,questionId,sortOrder) VALUES (?,?,?)');
    b.questionIds.forEach((qid, i) => { try { ins.run(id, qid, i); } catch (_) {} });
  }
  res.status(201).json(db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id));
});

router.put('/quizzes/:id', requireWrite, (req, res) => {
  const cur = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Quiz not found' });
  const b = req.body || {};
  db.prepare(
    'UPDATE quizzes SET title=?,date=?,subject=?,category=?,difficulty=?,timeLimit=?,updatedAt=? WHERE id=?'
  ).run(b.title ?? cur.title, b.date ?? cur.date, b.subject ?? cur.subject,
    b.category ?? cur.category, b.difficulty ?? cur.difficulty, b.timeLimit ?? cur.timeLimit, now(), cur.id);
  if (Array.isArray(b.questionIds)) {
    db.prepare('DELETE FROM quiz_questions WHERE quizId = ?').run(cur.id);
    const ins = db.prepare('INSERT OR REPLACE INTO quiz_questions (quizId,questionId,sortOrder) VALUES (?,?,?)');
    b.questionIds.forEach((qid, i) => { try { ins.run(cur.id, qid, i); } catch (_) {} });
  }
  res.json(db.prepare('SELECT * FROM quizzes WHERE id = ?').get(cur.id));
});

router.delete('/quizzes/:id', requireWrite, (req, res) => {
  db.prepare('DELETE FROM quiz_questions WHERE quizId = ?').run(req.params.id);
  const r = db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
  res.json({ deleted: r.changes });
});

// ---------- questions (bank) ----------
router.get('/questions', (req, res) => {
  const { subject, category, difficulty, q } = req.query;
  let sql = 'SELECT * FROM questions WHERE 1=1';
  const p = [];
  if (subject) { sql += ' AND subject = ?'; p.push(subject); }
  if (category) { sql += ' AND category = ?'; p.push(category); }
  if (difficulty) { sql += ' AND difficulty = ?'; p.push(difficulty); }
  if (q) { sql += ' AND (question LIKE ? OR category LIKE ? OR tags LIKE ?)'; p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY createdAt DESC LIMIT 500';
  res.json(db.prepare(sql).all(...p).map(parseOpts));
});

router.get('/questions/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Question not found' });
  // statistik soal: berapa kali dijawab, accuracy
  const st = db.prepare('SELECT COUNT(*) n, SUM(isCorrect) ok, AVG(responseTime) avgT FROM answer_attempts WHERE questionId = ?').get(r.id);
  res.json({ ...parseOpts(r), stats: { attempts: st.n || 0, accuracy: st.n ? Math.round((st.ok || 0) / st.n * 1000) / 10 : null, avgResponseTime: st.avgT ? Math.round(st.avgT * 10) / 10 : null } });
});

router.post('/questions', requireWrite, (req, res) => {
  const b = req.body || {};
  if (!b.question) return res.status(400).json({ error: 'question required' });
  const id = b.id || nid('Q');
  const t = now();
  db.prepare(
    'INSERT INTO questions (id,quizId,subject,category,subcategory,difficulty,question,options,correctAnswer,explanation,source,tags,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(id, b.quizId || null, b.subject || 'Fisika', b.category || '', b.subcategory || '',
    b.difficulty || 'Sedang', b.question, JSON.stringify(b.options || []),
    b.correctAnswer || '', b.explanation || '', b.source || '', b.tags || '', t, t);
  if (b.quizId) {
    const n = db.prepare('SELECT COUNT(*) c FROM quiz_questions WHERE quizId = ?').get(b.quizId);
    db.prepare('INSERT OR REPLACE INTO quiz_questions (quizId,questionId,sortOrder) VALUES (?,?,?)').run(b.quizId, id, b.sortOrder ?? (n ? n.c : 0));
  }
  res.status(201).json(parseOpts(db.prepare('SELECT * FROM questions WHERE id = ?').get(id)));
});

router.put('/questions/:id', requireWrite, (req, res) => {
  const cur = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Question not found' });
  const b = req.body || {};
  db.prepare(
    'UPDATE questions SET quizId=?,subject=?,category=?,subcategory=?,difficulty=?,question=?,options=?,correctAnswer=?,explanation=?,source=?,tags=?,updatedAt=? WHERE id=?'
  ).run(b.quizId ?? cur.quizId, b.subject ?? cur.subject, b.category ?? cur.category,
    b.subcategory ?? cur.subcategory, b.difficulty ?? cur.difficulty, b.question ?? cur.question,
    b.options !== undefined ? JSON.stringify(b.options) : cur.options,
    b.correctAnswer ?? cur.correctAnswer, b.explanation ?? cur.explanation,
    b.source ?? cur.source, b.tags ?? cur.tags, now(), cur.id);
  res.json(parseOpts(db.prepare('SELECT * FROM questions WHERE id = ?').get(cur.id)));
});

router.delete('/questions/:id', requireWrite, (req, res) => {
  db.prepare('DELETE FROM quiz_questions WHERE questionId = ?').run(req.params.id);
  const r = db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ deleted: r.changes });
});

// ---------- attempts ----------
router.post('/quiz-attempts', requireWrite, (req, res) => {
  const b = req.body || {};
  if (!b.quizId || !Array.isArray(b.answers) || !b.answers.length) {
    return res.status(400).json({ error: 'quizId and answers[] required' });
  }
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(b.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  let correct = 0;
  const rows = b.answers.map((a) => {
    const q = db.prepare('SELECT correctAnswer FROM questions WHERE id = ?').get(a.questionId);
    const ca = q ? q.correctAnswer : '';
    const ok = String(a.selectedAnswer || '').trim().toUpperCase() === String(ca || '').trim().toUpperCase() ? 1 : 0;
    if (ok) correct++;
    return { questionId: a.questionId, selectedAnswer: a.selectedAnswer || '', correctAnswer: ca || '', isCorrect: ok, responseTime: a.responseTime || 0 };
  });
  const total = rows.length;
  const incorrect = total - correct;
  const accuracy = total ? Math.round(correct / total * 1000) / 10 : 0;
  const score = Math.round(correct / total * 100);
  const totalTime = b.totalTime ?? rows.reduce((s, r) => s + (r.responseTime || 0), 0);
  const avg = total ? Math.round((totalTime / total) * 10) / 10 : 0;
  const id = nid('AT');
  db.prepare(
    'INSERT INTO quiz_attempts (id,userId,quizId,score,accuracy,correct,incorrect,totalTime,averageResponseTime,completedAt) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, b.userId || 1, b.quizId, score, accuracy, correct, incorrect, totalTime, avg, now());
  const ins = db.prepare('INSERT INTO answer_attempts (attemptId,questionId,selectedAnswer,correctAnswer,isCorrect,responseTime) VALUES (?,?,?,?,?,?)');
  rows.forEach((r) => ins.run(id, r.questionId, r.selectedAnswer, r.correctAnswer, r.isCorrect, r.responseTime));
  res.status(201).json({ id, quizId: b.quizId, score, accuracy, correct, incorrect, total, totalTime, averageResponseTime: avg });
});

router.get('/attempts/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Attempt not found' });
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(a.quizId);
  const ans = db.prepare('SELECT * FROM answer_attempts WHERE attemptId = ?').all(a.id).map((r) => {
    const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(r.questionId);
    return { ...r, question: q ? parseOpts(q) : null };
  });
  res.json({ ...a, quiz, answers: ans });
});

// ---------- history ----------
function historyQuery(req, res) {
  const { subject, difficulty, from, to } = req.query;
  let sql = 'SELECT qa.*, q.title quizTitle, q.subject quizSubject, q.difficulty quizDifficulty, q.date quizDate FROM quiz_attempts qa LEFT JOIN quizzes q ON q.id = qa.quizId WHERE 1=1';
  const p = [];
  if (subject) { sql += ' AND q.subject = ?'; p.push(subject); }
  if (difficulty) { sql += ' AND q.difficulty = ?'; p.push(difficulty); }
  if (from) { sql += ' AND qa.completedAt >= ?'; p.push(from); }
  if (to) { sql += ' AND qa.completedAt <= ?'; p.push(to); }
  sql += ' ORDER BY qa.completedAt DESC LIMIT 200';
  res.json(db.prepare(sql).all(...p));
}
router.get('/quiz-history', historyQuery);
router.get('/history', historyQuery);

// ---------- progress / statistics ----------
function streaks() {
  const rows = db.prepare('SELECT DISTINCT substr(completedAt,1,10) d FROM quiz_attempts ORDER BY d ASC').all().map((r) => r.d);
  if (!rows.length) return { currentStreak: 0, longestStreak: 0 };
  const set = new Set(rows);
  const day = (d, off) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + off); return t.toISOString().slice(0, 10); };
  const today = new Date().toISOString().slice(0, 10);
  let cur = 0;
  let anchor = set.has(today) ? today : day(today, -1);
  while (set.has(anchor)) { cur++; anchor = day(anchor, -1); }
  let longest = 1, run = 1;
  for (let i = 1; i < rows.length; i++) {
    if (day(rows[i - 1], 1) === rows[i]) { run++; longest = Math.max(longest, run); }
    else run = 1;
  }
  return { currentStreak: cur, longestStreak: longest };
}

function progressData() {
  const attempts = db.prepare('SELECT * FROM quiz_attempts ORDER BY completedAt ASC').all();
  const totalQuiz = attempts.length;
  const totalSoal = attempts.reduce((s, a) => s + (a.correct || 0) + (a.incorrect || 0), 0);
  const totalBenar = attempts.reduce((s, a) => s + (a.correct || 0), 0);
  const accuracy = totalSoal ? Math.round(totalBenar / totalSoal * 1000) / 10 : 0;
  const avgResponse = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.averageResponseTime || 0), 0) / attempts.length * 10) / 10 : 0;
  const bestScore = attempts.length ? Math.max(...attempts.map((a) => a.score || 0)) : 0;
  const { currentStreak, longestStreak } = streaks();
  const recent = db.prepare(
    'SELECT qa.*, q.title quizTitle, q.subject quizSubject FROM quiz_attempts qa LEFT JOIN quizzes q ON q.id = qa.quizId ORDER BY qa.completedAt DESC LIMIT 5'
  ).all();
  const byDate = attempts.map((a, i) => ({
    n: i + 1, date: (a.completedAt || '').slice(0, 10), accuracy: a.accuracy, score: a.score, avgTime: a.averageResponseTime,
  }));
  // bySubject: join answer_attempts -> questions.subject
  const subjRows = db.prepare(
    `SELECT q.subject s, COUNT(*) n, SUM(aa.isCorrect) ok FROM answer_attempts aa JOIN questions q ON q.id = aa.questionId GROUP BY q.subject`
  ).all();
  const bySubject = {};
  subjRows.forEach((r) => { bySubject[r.s || 'Unknown'] = { total: r.n, correct: r.ok || 0, accuracy: r.n ? Math.round((r.ok || 0) / r.n * 1000) / 10 : 0 }; });
  const topicRows = db.prepare(
    `SELECT q.subject s, q.category c, COUNT(*) n, SUM(aa.isCorrect) ok, AVG(aa.responseTime) avgT FROM answer_attempts aa JOIN questions q ON q.id = aa.questionId GROUP BY q.subject, q.category ORDER BY c ASC`
  ).all();
  const byTopic = topicRows.map((r) => ({
    subject: r.s, category: r.c, total: r.n, correct: r.ok || 0,
    accuracy: r.n ? Math.round((r.ok || 0) / r.n * 1000) / 10 : 0,
    avgTime: r.avgT ? Math.round(r.avgT * 10) / 10 : 0,
  }));
  const calRows = db.prepare('SELECT substr(completedAt,1,10) d, COUNT(*) c FROM quiz_attempts GROUP BY d').all();
  const calendar = {};
  calRows.forEach((r) => { calendar[r.d] = r.c; });
  return {
    totals: { totalQuiz, totalSoal, totalBenar, accuracy, avgResponse, bestScore, currentStreak, longestStreak },
    recent, byDate, bySubject, byTopic, calendar,
  };
}

router.get('/progress', (req, res) => {
  const d = progressData();
  if (!d.totals.totalQuiz) return res.json({ ...d, message: 'Data belum cukup. Kerjakan minimal 1 quiz untuk melihat progress.' });
  res.json(d);
});
router.get('/statistics', (req, res) => {
  const d = progressData();
  if (!d.totals.totalQuiz) return res.json({ ...d, message: 'Data belum cukup. Kerjakan minimal 1 quiz untuk melihat statistik.' });
  res.json(d);
});
router.get('/subject-progress', (req, res) => {
  const { bySubject } = progressData();
  if (!Object.keys(bySubject).length) return res.json({ data: [], message: 'Data belum cukup.' });
  res.json({ data: bySubject });
});
router.get('/topic-performance', (req, res) => {
  const { byTopic } = progressData();
  if (!byTopic.length) return res.json({ data: [], message: 'Data belum cukup.' });
  res.json({ data: byTopic });
});
router.get('/question-performance', (req, res) => {
  const rows = db.prepare(
    'SELECT questionId, COUNT(*) attempts, SUM(isCorrect) correct, AVG(responseTime) avgTime FROM answer_attempts GROUP BY questionId ORDER BY attempts DESC LIMIT 100'
  ).all().map((r) => ({ ...r, accuracy: r.attempts ? Math.round(r.correct / r.attempts * 1000) / 10 : 0 }));
  if (!rows.length) return res.json({ data: [], message: 'Data belum cukup.' });
  res.json({ data: rows });
});

// ---------- recommendations (rule-based, data nyata saja) ----------
router.get('/recommendations', (req, res) => {
  const { byTopic, byDate, totals } = progressData();
  if (!totals.totalQuiz) return res.json({ recommendations: [], message: 'Data belum cukup. Kerjakan minimal 1 quiz dulu.' });
  const recs = [];
  const weak = byTopic.filter((t) => t.total >= 3 && t.accuracy < 75).sort((a, b) => a.accuracy - b.accuracy);
  weak.slice(0, 3).forEach((t) => recs.push({
    type: 'weak-topic',
    text: `Accuracy kamu pada ${t.category} (${t.subject}) hanya ${t.accuracy}%. Coba latihan lebih banyak soal ${t.category}.`,
  }));
  const strong = [...byTopic].filter((t) => t.total >= 3).sort((a, b) => b.accuracy - a.accuracy)[0];
  if (strong) recs.push({ type: 'strength', text: `Materi terkuat kamu: ${strong.category} (${strong.accuracy}%). Pertahankan!` });
  if (byDate.length >= 2) {
    const last = byDate.slice(-5);
    const trend = last[last.length - 1].accuracy - last[0].accuracy;
    if (trend > 0) recs.push({ type: 'trend', text: `Performa kamu meningkat ${Math.round(trend * 10) / 10}% dalam ${last.length} quiz terakhir.` });
    else if (trend < 0) recs.push({ type: 'trend', text: `Accuracy menurun ${Math.abs(Math.round(trend * 10) / 10)}% dalam ${last.length} quiz terakhir. Fokus review pembahasan.` });
  }
  res.json({ recommendations: recs });
});

// ---------- AI generate quiz ----------
router.post('/ai/generate-quiz', requireWrite, (req, res) => {
  const b = req.body || {};
  const n = Math.min(Math.max(parseInt(b.numberOfQuestions) || 10, 1), 50);
  let sql = 'SELECT * FROM questions WHERE 1=1';
  const p = [];
  if (b.subject && b.subject !== 'Mixed') { sql += ' AND subject = ?'; p.push(b.subject); }
  if (b.category) { sql += ' AND category = ?'; p.push(b.category); }
  if (b.difficulty) { sql += ' AND difficulty = ?'; p.push(b.difficulty); }
  if (Array.isArray(b.topics) && b.topics.length) {
    sql += ` AND (${b.topics.map(() => 'category = ?').join(' OR ')})`;
    p.push(...b.topics);
  }
  const pool = db.prepare(sql).all(...p);
  if (pool.length < n) return res.status(400).json({ error: `Soal cocok hanya ${pool.length}, butuh ${n}. Tambah soal dulu atau longgarkan filter.` });
  // acak
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked = pool.slice(0, n);
  const id = b.id || nid('QZ');
  const t = now();
  const subject = b.subject || (b.topics ? 'Mixed' : (picked[0] ? picked[0].subject : 'Mixed'));
  db.prepare(
    'INSERT INTO quizzes (id,title,date,subject,category,difficulty,timeLimit,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id, b.title || `Daily Quiz ${t.slice(0, 10)}`, b.date || t.slice(0, 10), subject,
    (b.topics || []).join(', ') || b.category || '', b.difficulty || 'TKA', b.timeLimit || Math.ceil(n * 1.5), t, t);
  const ins = db.prepare('INSERT OR REPLACE INTO quiz_questions (quizId,questionId,sortOrder) VALUES (?,?,?)');
  picked.forEach((q, i) => ins.run(id, q.id, i));
  res.status(201).json({ ...db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id), questionCount: n, questionIds: picked.map((q) => q.id) });
});

module.exports = router;
