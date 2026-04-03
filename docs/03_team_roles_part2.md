# DSApline V2.0 — Team Roles (Part 2): Melinkeri, Kushwaha & Aarrush

---

## 5. Melinkeri — Search & Indexing Optimization

### Role Description
Melinkeri is responsible for making the Archive and Problem search pages **scale to 10,000+ rows** without degradation. He designed and applied the B-Tree and GIN indexes in the Prisma schema, analysed query execution plans, and ensured all critical queries operate under 50ms.

### Key Files Owned
- Index definitions in `prisma/schema.prisma` (lines 93-99)
- `lib/filterEngine.ts` — Client-side filter engine (search, platform, difficulty, tags, date range)
- `components/ArchiveFilters.tsx` — Filter UI controls

### Database Tasks & Indexes Created

| Index | Type | Column(s) | SQL Generated | Query It Optimises |
|-------|------|-----------|---------------|-------------------|
| `idx_submission_userId` | **B-Tree** | `userId` | `CREATE INDEX ON "Submission" ("userId")` | `WHERE userId = $1` (Dashboard, Profile) |
| `idx_submission_problemSlug` | **B-Tree** | `problemSlug` | `CREATE INDEX ON "Submission" ("problemSlug")` | `WHERE problemSlug = $1` (Problem page) |
| `idx_submission_tags` | **GIN** | `tags` | `CREATE INDEX ON "Submission" USING GIN (tags)` | `WHERE 'DP' = ANY(tags)` (Tag filter) |
| `idx_submission_createdAt` | **B-Tree** | `createdAt` | `CREATE INDEX ON "Submission" ("createdAt")` | `ORDER BY createdAt DESC` (Archive sort) |
| `idx_submission_userId_createdAt` | **B-Tree (Compound)** | `userId, createdAt` | `CREATE INDEX ON "Submission" ("userId", "createdAt")` | `WHERE userId = $1 ORDER BY createdAt DESC` |
| `idx_submission_problemSlug_createdAt` | **B-Tree (Compound)** | `problemSlug, createdAt` | `CREATE INDEX ON "Submission" ("problemSlug", "createdAt")` | `WHERE problemSlug = $1 ORDER BY createdAt DESC` |
| `idx_problem_platform` | **B-Tree** | `platform` | `CREATE INDEX ON "Problem" (platform)` | `WHERE platform = 'leetcode'` |
| `idx_comment_submissionId` | **B-Tree** | `submissionId` | `CREATE INDEX ON "Comment" ("submissionId")` | Comment loading per submission |
| `idx_history_submissionId` | **B-Tree** | `submissionId` | `CREATE INDEX ON "SubmissionHistory" ("submissionId")` | History retrieval |

### Client-Side Filter Engine

The `filterEngine.ts` implements 7 independent filter dimensions that work on the data already fetched from SQL:

```typescript
interface FilterState {
  search: string;           // Full-text on title + username
  platform: string;          // "all" | "leetcode" | "codeforces" | ...
  dateRange: { start, end }; // ISO date range
  difficultyRange: { min, max }; // 0-10 scale
  tags: string[];            // OR logic: item must match ANY selected tag
  lcDifficulty: string[];    // ["Easy", "Medium", "Hard"]
  cfRatingRange: { min, max }; // 0-3500 Codeforces rating
}
```

### Viva Questions & Answers

**Q1: Explain the internal structure of a B-Tree index. Why is it O(log N) for lookups?**
> A: A B-Tree is a balanced tree where each internal node contains sorted keys and pointers to child nodes. PostgreSQL uses B+ Trees specifically, where all data pointers are in leaf nodes, and internal nodes contain only separator keys. For a table with N rows and a branching factor of ~200 (typical for 8KB pages), the tree height is log₂₀₀(N). With 10,000 rows, that's log₂₀₀(10000) ≈ 2 levels — meaning any lookup requires at most 2-3 disk page reads, compared to potentially 10,000 reads for a sequential scan.

**Q2: Why does the `tags` column use a GIN index instead of a B-Tree index?**
> A: B-Tree indexes work on **scalar** values — they can answer "is this value equal to X?" or "is this value between X and Y?". But `tags` is an **array**. The query "find submissions tagged with DP" translates to `WHERE 'DP' = ANY(tags)`, which requires checking if the value exists *inside* the array. A GIN (Generalized Inverted Index) handles this by creating an **inverted index**: for each distinct tag value, it stores a list of row pointers. So looking up "DP" goes directly to the "DP" entry and retrieves all matching row IDs in O(1) + O(k) where k is the number of matches.

