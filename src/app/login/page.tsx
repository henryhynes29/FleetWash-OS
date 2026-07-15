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

  const google = async () => {
    setErr("");
    const { error } = await sbBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
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
          <>
            <button className="btn" onClick={google} style={{ width: "100%", background: "#fff", color: "#1F2937", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.5 2 8.2 6.8 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6c-2.1 1.6-4.8 2.6-7.7 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C8.1 41.1 15.4 46 24 46z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.6 5.6C41.9 36.6 46 31 46 24c0-1.5-.2-2.6-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
            <div className="dim" style={{ textAlign: "center", fontSize: 12, margin: "14px 0" }}>— or use your email —</div>
            <form onSubmit={send}>
              <input className="inp" type="email" name="email" inputMode="email" autoComplete="email"
                autoCapitalize="off" autoCorrect="off" placeholder="you@company.com" />
              {err && <div style={{ color: "var(--red)", fontWeight: 700, marginTop: 8, fontSize: 14, lineHeight: 1.4 }}>{err}</div>}
              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 12, opacity: busy ? 0.6 : 1 }} disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
