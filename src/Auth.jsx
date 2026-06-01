import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        setInfo("Account created. If email confirmation is on, check your inbox — otherwise sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="brandmark">FAMILY LEDGER</div>
      <h1 className="display">{mode === "signup" ? "Create your\naccount." : "Welcome\nback."}</h1>
      <p className="sub">One account per family member. After signing in you'll create or join your household.</p>

      <div className="tabs2">
        <button className={"tab2" + (mode === "signin" ? " on" : "")} onClick={() => setMode("signin")}>Sign in</button>
        <button className={"tab2" + (mode === "signup" ? " on" : "")} onClick={() => setMode("signup")}>Sign up</button>
      </div>

      <div className="card">
        <label className="lbl">Email</label>
        <input className="inp" type="email" autoComplete="email" value={email}
          placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        <label className="lbl" style={{ marginTop: 14 }}>Password</label>
        <input className="inp" type="password" autoComplete="current-password" value={pw}
          placeholder="••••••••" onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        {err && <div className="err">{err}</div>}
        {info && <div className="err" style={{ background: "#dcefe7", color: "#1f5346" }}>{info}</div>}
        <button className="primary big" style={{ marginTop: 18 }} disabled={busy || !email || !pw} onClick={submit}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
