# DSApline V2.0 — Full-Stack Technical Documentation

## 1. Project Overview

**DSApline** (Discipline + Alpine) is a production-grade, full-stack web application that enables a collaborative group of Computer Science students to track, archive, and analyze their competitive programming journey across platforms like LeetCode and Codeforces. The application operates on a PostgreSQL relational database, implements enterprise-grade ORM patterns via Prisma, and is deployed on modern serverless infrastructure.

This documentation covers the **V2.0 SQL-backed architecture** — the complete rewrite from a GitHub JSON file-based storage system to a properly normalised relational database.

---

## 2. Technology Stack & Justification

### 2.1 Frontend Framework: Next.js 16 (React 19)

| Aspect | Detail |
|--------|--------|
| **Framework** | Next.js 16.2.2 with Turbopack |
| **React Version** | 19.2.3 |
| **Rendering Strategy** | Server-Side Rendering (SSR) + Server Components |

**Why Next.js?**
- **Server Components**: Data-fetching happens on the server (close to the database), reducing client-side JavaScript and improving Time-to-First-Byte (TTFB). Every page that queries PostgreSQL (Dashboard, Archive, Submission, Problem) is a Server Component that runs SQL queries at the edge.
- **API Routes**: Next.js App Router provides a built-in HTTP layer (`app/api/`), eliminating the need for a separate Express/Fastify backend. This is why we can have `POST /api/submit`, `PUT /api/submission/[id]`, etc. without a separate server process.
- **Dynamic Routing**: The `[id]`, `[slug]`, `[userId]` route segments map directly to database primary keys, creating clean URLs like `/submission/uuid-123` and `/problem/two-sum`.
- **Turbopack**: The Rust-based bundler provides sub-second HMR during development — critical for a team of 7 developers working in parallel.

### 2.2 Database: PostgreSQL (via Neon.tech)

| Aspect | Detail |
|--------|--------|
| **Engine** | PostgreSQL 16 |
| **Hosting** | Neon.tech (Serverless Postgres) |
| **Region** | `ap-southeast-1` (Singapore) |
| **Connection** | Pooled via `pg` driver + `@prisma/adapter-pg` |

**Why PostgreSQL?**
- **ACID Compliance**: Every submission, edit, and comment operates within a transaction boundary. PostgreSQL guarantees Atomicity (multi-table inserts succeed or fail together), Consistency (foreign key constraints prevent orphan records), Isolation (concurrent submissions don't interfere), and Durability (committed data survives server crashes).
- **Array Columns**: PostgreSQL natively supports `String[]` arrays, used for the `tags` column. This eliminates the need for a separate `TagMapping` junction table — a deliberate denormalisation decision that trades strict 3NF compliance for dramatically simpler tag queries.
- **GIN Indexes**: The `tags` column uses a GIN (Generalized Inverted Index), which is specifically designed for array containment queries (`@>` operator). This is why tag-based filtering on 10,000+ submissions remains under 50ms.
- **UUID Primary Keys**: `@default(uuid())` generates RFC 4122 v4 UUIDs, preventing sequential ID enumeration attacks and enabling distributed ID generation without coordination.

**Why Neon.tech?**
- **Serverless**: Compute scales to zero when idle (critical for a student project with sporadic traffic). No fixed-cost VM.
- **Connection Pooling**: Built-in PgBouncer-compatible pooling handles the bursty connection pattern of serverless functions (each Next.js API route opens a new connection).
- **Branching**: Neon supports database branching (similar to Git branches), which was used during the ETL migration to test data integrity before pointing production traffic.

### 2.3 ORM: Prisma 7.6

| Aspect | Detail |
|--------|--------|
| **Schema File** | `prisma/schema.prisma` |
| **Client** | `@prisma/client` with `@prisma/adapter-pg` driver adapter |
| **Config** | `prisma.config.ts` |

**Why Prisma?**
- **Type Safety**: Prisma generates TypeScript types directly from the schema. If the `Submission` model has a `tags: String[]` field, the generated type `Prisma.SubmissionCreateInput` will enforce `tags: string[]` at compile time. This eliminates an entire class of runtime bugs.
- **SQL Injection Prevention**: All Prisma queries are parameterised by default. `prisma.submission.findMany({ where: { userId } })` generates `SELECT ... WHERE user_id = $1` with `$1` as a bound parameter, not string concatenation. This makes SQL injection structurally impossible through the ORM.
- **Relation Handling**: The `include` clause (`include: { problem: true, user: true }`) generates efficient `LEFT JOIN` queries, eliminating the N+1 problem that would occur with manual query loops.
- **Migration Management**: `prisma db push` applies schema changes directly to the database, creating tables, columns, indexes, and constraints declaratively.

### 2.4 Authentication: Clerk

| Aspect | Detail |
|--------|--------|
| **Provider** | Clerk (`@clerk/nextjs` v6.36.5) |
| **Strategy** | OAuth 2.0 (Google, GitHub) + Email/Password |
| **Session** | JWT-based, stored in HttpOnly cookies |

**Why Clerk?**
- **Managed Identity**: Clerk handles password hashing (bcrypt), session management, OAuth token exchange, and MFA — none of which should be hand-rolled in a student project.
- **Server-Side Auth**: `auth()` and `currentUser()` from `@clerk/nextjs/server` are available in every Server Component and API Route, providing the authenticated `userId` used as a foreign key in all database operations.
- **User Sync**: Clerk User IDs (format: `user_2abc...`) are used as the primary key in the `User` table, creating a direct 1:1 mapping between the auth layer and the database.

### 2.5 Styling: Tailwind CSS 4

| Aspect | Detail |
|--------|--------|
| **Framework** | Tailwind CSS v4 with `@tailwindcss/postcss` |
| **Design System** | Dark mode, glassmorphism, gradient text |
| **Icons** | Lucide React (`lucide-react` v0.562) |

### 2.6 Validation: Zod 4

| Aspect | Detail |
|--------|--------|
| **Library** | Zod v4.3.4 |
| **Usage** | Runtime type validation for API payloads and data shapes |

**Why Zod?**
- Provides runtime schema validation that mirrors TypeScript types. The `IndexEntrySchema` and `SubmissionSchema` in `lib/types.ts` ensure that data flowing through the application matches the expected shape, catching malformed data before it reaches the database.

---

## 3. Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                       │
│  React 19 Server Components + Client Interactive Components │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │Dashboard │ │ Archive  │ │ Submit   │ │ Submission/   │  │
│  │ page.tsx │ │ page.tsx │ │ Form.tsx │ │ Problem Pages │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
└───────┼────────────┼────────────┼───────────────┼───────────┘
        │            │            │               │
        ▼            ▼            ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Server)                        │
