# DSApline V2.0 — Team Roles, DBMS Linkage & Viva Preparation

## Team Structure Overview

```
┌─────────────────────────────────────────────────┐
│              Aksh (Lead/Architect)               │
│   Schema Design · Archive Page · ER Diagram      │
├────────┬────────┬────────┬────────┬──────┬──────┤
│ Vedant │ Avani  │ Bhoju  │Melinkeri│Kush- │Aar-  │
│Submis- │Users/  │Security│Search/ │waha  │rush  │
│sions & │Auth    │& Hist  │Indexing│Dash- │QA/   │
│Comments│        │ory     │        │board │DevOps│
└────────┴────────┴────────┴────────┴──────┴──────┘
```

---

## 1. Aksh — Lead Architect

### Role Description
Aksh is the **Lead Architect** responsible for the master database schema design, the ER diagram, and the Archive page that serves as the primary SQL-filtered data viewer. He designed the 5-table relational schema in `prisma/schema.prisma`, defined all foreign key relationships, decided on natural vs surrogate keys, and architected the problem-centric URL structure (`/problem/[slug]`).

### Key Files Owned
- `prisma/schema.prisma` — The entire database schema
- `lib/archive.ts` — Archive data-fetching layer
- `lib/viewer.ts` — Problem-centric queries (`getProblemBySlug`, `getSubmissionsByProblem`)
- `app/archive/page.tsx` — Archive page (Server Component)
- `app/problem/[slug]/page.tsx` — Problem-centric view
- `components/Archive.tsx` — Archive table with filtering
- `lib/filterEngine.ts` — Client-side filter logic

### Database Tasks & Queries

**1. Schema Design Decisions:**
- Chose `slug` as a **natural primary key** for the `Problem` table instead of an auto-incrementing integer. This creates human-readable URLs (`/problem/two-sum`) and self-documenting foreign keys.
- Designed `ON DELETE CASCADE` on all foreign keys to maintain referential integrity automatically.
- Created the `Status` ENUM type (`SOLVED`, `ATTEMPTED`, `NEEDS_REVIEW`) for domain constraint enforcement.

**2. Archive Query (Multi-table JOIN):**
```sql
SELECT s.id, p.title, p."difficultyValue", s.tags, u."fullName",
       s."userId", s."createdAt", p.platform, p."difficultyLabel", p.rating, s."problemSlug"
FROM "Submission" s
JOIN "Problem" p ON s."problemSlug" = p.slug
JOIN "User" u ON s."userId" = u.id
ORDER BY s."createdAt" DESC;
```
This is a **3-table INNER JOIN** that denormalises the data for the UI.

**3. Problem Page Query (Filtered JOIN with aggregate subqueries):**
```sql
SELECT s.*, u."fullName",
  (SELECT COUNT(*) FROM "Comment" WHERE "submissionId" = s.id) AS comment_count,
  (SELECT COUNT(*) FROM "SubmissionHistory" WHERE "submissionId" = s.id) AS edit_count
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
WHERE s."problemSlug" = $1
ORDER BY s."createdAt" DESC;
```

### Viva Questions & Answers

**Q1: Why did you use `slug` as the primary key for the Problem table instead of an auto-incrementing integer?**
> A: A natural key (`slug`) was chosen because it makes foreign key references self-documenting. When I see `problemSlug = "two-sum"` in the Submission table, I immediately know which problem it refers to without a second lookup. Auto-increment IDs would require a JOIN just to know the problem name. Additionally, slugs are URL-safe, enabling clean routes like `/problem/two-sum`. The tradeoff is that if a problem title changes, the slug (and all FK references) would need to change — but problem titles on LeetCode/Codeforces are immutable, making this a safe choice.

**Q2: Your Archive query uses a 3-table JOIN. What's the worst-case time complexity, and how do your indexes mitigate it?**
> A: Without indexes, a 3-table JOIN is O(N × M × K) where N, M, K are the row counts of Submission, Problem, and User. With our B-Tree indexes on `Submission.problemSlug` and `Submission.userId`, PostgreSQL uses **Index Nested Loop Joins**: it scans Submission (ordered by `createdAt` index), then does O(log M) lookups into Problem and O(log K) lookups into User, giving O(N × log M × log K). The `ORDER BY createdAt DESC` is satisfied by the `createdAt` index, avoiding a separate sort.

