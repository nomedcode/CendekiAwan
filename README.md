# CendekiAwan

Dashboard telemetri **live** untuk lima layanan AWS yang berjalan sepenuhnya lokal di
[Floci](https://github.com/floci-io/floci) — emulator AWS MIT, tanpa akun, tanpa auth token.
Satu halaman, satu perintah Docker Compose, biaya Rp0.

Lima layanan yang divisualisasikan: **SQS · S3 · SNS · DynamoDB · Lambda**.

## Masalah yang diselesaikan

Emulator AWS lokal hanya punya API dan CLI. Tidak ada cara cepat untuk melihat apakah
queue bertambah, objek masuk bucket, atau Lambda benar-benar terpanggil. CendekiAwan
menutup celah itu: setiap kartu menampilkan nilai saat ini, tren 15 menit, sumber data
(`live` / `CloudWatch 60 dtk` / `derived`), dan tombol aksi yang langsung mengubah state.

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19 + Vite 6, disajikan nginx |
| Backend | FastAPI + SQLAlchemy 2, Python 3.12 |
| Database | PostgreSQL 16 (named volume `pgdata`) |
| Emulator AWS | Floci 2.4.0 (S3, SQS, SNS, DynamoDB, Lambda) |
| Cache bonus | Redis 7.4 (TTL 2 dtk) |

## Arsitektur

```text
Browser :8080
   │
   ▼
frontend (nginx) ──/api──► backend (FastAPI :8000)
                              │        │
                              │        ├──► db (Postgres :5432)   [pgdata]
                              │        ├──► floci (:4566)         [flocidata]
                              │        └──► redis (:6379)        [rediscache]
                              └── retry loop saat startup
```

| Service | Image | Port host | Volume | Healthcheck |
|---|---|---|---|---|
| `frontend` | `nginx:1.27-alpine` (build) | `8080:80` | – | `wget /` |
| `backend` | `python:3.12-slim` (build) | internal `8000` | – | Python `urllib /health` |
| `db` | `postgres:16-alpine` | `127.0.0.1:5432` | `pgdata` | `pg_isready` |
| `floci` | `floci/floci:2.4.0` | `127.0.0.1:4566` | `flocidata` | bash `/dev/tcp` |
| `redis` | `redis:7.4-alpine` | internal `6379` | `rediscache` | `redis-cli ping` |
| `adminer` | `adminer:4.8.1` | `127.0.0.1:8081` | – | profile `tools` saja |

Network: `appnet` (bridge). Aplikasi menghubungi database lewat nama service `db`.

## Menjalankan

```bash
cp .env.example .env          # opsional; semua nilai punya default
docker compose up -d --build
```

Buka **http://localhost:8080**. Hentikan dengan `docker compose down` (data selamat).

Tools database (opsional):

```bash
docker compose --profile tools up -d adminer   # http://localhost:8081
```

## Endpoint

| Method | Path | Fungsi | Status |
|---|---|---|---|
| GET | `/health` | DB + emulator + Redis | 200 / 503 |
| GET | `/api/snapshot` | state live 5 layanan (cache 2 dtk) | 200 |
| GET | `/api/metrics?minutes=15` | time series dari Postgres | 200 |
| GET | `/api/events?limit=50` | audit log | 200 |
| POST | `/api/actions/simulate` | kirim pesan ke SQS | 201 / 422 |
| POST | `/api/actions/publish` | publish SNS → fanout | 201 / 422 |
| POST | `/api/actions/upload` | taruh objek di S3 | 201 / 422 |
| POST | `/api/actions/item` | tulis item DynamoDB | 201 / 422 |
| POST | `/api/actions/invoke` | invoke Lambda | 201 / 422 |

## Alur demo

1. Buka halaman — lima baris service terisi dalam ±5 detik (sampler pertama).
2. Klik **Kirim pesan** → SQS depth naik 10 dalam ≤8 detik, feed audit mencatat `simulate ok`.
3. Klik **Publish** → SNS mem-fanout ke queue, depth naik lagi.
4. Klik **Invoke** → Lambda berjalan di container, durasi muncul di baris.
5. Grafik SQS menunjukkan langkah nyata (bukan data palsu).

## Bukti verifikasi

Semua perintah dan output ada di [`docs/verification.md`](docs/verification.md):
`compose ps` lima sehat, curl 200/201, persistensi `down`/`up`, Redis hit, ukuran image.

## Screenshot

![Dashboard desktop](docs/screenshots/desktop.png)

## Image Docker Hub

- [`bangdemon/cendekiawan-backend`](https://hub.docker.com/r/bangdemon/cendekiawan-backend) — tag `1.0.0` dan `latest`
- [`bangdemon/cendekiawan-frontend`](https://hub.docker.com/r/bangdemon/cendekiawan-frontend) — tag `1.0.0` dan `latest`

## Struktur repo

```text
cendekiawan/
  backend/    app/{config,db,models,schemas,emulator,sampler,cache,main}.py
              app/routers/api.py  tests/  Dockerfile
  frontend/   src/{App,api,styles.css,components/*}  nginx.conf  Dockerfile
  docs/       lo1-analysis.md  verification.md  screenshots/
  docker-compose.yml  .env.example  README.md
```

## Analisis model layanan cloud (LO1)

Lihat [`docs/lo1-analysis.md`](docs/lo1-analysis.md): profil proyek, tabel lima model
layanan (IaaS/PaaS/SaaS/BaaS/FaaS), dan analisis deployment public/private/hybrid/multi-cloud.

## Batasan yang disengaja

- **Loopback saja.** UI di `8080`, emulator di `127.0.0.1:4566`, database di `127.0.0.1:5432`.
  Tidak ada autentikasi — proyek ini alat lokal, bukan layanan publik.
- **Kredensial dummy.** Floci menerima kredensial apa pun; nilai di `.env.example` bukan
  kredensial AWS asli. Jangan pernah memakai kredensial asli di sini.
- **Floci, bukan AWS asli.** Perilaku mengikuti emulator. Metrik `ApproximateAgeOfOldestMessage`
  hanya tersedia lewat CloudWatch dan dipublikasikan **sekali per menit** — kartu memberi
  label sumbernya.
- **DynamoDB item count** dihitung dengan `Scan Select=COUNT` (bukan `DescribeTable.ItemCount`
  yang tidak dapat diandalkan), dan tabel demo dibatasi kecil.

## Persistensi: `down` vs `down -v`

- `docker compose down` — container berhenti, **volume tetap**. Data Postgres, Floci, dan
  Redis selamat; sudah diuji (events 11 → 11, DynamoDB 5 item, S3 3 objek, SQS 26 pesan).
- `docker compose down -v` — **menghapus named volume** `pgdata`, `flocidata`, `rediscache`.
  Semua data demo hilang dan resource akan di-seed ulang saat start berikutnya.

## AI Usage Declaration

Alat AI **Claude Code** digunakan untuk: scaffold proyek, implementasi backend/frontend,
penulisan tes, konfigurasi Docker, dan penyusunan dokumen ini. Seluruh hasil dijalankan dan
diverifikasi di mesin pengembang: `docker compose up -d --build`, `pytest` (12 tes),
curl endpoint, uji persistensi, dan screenshot browser. Tidak ada kredensial asli yang
digunakan atau disimpan; nilai AWS di `.env.example` adalah dummy untuk emulator lokal.