# Engineering Decisions

This document explains the reasoning behind the main technical choices. Details of the schema
and API live in [docs/DATABASE.md](docs/DATABASE.md) and [docs/API.md](docs/API.md).

---

## 1. Why this project architecture?

### Monorepo with `backend/` and `frontend/`

One repository keeps the API contract, the client that consumes it, the docs and the Docker
setup versioned together. A change to an endpoint and the matching UI change land in the same
commit and review.

### Layered backend

```
request → route → validate (Zod) → authenticate → authorize(roles) → controller → service → model
                                                                                      ↓
                                                         domain event → Socket.IO / audit log
```

| Layer | Responsibility | Must not |
|---|---|---|
| `routes/` | URL → middleware chain → controller. Declares *who* may call *what*. | Contain logic. |
| `validators/` | Zod schemas for `params`, `query`, `body`. Coerce and sanitise input. | Touch the database. |
| `middlewares/` | Cross-cutting concerns: auth, RBAC, validation, rate limiting, errors. | Know about appointments. |
| `controllers/` | Translate HTTP ↔ service call ↔ response envelope. 3–6 lines each. | Contain business rules. |
| `services/` | **All business rules**: slot validity, status workflow, ownership scoping, transactions, auditing, publishing events. | Read `req`/`res`. |
| `models/` | Schema, indexes, serialisation rules (e.g. hide `passwordHash`). | Contain workflows. |
| `utils/` | Pure helpers: time maths, pagination, response envelope, `ApiError`, transaction wrapper, event bus. | Have side effects. |

Why this split:

- **Testable.** Services take plain arguments, so business rules can be exercised without HTTP;
  `slotGenerator.js` is a pure function with its own unit tests.
- **Reusable.** The same `createAppointment` service could be called from a queue consumer or a
  CLI without change.
- **Reviewable.** A reviewer reads one route file to see every permission rule, and one
  service file to see every business rule for that resource.

### Decoupling side effects with a domain event bus

Services emit `domainEvents.emit('appointment', …)` after a successful write. The Socket.IO
module subscribes to it. The appointment service has no idea WebSockets exist, so replacing
Socket.IO with Redis pub/sub or Kafka later touches only the subscriber.

### Consistency by construction

- **One response helper** (`sendSuccess` / `sendError`) produces every response, so the
  `{ success, message, data, meta }` envelope cannot drift between endpoints.
- **One error class** (`ApiError`) for expected failures and **one error handler** that maps
  everything else (Mongoose validation, cast errors, duplicate keys, bad JSON) to the right
  status. Unknown errors become a generic 500 and are logged with full detail server-side.
- **Express 5** forwards rejected promises from async handlers to the error handler natively,
  so no `asyncHandler` wrapper or try/catch boilerplate is needed in controllers.

### Configuration

All configuration comes from environment variables, validated at boot with a Zod schema
(`config/env.js`). A missing or weak secret (under 32 characters) stops the process
immediately with a readable message, instead of failing on the first request.

---

## 2. How did you design the MongoDB schema?

Full detail, a diagram and sample documents are in [docs/DATABASE.md](docs/DATABASE.md). The key
decisions:

1. **Reference the big entities, don't embed them.** Patients, doctors and appointments grow
   without bound and are queried from different directions (a doctor's day, a patient's
   history, the global list), so appointments live in their own collection and reference the
   others.
2. **Denormalise exactly what the hot path needs.** Each appointment stores a small
   `patientSnapshot` (code, name, mobile) and `doctorSnapshot` (name). The appointment list
   then searches and renders from one collection with no `$lookup` (join). The cost is that a
   later name correction does not update old appointments automatically; this is accepted and
   documented.
3. **Store the schedule, compute the slots.** A weekly template per doctor (`doctorschedules`)
   instead of materialised slot documents. Changing working hours is a single-document update,
   and there is no slot table to keep in sync. The *only* persisted fact about a slot is the
   appointment that holds it.
4. **Timezone-proof time model.** `date` is a `YYYY-MM-DD` string in the clinic timezone, and
   times are integer minutes since midnight. A 09:00 slot is 09:00 whatever the server's
   timezone, string dates sort and range-query correctly, and slot arithmetic is integer maths.