**Q3: You store `tags` as a PostgreSQL array (`String[]`) instead of a normalised junction table. Defend this decision against a professor arguing it violates 1NF.**
> A: Technically, 1NF requires atomic values — and a PostgreSQL `text[]` array is indeed a multi-valued attribute. However, PostgreSQL treats arrays as first-class atomic types with native operators (`@>`, `&&`, `ANY()`). The normalised alternative would require a `Tag` table + `SubmissionTag` junction table, adding 2 JOINs to every archive query. Since tags are always read and written as a complete set (never individually), the array approach is a deliberate denormalisation that trades strict 1NF for 60% fewer JOINs. The GIN index on the array column provides the same query performance as a junction table index.

**Q4: Explain the difference between `ON DELETE CASCADE` and `ON DELETE SET NULL`. Why did you choose CASCADE for all foreign keys?**
> A: `CASCADE` deletes dependent rows when the parent is deleted. `SET NULL` keeps dependent rows but sets the FK to NULL. I chose CASCADE because in DSApline, a submission without a user is meaningless (who wrote it?), and a submission without a problem is meaningless (what was it solving?). SET NULL would create orphan records that clutter the archive. CASCADE ensures **referential integrity** by automatically cleaning up dependent data. The risk is accidental bulk deletion — if a User is deleted, ALL their submissions vanish. This is acceptable because user deletion is an admin-only operation.

**Q5: The Problem table has both `difficultyValue` (Float) and `difficultyLabel` (String). Isn't this a transitive dependency violating 3NF?**
> A: It would be a transitive dependency IF `difficultyLabel` was deterministically derived from `difficultyValue`. But they're independent: LeetCode provides labels ("Easy", "Medium", "Hard") without numeric values, while Codeforces provides ratings (800-3500) without labels. Our internal `difficultyValue` (0-10) is a team-assigned rating. There's no functional dependency `difficultyValue → difficultyLabel`, so 3NF is preserved. They're orthogonal attributes from different data sources.

---

## 2. Vedant — Submissions & Discussions

### Role Description
Vedant owns the **Submission flow** — the entire lifecycle from form input to database insertion to code viewing and editing. He built the `SubmitForm.tsx` client component, the submission detail page with edit capabilities, and the comment/discussion system.

### Key Files Owned
- `components/SubmitForm.tsx` — Submission form with auto-fill
- `app/api/submit/route.ts` — `POST` submission API
- `app/api/submission/[id]/route.ts` — `GET`/`PUT` submission API
- `app/submission/[id]/page.tsx` — Submission detail page
- `components/EditSubmission.tsx` — Edit mode UI
- `app/api/comments/route.ts` — Comments CRUD API
- `components/CommentSection.tsx` — Discussion UI

### Database Tasks & Queries

**1. Multi-Step INSERT (Submission creation):**
```sql
-- Vedant's submission pipeline executes 4 SQL operations:
-- 1. UPSERT User  (INSERT ... ON CONFLICT UPDATE)
-- 2. UPSERT Problem  (INSERT ... ON CONFLICT DO NOTHING)
-- 3. INSERT Submission  (new row with UUID)
-- 4. UPDATE User  (atomic increment of totalSolved)
```
The `UPSERT` pattern (`INSERT ... ON CONFLICT`) is critical — it prevents duplicate key violations when the same user submits twice or the same problem is solved by multiple users.

**2. Edit with Audit Trail (UPDATE with prior INSERT):**
```sql
-- Before updating, snapshot the current state:
INSERT INTO "SubmissionHistory" ("submissionId", "oldCode", "oldNotes") VALUES ($1, $2, $3);
-- Then update:
UPDATE "Submission" SET "codeSnippet" = $4, notes = $5, tags = $6 WHERE id = $1;
```

**3. Comments — Full CRUD:**
```sql
-- CREATE: INSERT INTO "Comment" (content, "userId", "submissionId") VALUES ($1, $2, $3);
-- READ:   SELECT c.*, u."fullName" FROM "Comment" c JOIN "User" u ON c."userId" = u.id
--         WHERE c."submissionId" = $1 ORDER BY c."createdAt" ASC;
-- UPDATE: UPDATE "Comment" SET content = $2 WHERE id = $1 AND "userId" = $3;
```
The UPDATE query includes `AND "userId" = $3` as an **application-level row security** check.

