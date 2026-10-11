# TKA Quiz — Latihan Soal Fisika & Bahasa Indonesia

Web app kuis untuk latihan mandiri TKA kelas 12: kerjakan quiz harian, lihat pembahasan, pantau progres per materi, dan kelola bank soal.

## Fitur
- Bank soal Fisika & Bahasa Indonesia (soal awal dari `data/seed_*.json`, bisa ditambah lewat CRUD)
- Quiz harian (campuran / per mapel) dengan pembahasan tiap soal
- Dashboard progres: skor, akurasi, kecepatan per soal, analisis per materi
- Streak harian + kalender aktivitas
- Riwayat pengerjaan & rekomendasi materi lemah
- Admin: kelola soal/quiz dari UI tanpa menyentuh kode
- API berlapis peran: `USER` (submit jawaban), `AI` (generate soal/rekomendasi), `ADMIN` (kelola penuh)
- Data lokal: SQLite (`data/tka.db`, auto-migrate)

## Menjalankan
```bash
npm install
node scripts/seed.js   # isi bank soal awal (opsional, idempotent)
node server.js         # buka http://localhost:3000
```

Kunci API (`data/keys.json`) di-generate otomatis saat pertama dijalankan dan **tidak** ikut ter-commit.

## Struktur
```
server.js          # entry Express
lib/               # db (SQLite) & auth (x-api-key)
routes/api.js      # REST API
public/            # frontend SPA (index.html, js/, css/)
data/              # seed soal; db & keys di-generate saat runtime
scripts/seed.js    # seeding bank soal
```