5. **Soft state, not deletes.** Appointments are never deleted. Cancelling flips `status` and
   `holdsSlot`, preserving history for audit and reporting.
6. **Human-friendly patient IDs.** `PT-000042`, generated from an atomic counter
   (`findOneAndUpdate` with `$inc`), inside the booking transaction.
7. **Mobile is not unique.** Family members commonly share a phone number; uniqueness is on
   `patientCode`.

---

## 3. How did you prevent double booking?

### The guarantee lives in the database

```js
appointmentSchema.index(
  { doctor: 1, date: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true } },
);
```

When two receptionists book the same slot at the same moment:

1. Both requests pass validation and the "is this a real, future slot?" check.
2. Both attempt to insert an appointment.
3. MongoDB applies the unique index atomically: the first insert wins, and the second fails
   with duplicate-key error `E11000`.
4. The service maps `E11000` on that index to **409 `SLOT_ALREADY_BOOKED`** with a
   human-readable message.

### Why this approach rather than the alternatives

| Approach | Problem |
|---|---|
| "Check if the slot is free, then insert" in application code | Race condition: both requests read "free" before either writes. |
| In-process lock or mutex | Breaks as soon as a second API instance runs. |
| Distributed lock (Redis) | Extra infrastructure and failure modes (lock expiry, crashes while holding a lock) to solve a problem the database already solves. |
| Materialised slot documents with `findOneAndUpdate({ booked: false })` | Works, but requires pre-generating and maintaining slot documents. |
| **Unique index** | Atomic, works across any number of API instances, zero extra infrastructure, enforced even if a future code path forgets to check. |

### Details that make it correct

- **Partial index on `holdsSlot: true`.** Cancelled appointments drop out of the index, so a
  cancelled slot can be re-booked while the cancelled record stays for history. A dedicated
  boolean is used because partial index filters do not support `$ne`/`$nin`.
- **Transaction for new patients.** Registering a new patient and creating the appointment run
  in one MongoDB transaction. If the booking loses the race, the patient insert is rolled back,
  so there are no orphan patients. On a standalone MongoDB (no replica set, so no
  transactions) the code detects this once at runtime and falls back to deleting the patient
  it just created; the unique index still guarantees no double booking either way.
- **Write conflicts inside transactions** (two transactions inserting the same key) are
  labelled `TransientTransactionError` by MongoDB. The driver's `withTransaction` retries them,
  and the retry then hits the unique index cleanly.

### Proof

`tests/appointments.test.js` fires **10 simultaneous booking requests for the same slot**,
each registering a different new patient, and asserts:

- exactly 1 response is `201` and 9 are `409 SLOT_ALREADY_BOOKED`;
- exactly 1 appointment exists in the database;
- exactly 1 patient exists, so the 9 losing transactions rolled back.

### The same idea applied to every state change

Arrive, cancel, complete and edit all use `findOneAndUpdate({ _id, status: <status we
validated> }, …)`. If another user changed the appointment in between (for example one cancels
while another marks arrival), the filter no longer matches and the second user gets
**409 `STALE_APPOINTMENT`** instead of silently overwriting. This is optimistic concurrency
control without a version field.

---

## 4. Which indexes did you create and why?