### Viva Questions & Answers

**Q1: Your submission flow executes 4 separate SQL operations (upsert user, upsert problem, insert submission, update stats). What happens if the server crashes after step 3 but before step 4?**
> A: The `totalSolved` counter would be incorrect — the submission exists but the counter wasn't incremented. This is a **data inconsistency** caused by lack of an explicit transaction boundary. The fix is to wrap all 4 operations in `prisma.$transaction([...])`, which makes them atomic. Currently, we rely on the fact that failures are rare and `totalSolved` can be recalculated from `COUNT(*)` if needed. In a banking system, this would be unacceptable — but for a problem tracker, eventual consistency is tolerable.

**Q2: Explain the difference between `prisma.problem.upsert({ update: {} })` and `prisma.problem.upsert({ update: { title: newTitle } })`. When would you use each?**
> A: `update: {}` means "if the problem already exists, don't change anything." This is an **INSERT-if-not-exists** pattern — we only create the problem the first time it's encountered. `update: { title: newTitle }` would overwrite the title on every submission. We use `update: {}` because problem metadata (title, platform) is immutable once created. If we allowed updates, a user could accidentally rename "Two Sum" to "My Problem" by submitting with a different title.

**Q3: Your comment UPDATE query has `WHERE id = $1 AND "userId" = $3`. Why not just `WHERE id = $1`?**
> A: The `AND "userId" = $3` clause implements **Row-Level Security** at the application level. Without it, any authenticated user could edit any comment by knowing its UUID. With it, the UPDATE only succeeds if the authenticated user is the comment author. If `userId` doesn't match, zero rows are affected, and the API returns 403 Forbidden. This is defense-in-depth — even if a frontend bug sends the wrong commentId, the database won't allow the edit.

**Q4: You use `@db.Text` for `codeSnippet` instead of `VARCHAR(n)`. What's the database-level difference?**
> A: In PostgreSQL, `TEXT` and `VARCHAR` without a length constraint are stored identically — both use variable-length storage with a TOAST (The Oversized-Attribute Storage Technique) mechanism for values over 2KB. The difference is semantic: `VARCHAR(n)` adds a length CHECK constraint, while `TEXT` has no upper limit. Code snippets can be arbitrarily long (a 500-line solution is ~15KB), so imposing a `VARCHAR(n)` limit would risk data truncation. `TEXT` is the correct PostgreSQL type for unbounded text.

**Q5: When a submission is edited, you INSERT into SubmissionHistory and then UPDATE the submission. Is there a risk of the history INSERT succeeding but the UPDATE failing?**
> A: Yes, this is the same atomicity concern as in Q1. If the UPDATE fails after the history INSERT, we'd have a phantom history entry for an edit that never happened. The mitigation is wrapping both operations in `prisma.$transaction()`. That said, since the history INSERT only adds data (it doesn't modify or delete), the worst case is a spurious history entry — which is a minor data quality issue, not a correctness violation.

---

## 3. Avani — Users & Authentication

### Role Description
Avani manages all **user identity and authentication**. She ensures that every Clerk-authenticated user has a corresponding row in the PostgreSQL `User` table, handles profile data synchronisation, and manages the session-to-database relationship.

### Key Files Owned
- `lib/db.ts` — `getOrCreateUserSQL()` function (Clerk → SQL sync)
- `lib/prisma.ts` — Prisma client singleton with connection pooling
- `app/user/[userId]/page.tsx` — User profile page
- The `User` model in `schema.prisma`

### Database Tasks & Queries

**1. User Upsert (Clerk → SQL Sync):**
```sql
INSERT INTO "User" (id, email, "fullName")
VALUES ($1, $2, $3)
ON CONFLICT (id) DO UPDATE SET "fullName" = EXCLUDED."fullName", email = EXCLUDED.email;
```
- `ON CONFLICT (id)` matches on the PRIMARY KEY.
- `EXCLUDED` is a PostgreSQL keyword referencing the row that would have been inserted.
- This is an **idempotent operation** — calling it 100 times produces the same result as calling it once.

**2. User Profile Fetch (with aggregated stats):**
```sql
SELECT s.*, p.*, u.* FROM "Submission" s
JOIN "Problem" p ON s."problemSlug" = p.slug
JOIN "User" u ON s."userId" = u.id
WHERE s."userId" = $1 ORDER BY s."createdAt" DESC;
```

