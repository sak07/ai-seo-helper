"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SeoDraft } from "@/lib/seo/types";

const SAMPLE_TITLE = "Neon Nights Indoor Music Festival";
const SAMPLE_DESCRIPTION =
  "A fictional evening of live electronic music, light shows and food stalls at Space42 Arena, created for this SEO prototype. Friends and families can explore several stages and an immersive lighting experience.";

// Shared Tailwind classes
const card = "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm";
const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";
const button = "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";

const STATUS_LABEL: Record<SeoDraft["status"], string> = {
  pending_approval: "Pending Approval",
  approved: "Approved (not published)",
  rejected: "Rejected",
};

const STATUS_STYLE: Record<SeoDraft["status"], string> = {
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

type ApiResult = {
  ok: boolean;
  status: number;
  data: { error?: string; fields?: Record<string, string[]>; draft?: SeoDraft };
};

/** POST JSON to our own API. The browser sends the session cookie automatically. */
async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error. Please try again." } };
  }
}

/** Turns an API error into one readable line, including field validation errors. */
function getErrorMessage(data: ApiResult["data"]): string {
  const messages = [data.error ?? "Something went wrong"];
  for (const [field, fieldMessages] of Object.entries(data.fields ?? {})) {
    messages.push(`${field}: ${fieldMessages.join(", ")}`);
  }
  return messages.join(" | ");
}

// ---------------------------------------------------------------------------
// Login form (shown when the server says there is no valid admin session)
// ---------------------------------------------------------------------------

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await postJson("/api/auth/login", { password });
    setLoading(false);

    if (!result.ok) {
      setError(getErrorMessage(result.data));
      return;
    }
    router.refresh(); // the server re-checks the new cookie and renders the helper
  }

  return (
    <form onSubmit={handleLogin} className={`${card} mt-8 max-w-sm space-y-3`}>
      <h2 className="font-semibold">Admin login</h2>
      <p className="text-xs text-zinc-500">Demo authentication only, not production auth.</p>
      <input
        type="password"
        required
        placeholder="Demo admin password"
        className={input}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={loading} className={`${button} w-full bg-zinc-900 text-white`}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SEO helper (shown only to a logged-in admin)
// ---------------------------------------------------------------------------

export function SeoHelper({ allowSimulation }: { allowSimulation: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [description, setDescription] = useState(SAMPLE_DESCRIPTION);
  const [simulate, setSimulate] = useState("");
  const [draft, setDraft] = useState<SeoDraft | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** Shows the draft returned by the server, or the error. */
  function showResult(result: ApiResult) {
    if (result.status === 401) {
      router.refresh(); // session expired: the server will show the login form
      return;
    }
    if (!result.ok || !result.data.draft) {
      setError(getErrorMessage(result.data));
      return;
    }
    setDraft(result.data.draft);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setDraft(null);

    const body = simulate ? { title, description, simulate } : { title, description };
    const result = await postJson("/api/seo/generate", body);

    setLoading(false);
    showResult(result);
  }

  async function handleReview(decision: "approve" | "reject") {
    if (!draft) return;
    setLoading(true);
    setError("");

    const result = await postJson(`/api/seo/drafts/${draft.id}/review`, { decision });

    setLoading(false);
    showResult(result);
  }

  async function handleLogout() {
    await postJson("/api/auth/logout", {});
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-600">Signed in as demo admin</span>
        <button onClick={handleLogout} className={`${button} border border-zinc-300`}>
          Log out
        </button>
      </div>

      {/* Input form */}
      <form onSubmit={handleGenerate} className={`${card} space-y-4`}>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Page title</span>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Fictional description</span>
          <textarea
            className={`${input} min-h-28`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <span className="text-xs text-zinc-500">
            Fictional content only. Do not enter customer or personal data.
          </span>
        </label>

        {allowSimulation && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Failure simulation (dev only)</span>
            <select className={input} value={simulate} onChange={(e) => setSimulate(e.target.value)}>
              <option value="">None (normal mock output)</option>
              <option value="invalid_output">Provider returns invalid output</option>
              <option value="provider_error">Provider throws an error</option>
            </select>
          </label>
        )}

        <button disabled={loading} className={`${button} bg-zinc-900 text-white`}>
          {loading ? "Working..." : "Generate SEO Suggestions"}
        </button>
      </form>

      {/* Error message */}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Generated suggestion + review */}
      {draft && (
        <section className={`${card} space-y-5`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Suggestion (fictional example)</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[draft.status]}`}>
              {STATUS_LABEL[draft.status]}
            </span>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              SEO title ({draft.suggestion.seoTitle.length}/60)
            </p>
            <p className="text-lg text-blue-700">{draft.suggestion.seoTitle}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              Meta description ({draft.suggestion.metaDescription.length}/160)
            </p>
            <p className="text-sm text-zinc-700">{draft.suggestion.metaDescription}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">FAQs</p>
            <dl className="mt-2 space-y-3">
              {draft.suggestion.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-sm font-medium">{faq.question}</dt>
                  <dd className="text-sm text-zinc-700">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            A human must check every fact before approving. Approving only records your review
            decision. It does <strong>not</strong> publish anything to a live website.
          </p>

          {draft.status === "pending_approval" ? (
            <div className="flex gap-3">
              <button
                disabled={loading}
                onClick={() => handleReview("approve")}
                className={`${button} bg-green-700 text-white`}
              >
                Approve
              </button>
              <button
                disabled={loading}
                onClick={() => handleReview("reject")}
                className={`${button} border border-red-300 text-red-700`}
              >
                Reject
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Decision saved on the server. Nothing was published.</p>
          )}
        </section>
      )}
    </div>
  );
}
