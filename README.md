# EMR Appointment Management System

Appointment management module for an Enterprise EMR, built on the MERN stack.

> Work in progress. The backend API is complete and tested; the React frontend and the
> full documentation (architecture, database design, API reference, ENGINEERING_DECISIONS.md)
> are in progress.

## Quick start (backend)

Requirements: Node.js 20+, and either Docker or a MongoDB Atlas connection string.

```bash
# 1. Database (single-node replica set so transactions work)
docker compose up -d mongo

# 2. API
cd backend
cp .env.example .env        # then set the two JWT secrets
npm install
npm run seed                # departments, staff accounts, schedules, sample patients
npm run dev                 # http://localhost:5000
```

Seeded accounts (password `Password@123`):

| Role | Email |
|---|---|
| Super Admin | admin@emr.local |
| Receptionist | reception@emr.local |
| Doctor | arjun.mehta@emr.local, kavya.iyer@emr.local, rohan.das@emr.local |

## Tests

```bash
cd backend
npm test     # spins up an in-memory MongoDB replica set; no external DB needed
```
