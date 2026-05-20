# Task Manager — Divisi Operasional

Aplikasi web untuk mengatur jadwal pekerjaan, update progress project, dan reminder
otomatis ke Email (Gmail) + Google Calendar untuk lima divisi:

- Network Engineer
- Network Security Engineer
- System Engineer
- Safety Driver
- Admin Project

## Tech stack

| Layer       | Teknologi                                              |
| ----------- | ------------------------------------------------------ |
| Frontend    | React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui |
| Backend     | Node.js 20 + Express + TypeScript + Prisma ORM         |
| Database    | MySQL 8                                                |
| Auth        | Google OAuth 2.0 (SSO) + JWT cookie                    |
| Reminder    | node-cron worker (email Gmail + Google Calendar API)   |
| Deploy      | Docker Compose (app + worker + mysql)                  |

## Struktur folder

```
taskmanager/
├── backend/        Express API + Prisma + reminder worker
├── frontend/       React SPA
├── docker-compose.yml
└── .env.example
```

## Setup singkat (development)

1. **Siapkan Google OAuth Client**
   - Buka https://console.cloud.google.com → APIs & Services → Credentials
   - Buat *OAuth 2.0 Client ID* tipe **Web application**
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
   - Aktifkan **Gmail API** dan **Google Calendar API**
   - Catat `CLIENT_ID` dan `CLIENT_SECRET`

2. **Konfigurasi env**
   ```bash
   cp .env.example .env
   # isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, dll.
   ```

3. **Jalankan dengan Docker**
   ```bash
   docker compose up -d --build
   docker compose exec backend npx prisma migrate deploy
   docker compose exec backend npm run seed
   ```

4. **Akses aplikasi**
   - Frontend: http://localhost:5173
   - Backend:  http://localhost:4000
   - MySQL:    localhost:3306

## Setup development manual (tanpa Docker)

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev          # API di :4000
npm run worker       # reminder worker terpisah

# Frontend
cd frontend
npm install
npm run dev          # SPA di :5173
```

## Role & izin

| Role                       | Akses                                            |
| -------------------------- | ------------------------------------------------ |
| ADMIN_PROJECT              | CRUD project, assign anggota, lihat semua divisi |
| NETWORK_ENGINEER           | Lihat & update task divisinya                    |
| NETWORK_SECURITY_ENGINEER  | Lihat & update task divisinya                    |
| SYSTEM_ENGINEER            | Lihat & update task divisinya                    |
| SAFETY_DRIVER              | Lihat & update task divisinya                    |

User pertama yang login otomatis menjadi `ADMIN_PROJECT`.

## Reminder

Setiap task bisa punya banyak reminder. Saat jatuh tempo:

1. Worker mengirim email HTML ke alamat Gmail user via Gmail API.
2. Worker membuat/update event di Google Calendar primary user (jika user
   sudah grant scope calendar saat login).

Reminder dijalankan tiap 1 menit oleh `node-cron`.
