# Task 3: Safe AI SEO Helper (prototype)

Admin-only helper that turns a page title and a fictional description into an SEO title, a meta description and 2–3 FAQs. A **mock** AI provider generates the suggestion, it is validated, and it waits for **explicit human approval**. Nothing is ever published.

Stack: Next.js 16.4.5 (App Router, `cacheComponents`), React 19, TypeScript, Tailwind CSS, Zod. No extra dependencies, no database, no paid API.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000/admin/seo   (/ redirects there)
```

## Configure demo authentication

Create `.env.local` (git-ignored; never commit it):

```bash
DEMO_ADMIN_SECRET=<choose a demo admin password>
SESSION_SECRET=<random string, 32+ characters>
# generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- Both values are server-only. Neither uses a `NEXT_PUBLIC_` prefix, and only `src/lib/seo/auth.ts` (marked `server-only`) reads them.
- After login the browser receives an HTTP-only, `SameSite=Strict` cookie `admin.<expiry>.<HMAC signature>` that expires after 30 minutes. It never contains the password or a secret.
- If `SESSION_SECRET` is missing, login fails closed.
- **This is a demonstration mechanism, not production authentication.**

## Architecture

```
/admin/seo (server component: checks the session cookie on the server)
 ├─ no session → login form → POST /api/auth/login
 └─ admin → SEO helper
      ├─ POST /api/seo/generate
      │    same-origin check → admin check → validate input (Zod, no personal data)
      │    → provider.generate() → validate output (Zod, no invented claims)
      │    → save draft in memory as "pending_approval"
      ├─ POST /api/seo/drafts/[id]/review   { "decision": "approve" | "reject" }
      │    same-origin check → admin check → only a pending draft → approved | rejected
      └─ POST /api/auth/logout
```

| File | Purpose |
| --- | --- |
| `src/lib/seo/provider.ts` | `SeoProvider` interface and `getSeoProvider()`, the single place a real LLM would plug in |
| `src/lib/seo/mock-provider.ts` | Deterministic mock (no network). Dev-only failure modes: `invalid_output`, `provider_error` |
| `src/lib/seo/schema.ts` | Zod schemas for input, output, login and review, plus regex safety rules (personal data, unsupported claims) |
| `src/lib/seo/auth.ts` | Password check, signed session cookie, `isDemoAdmin()`, `isSameOrigin()` (CSRF) |
| `src/lib/seo/drafts.ts` | In-memory draft store (`pending_approval` → `approved` / `rejected`) |
| `src/app/api/...` | Route handlers: login, logout, generate, review |
| `src/app/admin/seo/` | Admin page (server) and form/preview/approval UI (client) |

**Provider interface.** Output is typed `unknown` on purpose, so whatever a model returns must pass `SeoOutputSchema` before anyone sees it:

```ts
export interface SeoProvider {
  generate(input: SeoInput): Promise<unknown>;
}
```

To connect a real LLM, implement `SeoProvider` in a server-only module that reads its API key from a server env var, and return it from `getSeoProvider()`. No route or UI code changes.

## Sample input (fictional)

- **Title:** Neon Nights Indoor Music Festival
- **Description:** A fictional evening of live electronic music, light shows and food stalls at Space42 Arena, created for this SEO prototype. Friends and families can explore several stages and an immersive lighting experience.

## Sample output (actual response from `POST /api/seo/generate`, HTTP 201)

```json
{
  "status": "pending_approval",
  "published": false,
  "suggestion": {
    "seoTitle": "Neon Nights Indoor Music Festival | Space42 Arena",
    "metaDescription": "A fictional evening of live electronic music, light shows and food stalls at Space42 Arena, created for this SEO prototype. Friends and families can explore...",
    "faqs": [
      { "question": "What is Neon Nights Indoor Music Festival?",
        "answer": "This is a fictional example event created to demonstrate an AI-assisted SEO content workflow." },
      { "question": "Where can I verify the event details?",
        "answer": "Please consult the official event listing or contact the venue to confirm dates, availability, and other details." }
    ]
  }
}
```

