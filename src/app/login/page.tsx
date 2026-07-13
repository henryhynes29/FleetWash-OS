"use client";
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-client";

export default function Login() {
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    // Read the ACTUAL box contents — immune to autofill not updating state
    const email = String(new FormData(e.currentTarget).get("email") || "").trim().toLowerCase();
    if (!email.includes("@") || !email.includes(".")) {
      setErr("Enter your full email address (like you@gmail.com).");
      return;
    }
    setBusy(true);
    try {
      const { error } = await sbBrowser().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setErr(
          /rate|limit|seconds/i.test(error.message)
            ? "Too many attempts — Supabase's free email sender allows only a few per hour. Wait a bit, check spam for earlier emails, or send a magic link from the Supabase dashboard (Authentication → Users)."
            : error.message
        );
      } else setSent(email);
    } catch {
      setErr("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="disp" style={{ fontSize: 28 }}>FleetWash <span style={{ color: "var(--orange)" }}>OS</span></div>
      <div className="dim" style={{ margin: "6px 0 26px" }}>Sign in with your work email</div>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {sent ? (
          <div className="card" style={{ textAlign: "center", borderColor: "var(--green)" }}>
            <div style={{ fontSize: 30 }}>✉️</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>Check your email</div>
            <div className="dim" style={{ fontSize: 14, marginTop: 4 }}>
              Sign-in link sent to <b>{sent}</b>. Check spam too — the sender is Supabase.
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 14, minHeight: 42, fontSize: 13 }} onClick={() => setSent("")}>
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <input className="inp" type="email" name="email" inputMode="email" autoComplete="email"
              autoCapitalize="off" autoCorrect="off" placeholder="you@company.com" />
            {err && <div style={{ color: "var(--red)", fontWeight: 700, marginTop: 8, fontSize: 14, lineHeight: 1.4 }}>{err}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 12, opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
