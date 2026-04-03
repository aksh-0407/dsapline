# DSApline V2.0

**DSA + Discipline — Master Data Structures & Algorithms through Discipline, Accountability and Collaborative Learning.**

DSApline is a production-grade, full-stack web application that enables competitive programmers to track, archive, and analyse their coding journey across LeetCode, Codeforces, HackerRank, and GeeksforGeeks. Built on a PostgreSQL relational database with a 5-table normalised schema, it features editable submissions with version history, per-submission difficulty ratings, community difficulty averages, up to 10 alternate solutions per problem, problem-centric views, community discussions, and real-time analytics.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.6-2D3748?logo=prisma)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## Key Features

- **SQL-Backed Archive** — Search and filter all submissions by tag, difficulty, platform, date range, and user. Powered by PostgreSQL with B-Tree and GIN indexes for sub-50ms queries.
- **Editable Submissions** — Edit your code, notes, tags, language, and difficulty rating after submission. Every edit creates an immutable audit trail in the `SubmissionHistory` table.
- **Per-Submission Difficulty + Community Average** — Each user rates a problem on their own submission (0–10 scale). The problem's displayed difficulty is the live community average, computed as `AVG(difficultyRating)` across all rated submissions. Users who choose "Unrated" are excluded from the average.
- **Up to 10 Alternate Solutions** — Submit up to 10 alternate approaches per problem (e.g., brute-force, optimised, recursive). Each alternate is stored as a full `Submission` row sharing the same problem and tags.
- **Problem-Centric Views** — Browse `/problem/[slug]` to see all users' solutions for a specific problem, compare approaches, and discuss.
- **Comment Discussions** — Threaded discussions on every submission. Users can post and edit their own comments.
- **Dashboard Analytics** — Real-time stats: total solved, current streak, highest streak, activity heatmap (GitHub-style), and recent submissions. Computed via SQL aggregation queries.
- **Leaderboard** — Ranking system by total problems solved and active streaks.
- **Smart Auto-Fill** — Paste a LeetCode or Codeforces URL; the system auto-fetches the problem title, difficulty label, rating, and official tags via API enrichment.
- **Ownership Security** — Server-side ownership checks on all edit endpoints. Users cannot modify others' submissions or comments.

---

## Architecture

DSApline V2 uses a **Server Component-first** architecture where data-fetching happens on the server directly against PostgreSQL — no client-side API waterfalls.

```
 Browser (React 19)           Server (Next.js 16)           Database (Neon.tech)
┌──────────────────┐    ┌────────────────────────┐    ┌──────────────────────┐
│  Dashboard       │    │  Server Components     │    │    PostgreSQL 16     │
│  Archive         │───▶│  (SSR, direct DB call) │───▶│                      │
│  Submission Page │    │                        │    │  ┌──────┐ ┌───────┐  │
│  Problem Page    │    │  API Routes            │    │  │ User │ │Problem│  │
│                  │    │  /api/submit (POST)    │    │  └──┬───┘ └───┬───┘  │
│  Client Comps:   │    │  /api/submission (PUT) │    │     │         │      │
│  SubmitForm      │───▶│  /api/comments (CRUD)  │───▶│  ┌──▼─────────▼──┐   │
│  EditSubmission  │    │                        │    │  │  Submission   │   │
│  CommentSection  │    │  Prisma ORM            │    │  └──┬─────────┬──┘   │
│  ArchiveFilters  │    │  (parameterised SQL)   │    │     │         │      │
└──────────────────┘    └────────────────────────┘    │  ┌──▼──┐  ┌──▼───┐   │
                                                      │  │Comm-│  │Hist- │   │
        Clerk Auth (JWT / proxy.ts middleware)        │  │ent  │  │ory   │   │
        ──────────────────────────────────────        │  └─────┘  └──────┘   │
                                                      └──────────────────────┘
```

### Request Flow — Submitting a Solution

