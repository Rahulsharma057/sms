# Duty Officer Inspection & Task Management System

Full-stack app: **Next.js + MUI** (frontend) and **Node/Express + MongoDB (Mongoose)** (backend), with JWT auth.

## Features
- Login/Logout (JWT, httpOnly cookie + localStorage token)
- Two roles: **teacher** and **superadmin**
- Each teacher logs in with their own email and only sees their own reports
- Superadmin has a dashboard with a table of ALL reports (filter by teacher), stats cards, and report detail view
- Daily "Duty Officer's Inspection Checklist" form (matches the uploaded checklist: Morning / Mid-day / Afternoon checks, Summary of observations, Urgent matters, Signature/Countersign) — teachers fill this daily
- Task assignment: superadmin can create a task and assign it to a teacher
- Per-task chat: both superadmin and the assigned teacher can send messages back and forth about a task
- Task status tracking: pending / in-progress / completed (teacher can update status; superadmin can see it live)
- Mobile-responsive UI (MUI breakpoints + hamburger menu on small screens)

## Folder structure
```
sms/
  backend/     -> Express + MongoDB API (port 5001)
  frontend/    -> Next.js + MUI app (port 3000)
```

## 1. Backend setup
```bash
cd backend
npm install
```

`.env` is already filled in with the Mongo URI and JWT secret you provided:
```
PORT=5001
MONGODB_URI=...
JWT_SECRET=...
CLIENT_URL=http://localhost:3000
```

> ⚠️ **Security note:** you shared your real MongoDB connection string and JWT secret in plain text.
> Since these were pasted in a chat, please **rotate the MongoDB user's password** in Atlas (Database Access → Edit user) and change `JWT_SECRET` to a new random string before going to production, then update `.env` accordingly. Never commit `.env` to a public GitHub repo (a `.gitignore` is already included).

Create the first Superadmin account:
```bash
npm run seed -- admin@school.com "Admin@123" "Super Admin"
```
This prints the login email/password for the superadmin. (You can also just run `npm run seed` to use the defaults: `admin@school.com` / `Admin@123`.)

Start the backend:
```bash
npm run dev
# or: npm start
```
API runs at `http://localhost:5001/api`.

## 2. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
App runs at `http://localhost:3000`. It talks to the backend via `NEXT_PUBLIC_API_URL` in `.env.local` (already set to `http://localhost:5001/api`).

## 3. Using the app
1. Go to `http://localhost:3000/login` and log in as **superadmin** (the account you seeded).
2. Superadmin → **Teachers** page → **Add Teacher** to create login accounts for each teacher (name, email, temporary password).
3. Share those credentials with each teacher. Teachers log in and see only their own dashboard/reports.
4. Teachers → **New Report** → fill the daily checklist → **Save report**.
5. Superadmin → **Dashboard** → see all reports in one table, filter by teacher, click a row for full details.
6. Superadmin → **Tasks** → **Assign New Task** to a teacher → chat with them about it; teacher sees it under **My Tasks**, can reply and update status.

## API summary
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/login | public |
| POST | /api/auth/logout | logged in |
| GET | /api/auth/me | logged in |
| POST | /api/users | superadmin (create teacher) |
| GET | /api/users/teachers | superadmin |
| PATCH | /api/users/:id/toggle-active | superadmin |
| POST | /api/reports | teacher (create daily report) |
| GET | /api/reports/mine | teacher |
| GET | /api/reports | superadmin (all, ?teacher=&from=&to=) |
| GET | /api/reports/:id | owner or superadmin |
| POST | /api/tasks | superadmin |
| GET | /api/tasks/mine | teacher |
| GET | /api/tasks | superadmin |
| GET | /api/tasks/:id | owner or superadmin |
| PATCH | /api/tasks/:id/status | owner or superadmin |
| POST | /api/tasks/:id/messages | owner or superadmin (chat) |

## Notes
- `node_modules` is **not** included in this zip — run `npm install` in both `backend` and `frontend` folders first.
- Built with Next.js 14 (App Router), MUI v5, Mongoose 8.
