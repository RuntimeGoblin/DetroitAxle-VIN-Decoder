# VIN Decoder — Internal Platform

A full-stack tool for building, verifying, and owning a proprietary vehicle specification dataset — seeded from public decode APIs but made accurate through real agent work.

---

## What This Actually Does

Every time one of our agents looks up a VIN, the system decodes it, stores the result, and gives the agent a structured place to annotate it. Over time those annotations — part numbers, brake specs, listing corrections — become a dataset that belongs entirely to us. Nobody else has it because nobody else built it this way.

The backend is Go (Gin + GORM + PostgreSQL). The frontend is React + Vite + Tailwind. Authentication is JWT with refresh tokens. Everything communicates through a typed REST API with a consistent response envelope.

---

## The Build Key — Why It Matters

A full VIN is 17 characters. Most of those characters describe the individual car off the assembly line — the serial number, the plant it was built at, the model year check digit. What we actually care about is the *build* — the year, make, model, trim, and configuration.

We extract that as a 10-character **Build Key**: characters 1–8 and 10–11 of the VIN.

```
VIN:       1 G C U K P E C 3 8 G Z 1 0 5 5 5 4
Position:  1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7
                             ^       (skipped — check digit + sequence)
Build Key: 1 G C U K P E C   8 G  →  1GCUKPEC8G
```

Every single 2016 Chevy Silverado 1500 with a 6.2L V8 in crew cab configuration shares the same build key. It doesn't matter if the VIN ends in `105554` or `891201` — same build key, same record in our database.

This means:
- A part note added for one VIN applies to every vehicle of that exact build
- An agent who fixes a brake spec for one truck fixes it for all of them
- We never store duplicate specs for essentially the same vehicle

The first time a full 17-character VIN is searched and we don't have its build key yet, we call two APIs concurrently (auto.dev for make/model/trim, NHTSA for engine/brake system details), merge the results, and save one record. Every subsequent lookup for that build is instant and free.

---

## Data Collection — How It Works in Practice

### The Agent Workflow

When an agent talks to a customer and looks up their VIN:

1. The vehicle loads with whatever we know from the initial decode
2. The agent can add notes directly — a specific part number that fits, a free-text observation, a reported listing error
3. If they notice a spec is wrong (wrong displacement, wrong brake type), they can edit it inline
4. Every edit is logged automatically — who changed it, what it was before, what it is now

That's it. No training required. The data collection happens as a side effect of agents doing their normal job.

### Note Types

There are three kinds of notes, each serving a different purpose:

**Part Number Notes** — "This part fits this build." An agent adds a part number and optionally assigns it to a category (Front Brakes, Rear Suspension, etc.). This is the most valuable data we collect. Over time, a single vehicle record accumulates a list of known-good part numbers across every system.

**Free Text Notes** — General observations. "Customer said the 2018 models in this trim sometimes have a different caliper bracket." Things that don't fit in a structured field but are worth preserving.

**Listing Error Notes** — An agent flags something in the catalog that's wrong. Maybe a part is listed as compatible with a build that it doesn't actually fit. The listing team gets a queue of these to resolve, and each one has a resolution log so nothing disappears quietly.

### Where the Data Comes From

The initial vehicle specs come from auto.dev and NHTSA. Those are reasonable starting points but they're not always accurate for the specific fields our business cares about — rotor sizes, brake codes, spring types, exact transmission speeds. The public APIs give us a shell. Our agents fill in what actually matters.

That's the whole point. The auto.dev and NHTSA data is available to anyone. The layer on top of it — the part number associations, the corrected specs, the listing error history — isn't available to anyone. It's ours.

---

## Verification — Keeping the Data Honest

### The Trust System

Not every agent has the same level of confidence. A new agent might change a spec and be wrong. A senior tech who's handled thousands of these vehicles probably isn't.

Each user account has an `is_trusted` flag. When an untrusted agent edits a vehicle field, that change goes into the **VIN Update Queue** — it's applied to the vehicle immediately (so the agent's customer gets the right answer now), but it's flagged for review.

An admin reviews the queue, sees the old value, the new value, who made the change, and when. They can:
- **Verify it** — mark it as confirmed. That field is now locked; nobody can casually overwrite a verified value.
- **Correct and verify** — change it to the right value and lock it at the same time.
- **Leave it** — it stays in the queue until someone reviews it.

Trusted agents' edits skip the review queue. They still get logged (everything gets logged), but they don't require manual verification.

### The Field History

Every field change on every vehicle is stored permanently with full context — user ID, username, timestamp, old value, new value, trust level. You can reconstruct exactly how any spec ended up the way it is and who is responsible for each piece of it.

This matters for two reasons. One is accountability. If a customer gets the wrong part because a spec was wrong, we can trace exactly where that spec came from and who put it there. The second is data quality — over time, you can see which agents consistently make accurate edits and which ones need more oversight.

---

## Security

### Authentication

Every request to the API (other than login) requires a signed JWT. Tokens expire after one hour. The frontend automatically refreshes them using a 7-day refresh token so users aren't constantly asked to log back in. If a refresh fails, the session is cleared and the user lands back on the login page — no silent stale sessions.

Passwords are hashed with bcrypt before storage. The hashed password never appears in any API response.

### Role-Based Access

There are three roles:

| Role | What they can do |
|---|---|
| `agent` | Look up VINs, add notes, edit vehicle specs (edits go to review queue unless trusted) |
| `admin` | Everything above + manage users, review the update queue, see the admin dashboard |
| `listing` | Read-only access to listing error notes for catalog work |

The role check is enforced on the backend — the frontend hiding a button doesn't protect anything if the API doesn't check.

### Field-Level Permissions

