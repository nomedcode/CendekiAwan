# Analisis Model Layanan Cloud — CendekiAwan

Dokumen ini menjawab LO 1 (a–c) untuk proyek **CendekiAwan**.

## a. Profil dan alasan pemilihan proyek

| Butir | Jawaban |
|---|---|
| Nama proyek | **CendekiAwan** |
| Kategori | Web (dashboard operasional / CloudOps) |
| Masalah | Emulator AWS lokal (Floci/LocalStack) hanya menyediakan API dan CLI. Tidak ada cara cepat untuk melihat apakah queue bertambah, objek masuk bucket, atau Lambda benar-benar terpanggil. |
| Target pengguna | Mahasiswa dan pengembang yang belajar AWS tanpa akun cloud; lab cloud kampus. |
| MVP | Satu halaman yang menampilkan state live SQS, S3, SNS, DynamoDB, dan Lambda, plus tombol aksi yang langsung mengubah state. |
| Motivasi | Relevan dengan peran **Cloud/DevOps Engineer** dan **Backend Engineer**: Docker, orkestrasi multi-container, observability, dan integrasi SDK AWS. |

**Requirement teknis dan biaya.** Semua berjalan di Docker Desktop di laptop; tanpa akun
cloud, tanpa auth token, **target biaya Rp0**. Emulator memakai kredensial dummy sehingga
tidak ada risiko tagihan tak sengaja. Kebutuhan sumber daya: ±4 GB RAM untuk Docker.

**Data dan kepatuhan (UU No. 27 Tahun 2022).** Aplikasi hanya menyimpan **audit aksi**
(nama aksi, nama resource, status, waktu) dan **snapshot metrik angka**. Tidak ada data
pribadi, tidak ada email, tidak ada identifier pengguna. Karena itu tidak ada kewajiban
persetujuan subjek data; yang tetap dijaga adalah prinsip minimalisasi dan keamanan
penyimpanan (kredensial tidak di-commit; `.env` di-`.gitignore`). Fitur Supabase (yang
akan menyimpan email) sengaja **tidak dipakai** meskipun tersedia sebagai bonus.

**Karakteristik esensial NIST (SP 800-145).** Yang paling dibutuhkan proyek ini adalah
**on-demand self-service**: resource dibuat dan diubah lewat UI tanpa interaksi manusia di
sisi penyedia. Karakteristik pendukung: **measured service** — dashboard menampilkan
metrik dan histori pemakaian.

## b. Perbandingan lima model layanan

| Model | Tingkat abstraksi | Dikelola sendiri | Dikelola penyedia | Contoh penyedia nyata | Cocok untuk proyek ini? |
|---|---|---|---|---|---|
| **IaaS** | Rendah | OS, runtime, aplikasi, data, patching | Hardware, jaringan, virtualisasi | Amazon EC2, VPS | **Tidak.** Terlalu banyak operasional untuk aplikasi demo satu halaman. |
| **PaaS** | Sedang | Aplikasi dan data | OS, runtime, scaling, deployment | AWS App Runner, Google Cloud Run, Railway | **Ya.** Paling pas untuk memindahkan backend/frontend ke cloud. |
| **SaaS** | Tinggi | Hanya konfigurasi | Seluruh aplikasi | Gmail, Notion, Slack | **Tidak.** Proyek ini dibangun sendiri, bukan memakai produk jadi. |
| **BaaS** | Tinggi (API) | Skema data dan policy | Auth, database, storage | Supabase, Firebase | **Ya, opsional.** Cocok untuk auth + RLS, tetapi menambah ketergantungan internet dan data pribadi. |
| **FaaS** | Tinggi (fungsi) | Kode fungsi | Server, scaling, runtime | AWS Lambda, Cloud Functions | **Ya.** Dipakai untuk memproses event queue di dalam emulator. |

## c. Model deployment dan rekomendasi

**Pengertian singkat.**

- **Public cloud** — infrastruktur dimiliki penyedia dan dipakai bersama banyak pelanggan
  lewat internet (AWS, GCP, Azure).
- **Private cloud** — infrastruktur khusus satu organisasi, dikelola internal atau pihak
  ketiga.
- **Hybrid** — sebagian workload di private cloud, sebagian di public cloud, terhubung
  jaringan dan identitas bersama.
- **Multi-cloud** — memakai dua atau lebih public cloud sekaligus untuk menghindari
  ketergantungan pada satu vendor.

**Jika proyek dipindahkan dari localhost ke cloud.** Kombinasi yang paling tepat:

- **Public cloud** sebagai deployment model (biaya awal nol, tidak perlu membeli hardware).
- **PaaS** untuk backend (AWS App Runner / Cloud Run) dan frontend (static hosting + CDN).
- **Managed database** (Amazon RDS for PostgreSQL) dan **object storage** (Amazon S3).
- **Model harga: pay-as-you-go** untuk fase demo, dengan **free tier** sebagai pengaman
  biaya. **Reserved instance** tidak masuk akal untuk beban yang belum stabil, dan **spot
  instance** tidak cocok untuk backend yang harus selalu hidup (bisa dihentikan kapan saja).

**Dua trade-off utama.**

1. **Vendor lock-in.** Memakai layanan khas AWS (App Runner, RDS, Lambda) mempersulit
   pindah vendor. Mitigasi: aplikasi tetap berupa container Docker, konfigurasi lewat
   environment variable, dan akses AWS hanya lewat SDK standar (boto3).
2. **Cold start dan batas free tier.** Lambda/PaaS bisa lambat pada permintaan pertama, dan
   free tier punya kuota jam/bulan. Mitigasi: satu instance backend yang selalu hidup untuk
   demo, dan pemantauan biaya sejak awal.

**Peran Docker dalam perpindahan.** Seluruh aplikasi sudah dikemas sebagai image
multi-stage (`backend` dan `frontend`) dengan tag versi `1.0.0` dan `latest` di Docker Hub.
Image yang sama menjalankan versi lokal dan versi cloud, sehingga perpindahan hanya
mengganti cara menjalankan container (Compose → App Runner/ECS), bukan mengubah kode.