# Deployment Guide — Task Manager

Deploy ke VM produksi pakai Docker Compose + Cloudflare Tunnel. Tidak perlu
buka port apa pun di VM, HTTPS otomatis ditangani Cloudflare di edge.

## Prasyarat

| Item | Catatan |
|---|---|
| VM Ubuntu 22.04 / 24.04 LTS | SSH access dengan user yang bisa sudo |
| Domain di Cloudflare | Domain yang nameserver-nya sudah di Cloudflare |
| Akun Google Cloud | Untuk OAuth Client (gratis) |
| ~5 GB disk free | Image Docker + DB + uploads awal |

---

## 1. Siapkan VM (sekali setup)

SSH ke VM, install Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Supaya bisa jalankan docker tanpa sudo
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

Verifikasi: `docker run hello-world` harus jalan tanpa sudo.

---

## 2. Clone aplikasi

```bash
sudo mkdir -p /opt/taskmanager
sudo chown "$USER":"$USER" /opt/taskmanager
git clone <url-repo-anda> /opt/taskmanager
cd /opt/taskmanager
```

Kalau Anda transfer manual via scp, tidak perlu `git clone`:
```bash
# Dari laptop Anda
rsync -avz --exclude node_modules --exclude .env \
  /home/xsecnet/taskmanager/ user@vm-ip:/opt/taskmanager/
```

---

## 3. Buat Cloudflare Tunnel

1. Buka https://one.dash.cloudflare.com → **Networks → Tunnels → Create a tunnel**
2. Pilih **Cloudflared** → **Next**
3. Beri nama (mis. `taskmanager`) → **Save**
4. Pilih **Docker** sebagai connector → **copy token-nya** (panjang, dimulai dengan `eyJ...`)
5. Jangan jalankan command-nya, kita yang akan urus via compose
6. **Next → Public Hostnames**:
   - Subdomain: `taskmanager` (atau nama yang Anda mau)
   - Domain: pilih domain Anda
   - Path: kosongkan
   - Service Type: `HTTP`
   - URL: `frontend:80`
7. **Save tunnel**

Sekarang Anda punya domain seperti `https://taskmanager.contoh.com` yang akan
otomatis di-route ke container `frontend` saat tunnel aktif.

---

## 4. Buat OAuth Client di Google Cloud

1. https://console.cloud.google.com → buat project baru atau pakai yang ada
2. **APIs & Services → Library** → enable **Gmail API** dan **Google Calendar API**
3. **OAuth consent screen** → External, isi nama app + email, scopes:
   - `userinfo.email`, `userinfo.profile`
   - `gmail.send`, `calendar.events`
4. **Credentials → Create OAuth client ID** → Web application
5. **Authorized redirect URIs**:
   ```
   https://taskmanager.contoh.com/api/auth/google/callback
   ```
   (ganti dengan domain Anda)
6. Copy **Client ID** dan **Client Secret**

---

## 5. Generate VAPID keys (untuk push notification)

Di VM:
```bash
docker run --rm node:20-alpine npx -y web-push generate-vapid-keys
```
Catat **Public Key** dan **Private Key**.

---

## 6. Konfigurasi `.env`

```bash
cd /opt/taskmanager
cp .env.production.example .env
nano .env
```

Yang harus diisi:

| Variabel | Nilai |
|---|---|
| `APP_URL`, `API_URL` | `https://taskmanager.contoh.com` (sama persis) |
| `JWT_SECRET` | Hasil `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | Password kuat |
| `DATABASE_URL` | Match dengan user/password di atas |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Dari step 4 |
| `GOOGLE_REDIRECT_URI` | URL callback yang sama dengan di Google Console |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Dari step 5 |
| `VAPID_SUBJECT` | `mailto:admin@contoh.com` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Dari step 3 |

---

## 7. Launch

```bash
cd /opt/taskmanager
docker compose up -d --build
```

Pertama kali agak lama (build images, download MySQL, dll). Tunggu sampai
selesai, lalu cek status:

```bash
docker compose ps
```

Semua service harus `Up`. Cek log:

```bash
docker compose logs -f --tail=50
```

Yang Anda harapkan:
- `tm_mysql`: `[Server] /usr/sbin/mysqld: ready for connections`
- `tm_backend`: `[api] listening on http://localhost:4000`
- `tm_worker`: `[worker] reminder worker started`
- `tm_cloudflared`: `Registered tunnel connection`