1. User fills `SubmitForm.tsx` → `POST /api/submit` with FormData (including up to 10 alt solutions)
2. `auth()` extracts `userId` from Clerk JWT cookie
3. `enrichProblemData(url)` calls LeetCode GraphQL / Codeforces REST API for metadata
4. `prisma.user.upsert()` — ensures User exists in SQL (Clerk → DB sync)
5. `prisma.problem.upsert()` — creates Problem if first time
6. `prisma.submission.create()` — stores main solution with user's `difficultyRating`
7. Loop: `prisma.submission.create()` × N — stores each alternate solution
8. `recomputeProblemAvgDifficulty(slug)` — `AVG(difficultyRating)` → updates `Problem.difficultyValue`
9. `prisma.user.update({ totalSolved: { increment: 1 } })` — atomic counter update
10. Returns `{ success: true, id }` → client redirects to Dashboard

---

## Database Schema (ER Diagram)

The database uses **5 tables** in **3NF** (Third Normal Form) with controlled denormalisation.

```mermaid
erDiagram
    USER {
        String id PK "Clerk User ID"
        String email UK "UNIQUE"
        String fullName "Nullable"
        Int totalSolved "Default 0"
        Int currentStreak "Default 0"
        Int maxStreak "Default 0"
        DateTime createdAt "Default now()"
        DateTime updatedAt "Auto-updated"
    }

    PROBLEM {
        String slug PK "Natural key, e.g. two-sum"
        String title "e.g. 1. Two Sum"
        Float difficultyValue "Community AVG of Submission.difficultyRating"
        String difficultyLabel "Easy/Medium/Hard (platform label)"
        String platform "leetcode, codeforces, etc."
        String url "Original problem URL"
        Int rating "Codeforces rating"
    }

    SUBMISSION {
        String id PK "UUID v4"
        String language "Default cpp"
        String codeSnippet "TEXT, full solution"
        String notes "TEXT, nullable"
        Status status "ENUM: SOLVED/ATTEMPTED/NEEDS_REVIEW"
        Float difficultyRating "Per-user rating (0-10, nullable = unrated)"
        StringArray tags "PostgreSQL array"
        DateTime createdAt "Immutable solve date"
        DateTime updatedAt "Changes on edit"
        String userId FK "User.id CASCADE"
        String problemSlug FK "Problem.slug CASCADE"
    }

    COMMENT {
        String id PK "UUID v4"
        String content "TEXT, 1-2000 chars"
        DateTime createdAt "Default now()"
        String userId FK "User.id CASCADE"
        String submissionId FK "Submission.id CASCADE"
    }

    SUBMISSION_HISTORY {
        String id PK "UUID v4"
        String oldCode "TEXT, pre-edit snapshot"
        String oldNotes "TEXT, nullable"
        DateTime changedAt "Default now()"
        String submissionId FK "Submission.id CASCADE"
    }

    USER ||--o{ SUBMISSION : "creates"
    USER ||--o{ COMMENT : "writes"
    PROBLEM ||--o{ SUBMISSION : "has solutions"
    SUBMISSION ||--o{ COMMENT : "has discussions"
    SUBMISSION ||--o{ SUBMISSION_HISTORY : "has edit history"
```

### Difficulty Design

| Property | Location | Value |
|----------|----------|-------|
| `Submission.difficultyRating` | Per submission | User's own 0–10 rating (null if unrated) |
| `Problem.difficultyValue` | Per problem | Community `AVG(difficultyRating)` — recomputed on every write |
| `Problem.difficultyLabel` | Per problem | Platform label ("Easy"/"Medium"/"Hard") — from API enrichment |

### Index Strategy (9 indexes)