**Q3: You have both `@@index([userId])` and `@@index([userId, createdAt])`. Isn't the single-column index redundant?**
> A: The compound index `(userId, createdAt)` CAN serve as a substitute for `(userId)` alone — PostgreSQL can use the leftmost prefix of a compound index. However, the compound index is larger in size (stores two columns per entry), so scans that only need `userId` would read more disk pages. Keeping both is a **space-time tradeoff**: the single-column index is smaller and faster for simple lookups (`WHERE userId = X`), while the compound index is optimal for sorted lookups (`WHERE userId = X ORDER BY createdAt DESC`). With <100,000 rows, the storage overhead is negligible.

**Q4: If a professor asks "Why not use PostgreSQL Full-Text Search (tsvector) for the search bar?", what's your answer?**
> A: Our search currently happens client-side (JavaScript `.includes()` on pre-fetched data). For <10,000 rows, this is faster than a server roundtrip. If the dataset grew to 100,000+ rows, we'd implement server-side full-text search using: `ALTER TABLE "Submission" ADD COLUMN search_vector tsvector; CREATE INDEX idx_fts ON "Submission" USING GIN(search_vector);` and query with `WHERE search_vector @@ to_tsquery('english', 'binary & search')`. The advantage over LIKE is that tsvector supports stemming ("running" matches "run") and ranking.

**Q5: What is the difference between an Index Scan, an Index-Only Scan, and a Bitmap Index Scan? Which does our Archive query use?**
> A: **Index Scan**: Traverses the B-Tree to find matching row pointers, then fetches each row from the heap (table storage) — one page read per row. **Index-Only Scan**: If ALL requested columns are in the index, reads directly from the index without touching the heap — fastest. **Bitmap Index Scan**: Builds a bitmap of matching row positions from the index, then reads the heap in physical order — efficient for queries matching many rows (avoids random I/O). Our Archive query (`SELECT s.*, p.*, u.*`) requests columns not in any index, so it uses **Index Scan** on `createdAt` for ordering + **Nested Loop Joins** into Problem and User via their primary key indexes.

---

## 6. Kushwaha — Dashboard Analytics

### Role Description
Kushwaha manages the **Dashboard page** — the personalised analytics view showing total problems solved, active days, current streak, highest streak, activity heatmap, and recent activity. He writes the complex aggregation queries that compute these metrics from raw submission data.

### Key Files Owned
- `lib/analytics.ts` — `getDashboardData()` function (all dashboard computations)
- `app/page.tsx` — Dashboard page (Server Component)
- `components/StatsGrid.tsx` — Statistics cards
- `components/ActivityHeatmap.tsx` — GitHub-style activity visualization
- `lib/leaderboard.ts` — `getLeaderboard()` function

### Database Tasks & Queries

**1. Activity Map Aggregation (equivalent to GROUP BY + COUNT):**
```sql
SELECT DATE("createdAt") AS solve_date, COUNT(*) AS count
FROM "Submission"
WHERE "userId" = $1
GROUP BY DATE("createdAt")
ORDER BY solve_date;
```
Implemented in TypeScript as:
```typescript
submissions.forEach((sub) => {
  const dateStr = sub.createdAt.toISOString().split("T")[0];
  activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
});
```

**2. Streak Calculation (equivalent to Window Functions):**
The streak algorithm identifies consecutive date sequences:
```sql
-- SQL equivalent using LAG window function:
WITH dates AS (
  SELECT DISTINCT DATE("createdAt") AS d FROM "Submission" WHERE "userId" = $1
),
gaps AS (
  SELECT d, d - LAG(d) OVER (ORDER BY d) AS gap FROM dates
)
SELECT d, gap, SUM(CASE WHEN gap > 1 THEN 1 ELSE 0 END) OVER (ORDER BY d) AS streak_group
FROM gaps;
```

**3. Leaderboard Ranking (GROUP BY + ORDER BY):**
```sql
SELECT s."userId", u."fullName", COUNT(*) AS total_solved,
       MAX(DATE(s."createdAt")) AS last_active
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
GROUP BY s."userId", u."fullName"
ORDER BY total_solved DESC;
```

**4. "Last Active" Date (MAX aggregate):**
```sql
SELECT MAX("createdAt") FROM "Submission" WHERE "userId" = $1;
```

### Viva Questions & Answers