Beyond roles, individual field edit permissions can be controlled per role. If you don't want the listing team to ever touch engine specs, that's a database-level restriction that gets checked on every PATCH request. It's not hardcoded — it's stored in `FieldPermission` records so it can be adjusted without a code deploy.

### What Doesn't Leave the Server

The `hashed_password` column has a `json:"-"` tag — it will never appear in any API response regardless of what the query returns. User usage counters (how many VINs they've decoded, how many notes they've written) are readable by admins but don't appear on regular user-facing endpoints.

---

## Who Uses This and How

### Customer Service Agents

An agent on a call types in the customer's VIN, gets the full build spec in under a second, and can immediately see every part number that's been associated with that vehicle. If a customer is asking about brake rotors and there are three part number notes from previous agents, all of that is right there. No digging through spreadsheets.

When the agent finds something new — a different caliper that fits this build — they add a note. Next agent who gets a call about the same build has that information.

### Listing Team

The listing team gets their own queue: all unresolved listing error notes across every vehicle. An agent flags something as wrong ("this part is listed as compatible but the customer's vehicle is actually 4WD not 2WD") and the listing team sees it, investigates, fixes the catalog, and marks it resolved with a note. The resolution history is preserved.

### Sales Team

Salespeople can search the vehicle database by make, model, and year. They can see what parts have been annotated for a given build and use that information during customer conversations. The custom fields system means they can tag vehicles with anything relevant that doesn't fit the standard spec fields.

### Future: Customer-Facing Website

The dataset we're building right now is the same one that eventually powers a customer website where someone can enter their VIN and find the parts that actually fit their vehicle — not just what the catalog claims fits, but what we know fits because our agents have handled that exact build before.

That data advantage is real. The part number associations, the corrected specs, the listing error history — none of that comes from a public API. It comes from our people doing their jobs and the system capturing what they know.

---

## Why Go for the Backend

Go compiles to a single static binary with no runtime dependencies. The server starts in milliseconds. Memory usage stays flat under load — no garbage collection pauses, no JVM warmup, no interpreter overhead.

For a tool where agents are on live calls with customers, response time matters. A VIN lookup that already exists in the database returns in under 5ms. A cold decode (first time we've seen a build key) fires two external API calls concurrently and returns in whatever time the slowest of those takes, typically under 400ms. The concurrency model in Go — goroutines and channels — makes the parallel API fetch straightforward to write and reason about.

GORM handles the database layer cleanly. AutoMigrate means the schema evolves with the code without manual SQL scripts. The switch from SQLite (development) to PostgreSQL (production) required changing one function and one import — nothing else in the codebase knew or cared about the underlying database.

The type system catches a class of bugs at compile time that would surface at runtime in a dynamic language. When you refactor a DTO, the compiler tells you every place in the codebase that's now broken.

## Why React for the Frontend

The app has genuinely complex interactive state — inline field editing with optimistic updates, a note panel that filters and searches in real time, a history queue with verification dialogs. React's component model makes that manageable. Each piece of UI owns its own state and can be reasoned about in isolation.

React Query handles all the server state — caching, background refetching, optimistic updates. When an agent edits a spec, the UI updates immediately and invalidates the relevant cache in the background. If the update fails, the old value is still in cache and can be shown again. This pattern would be significantly more work to implement manually.

Tailwind keeps the styling consistent without a large CSS codebase to maintain. The dark/light theme toggle, the color system, the component styles — all of it is utility-class-based and lives next to the markup it styles.

Vite makes development fast. Hot module replacement means a saved file reflects in the browser in under 100ms. Production builds output content-hashed asset files so browsers cache vendor libraries (React, axios, etc.) independently from application code, and only fetch what changed on a new deploy.

---

## Project Structure

```
vin/
├── server/                  # Go backend
│   ├── main.go              # Entry point — DB init, migrations, router
│   ├── config/db.go         # PostgreSQL connection
│   ├── models/              # GORM models (Vehicle, AgentNote, User, etc.)
│   ├── DTO/                 # Response shapes — what actually leaves the API
│   ├── handlers/            # Route handlers (vehicle, notes, auth, admin, history)
│   ├── services/fetch_vin.go  # auto.dev + NHTSA concurrent decode
│   ├── helpers/             # Build key extraction, pagination, VIN validation
│   ├── auth/                # JWT generation, parsing, middleware
│   ├── routes/routes.go     # All API routes wired together
│   └── cmd/seed/main.go     # One-time admin user bootstrap
│
└── ui/                      # React frontend
    ├── src/
    │   ├── api/             # Typed wrappers for every endpoint
    │   ├── contexts/        # Auth, theme, toast state
    │   ├── pages/           # Full page components
    │   └── components/      # Shared UI components
    └── dist/                # Production build (deploy this to the server)
```

---

## Running It

**Requirements:** Go 1.21+, Node 18+, PostgreSQL 14+

**First time setup:**

```bash
# Backend
cd server
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, AUTO_DEV_TOKEN
go mod tidy
go run ./cmd/seed             # creates the first admin user
air                           # live reload during development

# Frontend
cd ui
npm install
npm run dev                   # dev server at localhost:5173
```

**Production build:**

```bash
cd ui && npm run build
# copy ui/dist/* to /home/developer/frontend/ on the server
# the Go binary serves everything from that directory

cd server && go build -o app .
./app
```

**Environment variables:**

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signing key for access and refresh tokens |
| `AUTO_DEV_TOKEN` | Yes | auto.dev API key for VIN decoding |

---

## Default Admin Credentials

After running `go run ./cmd/seed`:

```
Email:    admin@vindecoder.local
Password: Admin@2026!
```

Change the password on first login.
