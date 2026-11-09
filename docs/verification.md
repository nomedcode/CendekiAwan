# Bukti verifikasi: CendekiAwan

Semua perintah dijalankan di Windows 11 dengan Docker Desktop, dari akar repo.

## 1. Stack berjalan dan sehat

```bash
docker compose up -d --build
docker compose ps
```

Output ringkas:

```text
backend  | Up (healthy) | 8000/tcp
db       | Up (healthy) | 127.0.0.1:5432->5432/tcp
floci    | Up (healthy) | 127.0.0.1:4566->4566/tcp
frontend | Up (healthy) | 0.0.0.0:8080->80/tcp
redis    | Up (healthy) | 6379/tcp
```

## 2. Health dan endpoint baca

```bash
curl -i http://localhost:8080/health
curl -s http://localhost:8080/api/snapshot
```

```text
HTTP/1.1 200 OK
{"status":"ok","checks":{"db":"ok","emulator":"ok","redis":"ok"}}
```

`/api/snapshot` mengembalikan lima bagian (`sqs`, `s3`, `sns`, `dynamodb`, `lambda`)
dengan `status: ok` untuk kelimanya.

## 3. Endpoint tulis (status 201)

```bash
curl -i -X POST http://localhost:8080/api/actions/simulate \
  -H "Content-Type: application/json" -d '{"count":10}'
```

```text
HTTP/1.1 201 Created
{"action":"simulate","target":"cendekiawan-queue","sent":10}
```

Aksi lain yang diuji: `publish` (SNS ke SQS, fanout), `upload` (S3), `item` (DynamoDB),
dan `invoke` (Lambda; durasi ±54 ms pada invoke pertama setelah cold start).

Validasi input: `{"count":0}` dan `{"name":"not-our-queue"}` ditolak dengan 422. Body
dengan karakter NUL juga ditolak dengan 422, bukan 500.

## 4. Persistensi: `down` vs `down -v`

```bash
curl -X POST .../api/actions/item -d '{"count":2}'   # 201, 2 item
docker compose down
docker compose up -d
curl .../api/events?limit=200
curl .../api/snapshot
```

Hasil:

```text
events sebelum down : 11
events setelah up   : 11
DynamoDB item       : 5
S3 objek            : 3
SQS depth           : 26
```

Named volume `pgdata` dan `flocidata` sama-sama mempertahankan data.

`docker compose down` hanya menghentikan container; volume tetap ada.
`docker compose down -v` menghapus `pgdata`, `flocidata`, dan `rediscache`, sehingga
semua data demo hilang dan resource di-seed ulang saat start berikutnya.

## 5. Redis cache (bonus)

```bash
docker compose exec -T redis redis-cli config resetstat
# 25 request berturut-turut ke /api/snapshot
docker compose exec -T redis redis-cli info stats
```

```text
keyspace_hits:24
keyspace_misses:1
```

Cache dipakai (TTL 2 detik) dan healthcheck `redis-cli ping` aktif.

## 6. Build dan ukuran image

```text
dist/index.html                 0.78 kB
dist/assets/index-*.css         6.54 kB
dist/assets/index-*.js        234.66 kB (gzip 73.49 kB)

cendekiawan-backend:latest    381 MB
cendekiawan-frontend:latest   73.9 MB
```

Backend memakai multi-stage `builder → runtime` dan berjalan sebagai user non-root
(`uid 10001`). Frontend memakai `node:22-alpine` untuk build, lalu `nginx:1.27-alpine`
untuk runtime.

## 7. Tes otomatis

```bash
cd backend && pytest
```

```text
12 passed
```

Mencakup health, create/list event, rentang `limit`/`minutes`, validasi NUL, aksi dengan
nama resource tidak dikenal, aksi dengan `count` di luar rentang, aksi sukses beserta
audit, dan snapshot dari cache tanpa memanggil emulator.

## 8. Docker Hub

```text
bangdemon/cendekiawan-backend:1.0.0   OK
bangdemon/cendekiawan-backend:latest  OK
bangdemon/cendekiawan-frontend:1.0.0  OK
bangdemon/cendekiawan-frontend:latest OK
```

Diverifikasi ulang dengan `docker manifest inspect` setelah push.
