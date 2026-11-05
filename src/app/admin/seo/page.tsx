import type { Metadata } from "next";
import { Suspense } from "react";
import { isDemoAdmin } from "@/lib/seo/auth";
import { LoginForm, SeoHelper } from "./seo-helper";

export const metadata: Metadata = {
  title: "AI SEO Helper (Admin)",
  robots: { index: false, follow: false },
};

export default function AdminSeoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">AI SEO Helper</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Admin-only prototype · mock AI provider · fictional content only · human approval required
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Checking session…</p>}>
        <AdminGate />
      </Suspense>
    </main>
  );
}

// Authorization is decided on the server; the browser never holds an "isAdmin" flag.
async function AdminGate() {
  if (!(await isDemoAdmin())) return <LoginForm />;
  return <SeoHelper allowSimulation={process.env.NODE_ENV !== "production"} />;
}