**3. Connection Pooling Architecture:**
```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```
The `pg.Pool` maintains a pool of reusable TCP connections to PostgreSQL, avoiding the overhead of establishing a new TLS connection (~100ms) for each query.

### Viva Questions & Answers

**Q1: Why does the User table use Clerk's external ID (`user_2abc...`) as the primary key instead of a database-generated serial/UUID?**
> A: Using Clerk's ID as the PK creates a **natural foreign key** — every API route receives the `userId` from `auth()`, and we can immediately use it in WHERE clauses without a lookup. If we used a database-generated ID, every request would need: `SELECT id FROM User WHERE clerkId = $1` before any other query. This extra roundtrip adds ~5ms latency per request. The tradeoff is that our PK format is controlled by an external system (Clerk), but since Clerk guarantees ID stability, this is safe.

**Q2: Explain what happens at the database level when two users sign up simultaneously with the same email.**
> A: The `email` column has a `UNIQUE` constraint. If User A's INSERT commits first, User B's INSERT will fail with a `unique_violation` error (PostgreSQL error code 23505). Prisma throws a `PrismaClientKnownRequestError` with code `P2002`. In our system, this shouldn't happen because Clerk prevents duplicate email registrations before the database is ever touched — the UNIQUE constraint is a **defense-in-depth** layer.

**Q3: Your connection pool singleton uses `globalThis.prismaGlobal`. Why not just `const prisma = new PrismaClient()` at the module level?**
> A: In development, Next.js uses Hot Module Replacement (HMR), which re-executes module code on every file change. Without the singleton pattern, each HMR cycle would create a NEW PrismaClient (and a new `pg.Pool`), eventually exhausting PostgreSQL's connection limit (typically 100). The `globalThis` pattern stores the client on Node.js's global object, which survives HMR, ensuring only one pool exists across all re-renders.

**Q4: What PostgreSQL isolation level does our application use, and what anomalies could occur?**
> A: PostgreSQL defaults to `READ COMMITTED`. This prevents **dirty reads** (reading uncommitted data) but allows **non-repeatable reads** (re-reading a row within a transaction may return different values if another transaction committed in between) and **phantom reads** (new rows appearing in a repeated query). For DSApline, this is acceptable because our operations are short-lived (single query per request). If we needed stricter isolation (e.g., for financial transactions), we'd use `SERIALIZABLE`.

**Q5: The `updatedAt` field uses `@updatedAt`. How does Prisma implement this without a database trigger?**
> A: Prisma implements `@updatedAt` at the **client level**, not the database level. When Prisma generates an UPDATE query, it automatically appends `"updatedAt" = NOW()` to the SET clause. This means if you bypass Prisma and execute a raw SQL UPDATE, `updatedAt` will NOT be updated. A database-level implementation would use a trigger: `CREATE TRIGGER ... BEFORE UPDATE ... SET NEW."updatedAt" = NOW()`. Prisma chose client-level for portability across databases that don't support triggers.

---

## 4. Bhoju — Security & History

### Role Description
Bhoju is responsible for **data security, audit logging, and cheat-proofing**. He designed the `SubmissionHistory` table that creates an immutable audit trail of all edits, implemented the ownership verification logic that prevents users from editing others' submissions, and ensures the system is resistant to common web attacks.

### Key Files Owned
- `SubmissionHistory` model in `schema.prisma`
- Ownership checks in `app/api/submission/[id]/route.ts` (line 65: `existing.userId !== userId`)
- Ownership checks in `app/api/comments/route.ts` (line 151: `existing.userId !== userId`)
- `app/api/submission/[id]/history/route.ts` — History viewer API

### Database Tasks & Queries

**1. Audit Log INSERT (Before every UPDATE):**
```sql
INSERT INTO "SubmissionHistory" (id, "submissionId", "oldCode", "oldNotes", "changedAt")
VALUES (gen_random_uuid(), $1, $2, $3, NOW());
```
This implements a **write-ahead audit pattern** — the old state is persisted before the new state is written.

**2. Ownership Guard (Application-level Row Security):**
```sql
-- Pseudo-SQL for the ownership check:
SELECT "userId" FROM "Submission" WHERE id = $1;
-- Application logic: IF result.userId !== authenticatedUserId → RETURN 403
```