Failure responses (dev-only simulation):

- `invalid_output` → `502 {"error":"AI output failed validation (format, length or unsupported claims). Nothing was saved."}`
- `provider_error` → `502 {"error":"SEO suggestion generation failed. Please try again."}` (the internal error appears only in the server log)

## Safety and human approval

1. Only an admin can use the helper: every page render and API call re-checks a signed, 30-minute HTTP-only session cookie on the server, and POSTs from another origin are rejected (CSRF).
2. No customer data leaves the server: input is fictional-only, emails and phone/card numbers are rejected, the mock makes no network calls, and a real LLM key would stay in a server-only env var.
3. AI output is treated as untrusted: Zod enforces shape and length and rejects invented prices, dates, guarantees or availability claims, so bad output is never saved.
4. Provider failures and invalid output return a generic 502 message; details go only to server logs, never stack traces or secrets.
5. Every suggestion is saved server-side as `pending_approval`; only an authenticated admin can approve or reject it after checking the facts, and approval only records that decision, so nothing is ever published automatically.

## Tests executed (2026-11-05)

Static checks: `npx tsc --noEmit` ✅ · `npx eslint` ✅ · `npm run build` ✅

HTTP checks against `npm run dev` (a throwaway Node `fetch` script, kept out of the repo to keep it minimal): **43 passed, 0 failed**.

| # | Required case | Result |
| --- | --- | --- |
| 1 | Unauthenticated generation denied | ✅ 401 without a session; 403 from another origin or without an `Origin` header |
| 2 | Invalid input rejected | ✅ 400 for short title/description, unknown field, email, phone number, invalid JSON |
| 3 | Valid input gives a schema-valid suggestion | ✅ 201, lengths within limits, 2 FAQs, `pending_approval`, no invented claims |
| 4 | Invalid provider output rejected | ✅ 502, no draft returned |
| 5 | Provider error fails safely | ✅ 502 generic message, no internal error text or stack trace |
| 6 | Unauthorized approval denied | ✅ 401 without a session or with a tampered cookie; 403 from another origin |
| 7 | Admin can approve or reject | ✅ approve → `approved`, reject → `rejected`; re-review 409; unknown draft 404; bad decision 400 |
| 8 | Nothing auto-published | ✅ `published: false` before and after approval; no publish endpoint (404) |

Also verified:

- Login: wrong password 401, other origin 403.
- Cookie: `HttpOnly`, `SameSite=Strict`, `Max-Age=1800`, no secret in the value.
- The page shows the login form, not the helper, without a session.
- Logout clears the cookie.
- No secret appeared in any response body.

**Production mode** (`next build` + `next start`):

- Login sets a `Secure` cookie.
- Generate → 201, then approve → `approved` with `published: false`.
- Unauthenticated generate → 401.
- Failure simulation is refused (400) and hidden in the UI.

## Known limitations

- **Demo auth:** one shared password, no user accounts, no login rate limiting. Logout deletes the cookie, but a copied token stays valid until it expires (no server-side revocation).
- **In-memory drafts:** lost on restart, not shared across server instances, no audit trail of who approved.
- **Heuristic checks:** the regex checks are heuristics. They cannot detect invented performer names or subtle inaccuracies, so human review is the real control.
- **Mock output:** the mock is template-based. It copies the description into the meta description, so a price or date in the input causes the output to be rejected.

## Production improvements

- Real identity provider (SSO/OIDC) with roles, server-side sessions, login rate limiting and an audit log.
- Database-backed drafts with reviewer identity and history. Publishing would be a separate CMS step with its own permission.
- Real LLM provider behind `SeoProvider`:
  - server-only key
  - timeouts and retries
  - structured JSON output
  - a system prompt that forbids unsupported claims
  - a vendor with a no-training / data-processing agreement
- Security headers (CSP `frame-ancestors`), monitoring, and automated unit and Playwright tests in CI.