│  Next.js App Router API Routes                              │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │/api/     │ │/api/     │ │/api/      │ │/api/comments │  │
│  │submit    │ │submission│ │parse-url  │ │  GET/POST/   │  │
│  │  POST    │ │  GET/PUT │ │  POST     │ │    PUT       │  │
│  └────┬─────┘ └────┬─────┘ └────┬──────┘ └─────┬────────┘  │
└───────┼────────────┼────────────┼───────────────┼───────────┘
        │            │            │               │
        ▼            ▼            ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATA LAYER (lib/)                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │analytics │ │ archive  │ │  viewer   │ │ leaderboard  │  │
│  │  .ts     │ │  .ts     │ │  .ts      │ │    .ts       │  │
│  └────┬─────┘ └────┬─────┘ └────┬──────┘ └─────┬────────┘  │
└───────┼────────────┼────────────┼───────────────┼───────────┘
        │            │            │               │
        ▼            ▼            ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                ORM LAYER (Prisma Client)                     │
│  prisma.ts → PrismaClient ← schema.prisma                  │
│  Connection Pool via pg.Pool → @prisma/adapter-pg           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (Neon.tech PostgreSQL)                 │
│  ┌──────┐ ┌─────────┐ ┌────────────┐ ┌─────────┐ ┌──────┐ │
│  │ User │ │ Problem │ │ Submission │ │ Comment │ │ Sub- │ │
│  │      │ │         │ │            │ │         │ │ Hist │ │
│  └──────┘ └─────────┘ └────────────┘ └─────────┘ └──────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Request Flow (Example: Submitting a Solution)

1. **Client** → User fills `SubmitForm.tsx` and hits "Confirm Submission"
2. **Network** → `POST /api/submit` with `FormData` (URL, code, tags, difficulty)
3. **Auth Check** → `auth()` extracts `userId` from Clerk JWT cookie
4. **Enrichment** → `enrichProblemData(url)` calls LeetCode GraphQL / Codeforces REST API
5. **User Upsert** → `prisma.user.upsert()` ensures user exists in SQL
6. **Problem Upsert** → `prisma.problem.upsert()` creates or finds the problem
7. **Submission Insert** → `prisma.submission.create()` stores the code
8. **Stats Update** → `prisma.user.update({ totalSolved: { increment: 1 } })`
9. **Response** → `{ success: true, id: submissionId }` → Client redirects to Dashboard

---

## 4. Application Pages & Routes

| Route | Type | Auth Required | Data Source |
|-------|------|--------------|-------------|
| `/` | Dashboard / Landing | Yes (Dashboard) / No (Landing) | `getDashboardData()` → SQL |
| `/submit` | Submission Form | Yes | Client-side form → `POST /api/submit` |
| `/archive` | Global Archive | No | `getGlobalArchive()` → SQL |
| `/leaderboard` | Rankings | No | `getLeaderboard()` → SQL |
| `/submission/[id]` | Submission Detail | No (view) / Yes (edit) | `prisma.submission.findUnique()` |
| `/problem/[slug]` | Problem View | No | `getSubmissionsByProblem()` → SQL |
| `/user/[userId]` | User Profile | No | `getDashboardData()` → SQL |
| `/api/submit` | Create Submission | Yes | `POST` → INSERT |
| `/api/submission/[id]` | Get/Edit Submission | No (GET) / Yes (PUT) | SELECT / UPDATE |
| `/api/submission/[id]/history` | Edit History | No | SELECT |
| `/api/comments` | Comments CRUD | No (GET) / Yes (POST/PUT) | SELECT / INSERT / UPDATE |
| `/api/parse-url` | URL Enrichment | No | External API calls |
| `/api/tags` | Available Tags | No | SELECT |