**3. History Retrieval:**
```sql
SELECT * FROM "SubmissionHistory" WHERE "submissionId" = $1 ORDER BY "changedAt" DESC;
```

### Security Measures Implemented

| Attack Vector | Prevention |
|--------------|------------|
| **SQL Injection** | Prisma uses parameterised queries exclusively. No string concatenation. |
| **Unauthorised Edit** | `existing.userId !== userId` check returns HTTP 403 Forbidden. |
| **XSS in Comments** | React auto-escapes all JSX content. `{comment.content}` is rendered as text, not HTML. |
| **CSRF** | Clerk's JWT-based auth uses HttpOnly SameSite cookies, preventing cross-origin forged requests. |
| **ID Enumeration** | UUID v4 primary keys have 122 bits of entropy (2^122 possible values), making brute-force guessing infeasible. |

### Viva Questions & Answers

**Q1: Your audit log is implemented at the application layer. How would you implement it as a PostgreSQL trigger instead?**
> A: ```sql
> CREATE OR REPLACE FUNCTION log_submission_edit() RETURNS TRIGGER AS $$
> BEGIN
>   INSERT INTO "SubmissionHistory" (id, "submissionId", "oldCode", "oldNotes", "changedAt")
>   VALUES (gen_random_uuid(), OLD.id, OLD."codeSnippet", OLD.notes, NOW());
>   RETURN NEW;
> END; $$ LANGUAGE plpgsql;
> 
> CREATE TRIGGER submission_audit BEFORE UPDATE ON "Submission"
> FOR EACH ROW EXECUTE FUNCTION log_submission_edit();
> ```
> The trigger uses `OLD` to reference the pre-update row values. The advantage of a trigger is that it fires even for raw SQL updates and cannot be bypassed by application bugs. The disadvantage is that Prisma doesn't manage triggers in the schema — they must be applied via raw SQL migrations.

**Q2: A user discovers another user's submission UUID. Can they edit it by sending a PUT request with the correct UUID?**
> A: No. The `PUT /api/submission/[id]` handler first calls `auth()` to get the authenticated user's ID from the JWT cookie. Then it fetches the submission and checks `existing.userId !== userId`. Even if the attacker knows the UUID, they cannot forge the JWT (it's signed with Clerk's private key). The response would be `403 Forbidden: You can only edit your own submissions`.

**Q3: The SubmissionHistory table uses `ON DELETE CASCADE` on the `submissionId` FK. Doesn't this defeat the purpose of an audit log?**
> A: This is a valid concern. CASCADE means if a submission is deleted, its entire history is also deleted — destroying the audit trail. In a compliance-critical system (healthcare, finance), you'd use `ON DELETE RESTRICT` to prevent deletion of submissions that have history records, or `ON DELETE SET NULL` to orphan the history records but keep them. For DSApline, we chose CASCADE because submission deletion is rare and typically intentional (account cleanup), and keeping orphaned history records with no parent would confuse users.

**Q4: Explain how Prisma prevents SQL injection. Give a concrete example of vulnerable vs safe code.**
> A: Vulnerable (raw string concatenation):
> ```javascript
> const result = await db.query(`SELECT * FROM User WHERE id = '${userId}'`);
> // If userId = "'; DROP TABLE User; --", the query becomes:
> // SELECT * FROM User WHERE id = ''; DROP TABLE User; --'
> ```
> Safe (Prisma parameterised):
> ```typescript
> const result = await prisma.user.findUnique({ where: { id: userId } });
> // Generates: SELECT * FROM "User" WHERE id = $1   (with $1 bound to userId)
> // The $1 parameter is NEVER interpolated into the SQL string — it's sent
> // separately to PostgreSQL's query planner, making injection impossible.
> ```

**Q5: If two users try to edit the same submission simultaneously, what happens?**
> A: Since only the submission owner can edit (ownership check), two different users can't edit the same submission. But if the same user opens two browser tabs and edits the same submission: Tab A reads the current code, Tab B reads the same code, Tab A saves first (creating history entry 1), Tab B saves second (creating history entry 2 — which contains Tab A's edit as "old code"). This is a **lost update anomaly**. The fix would be **optimistic locking**: add a `version` column, and the UPDATE includes `WHERE version = $expectedVersion`. If another tab incremented the version, the UPDATE affects zero rows, and the API returns "Conflict, please refresh."