Buka di browser: `https://taskmanager.contoh.com` → halaman login muncul.

---

## 8. Login pertama

User pertama yang login Google otomatis jadi `ADMIN_PROJECT`. Kalau Anda
sebelumnya pernah seed `admin@example.com` di dev, di production tidak ada
seed (Prisma `migrate deploy` tidak menjalankan seed). Login Anda langsung
jadi admin.

---

## Operasional harian

### Lihat log

```bash
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f cloudflared
```

### Restart 1 service

```bash
docker compose restart backend
```

### Update aplikasi (deploy versi baru)

```bash
cd /opt/taskmanager
git pull            # atau rsync ulang dari laptop
docker compose build backend frontend
docker compose up -d
docker compose exec backend npx prisma migrate deploy   # jika ada migration baru
```

### Backup database

Manual:
```bash
./scripts/backup-mysql.sh
ls -lh backups/
```

Otomatis (cron tiap jam 02:00):
```bash
crontab -e
# Tambahkan:
0 2 * * * cd /opt/taskmanager && ./scripts/backup-mysql.sh >> backups/backup.log 2>&1
```

Backup `.sql.gz` ada di folder `backups/`. Saya sarankan rsync folder ini
ke storage eksternal (S3, NAS, dll) tiap malam.

### Restore database

```bash
./scripts/restore-mysql.sh backups/taskmanager-20260520-020000.sql.gz
```

Akan minta konfirmasi `yes`.

### Backup file upload

File attachment task ada di volume `uploads_data`. Backup dengan:

```bash
docker run --rm \
  -v taskmanager_uploads_data:/data \
  -v "$(pwd)/backups:/backup" \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

---

## Troubleshooting

**Tunnel "down" di Cloudflare Dashboard**
- `docker compose logs cloudflared` — cek pesan error
- Token salah atau expired? Generate ulang di Cloudflare Dashboard
- VM tidak bisa keluar internet ke `*.cloudflare.com`? Cek firewall outbound

**Login Google: redirect_uri_mismatch**
- `GOOGLE_REDIRECT_URI` di `.env` harus persis sama dengan yang di
  Google Console — termasuk `https://`, subdomain, dan path.
- Setelah ubah `.env`, harus `docker compose up -d` (bukan restart) agar
  env baru ke-load.

**Push notification tidak masuk**
- VAPID keys di `.env` benar dan backend sudah restart sejak diisi
- User sudah klik "Aktifkan" di drawer notifikasi dan grant permission
- HTTPS aktif (push browser hanya jalan di HTTPS — ini otomatis lewat Cloudflare)

**Backend tidak konek ke MySQL**
- `DATABASE_URL` host harus `mysql` (nama service), bukan `localhost`
- Cek `docker compose logs mysql` — kadang user/password salah, butuh
  `docker compose down -v` (hati-hati: ini hapus data!) lalu setup ulang

**Frontend muncul tapi semua API 502**
- `docker compose logs backend` — cek apakah crash saat start
- Migration belum dijalankan? `docker compose exec backend npx prisma migrate deploy`

**Disk penuh karena image lama**
```bash
docker system prune -a --volumes
```
(hati-hati: ini hapus semua image yang tidak terpakai. Pastikan stack lain di
VM ini tidak terpengaruh.)

---

## Hardening tambahan (opsional)

- **Cloudflare Access**: di tunnel hostname, aktifkan "Zero Trust Access"
  supaya user harus login Cloudflare Identity dulu sebelum akses domain.
  Berguna kalau ini benar-benar internal.
- **Email-based access policy**: di Cloudflare Access, batasi domain email
  yang boleh login (mis. hanya `@perusahaan.com`).
- **Backup ke remote**: pasang `rclone` di VM, sync `/opt/taskmanager/backups/`
  ke S3/B2/GDrive setiap malam.
- **Monitoring**: pasang Uptime Kuma di VM yang sama (port internal saja),
  monitor `https://taskmanager.contoh.com/api/health`.
- **Log rotation**: Docker default rotate log per 10MB, 3 file. Cukup untuk
  most cases. Sesuaikan di `/etc/docker/daemon.json` kalau perlu.

---

## Estimasi resource

Stack lengkap (idle):
- RAM: ~600 MB
- Disk: 1.5 GB image + 200 MB DB awal + uploads
- CPU: <1% di idle

Untuk 30-50 user aktif sehari-hari, 2 vCPU + 4 GB RAM lebih dari cukup.