| Index | Type | Purpose |
|-------|------|---------|
| `Submission(userId)` | B-Tree | Filter by user |
| `Submission(problemSlug)` | B-Tree | Filter by problem |
| `Submission(tags)` | **GIN** | Array containment queries |
| `Submission(createdAt)` | B-Tree | Date sort/range |
| `Submission(userId, createdAt)` | B-Tree Compound | Dashboard queries |
| `Submission(problemSlug, createdAt)` | B-Tree Compound | Problem page queries |
| `Problem(platform)` | B-Tree | Platform filter |
| `Comment(submissionId)` | B-Tree | Load comments |
| `SubmissionHistory(submissionId)` | B-Tree | Load edit history |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 16 (Turbopack) | Server Components for zero-waterfall DB access; API Routes replace a separate backend |
| **Language** | TypeScript 5 | Compile-time type safety across frontend, backend, and DB queries |
| **Database** | PostgreSQL 16 (Neon.tech) | ACID compliance, native array columns, GIN indexes, ENUMs, UUID generation |
| **ORM** | Prisma 7.6 | Type-safe queries, auto-parameterisation (SQL injection prevention), declarative schema |
| **Auth** | Clerk | Managed OAuth/JWT; `proxy.ts` middleware (Next.js 16 convention) |
| **Styling** | Tailwind CSS 4 | Utility-first, dark mode, responsive |
| **Validation** | Zod 4 | Runtime schema validation for API payloads |
| **Icons** | Lucide React | Consistent icon set |
| **Deployment** | Vercel + Neon.tech | Serverless frontend + serverless database |

---

## Pages & API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | — | Dashboard (auth) / Landing page (unauth) |
| `/submit` | — | Submission form with auto-fill & up to 10 alt solutions |
| `/archive` | — | Searchable archive with filters |
| `/leaderboard` | — | Rankings by total solved & streaks |
| `/submission/[id]` | — | Submission detail + per-user & community difficulty + edit + comments |
| `/problem/[slug]` | — | All solutions for a problem |
| `/user/[userId]` | — | User profile with stats & history |
| `/api/submit` | `POST` | Create submission + alternates (multi-step INSERT + AVG recompute) |
| `/api/submission/[id]` | `GET` `PUT` | Fetch / Edit submission (with audit log + AVG recompute) |
| `/api/submission/[id]/history` | `GET` | Edit history entries |
| `/api/comments` | `GET` `POST` `PUT` | Comments CRUD |
| `/api/parse-url` | `POST` | LeetCode/Codeforces metadata enrichment |

---

## Project Structure

```
dsapline/
├── app/
│   ├── api/
│   │   ├── submit/route.ts          # POST: Create submissions + up to 10 alternates
│   │   ├── submission/[id]/
│   │   │   ├── route.ts             # GET/PUT: Fetch/Edit submissions + avg recompute
│   │   │   └── history/route.ts     # GET: Edit history
│   │   ├── comments/route.ts        # GET/POST/PUT: Comments CRUD
│   │   ├── parse-url/route.ts       # POST: URL metadata enrichment
│   │   └── migrate/route.ts         # POST: ETL migration (auth-protected)
│   ├── archive/page.tsx             # Archive page (Server Component)
│   ├── leaderboard/page.tsx         # Leaderboard page
│   ├── submission/[id]/page.tsx     # Submission detail (My Rating + Avg badges)
│   ├── problem/[slug]/page.tsx      # Problem-centric view
│   ├── user/[userId]/page.tsx       # User profile
│   ├── submit/page.tsx              # Submission form
│   ├── page.tsx                     # Dashboard / Landing
│   └── layout.tsx                   # Root layout (Clerk + Navbar)
├── components/
│   ├── Archive.tsx                  # Archive table with problem links
│   ├── ArchiveFilters.tsx           # Multi-dimensional filter controls
│   ├── SubmitForm.tsx               # Form: up to 10 alt solutions, my difficulty rating
│   ├── EditSubmission.tsx           # Edit mode: per-submission difficulty + community avg
│   ├── CommentSection.tsx           # Discussion UI with inline editing
│   ├── Navbar.tsx                   # Navigation bar
│   ├── StatsGrid.tsx                # Dashboard stat cards
│   ├── ActivityHeatmap.tsx          # GitHub-style heatmap
│   └── LeaderboardClient.tsx        # Leaderboard with sorting tabs
├── lib/
│   ├── prisma.ts                    # Prisma client singleton (pg Pool)
│   ├── analytics.ts                 # Dashboard: streaks, heatmap, stats
│   ├── archive.ts                   # Archive: global + per-user fetch
│   ├── viewer.ts                    # Problem-centric data fetching
│   ├── date.ts                      # IST timezone utilities
│   ├── filterEngine.ts              # Client-side filter logic (7 dimensions)
│   ├── services.ts                  # LeetCode/Codeforces API enrichment
│   ├── types.ts                     # IndexEntry type + Zod schema
│   ├── db.ts                        # SQL user sync (Clerk → PostgreSQL)
│   ├── github.ts                    # GitHub API (used by migrate route only)
│   └── utils.ts                     # Tailwind merge utility
├── prisma/
│   └── schema.prisma                # Database schema (5 tables, 9 indexes)
├── docs/                            # DBMS documentation suite
│   ├── 01_project_overview.md       # Architecture & tech justification
│   ├── 02_database_documentation.md # ER diagram, tables, SQL, ACID
│   ├── 03_team_roles_part1.md       # Aksh, Vedant, Avani, Bhoju
│   └── 03_team_roles_part2.md       # Melinkeri, Kushwaha, Aarrush
├── proxy.ts                         # Clerk auth middleware (Next.js 16 convention)
└── package.json
```