The complete table is in [docs/DATABASE.md](docs/DATABASE.md#indexes). The reasoning:

- **Correctness index.** `{ doctor, date, slotStart }` unique and partial. This is the
  double-booking guarantee, not just a performance aid.
- **Compound indexes follow ESR (Equality → Sort → Range).** For example
  `{ status: 1, date: -1 }` serves "status = X, sorted by date, within a date range" with an
  index scan and no in-memory sort. `{ department: 1, date: -1 }` does the same for the
  department filter.
- **`{ doctor: 1, date: 1 }`** serves the most frequent query in the system: building the slot
  grid for a doctor's day. It is also the doctor's own list (every doctor query is forced to
  `doctor = me`).
- **`{ date: -1, slotStart: 1 }`** matches the default list sort exactly, so the unfiltered list
  for admins needs no sort stage.
- **Search indexes on the snapshots** (`patientSnapshot.searchName`, `.mobile`, `.patientCode`,
  `doctorSnapshot.searchName`). Combined with *anchored, lower-cased prefix regexes*
  (`/^anil/`), searches walk the index instead of scanning. Case-insensitive regexes
  (`/anil/i`) cannot use an index efficiently, which is why a lower-cased `searchName` copy
  is stored.
- **Security and housekeeping indexes.** Unique `users.email`; unique `refreshtokens.tokenHash`
  for O(log n) token lookup; `refreshtokens.family` to revoke a stolen session family in one
  update; a **TTL index** on `refreshtokens.expiresAt` so expired tokens delete themselves.
- **Audit indexes** match the questions an auditor asks: "what happened to this record"
  (`entity, entityId, timestamp`) and "what did this user do" (`user, timestamp`).

What was **not** indexed, and why: free-text fields (`purpose`, `notes`), which are never
filtered on, and `appointments.createdBy`, which has no query pattern yet. Every index slows
writes and uses RAM, so each one must earn its place.

In production `autoIndex` is disabled and indexes are built by `npm run db:indexes` as a
deploy step, so a large index build never blocks application start-up.

---

## 5. What security measures did you implement?

### Authentication

| Measure | Detail |
|---|---|
| Password hashing | bcrypt, cost 12 (configurable). Passwords limited to 72 characters, bcrypt's input limit, so long inputs are not silently truncated. |
| Short-lived access token | 15-minute JWT (HS256, issuer-checked, algorithm pinned to prevent `alg` confusion), sent as a Bearer header. The React client keeps it in memory only (never `localStorage`), so XSS cannot steal a long-lived credential. |
| Refresh token in an httpOnly cookie | Not readable by JavaScript; `Secure` in production; `SameSite` configurable; `Path=/api/v1/auth`, so it is not sent with ordinary API calls. |
| Refresh tokens stored hashed | Only SHA-256 hashes are in the database; a DB leak yields no usable tokens. |
| Rotation and reuse detection | Each refresh revokes the old token atomically and issues a new one in the same *family*. Presenting a rotated token again is treated as theft: **the whole family is revoked** and the event is audited (`TOKEN_REUSE_DETECTED`). |
| Logout invalidation | Revokes the refresh token server-side and clears the cookie. Works even when the access token has already expired. |
| No user enumeration | Unknown email and wrong password return the same message, and a bcrypt comparison runs against a dummy hash for unknown emails so response times match. |
| Disabled accounts | `isActive: false` blocks login and refresh. |
| Brute-force protection | Login/refresh limited to 20 requests per 15 minutes per IP; the general API limit is 1000 per 15 minutes. Failed logins are audited. |

### Authorization (RBAC)

- **Route level:** `authorize(...roles)` on every protected route; the full matrix is visible
  in the route files.
- **Data level:** doctors are scoped to `doctor = me` *inside the service*, so the rule holds no
  matter which filters the client sends. Another doctor's appointment returns **404** rather
  than 403, so the API does not confirm that it exists.
- **Field level:** receptionists can edit `purpose`/`notes`; only the treating doctor can write
  `consultationNotes`.
- **Privilege escalation blocked:** the API cannot create Super Admins, only the seed script
  can.
- **WebSockets** use the same access token in the handshake, and doctors can only subscribe to
  their own calendar.

### Input and output

- **Validation:** every `params`, `query` and `body` passes through a Zod schema. Unknown keys
  are stripped, values are coerced to the expected types, and ids, dates, times, mobile
  numbers and emails are validated.
- **NoSQL injection:** because input is parsed into typed values, a payload such as
  `{ "email": { "$gt": "" } }` fails validation instead of reaching a query. Mongoose
  `strictQuery` is on. User-supplied regex input is escaped.
- **Sort injection:** sort keys come from an allow-list.
- **Request size:** JSON bodies are limited to 100 KB.
- **No sensitive data in responses:** `passwordHash` has `select: false` *and* is removed by the
  `toJSON` transform. Internal `searchName` fields are removed. Stack traces and internal error
  messages are never returned in production.
- **No PHI over WebSockets:** events carry only IDs, date, time and status; clients refetch
  through the authorised REST API.
- **Logging hygiene:** the logger redacts `Authorization` and `Cookie` headers and any
  password or token fields.

### Transport and headers

`helmet` sets secure headers (CSP, HSTS, `X-Content-Type-Options` and others), `x-powered-by`
is disabled, CORS allows only the configured origins with credentials, and `trust proxy` is set
in production so rate limiting sees the real client IP.

### Audit trail

Logins (successful and failed), logouts, token reuse, user creation, schedule changes, patient
registration and every appointment create, update, arrive, complete and cancel are written to
`auditlogs` with user, role, action, entity, entity id, metadata, IP and timestamp. Audit
writes run after the business write commits and never fail the request.

---

## 6. What performance optimisations did you apply?

### Backend

| Optimisation | Why it was necessary |
|---|---|
| Server-side pagination, filtering and sorting | The appointment collection grows every day; sending it all to the browser is not an option. |
| Indexes matched to every filter and sort (ESR) | Without them, every list request scans the collection and sorts in memory. |
| Denormalised snapshots on appointments | The list and search avoid a `$lookup` (a join) per request. |
| Anchored prefix search on lower-cased fields | Makes name and mobile search index-backed instead of a full scan. |
| Slot grid in a constant number of queries | A department view with 20 doctors still costs exactly 2 queries (`$in` on schedules, `$in` on that day's appointments), not 40. |
| `find()` and `countDocuments()` in parallel | Halves list latency compared with running them one after the other. |
| Projections on list queries | Only the columns the table shows go over the wire; notes and audit timestamps are detail-only. |
| `.lean()` on reads | Skips Mongoose document hydration, which noticeably cuts CPU and memory per request. |
| Slots computed, not stored | No slot collection to read, write or keep consistent; generating a day's grid is microseconds of integer maths. |
| Fire-and-forget audit writes | Auditing never adds latency to the user's request. |
| Targeted Socket.IO rooms | Doctors receive only events for their own appointments, and scheduler screens subscribe per doctor/department and day. Front-desk users also share one staff room so list screens stay current, which is acceptable because the payloads are tiny; at scale that room would be split per department. |
| Small, PHI-free socket payloads | Cheap to fan out; clients refetch only the query they display. |
| gzip `compression` | JSON lists compress well, often by around 80%. |
| TTL index on refresh tokens | MongoDB cleans up expired tokens itself; no cron job is needed. |
| `autoIndex` off in production | Index builds happen at deploy time, not at app start-up. |

### Frontend

**State management choice: TanStack Query plus a small Context, not Redux.** Almost every piece
of state here is a copy of server data (slots, appointments, doctors, stats). TanStack Query is
built for exactly that. It gives caching, request de-duplication, loading and error states,
retries, background refetching and targeted invalidation. Re-implementing those in Redux would
mean slices, thunks and hand-written cache keys for no gain. The only client-owned global
state is the login session, which is a few lines of React Context. Filter state lives in the
URL.

| Optimisation | Why it was necessary |
|---|---|
| **Targeted cache invalidation from socket events** | An event carries `{ date, doctorId, status }`, so the client invalidates only that date's slot queries plus the appointment and stat queries. TanStack Query then refetches only the queries currently on screen; nothing is refetched for screens that aren't open. |
| **Memoised slot cells** (`React.memo` with primitive props and stable `useCallback` handlers) | A busy scheduler shows several doctors with 20–30 slots each. When one slot changes, only that cell re-renders instead of the whole grid. |
| **`placeholderData: keepPreviousData`** on lists and slot grids | Changing page or date keeps the old content visible (dimmed) until new data arrives, with no flash of empty state and no layout jump. |
| **Debounced search** (300–350 ms) | Typing "anil" sends one request, not four. Patient search results are cached for 60 s. |
| **Sensible `staleTime`** | 30 s for operational data (sockets push real changes), 5 min for reference data (departments, doctors). Opening a dropdown does not trigger a request. |
| **No retries on 4xx** | Retrying a validation error, a 403 or a 404 never helps; only 5xx and network errors retry (twice). |
| **Route-level code splitting** (`React.lazy`) | The login page downloads only what it needs. Each page is a separate chunk of 1–4 KB gzipped, and the calendar library (~21 KB gzipped) loads only with pages that use it. |
| **Vendor chunking** | React (~96 KB gz), data libraries (~44 KB gz) and form libraries (~39 KB gz) are separate long-cacheable files, so an app-code deploy doesn't invalidate them. |
| **Single in-flight token refresh** | Ten requests failing with 401 at once trigger one refresh, not ten. This is required for correctness too, since the server treats a replayed refresh token as theft. |
| **Context values memoised** | `useMemo` on the auth context value stops every consumer re-rendering on unrelated parent renders. |
| **Stable modal effects** | The modal keeps `onClose` in a ref, so typing inside a dialog never re-runs its focus logic. Without this, each keystroke re-ran it and stole focus from the input. |
| **Filters in the URL** | Reloading, sharing or using back/forward restores the exact list view without extra state or requests. |

---

## 7. What would change to support millions of appointments?

The current design already avoids the most common scaling traps: no unbounded arrays, no
joins on hot paths, no per-slot documents, and concurrency enforced by the database rather
than by a single process. Growth would be handled in stages.

### Stage 1: scale the existing pieces (tens of millions of appointments)

- **Keyset (cursor) pagination** instead of `skip/limit`. `skip(100000)` still walks 100,000
  index entries; `?after=<date,slotStart,_id>` is constant-time for any page.
- **Approximate or cached counts.** `countDocuments` over millions of matches is expensive;
  show "1,000+" or cache counts per filter for a short time.
- **Horizontal API scaling** behind a load balancer. The API is already stateless (JWT,
  DB-enforced uniqueness). Socket.IO needs the **Redis adapter** so an event emitted on one
  instance reaches clients connected to another.
- **Replace the in-process event bus** with Redis pub/sub or a message broker, so events
  survive and fan out across instances.
- **Read replicas** for list, search and reporting queries (`readPreference: secondaryPreferred`),
  keeping the primary for bookings.
- **Redis cache** for schedules and doctor lists, which are read on every slot request and
  change rarely. Invalidate on `SCHEDULE_UPDATED`.

### Stage 2: partition the data (hundreds of millions of appointments, multiple hospitals)

- **Shard `appointments`** on `{ facilityId, doctor, date }` (or a hashed `doctor` plus `date`).
  The double-booking key `{ doctor, date, slotStart }` stays within one shard, so the unique
  constraint still holds. MongoDB requires unique indexes on sharded collections to be
  prefixed by the shard key, and this design satisfies that.
- **Multi-tenancy:** add `facilityId` to every collection and index prefix.
- **Hot/cold separation:** move appointments older than N months to an archive collection or
  Online Archive / data lake. Keep the operational collection small so its working set fits in
  RAM.
- **Audit logs** move to an append-optimised store (time-series collection, or ship them to
  Elasticsearch/OpenSearch or a SIEM) with a retention policy.

### Stage 3: separate workloads

- **Search** moves to Atlas Search or Elasticsearch for fuzzy and phonetic name matching
  across millions of patients. Prefix regex stops being good enough once typo tolerance
  matters.
- **Reporting and dashboards** read from a separate analytics store fed by Change Streams
  (CQRS), so heavy aggregations never compete with bookings.
- **Notifications** (SMS or email reminders) and other side effects run on queue workers
  consuming the domain events.
- **Observability:** distributed tracing (OpenTelemetry), metrics on booking conflicts and
  latency percentiles, and alerts on 409 spikes, which signal contention on popular doctors.

---

## Other notable decisions

| Decision | Reasoning |
|---|---|
| **Zod** for validation | One schema both validates and produces typed, coerced, stripped data. Clear error paths (`body.weeklySchedule.0.sessions.1`). The React forms use Zod 4 too (via React Hook Form), with the same rules re-declared on the client; see Known limitations in the README. |
| **Pino** for logging | Structured JSON logs (ready for any log aggregator), very low overhead, built-in redaction. Pretty-printed in development. |
| **Vitest + Supertest + mongodb-memory-server** | Tests run against a real MongoDB **replica set** in memory, so transactions and unique-index races behave exactly as in production, with no external dependency. |
| **`DELETE /appointments/:id` = cancel** | Medical records should not be hard-deleted. DELETE keeps the REST shape the spec asks for while preserving history. |
| **Extra endpoint `POST /:id/complete`** | The spec's workflow includes `COMPLETED`, and a doctor needs a way to close a consultation. |
| **Arrival only on or before the appointment date** | Prevents accidentally checking in next week's patient. |
| **Docker Compose runs MongoDB as a single-node replica set** | Gives transactions locally with zero manual setup, matching Atlas behaviour. |
