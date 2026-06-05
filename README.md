# VIN Decoder — Internal Platform

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

A full-stack internal tool for building, verifying, and owning a proprietary vehicle specification dataset. Seeded from public decode APIs, made accurate through real agent work, and extended with a parts fitment catalog that no one else has.

---

## What This Actually Does

Every time an agent looks up a VIN, the system decodes it, stores the result, and gives the agent a structured place to annotate it. Over time those annotations — part numbers, brake specs, listing corrections, fitment rules — become a dataset that belongs entirely to us. Nobody else has it because nobody else built it this way.

The backend is Go (Gin + GORM + PostgreSQL). The frontend is React + Vite + Tailwind. Authentication is JWT with refresh tokens. Everything communicates through a typed REST API with a consistent response envelope.

---

## The Build Key

A full VIN is 17 characters. Most of those describe the individual unit off the assembly line. What we actually care about is the *build* — year, make, model, trim, and configuration.

We extract that as a 10-character **Build Key**: characters 1–8 and 10–11 of the VIN.

```
VIN:       1 G C U K P E C 3 8 G Z 1 0 5 5 5 4
Position:  1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7
                             ^       (skipped — check digit + sequence)
Build Key: 1 G C U K P E C   8 G  →  1GCUKPEC8G
```

Every 2016 Chevy Silverado 1500 with a 6.2L V8 in crew cab configuration shares the same build key regardless of what the last 7 digits are. That means a note, a corrected spec, or a confirmed part fitment added for one customer's truck applies instantly to every truck of that exact build.

The first time a full 17-character VIN is searched and we don't have its build key, we call auto.dev and NHTSA concurrently, merge the results, and save one record. Every subsequent lookup for that build is instant.

---

## How Data Gets Collected

**Agents** look up VINs on live calls. As a side effect of doing their job they add notes (free-text observations, part numbers that fit, listing errors they find), edit specs that are wrong, and confirm fitment from real customer interactions. None of that requires extra steps. The system captures it automatically.

**The DNR team** (Research and Development) uses a dedicated workspace to fill in spec fields that the initial VIN decode doesn't provide — rotor sizes, brake codes, spring types, exact transmission speeds. They pull from manufacturer catalogs and data sources, enter specs with source annotations, and propagate confirmed data across similar builds with one click.

**The Listing team** manages a queue of reported catalog errors. Agents flag mismatches, the listing team investigates, marks them resolved, and the history is kept.

The initial auto.dev and NHTSA data is available to anyone. The layer built on top of it — corrected specs, part number associations, source-tracked research, verified fitment — isn't available to anyone. It's ours.

---

## The Parts Catalog

The system includes a full parts fitment catalog built around rule-based matching rather than manual assignment.

Each part has one or more **fitment rules** that define which vehicles it fits. A rule specifies year range, make, model, trim (comma-separated for multiple valid trims), engine size, drive type, and any other required conditions. The matching engine evaluates those rules against every vehicle in the database.

Beyond required conditions, each rule can have **call-outs** — additional conditions that may or may not be verifiable from the vehicle record. If a vehicle has a matching custom field (like `Lugs: 8` or `engine_chassis: Z71`) the match is confirmed. If the field is missing from the record, the part is still returned but flagged as "Verify" with a message to the agent. If the field exists with the wrong value, the part is excluded entirely.

The matching is intentionally smart:

*Model matching is token-based and order-independent.* A rule written as "F-350 Super Duty" matches a vehicle whose model is "Super Duty F-350 DRW" because all tokens appear as whole words in the vehicle string.

*Trim accepts comma-separated lists.* "King Ranch, Lariat, XL, XLT" matches any vehicle whose trim contains any of those values.

*Drive type is normalized.* "4WD", "4x4", and "FOUR WHEEL DRIVE" all resolve to the same canonical value before comparison.

*Displacement is compared numerically.* "3.5" and "3.50" are the same.

*Custom field keys are normalized.* "engine_chassis", "engine-chassis", "Engine Chassis" and "enginechassis" all match the same custom field regardless of how it was entered.

