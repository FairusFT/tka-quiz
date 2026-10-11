/* TKA Daily Quiz SPA — vanilla JS, no build, no CDN. */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var API = '/api';

  /* ---------- helpers ---------- */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m === 0) return s + 'd';
    return m + 'm ' + (s < 10 ? '0' : '') + s + 'd';
  }
  function fmtAvg(sec) {
    sec = Math.round(sec || 0);
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m === 0) return s + 'd/question';
    return m + 'm ' + (s < 10 ? '0' : '') + s + 'd/question';
  }
  function fmtSpeed(sec) {
    var v = (sec || 0) / 60;
    return (Math.round(v * 100) / 100) + ' menit/soal';
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function getKey() {
    var k = sessionStorage.getItem('tka_key') || '';
    if (k) return k;
    k = prompt('Masukkan API key (USER/AI/ADMIN) untuk aksi tulis.\nLihat data/keys.json di server.');
    if (k) sessionStorage.setItem('tka_key', k.trim());
    return (k || '').trim();
  }
  function apiGet(url) {
    return fetch(API + url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function apiWrite(method, url, body) {
    var key = getKey();
    if (!key) return Promise.reject(new Error('API key dibutuhkan.'));
    return fetch(API + url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem('tka_key');
        throw new Error('API key ditolak (' + r.status + '). Coba lagi.');
      }
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    });
  }
  function loading(msg) { app.innerHTML = '<div class="loading">' + esc(msg || 'Memuat…') + '</div>'; }
  function errBox(msg) { return '<div class="err">' + esc(msg) + '</div>'; }
  function letter(i) { return String.fromCharCode(65 + i); }
  function optText(opt) {
    // opsi disimpan "A. teks" — tampilkan apa adanya
    return opt;
  }
  function optLetter(opt, i) {
    var m = String(opt || '').match(/^([A-E])[\.\)]\s*/);
    return m ? m[1] : letter(i);
  }

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById('themeToggle');
  function applyTheme() {
    var t = localStorage.getItem('tka_theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  themeBtn.addEventListener('click', function () {
    var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tka_theme', t);
    applyTheme();
  });
  applyTheme();

  /* ---------- nav active ---------- */
  function setNav(route) {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === route);
    });
  }

  /* ---------- streak badge ---------- */
  apiGet('/progress').then(function (p) {
    if (p && p.totals && p.totals.currentStreak > 0) {
      var b = document.getElementById('streakBadge');
      if (b) { b.hidden = false; b.textContent = '🔥 ' + p.totals.currentStreak; }
    }
  }).catch(function () {});

  /* ================= DASHBOARD ================= */
  function vDashboard() {
    setNav('dashboard');
    loading('Memuat dashboard…');
    Promise.all([
      apiGet('/quizzes?date=' + todayStr()).catch(function () { return []; }),
      apiGet('/progress').catch(function () { return null; }),
    ]).then(function (res) {
      var today = res[0] || [], prog = res[1] || {};
      var t = (prog.totals) || {};
      var h = '';
      h += '<div class="page-head"><h1>Dashboard</h1><p>Persiapan TKA — Fisika & Bahasa Indonesia</p></div>';

      // Today's Quiz
      h += '<div class="card"><h2>Today\'s Quiz</h2>';
      if (!today.length) {
        h += '<div class="empty">Today\'s quiz belum tersedia.</div>';
      } else {
        h += '<p style="font-weight:700;color:var(--green)">Today\'s Quiz is ready!</p>';
        today.forEach(function (q) {
          var icon = q.subject === 'Fisika' ? '📚' : (q.subject === 'Bahasa Indonesia' ? '📖' : '📚📖');
          h += '<div class="list-item"><h3>' + icon + ' ' + esc(q.title) + '</h3>'
            + '<div class="small muted">' + esc(q.subject) + ' • ' + (q.questionCount || '?') + ' Soal'
            + ' • Difficulty: ' + esc(q.difficulty || '-') + ' • Estimasi: ' + esc(q.timeLimit || 30) + ' menit</div>'
            + '<div style="margin-top:8px"><a class="btn primary" href="#/take/' + esc(q.id) + '">MULAI QUIZ</a></div></div>';
        });
      }
      h += '</div>';

      // pilihan cepat
      h += '<div class="card"><h2>Mulai Latihan</h2><div class="row">'
        + '<a class="btn" href="#/quiz?subject=Fisika">Fisika</a>'
        + '<a class="btn" href="#/quiz?subject=Bahasa Indonesia">Bahasa Indonesia</a>'
        + '<a class="btn" href="#/quiz?subject=Mixed">Mixed Quiz</a></div></div>';

      // statistik
      h += '<div class="card"><h2>Statistik</h2><div class="stats-grid">'
        + stat(t.totalQuiz || 0, 'Total quiz')
        + stat(t.totalSoal || 0, 'Total soal')
        + stat(t.totalBenar || 0, 'Total benar')
        + stat((t.accuracy || 0) + '%', 'Accuracy rata-rata')
        + stat(fmtDur(t.avgResponse || 0), 'Avg response')
        + stat('🔥 ' + (t.currentStreak || 0), 'Current streak')
        + stat('🏆 ' + (t.longestStreak || 0), 'Longest streak')
        + stat(t.bestScore || 0, 'Best score')
        + '</div></div>';

      // recent
      var recent = prog.recent || [];
      h += '<div class="card"><h2>Recent Quiz</h2>';
      if (!recent.length) h += '<div class="empty">Belum ada quiz dikerjakan.</div>';
      else recent.slice(0, 5).forEach(function (a) {
        h += '<div class="list-item"><h3>' + esc(a.quizTitle || a.quizId) + '</h3>'
          + '<div class="small muted">' + esc(a.completedAt ? a.completedAt.slice(0, 10) : '') + ' • Score ' + a.score + ' • ' + a.accuracy + '%</div>'
          + '<div style="margin-top:6px"><a class="btn ghost" href="#/result/' + esc(a.id) + '">Lihat hasil</a></div></div>';
      });
      h += '</div>';
      app.innerHTML = h;
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat dashboard: ' + e.message); });
  }
  function stat(v, l) { return '<div class="stat"><div class="v">' + esc(v) + '</div><div class="l">' + esc(l) + '</div></div>'; }

  /* ================= QUIZ LIST ================= */
  function vQuizList(query) {
    setNav('quiz');
    var subj = (query.subject) || '';
    loading('Memuat daftar quiz…');
    apiGet('/quizzes' + (subj ? '?subject=' + encodeURIComponent(subj) : '')).then(function (list) {
      var h = '<div class="page-head"><h1>Daily Quiz</h1><p>Pilih quiz untuk dikerjakan</p></div>';
      h += '<div class="card"><div class="toolbar">'
        + '<select id="fSubj"><option value="">Semua mapel</option>'
        + ['Fisika', 'Bahasa Indonesia', 'Mixed'].map(function (s) { return '<option ' + (subj === s ? 'selected' : '') + ' value="' + s + '">' + s + '</option>'; }).join('')
        + '</select><select id="fDiff"><option value="">Semua difficulty</option>'
        + ['Mudah', 'Sedang', 'Sulit', 'TKA'].map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('')
        + '</select><input id="fDate" type="date" value="' + todayStr() + '" /></div>'
        + '<div id="qlist"></div></div>';
      app.innerHTML = h;
      var fs = document.getElementById('fSubj'), fd = document.getElementById('fDiff'), fdt = document.getElementById('fDate');
      function render(list2) {
        var el = document.getElementById('qlist');
        if (!list2.length) { el.innerHTML = '<div class="empty">Tidak ada quiz untuk filter ini.</div>'; return; }
        el.innerHTML = list2.map(function (q) {
          return '<div class="list-item"><h3>' + esc(q.title) + '</h3>'
            + '<div class="small muted">' + esc(q.date) + ' • ' + esc(q.subject) + ' • ' + (q.questionCount || 0) + ' soal • ' + esc(q.difficulty) + ' • ' + esc(q.timeLimit) + ' mnt</div>'
            + '<div style="margin-top:8px"><a class="btn primary" href="#/take/' + esc(q.id) + '">MULAI QUIZ</a></div></div>';
        }).join('');
      }
      function refetch() {
        var url = '/quizzes?';
        if (fs.value) url += 'subject=' + encodeURIComponent(fs.value) + '&';
        if (fd.value) url += 'difficulty=' + encodeURIComponent(fd.value) + '&';
        if (fdt.value) url += 'date=' + encodeURIComponent(fdt.value);
        apiGet(url).then(render).catch(function (e) { document.getElementById('qlist').innerHTML = errBox(e.message); });
      }
      fs.onchange = refetch; fd.onchange = refetch; fdt.onchange = refetch;
      // initial: kalau filter tanggal = hari ini dan ada query subject, tampilkan semua tanggal itu
      if (subj && !location.hash.includes('date')) { fdt.value = ''; refetch(); }
      else render(list);
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat quiz: ' + e.message); });
  }

  /* ================= QUIZ RUNNER ================= */
  var runner = null;
  function vTake(quizId) {
    setNav('quiz');
    loading('Memuat soal… (jawaban disembunyikan server)');
    apiGet('/quizzes/' + encodeURIComponent(quizId)).then(function (quiz) {
      var qs = quiz.questions || [];
      if (!qs.length) { app.innerHTML = errBox('Quiz ini belum punya soal.'); return; }
      var limit = (quiz.timeLimit || 30) * 60;
      runner = {
        quiz: quiz, qs: qs, idx: 0,
        answers: {}, flags: {}, times: {}, startQ: Date.now(), startAll: Date.now(),
        timerId: null, remain: limit,
      };
      qs.forEach(function (q) { runner.times[q.id] = 0; });
      renderQ();
      runner.timerId = setInterval(function () {
        if (!runner) return;
        runner.remain--;
        var t = document.getElementById('timerVal');
        if (t) {
          t.textContent = fmtDur(runner.remain);
          if (runner.remain < 300) t.parentElement.classList.add('danger');
        }
        if (runner.remain <= 0) { submitQuiz(true); }
      }, 1000);
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat quiz: ' + e.message); });
  }
  function stampTime() {
    if (!runner) return;
    var q = runner.qs[runner.idx];
    runner.times[q.id] = (runner.times[q.id] || 0) + Math.round((Date.now() - runner.startQ) / 1000);
    runner.startQ = Date.now();
  }
  function renderQ() {
    var r = runner, q = r.qs[r.idx], i = r.idx, n = r.qs.length;
    var h = '<div class="timer"><span>⏱ <span id="timerVal">' + fmtDur(r.remain) + '</span></span>'
      + '<span class="q-progress"><b>' + (i + 1) + '</b>/' + n + '</span></div>';
    h += '<div class="card">';
    h += '<button class="btn ghost flag-btn" id="flagBtn">' + (r.flags[q.id] ? '⭐ Ditandai' : '☆ Tandai') + '</button>';
    h += '<div class="small muted">' + esc(q.subject) + ' • ' + esc(q.category) + ' • ' + esc(q.difficulty) + '</div>';
    h += '<h2 style="margin-top:6px">Soal ' + (i + 1) + '</h2>';
    h += '<div>' + q.question + '</div>';
    var opts = q.options || [];
    h += '<div style="margin-top:10px">';
    opts.forEach(function (op, oi) {
      var picked = r.answers[q.id] === optLetter(op, oi);
      h += '<button class="opt' + (picked ? ' picked' : '') + '" data-oi="' + oi + '">' + esc(optText(op)) + '</button>';
    });
    h += '</div>';
    h += '<div class="qnav"><button class="btn" id="prevBtn" ' + (i === 0 ? 'disabled' : '') + '>← Sebelumnya</button>'
      + '<button class="btn" id="nextBtn" ' + (i === n - 1 ? 'disabled' : '') + '>Berikutnya →</button></div>';
    h += '<div style="margin-top:10px"><button class="btn ghost block" id="palBtn">Lihat soal belum dijawab</button></div>';
    h += '<div id="palette" class="palette" hidden>' + r.qs.map(function (qq, qi) {
      var cls = '';
      if (r.answers[qq.id]) cls += 'done ';
      if (r.flags[qq.id]) cls += 'flagged ';
      if (qi === i) cls += 'current';
      return '<button data-qi="' + qi + '" class="' + cls + '">' + (qi + 1) + '</button>';
    }).join('') + '</div>';
    h += '<div style="margin-top:12px"><button class="btn primary block" id="submitBtn">Kumpulkan Quiz</button></div>';
    h += '</div>';
    app.innerHTML = h;
    app.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var oi = parseInt(b.getAttribute('data-oi'), 10);
        var op = (r.qs[r.idx].options || [])[oi];
        r.answers[r.qs[r.idx].id] = optLetter(op, oi);
        renderQ();
      });
    });
    document.getElementById('prevBtn').addEventListener('click', function () { if (r.idx > 0) { stampTime(); r.idx--; renderQ(); } });
    document.getElementById('nextBtn').addEventListener('click', function () { if (r.idx < n - 1) { stampTime(); r.idx++; renderQ(); } });
    document.getElementById('flagBtn').addEventListener('click', function () {
      var id = r.qs[r.idx].id;
      if (r.flags[id]) delete r.flags[id]; else r.flags[id] = true;
      renderQ();
    });
    document.getElementById('palBtn').addEventListener('click', function () {
      var p = document.getElementById('palette');
      p.hidden = !p.hidden;
    });
    app.querySelectorAll('#palette button').forEach(function (b) {
      b.addEventListener('click', function () { stampTime(); r.idx = parseInt(b.getAttribute('data-qi'), 10); renderQ(); });
    });
    document.getElementById('submitBtn').addEventListener('click', function () { submitQuiz(false); });
    window.scrollTo(0, 0);
  }
  function submitQuiz(auto) {
    if (!runner) return;
    var r = runner;
    var unanswered = r.qs.filter(function (q) { return !r.answers[q.id]; }).length;
    if (!auto && unanswered > 0) {
      if (!confirm('Masih ada ' + unanswered + ' soal belum dijawab. Kumpulkan?')) return;
    } else if (!auto) {
      if (!confirm('Kumpulkan quiz sekarang?')) return;
    }
    stampTime();
    clearInterval(r.timerId);
    var totalTime = Math.round((Date.now() - r.startAll) / 1000);
    var answers = r.qs.map(function (q) {
      return { questionId: q.id, selectedAnswer: r.answers[q.id] || '', responseTime: r.times[q.id] || 0 };
    });
    loading(auto ? 'Waktu habis — mengumpulkan…' : 'Mengumpulkan & menilai…');
    apiWrite('POST', '/quiz-attempts', { quizId: r.quiz.id, answers: answers, totalTime: totalTime })
      .then(function (res) {
        runner = null;
        location.hash = '#/result/' + res.id;
      })
      .catch(function (e) { app.innerHTML = errBox('Gagal mengumpulkan: ' + e.message); });
  }

  /* ================= RESULT + PEMBAHASAN ================= */
  function vResult(attemptId) {
    setNav('quiz');
    loading('Memuat hasil…');
    Promise.all([
      apiGet('/attempts/' + encodeURIComponent(attemptId)).catch(function () { return null; }),
      apiGet('/quiz-history').catch(function () { return []; }),
    ]).then(function (res) {
      var a = res[0], hist = res[1] || [];
      if (!a) { app.innerHTML = errBox('Hasil tidak ditemukan.'); return; }
      var total = a.correct + a.incorrect;
      var h = '<div class="page-head"><h1>Hasil Quiz</h1><p>' + esc((a.quiz && a.quiz.title) || a.quizId) + '</p></div>';
      h += '<div class="card"><h2>Skor Kamu</h2><div class="stats-grid">'
        + stat(a.score + '/100', 'Score')
        + stat(a.accuracy + '%', 'Accuracy')
        + stat(a.correct, 'Correct')
        + stat(a.incorrect, 'Incorrect')
        + stat(fmtDur(a.totalTime), 'Total Time')
        + stat(fmtAvg(a.averageResponseTime), 'Avg Response')
        + stat(fmtSpeed(a.averageResponseTime), 'Speed')
        + stat(total + ' soal', 'Total')
        + '</div></div>';
      // analisis performa vs quiz sebelumnya
      var prev = hist.filter(function (x) { return x.id !== a.id; })[0];
      h += '<div class="card"><h2>Analisis Performa</h2>';
      if (prev) {
        var dAcc = Math.round((a.accuracy - prev.accuracy) * 10) / 10;
        var dSpd = Math.round((a.averageResponseTime - prev.averageResponseTime) * 10) / 10;
        h += '<p>' + (dAcc >= 0
          ? 'Ketepatan kamu meningkat ' + dAcc + '% dibandingkan quiz sebelumnya (' + prev.accuracy + '% → ' + a.accuracy + '%).'
          : 'Ketepatan menurun ' + Math.abs(dAcc) + '% dibanding quiz sebelumnya. Review pembahasan di bawah.') + '</p>';
        h += '<p>' + (dSpd <= 0
          ? 'Kecepatan menjawab membaik (' + fmtDur(prev.averageResponseTime) + ' → ' + fmtDur(a.averageResponseTime) + ' per soal).'
          : 'Kecepatan menjawab masih dapat ditingkatkan (rata-rata ' + fmtSpeed(a.averageResponseTime) + ').') + '</p>';
      } else {
        h += '<p class="muted">Ini quiz pertama kamu — kerjakan quiz berikutnya untuk melihat perbandingan.</p>';
      }
      h += '</div>';
      // pembahasan
      h += '<div class="card"><h2>Pembahasan</h2>';
      (a.answers || []).forEach(function (ans, i) {
        var q = ans.question || {};
        var ok = !!ans.isCorrect;
        h += '<div class="list-item"><div class="row"><span class="badge ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Benar' : 'Salah') + '</span>'
          + '<span class="small muted">Soal ' + (i + 1) + ' • ' + esc(q.category || '') + ' • ' + fmtDur(ans.responseTime) + '</span></div>';
        h += '<div style="margin:8px 0">' + (q.question || '') + '</div>';
        (q.options || []).forEach(function (op, oi) {
          var L = optLetter(op, oi);
          var cls = '';
          if (L === ans.correctAnswer) cls = 'correct';
          else if (L === ans.selectedAnswer) cls = 'wrong';
          h += '<div class="opt ' + cls + '">' + esc(op)
            + (L === ans.correctAnswer ? ' ✓' : '') + (L === ans.selectedAnswer && !ok ? ' (jawabanmu)' : '') + '</div>';
        });
        h += '<div class="small">Jawaban saya: <b>' + esc(ans.selectedAnswer || '-') + '</b> • Jawaban benar: <b>' + esc(ans.correctAnswer || '-') + '</b></div>';
        h += '<div class="explain"><b>Pembahasan:</b><br>' + (q.explanation || '<span class="muted">Belum ada pembahasan.</span>') + '</div>';
        h += '</div>';
      });
      h += '</div><div class="row"><a class="btn" href="#/dashboard">Dashboard</a><a class="btn" href="#/quiz">Quiz lain</a></div>';
      app.innerHTML = h;
      window.scrollTo(0, 0);
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat hasil: ' + e.message); });
  }

  /* ================= QUESTION BANK ================= */
  function vBank(query) {
    setNav('bank');
    loading('Memuat bank soal…');
    apiGet('/meta').then(function (meta) {
      var h = '<div class="page-head"><h1>Question Bank</h1><p>Seluruh soal — cari, filter, kerjakan individual</p></div>';
      h += '<div class="card"><div class="toolbar">'
        + '<input id="bQ" type="search" placeholder="🔍 Cari soal…" value="' + esc(query.q || '') + '" />'
        + '<select id="bSubj"><option value="">Semua mapel</option>'
        + (meta.subjects || []).map(function (s) { return '<option ' + (query.subject === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
        + '<select id="bCat"><option value="">Semua materi</option></select>'
        + '<select id="bDiff"><option value="">Semua difficulty</option>'
        + (meta.difficulties || []).map(function (s) { return '<option ' + (query.difficulty === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
        + '</div><div id="bList"></div></div>';
      app.innerHTML = h;
      var bQ = document.getElementById('bQ'), bS = document.getElementById('bSubj'),
        bC = document.getElementById('bCat'), bD = document.getElementById('bDiff');
      function fillCat() {
        var cats = (meta.categories && meta.categories[bS.value]) || [];
        var all = [];
        Object.keys(meta.categories || {}).forEach(function (k) { all = all.concat(meta.categories[k]); });
        var list = bS.value ? cats : all;
        bC.innerHTML = '<option value="">Semua materi</option>' + list.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
      }
      fillCat();
      var deb = null;
      function refetch() {
        var url = '/questions?';
        if (bS.value) url += 'subject=' + encodeURIComponent(bS.value) + '&';
        if (bC.value) url += 'category=' + encodeURIComponent(bC.value) + '&';
        if (bD.value) url += 'difficulty=' + encodeURIComponent(bD.value) + '&';
        if (bQ.value) url += 'q=' + encodeURIComponent(bQ.value);
        apiGet(url).then(function (list) {
          var el = document.getElementById('bList');
          if (!list.length) { el.innerHTML = '<div class="empty">Tidak ada soal cocok.</div>'; return; }
          el.innerHTML = '<p class="small muted">' + list.length + ' soal ditemukan.</p>' + list.slice(0, 100).map(function (q) {
            return '<div class="list-item"><div class="row"><span class="badge">' + esc(q.difficulty) + '</span>'
              + '<span class="small muted">' + esc(q.subject) + ' • ' + esc(q.category) + '</span></div>'
              + '<div style="margin:6px 0">' + (q.question || '').slice(0, 220) + '…</div>'
              + '<div class="row"><a class="btn ghost" href="#/bank/' + esc(q.id) + '">Buka & pembahasan</a></div></div>';
          }).join('');
        }).catch(function (e) { document.getElementById('bList').innerHTML = errBox(e.message); });
      }
      bQ.addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(refetch, 350); });
      bS.addEventListener('change', function () { fillCat(); refetch(); });
      bC.addEventListener('change', refetch);
      bD.addEventListener('change', refetch);
      refetch();
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat bank: ' + e.message); });
  }
  function vBankDetail(qid) {
    setNav('bank');
    loading('Memuat soal…');
    apiGet('/questions/' + encodeURIComponent(qid)).then(function (q) {
      var h = '<div class="page-head"><h1>Detail Soal</h1><p>' + esc(q.subject) + ' • ' + esc(q.category) + ' • ' + esc(q.difficulty) + '</p></div>';
      h += '<div class="card"><div>' + (q.question || '') + '</div><div style="margin-top:10px">';
      (q.options || []).forEach(function (op) { h += '<div class="opt">' + esc(op) + '</div>'; });
      h += '</div>';
      if (q.stats) h += '<p class="small muted">Dikerjakan ' + q.stats.attempts + 'x • Accuracy ' + (q.stats.accuracy == null ? '-' : q.stats.accuracy + '%') + ' • Avg ' + fmtDur(q.stats.avgResponseTime || 0) + '</p>';
      h += '<div class="explain"><b>Pembahasan (jawaban ' + esc(q.correctAnswer) + '):</b><br>' + (q.explanation || '-') + '</div>';
      h += '<div class="row" style="margin-top:12px"><button class="btn primary" id="soloBtn">Kerjakan soal ini (1 soal)</button>'
        + '<a class="btn ghost" href="#/bank">Kembali</a></div></div>';
      app.innerHTML = h;
      document.getElementById('soloBtn').addEventListener('click', function () {
        // quiz 1 soal: buat quiz ad-hoc via AI generate? fallback: simpan attempt manual
        if (!confirm('Buat quiz 1 soal dari soal ini?')) return;
        var key = getKey(); if (!key) return;
        var ans = prompt('Jawaban kamu (A/B/C/D/E):', '');
        if (!ans) return;
        var t0 = Date.now();
        apiWrite('POST', '/quizzes', { title: 'Latihan individual — ' + q.category, date: todayStr(), subject: q.subject, category: q.category, difficulty: q.difficulty, timeLimit: 5, questionIds: [q.id] })
          .then(function (quiz) {
            return apiWrite('POST', '/quiz-attempts', { quizId: quiz.id, answers: [{ questionId: q.id, selectedAnswer: ans.trim().toUpperCase(), responseTime: Math.max(5, Math.round((Date.now() - t0) / 1000)) }], totalTime: 30 });
          })
          .then(function (res) { location.hash = '#/result/' + res.id; })
          .catch(function (e) { toast('Gagal: ' + e.message); });
      });
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat soal: ' + e.message); });
  }

  /* ================= PROGRESS ================= */
  function lineChart(cv, series, opts) {
    opts = opts || {};
    var W = cv.clientWidth || 600, H = 220, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.clearRect(0, 0, W, H);
    if (!series.length) { ctx.fillStyle = dark ? '#9aa3bd' : '#68738a'; ctx.fillText('Belum ada data', 20, 30); return; }
    var vals = series.map(function (s) { return s.y; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var pad = 34;
    function X(i) { return pad + (W - pad - 10) * (series.length === 1 ? 0.5 : i / (series.length - 1)); }
    function Y(v) { return H - pad + 8 - (H - pad - 18) * (v - min) / (max - min); }
    ctx.strokeStyle = dark ? '#2a3352' : '#e3e8f0';
    ctx.fillStyle = dark ? '#9aa3bd' : '#68738a';
    ctx.font = '11px sans-serif';
    for (var g = 0; g <= 4; g++) {
      var gv = min + (max - min) * g / 4, gy = Y(gv);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - 10, gy); ctx.stroke();
      ctx.fillText((Math.round(gv * 10) / 10) + (opts.suffix || ''), 2, gy + 4);
    }
    ctx.strokeStyle = opts.color || '#3b63f3'; ctx.lineWidth = 2.5; ctx.beginPath();
    series.forEach(function (s, i) { if (i === 0) ctx.moveTo(X(i), Y(s.y)); else ctx.lineTo(X(i), Y(s.y)); });
    ctx.stroke();
    ctx.fillStyle = opts.color || '#3b63f3';
    series.forEach(function (s, i) { ctx.beginPath(); ctx.arc(X(i), Y(s.y), 3.5, 0, 7); ctx.fill(); });
    ctx.fillStyle = dark ? '#9aa3bd' : '#68738a';
    series.forEach(function (s, i) {
      if (series.length > 12 && i % Math.ceil(series.length / 12)) return;
      ctx.fillText(String(s.x).slice(5), X(i) - 12, H - 8);
    });
  }
  function vProgress() {
    setNav('progress');
    loading('Memuat progress…');
    Promise.all([
      apiGet('/progress').catch(function () { return null; }),
      apiGet('/recommendations').catch(function () { return { recommendations: [] }; }),
    ]).then(function (res) {
      var p = res[0], rec = res[1] || {};
      if (!p || !p.totals || !p.totals.totalQuiz) {
        app.innerHTML = '<div class="page-head"><h1>Progress</h1></div><div class="empty">Data belum cukup. Kerjakan minimal 1 quiz untuk melihat progress.</div>';
        return;
      }
      var h = '<div class="page-head"><h1>Progress</h1><p>' + p.totals.totalQuiz + ' quiz • Accuracy ' + p.totals.accuracy + '%</p></div>';
      h += '<div class="card"><h2>Accuracy Progress</h2><canvas class="chart" id="cAcc"></canvas><p class="small muted">X: tanggal/nomor quiz • Y: accuracy (%)</p></div>';
      h += '<div class="card"><h2>Speed Progress</h2><canvas class="chart" id="cSpd"></canvas><p class="small muted">X: tanggal • Y: avg response time (detik)</p></div>';
      h += '<div class="card"><h2>Score Progress</h2><canvas class="chart" id="cSco"></canvas></div>';
      // subject
      h += '<div class="card"><h2>Subject Progress — Fisika vs Bahasa Indonesia</h2><div class="table-wrap"><table><tr><th>Mapel</th><th>Soal</th><th>Benar</th><th>Accuracy</th></tr>';
      Object.keys(p.bySubject || {}).forEach(function (s) {
        var v = p.bySubject[s];
        h += '<tr><td>' + esc(s) + '</td><td>' + v.total + '</td><td>' + v.correct + '</td><td><b>' + v.accuracy + '%</b></td></tr>';
      });
      h += '</table></div></div>';
      // topic
      var topics = (p.byTopic || []).slice().sort(function (a, b) { return a.accuracy - b.accuracy; });
      h += '<div class="card"><h2>Analisis Materi</h2><div class="table-wrap"><table><tr><th>Materi</th><th>Mapel</th><th>n</th><th>Accuracy</th></tr>';
      topics.forEach(function (t) {
        h += '<tr><td>' + esc(t.category) + '</td><td>' + esc(t.subject) + '</td><td>' + t.total + '</td><td><b>' + t.accuracy + '%</b></td></tr>';
      });
      h += '</table></div>';
      var weak = topics.filter(function (t) { return t.total >= 3; })[0];
      var strong = topics.filter(function (t) { return t.total >= 3; }).slice(-1)[0];
      if (weak) h += '<p>📉 Materi yang perlu ditingkatkan: <b>' + esc(weak.category) + '</b> (' + weak.accuracy + '%)</p>';
      if (strong) h += '<p>💪 Materi terkuat: <b>' + esc(strong.category) + '</b> (' + strong.accuracy + '%)</p>';
      h += '</div>';
      // rekomendasi
      h += '<div class="card"><h2>Rekomendasi</h2>';
      if ((rec.recommendations || []).length) rec.recommendations.forEach(function (r) { h += '<p>• ' + esc(r.text) + '</p>'; });
      else h += '<p class="muted">Belum ada rekomendasi — data masih sedikit.</p>';
      h += '</div>';
      // streak + calendar
      h += '<div class="card"><h2>Streak</h2><div class="row"><span class="badge">🔥 Current: ' + p.totals.currentStreak + '</span><span class="badge">🏆 Longest: ' + p.totals.longestStreak + '</span></div><div class="cal">';
      var cal = p.calendar || {};
      var dates = [];
      var d0 = new Date(); d0.setDate(d0.getDate() - 111);
      for (var i = 0; i < 112; i++) {
        var d = new Date(d0); d.setDate(d0.getDate() + i);
        var k = d.toISOString().slice(0, 10);
        var c = cal[k] || 0;
        var cls = c === 0 ? '' : (c === 1 ? 'l1' : (c === 2 ? 'l2' : 'l3'));
        dates.push('<i class="' + cls + '" title="' + k + ': ' + c + ' quiz"></i>');
      }
      h += dates.join('') + '</div></div>';
      app.innerHTML = h;
      lineChart(document.getElementById('cAcc'), p.byDate.map(function (d) { return { x: d.date, y: d.accuracy }; }), { suffix: '%', color: '#16a34a' });
      lineChart(document.getElementById('cSpd'), p.byDate.map(function (d) { return { x: d.date, y: d.avgTime }; }), { suffix: 'd', color: '#d97706' });
      lineChart(document.getElementById('cSco'), p.byDate.map(function (d) { return { x: d.date, y: d.score }; }), { color: '#3b63f3' });
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat progress: ' + e.message); });
  }

  /* ================= HISTORY ================= */
  function vHistory(query) {
    setNav('history');
    loading('Memuat history…');
    apiGet('/quiz-history').then(function (list) {
      var h = '<div class="page-head"><h1>Quiz History</h1><p>' + list.length + ' quiz pernah dikerjakan</p></div>';
      h += '<div class="card"><div class="toolbar">'
        + '<select id="hSubj"><option value="">Semua mapel</option><option>Fisika</option><option>Bahasa Indonesia</option><option>Mixed</option></select>'
        + '<select id="hDiff"><option value="">Semua difficulty</option><option>Mudah</option><option>Sedang</option><option>Sulit</option><option>TKA</option></select>'
        + '<input id="hDate" type="date" /></div><div id="hList"></div></div>';
      app.innerHTML = h;
      function render() {
        var s = document.getElementById('hSubj').value, d = document.getElementById('hDiff').value, dt = document.getElementById('hDate').value;
        var f = list.filter(function (a) {
          if (s && (a.quizSubject || '') !== s) return false;
          if (d && (a.quizDifficulty || '') !== d) return false;
          if (dt && (a.completedAt || '').slice(0, 10) !== dt) return false;
          return true;
        });
        var el = document.getElementById('hList');
        if (!f.length) { el.innerHTML = '<div class="empty">Tidak ada riwayat cocok.</div>'; return; }
        el.innerHTML = f.map(function (a) {
          return '<div class="list-item"><h3>' + esc(a.quizTitle || a.quizId) + '</h3>'
            + '<div class="small muted">' + esc(a.quizSubject || '') + ' • ' + esc((a.completedAt || '').slice(0, 10)) + ' • Score ' + a.score + ' • ' + a.accuracy + '% • ' + fmtDur(a.totalTime) + ' • Avg ' + fmtDur(a.averageResponseTime) + '</div>'
            + '<div style="margin-top:6px"><a class="btn ghost" href="#/result/' + esc(a.id) + '">Buka hasil</a></div></div>';
        }).join('');
      }
      ['hSubj', 'hDiff', 'hDate'].forEach(function (id) { document.getElementById(id).addEventListener('change', render); });
      render();
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat history: ' + e.message); });
  }

  /* ================= PROFILE ================= */
  function vProfile() {
    setNav('profile');
    loading('Memuat profil…');
    apiGet('/progress').then(function (p) {
      var t = (p && p.totals) || {};
      var prof = JSON.parse(localStorage.getItem('tka_profile') || '{"username":"fairus","displayName":"Fairus","photo":""}');
      var h = '<div class="page-head"><h1>Profile</h1></div>';
      h += '<div class="card"><div class="row">'
        + '<img id="avatar" class="avatar" src="' + esc(prof.photo || '') + '" alt="Foto profil" onerror="this.style.visibility=\'hidden\'" />'
        + '<div><div style="font-size:1.2rem;font-weight:800">' + esc(prof.displayName) + '</div><div class="muted">@' + esc(prof.username) + '</div></div></div>'
        + '<label>Username</label><input id="pUser" value="' + esc(prof.username) + '" />'
        + '<label>Nama tampilan</label><input id="pName" value="' + esc(prof.displayName) + '" />'
        + '<label>Foto profil</label><input id="pPhoto" type="file" accept="image/*" />'
        + '<div style="margin-top:10px"><button class="btn primary" id="pSave">Simpan</button></div></div>';
      h += '<div class="card"><h2>Statistik</h2><div class="stats-grid">'
        + stat(t.totalQuiz || 0, 'Total quiz') + stat(t.totalSoal || 0, 'Total soal')
        + stat((t.accuracy || 0) + '%', 'Accuracy') + stat('🔥 ' + (t.currentStreak || 0), 'Current streak')
        + stat('🏆 ' + (t.longestStreak || 0), 'Longest streak') + stat(t.bestScore || 0, 'Best score')
        + '</div></div>';
      app.innerHTML = h;
      var photoData = prof.photo || '';
      document.getElementById('pPhoto').addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          photoData = rd.result;
          var av = document.getElementById('avatar');
          av.src = photoData; av.style.visibility = 'visible';
        };
        rd.readAsDataURL(f);
      });
      document.getElementById('pSave').addEventListener('click', function () {
        var np = { username: document.getElementById('pUser').value.trim(), displayName: document.getElementById('pName').value.trim(), photo: photoData };
        localStorage.setItem('tka_profile', JSON.stringify(np));
        toast('Profil tersimpan.');
        vProfile();
      });
    }).catch(function (e) { app.innerHTML = errBox('Gagal memuat profil: ' + e.message); });
  }

  /* ================= ADMIN ================= */
  function vAdmin() {
    setNav('admin');
    var h = '<div class="page-head"><h1>Admin / Quiz Builder</h1><p>Kelola quiz & bank soal tanpa ubah source code</p></div>';
    h += '<div class="card"><h2>Quiz</h2><div class="row"><button class="btn primary" id="aNewQuiz">+ Quiz baru</button><button class="btn" id="aListQuiz">Muat daftar quiz</button></div><div id="aQuizList" style="margin-top:10px"></div></div>';
    h += '<div class="card"><h2>Soal</h2><div class="row"><button class="btn primary" id="aNewQ">+ Soal baru</button></div>'
      + '<div class="toolbar" style="margin-top:8px"><input id="aQ" type="search" placeholder="Cari soal…" /></div><div id="aQList"></div></div>';
    h += '<div class="card"><h2>AI Quiz Generator</h2><div class="toolbar"><select id="gSubj"><option>Fisika</option><option>Bahasa Indonesia</option><option>Mixed</option></select>'
      + '<select id="gDiff"><option>Mudah</option><option>Sedang</option><option>Sulit</option><option selected>TKA</option></select>'
      + '<input id="gN" type="number" value="10" min="1" max="50" style="max-width:90px" />'
      + '<input id="gDate" type="date" value="' + todayStr() + '" /></div>'
      + '<div class="row"><button class="btn primary" id="gBtn">Generate dari bank soal</button></div><div id="gOut" class="small muted" style="margin-top:8px"></div></div>';
    app.innerHTML = h;

    document.getElementById('aListQuiz').addEventListener('click', function () {
      apiGet('/quizzes').then(function (list) {
        document.getElementById('aQuizList').innerHTML = list.map(function (q) {
          return '<div class="list-item"><h3>' + esc(q.title) + ' <span class="small muted">' + esc(q.id) + '</span></h3>'
            + '<div class="small muted">' + esc(q.date) + ' • ' + esc(q.subject) + ' • ' + (q.questionCount || 0) + ' soal</div>'
            + '<div class="row" style="margin-top:6px"><button class="btn ghost" data-edit="' + esc(q.id) + '">Edit</button><button class="btn danger" data-del="' + esc(q.id) + '">Hapus</button></div></div>';
        }).join('') || '<div class="empty">Belum ada quiz.</div>';
        bindQuizBtns();
      }).catch(function (e) { toast(e.message); });
    });
    function bindQuizBtns() {
      app.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Hapus quiz ' + b.getAttribute('data-del') + '?')) return;
          apiWrite('DELETE', '/quizzes/' + encodeURIComponent(b.getAttribute('data-del'))).then(function () { toast('Quiz dihapus.'); document.getElementById('aListQuiz').click(); }).catch(function (e) { toast(e.message); });
        });
      });
      app.querySelectorAll('[data-edit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-edit');
          apiGet('/quizzes/' + encodeURIComponent(id)).then(function (q) {
            var title = prompt('Judul:', q.title); if (title == null) return;
            var date = prompt('Tanggal (YYYY-MM-DD):', q.date); if (date == null) return;
            var tl = prompt('Time limit (menit):', q.timeLimit); if (tl == null) return;
            apiWrite('PUT', '/quizzes/' + encodeURIComponent(id), { title: title, date: date, timeLimit: parseInt(tl, 10) || q.timeLimit }).then(function () { toast('Quiz diperbarui.'); }).catch(function (e) { toast(e.message); });
          });
        });
      });
    }
    document.getElementById('aNewQuiz').addEventListener('click', function () {
      var title = prompt('Judul quiz:', 'Daily Quiz #' + todayStr()); if (!title) return;
      var subj = prompt('Subject (Fisika / Bahasa Indonesia / Mixed):', 'Mixed'); if (subj == null) return;
      var diff = prompt('Difficulty:', 'TKA'); if (diff == null) return;
      apiWrite('POST', '/quizzes', { title: title, date: todayStr(), subject: subj, category: '', difficulty: diff, timeLimit: 30, questionIds: [] })
        .then(function (q) { toast('Quiz dibuat: ' + q.id); document.getElementById('aListQuiz').click(); })
        .catch(function (e) { toast(e.message); });
    });
    function searchAdminQ() {
      var q = document.getElementById('aQ').value;
      apiGet('/questions?' + (q ? 'q=' + encodeURIComponent(q) : '')).then(function (list) {
        document.getElementById('aQList').innerHTML = list.slice(0, 30).map(function (s) {
          return '<div class="list-item"><div class="small">' + esc((s.question || '').slice(0, 160)) + '…</div>'
            + '<div class="small muted">' + esc(s.id) + ' • ' + esc(s.subject) + ' • ' + esc(s.category) + ' • ' + esc(s.difficulty) + '</div>'
            + '<div class="row" style="margin-top:6px"><button class="btn ghost" data-qedit="' + esc(s.id) + '">Edit</button><button class="btn danger" data-qdel="' + esc(s.id) + '">Hapus</button></div></div>';
        }).join('') || '<div class="empty">Tidak ada soal.</div>';
        app.querySelectorAll('[data-qdel]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Hapus soal ' + b.getAttribute('data-qdel') + '?')) return;
            apiWrite('DELETE', '/questions/' + encodeURIComponent(b.getAttribute('data-qdel'))).then(function () { toast('Soal dihapus.'); searchAdminQ(); }).catch(function (e) { toast(e.message); });
          });
        });
        app.querySelectorAll('[data-qedit]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-qedit');
            apiGet('/questions/' + encodeURIComponent(id)).then(function (s) {
              var ex = prompt('Pembahasan baru (kosongkan = tidak diubah):', '');
              var payload = {};
              if (ex) payload.explanation = ex;
              var dif = prompt('Difficulty (' + s.difficulty + '):', s.difficulty); if (dif == null) return;
              payload.difficulty = dif;
              apiWrite('PUT', '/questions/' + encodeURIComponent(id), payload).then(function () { toast('Soal diperbarui.'); }).catch(function (e) { toast(e.message); });
            });
          });
        });
      }).catch(function (e) { toast(e.message); });
    }
    document.getElementById('aQ').addEventListener('input', searchAdminQ);
    searchAdminQ();
    document.getElementById('aNewQ').addEventListener('click', function () {
      var subject = prompt('Subject:', 'Fisika'); if (!subject) return;
      var category = prompt('Materi:', 'Medan magnet'); if (category == null) return;
      var diff = prompt('Difficulty:', 'TKA'); if (diff == null) return;
      var question = prompt('Teks pertanyaan (mendukung HTML):'); if (!question) return;
      var opts = [];
      for (var i = 0; i < 5; i++) { var o = prompt('Opsi ' + letter(i) + ':'); if (o == null) return; opts.push(letter(i) + '. ' + o); }
      var ca = prompt('Jawaban benar (A-E):'); if (!ca) return;
      var ex = prompt('Pembahasan:') || '';
      apiWrite('POST', '/questions', { subject: subject, category: category, difficulty: diff, question: question, options: opts, correctAnswer: ca.trim().toUpperCase(), explanation: ex, tags: category })
        .then(function (s) { toast('Soal dibuat: ' + s.id); searchAdminQ(); })
        .catch(function (e) { toast(e.message); });
    });
    document.getElementById('gBtn').addEventListener('click', function () {
      var out = document.getElementById('gOut');
      out.textContent = 'Membuat quiz dari bank…';
      apiWrite('POST', '/ai/generate-quiz', {
        subject: document.getElementById('gSubj').value,
        difficulty: document.getElementById('gDiff').value,
        numberOfQuestions: parseInt(document.getElementById('gN').value, 10) || 10,
        date: document.getElementById('gDate').value || todayStr(),
      }).then(function (q) { out.innerHTML = 'Quiz dibuat: <b>' + esc(q.id) + '</b> — ' + q.questionCount + ' soal. <a href="#/take/' + esc(q.id) + '">Kerjakan</a>'; })
        .catch(function (e) { out.textContent = 'Gagal: ' + e.message; });
    });
  }

  /* ================= ROUTER ================= */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var parts = raw.split('?');
    var segs = parts[0].split('/').filter(Boolean);
    var query = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var k = kv.split('=');
      query[decodeURIComponent(k[0])] = decodeURIComponent(k[1] || '');
    });
    return { segs: segs, query: query };
  }
  function route() {
    // hentikan timer runner saat pindah halaman
    if (runner && runner.timerId && !(parseHash().segs[0] === 'take')) {
      clearInterval(runner.timerId);
      runner = null;
    }
    var r = parseHash(), s = r.segs, q = r.query;
    if (s.length === 0 || s[0] === 'dashboard') vDashboard();
    else if (s[0] === 'quiz') vQuizList(q);
    else if (s[0] === 'take' && s[1]) vTake(s[1]);
    else if (s[0] === 'result' && s[1]) vResult(s[1]);
    else if (s[0] === 'bank' && s[1]) vBankDetail(s[1]);
    else if (s[0] === 'bank') vBank(q);
    else if (s[0] === 'progress') vProgress();
    else if (s[0] === 'history') vHistory(q);
    else if (s[0] === 'profile') vProfile();
    else if (s[0] === 'admin') vAdmin();
    else { location.hash = '#/dashboard'; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/dashboard';
  route();
})();
