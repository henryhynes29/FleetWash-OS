"use client";
import { useState } from "react";
import { sbBrowser } from "@/lib/supabase-client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setErr("");
    const { error } = await sbBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr(error.message); else setSent(true);
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
            <div className="dim" style={{ fontSize: 14, marginTop: 4 }}>Tap the sign-in link we sent to {email}.</div>
          </div>
        ) : (
          <>
            <input className="inp" type="email" inputMode="email" placeholder="you@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            {err && <div style={{ color: "var(--red)", fontWeight: 700, marginTop: 8, fontSize: 14 }}>{err}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={send} disabled={!email.includes("@")}>
              Email me a sign-in link
            </button>
          </>
        )}
      </div>
    </main>
  );
}