Searching works in both directions — from a vehicle to see what parts fit it, and from a part to see what vehicles in the database it's compatible with. Results are grouped by category and sorted by confidence (exact matches first).

The DNR team can clone parts with identical or similar fitment rules to speed up entry, and propagate confirmed specs from one researched vehicle to all similar builds that are still missing that data.

---

## Verification

Not every agent has the same confidence level. A new hire might enter a wrong spec. A senior tech who's handled thousands of these trucks probably won't.

Each user has an `is_trusted` flag. Untrusted agents' edits go into the **VIN Update Queue** — applied immediately so the customer gets the right answer, but flagged for admin review. An admin can verify the change (locking the field), correct it, or delete it (which automatically reverts the field to its previous value). Trusted agents' edits skip the queue but are still logged. Everything is always logged.

An agent can also delete their own mistakes directly from the vehicle page by clicking the edit history indicator on any field. Deleting a change reverts the field to what it was before.

---

## Security

Every API request except login requires a signed JWT. Access tokens expire in one hour. Refresh tokens last seven days and rotate on use — if a refresh fails, the session clears and the user lands on the login page, no silent stale sessions.

Passwords are hashed with bcrypt. The hash never appears in any API response.

**Roles:**

| Role | Access |
|---|---|
| `agent` | VIN lookups, notes, inline spec edits, parts catalog (read), compatible parts on vehicle pages |
| `listing` | Everything above + listing error queue, history of changes |
| `dnr` | Everything above + DNR workspace (spec entry, propagation, vehicle research) |
| `admin` | Full access including user management, admin dashboard, verification queue |

Role checks are backend-enforced. Hiding a button in the UI is not a security measure.

Field-level edit permissions are stored in the database per role, not hardcoded — adjustable without a deploy.

---

## Who Uses This

**Customer service agents** look up VINs on live calls and instantly see every part number, spec, and note that's been collected for that build. They add to it when they find something new. The next agent who handles the same build gets that information.

**The listing team** resolves catalog errors flagged by agents, and can see the history of changes across all vehicles.

**The DNR team** fills in spec data from external sources, confirms fitment against real part catalogs, and propagates verified specs across similar builds to multiply the research effort.

**Owners and managers** have an admin dashboard showing which agents are most productive (VIN lookup leaderboard, notes counts), database completeness metrics, and a notes activity chart.

Down the road, the same dataset powers a customer-facing website where someone enters their VIN and sees what parts actually fit their vehicle — not just what the catalog claims, but what's been confirmed by people who handled that exact build.

---

## Project Structure

```
vin/
├── server/
│   ├── main.go                 entry point, DB init, migrations, router
│   ├── config/db.go            PostgreSQL connection
│   ├── models/                 GORM models (Vehicle, User, AgentNote, CatalogPart, etc.)
│   ├── DTO/                    response shapes — what actually leaves the API
│   ├── handlers/               route handlers (vehicle, notes, auth, admin, history, parts, dnr)
│   ├── helpers/                build key, pagination, VIN validation, fitment matching
│   ├── services/fetch_vin.go   auto.dev + NHTSA concurrent decode
│   ├── auth/                   JWT generation, parsing, middleware, role guards
│   ├── routes/routes.go        all API routes
│   └── cmd/seed/main.go        one-time admin bootstrap
│
└── ui/
    └── src/
        ├── api/                typed wrappers for every endpoint
        ├── contexts/           auth, theme, toast state
        ├── pages/              full page components (Search, Vehicle, Parts, DNR, Admin, etc.)
        └── components/         shared UI components
```

---

## Running It

**Requirements:** Go 1.21+, Node 18+, PostgreSQL 14+

```bash
# Backend — first time
cd server
cp .env.example .env       # fill in DATABASE_URL, JWT_SECRET, AUTO_DEV_TOKEN
go mod tidy
go run ./cmd/seed          # creates the first admin user
air                        # live reload during development

# Frontend
cd ui
npm install
npm run dev                # dev server at localhost:5173, proxies /api to backend
```

```bash
# Production build
cd ui && npm run build
# copy ui/dist/* to /home/developer/frontend/ on the server

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

Change the password after first login — there's a key icon in the navbar on every page.