---

## Team

| Member | Role | Responsibility |
|--------|------|---------------|
| **Aksh Shah** | Lead Architect | Database schema design, ER diagram, Archive page, Problem-centric views |
| **Vedant Vakharia** | Submissions | Submission form UI/UX, edit capabilities, comments/discussion system |
| **Avani Gadkari** | Users/Auth | Clerk ↔ SQL user sync, profile management, connection pooling |
| **Arjun Thakur** | Security/History | Audit log (`SubmissionHistory`), ownership guards, SQL injection prevention |
| **Aditya Melinkeri** | Search/Indexing | B-Tree & GIN indexes, compound indexes, query optimisation |
| **Aditya Kushwaha** | Dashboard | Aggregation queries (GROUP BY, COUNT, MAX), streak algorithms, heatmap data |
| **Aarrush Dhumale** | QA/DevOps | ETL migration (JSON→SQL), load testing, documentation, integration testing |

> See [`docs/`](./docs/) for detailed role descriptions, DBMS linkage, and viva preparation (35 Q&A).

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Clerk](https://clerk.com) account (authentication)
- A [Neon.tech](https://neon.tech) PostgreSQL database

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/aksh-0407/DSApline.git
cd DSApline

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

Set the following in `.env.local`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

```bash
# 4. Push the schema to the database
npx prisma db push

# 5. Start the development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build   # Compiles with Turbopack, type-checks, generates static pages
npm run start   # Starts the production server
```

---

## DBMS Topics Demonstrated

This project covers the following DBMS concepts in a working production application:

| Topic | Where It's Used |
|-------|----------------|
| ER Diagrams & Schema Design | `prisma/schema.prisma`, `docs/02_database_documentation.md` |
| Normalisation (1NF → 3NF → BCNF) | Schema analysis in documentation |
| Primary Keys (Natural vs Surrogate) | `Problem.slug` (natural), `Submission.id` (UUID surrogate) |
| Foreign Keys & Referential Integrity | All tables linked via FK with CASCADE |
| UPSERT (INSERT ON CONFLICT) | User sync, Problem creation |
| B-Tree Indexes | 7 B-Tree indexes across tables |
| GIN Indexes | `Submission.tags` array column |
| Compound Indexes | `(userId, createdAt)`, `(problemSlug, createdAt)` |
| SQL Injection Prevention | Prisma parameterised queries |
| ACID Compliance | Transaction integrity across multi-step operations |
| MVCC | Concurrent submission handling |
| Aggregation (GROUP BY, COUNT, MAX, AVG) | Leaderboard, dashboard stats, community difficulty avg |
| Audit Logging | `SubmissionHistory` table |
| Connection Pooling | `pg.Pool` via `@prisma/adapter-pg` |
| ENUMs | `Status` type (SOLVED, ATTEMPTED, NEEDS_REVIEW) |
| PostgreSQL Arrays | `tags String[]` column |
| Cascading Deletes | `onDelete: Cascade` on all FK relationships |

---

## License

This project is licensed under the MIT License.