## Live Backend (API)

`https://classroom-backend-production-364b.up.railway.app/api/`

This is the public REST API base URL used by the frontend.

---

## Classroom Backend

This is the **Node.js + Express + TypeScript** backend for the Classroom demo application. It provides:

- **Authentication** using **Better-Auth** (email/password strategy, cookie-based sessions).
- **Role-based access control** for `admin`, `teacher`, and `student` roles.
- RESTful endpoints for **users**, **classes**, **subjects**, **departments**, **enrollments**, and **stats**.
- Rate limiting and bot protection via **Arcjet**.
- **Drizzle ORM** + **Neon** (PostgreSQL) for data access.

### Tech Stack

- **Node.js**, **Express**
- **TypeScript**
- **Drizzle ORM** (Neon PostgreSQL)
- **Better-Auth** (auth + session management)
- **Arcjet** (security + rate limiting)

### Key Endpoints (Overview)

- `POST /api/auth/sign-in` / `sign-up` – handled by Better-Auth.
- `GET /api/classes` – list classes (search, filters, pagination).
- `POST /api/classes` – create class (teacher/admin only; teacher can only create for themselves).
- `GET /api/classes/:id/users` – class roster; authorization rules:
  - **Admin:** can see all.
  - **Teacher:** can only see rosters for classes they teach.
  - **Student:** can only see student roster when they are enrolled.
- `POST /api/enrollments` – student enrolls in a class (enforced on server by `req.user.id`).
- `POST /api/enrollments/join` – student enrolls by invite code.
- `GET /api/subjects`, `POST /api/subjects` – subject listing and (demo-bypass) creation.
- `GET /api/departments`, `POST /api/departments` – department listing and (demo-bypass) creation.

### Security & Auth Highlights

- **Better-Auth session cookies** configured with:
  - `sameSite: "none"` and `secure: true` for cross-origin frontend/backend setups.
- `attachUser` middleware:
  - Reads the Better-Auth session and attaches `{ id, role }` to `req.user` when present.
- `requireAuth` and `requireRole` middleware:
  - Used on sensitive routes to enforce authentication and role checks.
- **Arcjet** `securityMiddleware`:
  - Rate-limits requests by role (`guest`, `student`, `teacher`, `admin`).
  - Uses a relaxed limit for `GET` endpoints to keep dropdowns and dashboards responsive.

### Database & Seeding

- **Database:** Neon PostgreSQL, accessed via Drizzle ORM.
- **Schema:** contained under `src/db/schema` with an index barrel file for imports.
- **Seed script:** `seed/seed.ts`
  - Loads `seed/data.json`.
  - Hashes user passwords using Better-Auth’s `hashPassword`.
  - Inserts users, accounts, departments, subjects, classes, and enrollments (in that order).

Run the seed locally with:

```bash
cd classroom-backend
npm run db:seed
```

### Getting Started (Local)

1. Install dependencies:

```bash
cd classroom-backend
npm install
```

2. Configure environment variables (example):

```env
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...
FRONTEND_URL=http://localhost:5173
```

3. Run the dev server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

### Demo Accounts (for Frontend Login)

The seed data defines users like:

- **Admin:** `admin@gmail.com` / `admin123`
- **Teacher(s):** `teacher_1` etc. (see `seed/data.json`)
- **Student(s):** `student_1` etc. (see `seed/data.json`)

These accounts are used in demos to showcase role-based pages and permissions.