**Q1: Your streak calculation is done in JavaScript, not SQL. Write the equivalent SQL using window functions and explain why you chose JavaScript.**
> A: SQL with window functions:
> ```sql
> WITH active_dates AS (
>   SELECT DISTINCT DATE("createdAt") AS d FROM "Submission" WHERE "userId" = $1 ORDER BY d
> ),
> with_rn AS (
>   SELECT d, ROW_NUMBER() OVER (ORDER BY d) AS rn FROM active_dates
> ),
> streak_groups AS (
>   SELECT d, d - (rn * INTERVAL '1 day')::DATE AS grp FROM with_rn
> )
> SELECT grp, COUNT(*) AS streak_len FROM streak_groups GROUP BY grp ORDER BY streak_len DESC LIMIT 1;
> ```
> I chose JavaScript because: (a) the current streak requires comparing against "today", which varies by timezone — easier in JS with `new Date()`; (b) we already fetch all submissions for the heatmap, so computing streaks from the same dataset avoids a second query; (c) the logic involves conditional checks (is streak alive today or yesterday?) that are cleaner in imperative code.

**Q2: Explain what `{ increment: 1 }` does at the SQL level in `prisma.user.update({ data: { totalSolved: { increment: 1 } } })`.**
> A: It generates: `UPDATE "User" SET "totalSolved" = "totalSolved" + 1 WHERE id = $1`. This is an **atomic increment** — PostgreSQL reads the current value and adds 1 in a single operation, which is safe under concurrent access. The alternative `SET "totalSolved" = 42` (reading the value in JS, adding 1, writing back) is vulnerable to a **lost update**: if two requests read 41 simultaneously, both would write 42 instead of the correct 43.

**Q3: Your dashboard fetches ALL submissions for a user. How would you optimise this for a user with 50,000 submissions?**
> A: Three strategies: (1) **Pagination**: `LIMIT 100 OFFSET 0` for recent activity, avoid loading all rows. (2) **Materialised stats**: Store `totalSolved`, `currentStreak`, `lastActiveDate` in the User table and update them on each INSERT/UPDATE (we already do `totalSolved`). (3) **Date-bounded queries**: For the heatmap, only fetch the last 365 days: `WHERE "createdAt" >= NOW() - INTERVAL '1 year'`. The compound index `(userId, createdAt)` makes this range query extremely efficient.

**Q4: What is the difference between `COUNT(*)` and `COUNT(column_name)` in SQL? Which does your leaderboard use?**
> A: `COUNT(*)` counts ALL rows, including those with NULL values. `COUNT(column_name)` counts only rows where that column is NOT NULL. In our leaderboard, we use `submissions.length` (JavaScript equivalent of `COUNT(*)`), which counts all submissions regardless of any NULL fields. If we used `COUNT(notes)`, submissions without notes would be excluded from the count — which would give an incorrect "total solved" number.

**Q5: The leaderboard uses `GROUP BY userId` after fetching all submissions. This means it loads the entire Submission table into memory. How would you make this scale to 1 million submissions?**
> A: Instead of fetching raw rows and grouping in JavaScript, push the aggregation to the database:
> ```sql
> SELECT s."userId", u."fullName",
>   COUNT(*) AS total_solved,
>   COUNT(DISTINCT DATE(s."createdAt")) AS active_days,
>   MAX(s."createdAt") AS last_active
> FROM "Submission" s JOIN "User" u ON s."userId" = u.id
> GROUP BY s."userId", u."fullName"
> ORDER BY total_solved DESC LIMIT 50;
> ```
> This returns only 50 rows (one per user) instead of 1 million. PostgreSQL's hash aggregate operator can process this in a single table scan. For real-time performance, we'd create a **materialised view**: `CREATE MATERIALIZED VIEW leaderboard_mv AS ...` and refresh it periodically with `REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_mv`.

---

## 7. Aarrush — QA & DevOps

### Role Description
Aarrush is responsible for **end-to-end quality assurance**, the ETL data migration script (JSON → SQL), load testing, and compiling the final DBMS project documentation. He ensures all components work together and the system handles concurrent users gracefully.

### Key Files Owned
- `app/api/migrate/route.ts` — ETL migration script
- `test_db.js`, `test_db.cjs`, `test_pg.js` — Database connectivity tests
- Load testing scripts and reports
- Final DBMS project documentation compilation

### Database Tasks & Queries

