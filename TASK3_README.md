# Task 3: Safe AI SEO Helper (prototype)

Admin-only helper that turns a page title and a fictional description into an SEO title, a meta description and 2–3 FAQs. A mock AI provider generates the suggestion; it is validated and then waits for human approval. Nothing is ever published.

## Run it

1. Create `.env.local`. It is git-ignored, and both values are server-only (no `NEXT_PUBLIC_` prefix):

   ```bash
   DEMO_ADMIN_SECRET=<choose a demo admin password>
   SESSION_SECRET=<random string, 32+ characters>
   # generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Start the app:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000/admin/seo, or the port shown in the terminal if 3000 is busy.

Demo only: one shared admin password, and drafts kept in memory (lost on restart, single server instance). Not production authentication or storage.

## Sample input (fictional)

- **Title:** Neon Nights Indoor Music Festival
- **Description:** A fictional evening of live electronic music, light shows and food stalls at Space42 Arena, created for this SEO prototype. Friends and families can explore several stages and an immersive lighting experience.

## Sample output

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

Error examples:

- **Email in the description:** `Remove personal data (emails, phone numbers). Use fictional content only.`
- **Provider returns invalid output** (dev-only simulation): `AI output failed validation (format, length or unsupported claims). Nothing was saved.`
- **Provider throws an error** (dev-only simulation): `SEO suggestion generation failed. Please try again.`

## Safety and human approval

1. Only an admin can use the helper: the page and every Server Action re-check a signed, 30-minute HTTP-only session cookie on the server, and Next.js rejects Server Action calls from other origins (CSRF).
2. No customer data leaves the server: input is fictional-only, emails and phone/card numbers are rejected, the mock makes no network calls, and a real LLM key would stay in a server-only env var.
3. AI output is treated as untrusted: Zod enforces shape and length and rejects invented prices, dates, guarantees or availability claims, so bad output is never saved.
4. Provider failures and invalid output return a generic error message; details go only to server logs, never stack traces or secrets.
5. Every suggestion is saved server-side as `pending_approval`; only an authenticated admin can approve or reject it after checking the facts, and approval only records that decision, so nothing is ever published automatically.