**1. ETL Migration (Bulk INSERT):**
```sql
-- The migration script reads JSON files via GitHub API and bulk-inserts:
INSERT INTO "User" (id, email, "fullName", "totalSolved") VALUES
  ($1, $2, $3, $4),   -- User 1
  ($5, $6, $7, $8),   -- User 2
  ...
ON CONFLICT (id) DO UPDATE SET "fullName" = EXCLUDED."fullName";

INSERT INTO "Problem" (slug, title, platform, url, "difficultyValue") VALUES
  ($1, $2, $3, $4, $5), ...
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "Submission" (id, "userId", "problemSlug", "codeSnippet", tags, "createdAt") VALUES
  ($1, $2, $3, $4, $5, $6), ...;
```
This is a `createMany` operation that processes hundreds of records in a single transaction.

**2. Data Verification Queries:**
```sql
-- Count verification: JSON count must equal SQL count
SELECT COUNT(*) FROM "Submission";
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Problem";

-- Cross-reference: Every submission must have a valid user and problem
SELECT COUNT(*) FROM "Submission" s
LEFT JOIN "User" u ON s."userId" = u.id
WHERE u.id IS NULL;  -- Should return 0 (no orphan submissions)

SELECT COUNT(*) FROM "Submission" s
LEFT JOIN "Problem" p ON s."problemSlug" = p.slug
WHERE p.slug IS NULL;  -- Should return 0
```

**3. Database Connection Test:**
```javascript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('SELECT NOW() AS current_time');
console.log('Connected:', result.rows[0].current_time);
```

### Viva Questions & Answers

**Q1: During the ETL migration, you need to insert 500 submissions that reference 7 users and 200 problems. What's the correct insertion order, and why?**
> A: The order MUST be: (1) Users first, (2) Problems second, (3) Submissions last. This is because `Submission` has foreign keys to both `User` and `Problem`. If you try to insert a Submission before its referenced User exists, PostgreSQL raises a `foreign_key_violation` (error 23503). This is the database enforcing **referential integrity** — you cannot reference a row that doesn't exist. The ETL script uses `UPSERT` (INSERT ON CONFLICT) to handle re-runs where users/problems already exist.

**Q2: If 50 users submit solutions at the exact same second, what PostgreSQL mechanism prevents data corruption?**
> A: PostgreSQL uses **MVCC (Multi-Version Concurrency Control)**. Each transaction sees a snapshot of the database as it was at the transaction's start time. When 50 concurrent INSERTs arrive: each gets a new UUID (generated independently via `gen_random_uuid()`), each INSERT creates a new row version — there's no contention because each row is unique. The only potential bottleneck is the `UPDATE "User" SET totalSolved = totalSolved + 1` — if 50 updates target the SAME user, PostgreSQL serialises them using row-level locks. Each UPDATE waits for the previous one to commit, ensuring the counter reaches exactly +50.

**Q3: How would you verify that the migration preserved data integrity? Name 3 specific SQL queries you'd run.**
> A: (1) **Row count match**: `SELECT COUNT(*) FROM "Submission"` must equal the number of entries in the source JSON. (2) **Orphan check**: `SELECT COUNT(*) FROM "Submission" s LEFT JOIN "User" u ON s."userId" = u.id WHERE u.id IS NULL` must return 0. (3) **Duplicate check**: `SELECT id, COUNT(*) FROM "Submission" GROUP BY id HAVING COUNT(*) > 1` must return 0 rows — no duplicate primary keys.

**Q4: You're load-testing with k6. The database starts returning "too many connections" errors at 100 concurrent users. What's happening and how do you fix it?**
> A: Neon.tech (and PostgreSQL in general) has a maximum connection limit. Each serverless function invocation opens a new connection. With 100 concurrent users, we exceed the limit. Fixes: (1) **Connection pooling**: Our `pg.Pool` reuses connections, but in serverless, each cold start creates a new pool. Neon's built-in PgBouncer proxy handles this. (2) **Reduce pool size**: Set `pg.Pool({ max: 5 })` to limit per-instance connections. (3) **Queue requests**: Use Prisma's connection pool timeout to queue excess connections instead of failing immediately.

**Q5: Explain the difference between `prisma db push` and `prisma migrate dev`. When would you use each?**
> A: `prisma db push` reads the schema and directly applies changes to the database — no migration files, no history. It's ideal for prototyping and development where you don't care about rollback. `prisma migrate dev` generates a SQL migration file (e.g., `20260402_add_comments_table.sql`), stores it in `prisma/migrations/`, and applies it. This creates a versioned history of schema changes that can be reviewed, rolled back, and deployed in CI/CD. For a DBMS course project, `db push` is sufficient. For production with a team, `migrate dev` is mandatory.
