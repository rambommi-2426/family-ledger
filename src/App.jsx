import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth.jsx";
import {
  Home, Plus, PieChart, CalendarClock, ArrowLeft, Check, ChevronRight,
  LogOut, Copy, Send, AlertTriangle
} from "lucide-react";

const EMO = { Food:"🍜", Groceries:"🛒", Transport:"🛵", Rent:"🏠", Utilities:"💡", Health:"💊", Education:"📚", Shopping:"🛍️", Misc:"✨", Income:"💸" };
const CATS = Object.keys(EMO).filter((c) => c !== "Income");
const ROLE_META = {
  provider: { label: "Provider", hint: "Funds wallets, has own budget, sees everyone" },
  guardian: { label: "Guardian", hint: "Funds wallets, has own budget, sees everyone" },
  kid:      { label: "Kid",      hint: "Gets pocket money, logs own spends, sees only self" },
};
const PALETTE = ["#caff4d","#8b6bff","#ff6bb3","#4be3d0","#ffb84d","#ff6b6b"];
const isParent = (r) => r === "provider" || r === "guardian";
const inr = (n) => "₹" + Math.abs(Number(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const ymKey = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + d.getMonth(); };
const nowYM = () => ymKey(Date.now());
const dayLabel = (ts) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function advance(dateISO, cadence) {
  const d = new Date(dateISO + "T00:00:00");
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    let settled = false;
    // never hang on Loading: if Supabase doesn't answer in 6s, fall through to sign-in
    const timer = setTimeout(() => { if (!settled) setSession((s) => (s === undefined ? null : s)); }, 6000);
    supabase.auth.getSession()
      .then(({ data }) => { settled = true; clearTimeout(timer); setSession(data.session ?? null); })
      .catch(() => { settled = true; clearTimeout(timer); setSession(null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s ?? null); setProfile(undefined); });
    return () => { clearTimeout(timer); sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setProfile(session === null ? null : undefined); return; }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (active) setProfile(error ? null : (data ?? null));
      } catch (e) {
        if (active) setProfile(null);
      }
    })();
    return () => { active = false; };
  }, [session]);

  if (session === undefined || profile === undefined) return <Center>Loading…</Center>;
  if (session === null) return <Auth />;
  if (profile === null) return <Onboard onDone={setProfile} />;
  return <Main profile={profile} />;
}

function Center({ children }) { return <div className="center">{children}</div>; }

/* ----------------------------- onboarding ----------------------------- */
function Onboard({ onDone }) {
  const [mode, setMode] = useState("create");
  const [hhName, setHhName] = useState(""); const [code, setCode] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState("kid");
  const [color, setColor] = useState(PALETTE[0]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState("");

  const reload = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    onDone(data);
  };
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "create") {
        if (!hhName.trim() || !name.trim()) throw new Error("Fill household + your name");
        const { data, error } = await supabase.rpc("create_household", { p_name: hhName.trim(), p_display_name: name.trim(), p_role: role, p_color: color });
        if (error) throw error; setCreated(data);
      } else {
        if (!code.trim() || !name.trim()) throw new Error("Enter code + your name");
        const { error } = await supabase.rpc("join_household", { p_code: code.trim(), p_display_name: name.trim(), p_role: role, p_color: color });
        if (error) throw error; await reload();
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (created) return (
    <div className="onboard">
      <div className="brandmark">FAMILY LEDGER</div>
      <h1 className="display">{"You're\nset."}</h1>
      <p className="sub">Share this code with the family. They sign up, tap <b>Join</b>, enter it.</p>
      <div className="codebox"><div style={{ fontSize: 12, opacity: .7, letterSpacing: ".1em" }}>JOIN CODE</div><div className="c">{created}</div></div>
      <button className="ghost" onClick={() => navigator.clipboard?.writeText(created)}><Copy size={15} /> Copy code</button>
      <button className="cta" onClick={reload}>Enter <ChevronRight size={18} /></button>
    </div>
  );

  return (
    <div className="onboard">
      <div className="brandmark">FAMILY LEDGER</div>
      <h1 className="display">{mode === "create" ? "Start your\nhousehold." : "Join the\nfam."}</h1>
      <div className="tabs2">
        <button className={"tab2" + (mode === "create" ? " on" : "")} onClick={() => setMode("create")}>Create</button>
        <button className={"tab2" + (mode === "join" ? " on" : "")} onClick={() => setMode("join")}>Join</button>
      </div>
      <div className="card">
        {mode === "create"
          ? (<><label className="lbl">Household name</label><input className="inp" value={hhName} placeholder="The Ram Fam" onChange={(e) => setHhName(e.target.value)} /></>)
          : (<><label className="lbl">Join code</label><input className="inp" value={code} placeholder="6-char code" onChange={(e) => setCode(e.target.value.toUpperCase())} /></>)}
        <label className="lbl" style={{ marginTop: 14 }}>Your name</label>
        <input className="inp" value={name} placeholder="Appa, Amma, Vishnu…" onChange={(e) => setName(e.target.value)} />
        <label className="lbl" style={{ marginTop: 14 }}>Your role</label>
        <div className="rolerow">
          {Object.entries(ROLE_META).map(([k, m]) => <button key={k} className={"rolebtn" + (role === k ? " on" : "")} onClick={() => setRole(k)}>{m.label}</button>)}
        </div>
        <p className="rolehint">{ROLE_META[role].hint}</p>
        <label className="lbl">Colour</label>
        <div className="swatches">{PALETTE.map((c) => <span key={c} className={"sw" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
        {err && <div className="err">{err}</div>}
        <button className="primary big" style={{ marginTop: 18 }} disabled={busy} onClick={submit}>{busy ? "…" : mode === "create" ? "Create" : "Join"}</button>
      </div>
      <button className="ghost" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sign out</button>
    </div>
  );
}

/* ----------------------------- main ----------------------------- */
function Main({ profile }) {
  const [hh, setHh] = useState(null);
  const [members, setMembers] = useState([]);
  const [txns, setTxns] = useState([]);
  const [scheds, setScheds] = useState([]);
  const [screen, setScreen] = useState("home");
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const hid = profile.household_id;
  const parent = isParent(profile.role);

  const loadTxns = useCallback(async () => {
    const { data } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
    setTxns(data || []);
  }, []);
  const loadScheds = useCallback(async () => {
    const { data } = await supabase.from("schedules").select("*").eq("active", true);
    setScheds(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: m }] = await Promise.all([
        supabase.from("households").select("*").eq("id", hid).maybeSingle(),
        supabase.from("profiles").select("*").eq("household_id", hid),
      ]);
      setHh(h); setMembers(m || []);
      await Promise.all([loadTxns(), loadScheds()]);
    })();
    const ch = supabase.channel("tx-" + hid)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: "household_id=eq." + hid }, loadTxns)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hid, loadTxns, loadScheds]);

  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || "—";
  const balanceOf = (id) => txns.reduce((s, t) => t.member_id === id ? s + (t.type === "income" ? +t.amount : -+t.amount) : s, 0);
  const monthOf = (id, type) => txns.filter((t) => t.member_id === id && t.type === type && ymKey(t.created_at) === nowYM()).reduce((s, t) => s + +t.amount, 0);

  const addExpense = async ({ amount, category, note, payVpa }) => {
    await supabase.from("transactions").insert({ household_id: hid, member_id: profile.id, type: "expense", amount, category, note });
    loadTxns();
    if (payVpa) { try { window.location.href = `upi://pay?pa=${encodeURIComponent(payVpa)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note || category)}`; } catch (e) {} }
    flash("Logged ✓ 🎉"); setScreen("home");
  };
  const sendMoney = async ({ toId, amount, method, note }) => {
    await supabase.from("transactions").insert({ household_id: hid, member_id: toId, from_member_id: profile.id, type: "income", amount, method, note, status: "paid" });
    loadTxns(); flash(`Sent ${inr(amount)} to ${nameOf(toId)} ✓`); setScreen("home");
  };
  const markSent = async (sc) => {
    await supabase.from("transactions").insert({ household_id: hid, member_id: sc.to_member_id, from_member_id: profile.id, type: "income", amount: sc.amount, method: "bank", note: "Scheduled allowance", status: "paid" });
    await supabase.from("schedules").update({ next_due: advance(sc.next_due, sc.cadence) }).eq("id", sc.id);
    await Promise.all([loadTxns(), loadScheds()]); flash(`Sent ${inr(sc.amount)} to ${nameOf(sc.to_member_id)} ✓`);
  };

  if (!hh) return <Center>Loading…</Center>;
  const tabs = [
    { k: "home", I: Home, l: "Home" },
    { k: "stats", I: PieChart, l: parent ? "Family" : "Stats" },
    ...(parent ? [{ k: "sched", I: CalendarClock, l: "Schedule" }] : []),
  ];

  return (
    <div className="frame">
      {toast && <div className="toast">{toast}</div>}
      <div className="topbar">
        <div className="who"><span className="avatar sm" style={{ background: profile.color }}>{profile.display_name[0]}</span>
          <div><div className="whoname">{profile.display_name}</div><div className="whorole">{ROLE_META[profile.role].label} · {hh.name}</div></div></div>
        <button className="switch" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
      </div>
      <div className="body">
        {screen === "home" && <HomeScreen {...{ profile, parent, members, txns, scheds, nameOf, balanceOf, monthOf, markSent, go: setScreen }} />}
        {screen === "add" && <AddScreen {...{ profile, balanceOf, addExpense, go: setScreen, flash }} />}
        {screen === "send" && <SendScreen {...{ profile, members, sendMoney, go: setScreen, flash }} />}
        {screen === "sched" && <SchedScreen {...{ hid, members, scheds, reload: loadScheds, flash }} />}
        {screen === "stats" && <StatsScreen {...{ profile, parent, members, txns, balanceOf, monthOf }} />}
      </div>
      <div className="nav">
        {tabs.map((t) => <button key={t.k} className={"navbtn" + (screen === t.k ? " on" : "")} onClick={() => setScreen(t.k)}><t.I size={20} /><span>{t.l}</span></button>)}
        <button className="fab" onClick={() => setScreen("add")}><Plus size={28} strokeWidth={2.6} /></button>
      </div>
    </div>
  );
}

function vibe(bal, role, monthSpent, budgetGuess) {
  if (bal < 0) return { t: `Owes ${inr(bal)}`, e: "🛑", cls: "warn" };
  if (role === "kid" && budgetGuess > 0 && bal < budgetGuess * 0.2) return { t: "Running low", e: "😬", cls: "" };
  return { t: "Looking good", e: "🛼", cls: "" };
}

function HomeScreen({ profile, parent, members, txns, scheds, nameOf, balanceOf, monthOf, markSent, go }) {
  const myBal = balanceOf(profile.id);
  const mySpent = monthOf(profile.id, "expense");
  const myGot = monthOf(profile.id, "income");
  const v = vibe(myBal, profile.role, mySpent, myGot);
  const due = parent ? scheds.filter((s) => s.next_due <= todayISO()) : [];
  const others = members.filter((m) => m.id !== profile.id);
  const feed = (parent ? txns : txns.filter((t) => t.member_id === profile.id)).slice(0, 14);

  return (
    <div className="screen">
      <div className="hero">
        <div className="herolbl">my wallet · {parent ? "home budget" : "pocket money"}</div>
        <div className={"heroamt" + (myBal < 0 ? " neg" : "")}>{myBal < 0 ? "−" : ""}{inr(myBal)}</div>
        <div className="statusrow"><span className={"status " + v.cls}>{v.e} {v.t}</span><span className="heroin">spent {inr(mySpent)} this month</span></div>
      </div>

      {parent && due.length > 0 && (<>
        <div className="sectionhdr">time to send 🔔</div>
        <div className="duewrap">{due.map((s) => (
          <div className="duecard" key={s.id}>
            <span className="avatar sm" style={{ background: members.find((m) => m.id === s.to_member_id)?.color }}>{nameOf(s.to_member_id)[0]}</span>
            <div className="tmid"><div className="tcat">{nameOf(s.to_member_id)} · {s.cadence}</div><div className="tmeta">{inr(s.amount)} · due {s.next_due}</div></div>
            <button className="sentbtn" onClick={() => markSent(s)}><Check size={15} /> Sent</button>
          </div>))}
        </div>
      </>)}

      {parent && (<>
        <div className="sectionhdr">family wallets</div>
        <div className="wallets">{others.map((m) => {
          const b = balanceOf(m.id); const sp = monthOf(m.id, "expense");
          return (<div className="wcard" key={m.id}>
            <div className="wtop"><span className="avatar sm" style={{ background: m.color }}>{m.display_name[0]}</span></div>
            <div className={"wbal" + (b < 0 ? " neg" : "")}>{b < 0 ? "owes " : ""}{inr(b)}</div>
            <div className="wsub">{b < 0 ? "over" : "left"} · spent {inr(sp)}</div>
          </div>);
        })}</div>
        <button className="addincome" onClick={() => go("send")}><Send size={16} /> Send money</button>
      </>)}

      <div className="sectionhdr">recent moves</div>
      {feed.length === 0 ? <div className="empty">Nothing yet. Tap ＋ to log a spend.</div> : (
        <div className="txnlist">{feed.map((t, i) => (
          <div className="txn" key={t.id} style={{ animationDelay: i * 30 + "ms" }}>
            <span className="emo">{t.type === "income" ? "💸" : EMO[t.category] || "✨"}</span>
            <div className="tmid">
              <div className="tcat">{title(t, profile, nameOf)}{t.note && <span className="tnote"> · {t.note}</span>}</div>
              <div className="tmeta">{parent ? nameOf(t.member_id) + " · " : ""}{dayLabel(t.created_at)}</div>
            </div>
            <span className={"tamt " + t.type}>{t.type === "income" ? "+" : "–"}{inr(t.amount)}</span>
          </div>))}
        </div>)}
    </div>
  );
}
function title(t, profile, nameOf) {
  if (t.type === "expense") return t.category;
  if (t.member_id === profile.id) return "Pocket money";
  return "Sent to " + nameOf(t.member_id);
}

function AddScreen({ profile, balanceOf, addExpense, go }) {
  const [amt, setAmt] = useState(""); const [cat, setCat] = useState("Food");
  const [note, setNote] = useState(""); const [vpa, setVpa] = useState("");
  const bal = balanceOf(profile.id);
  const over = amt && (bal - +amt) < 0;
  const save = (pay) => { if (amt && +amt > 0) addExpense({ amount: +amt, category: cat, note: note.trim(), payVpa: pay ? vpa.trim() : "" }); };
  return (
    <div className="screen">
      <div className="formhdr"><button className="back" onClick={() => go("home")}><ArrowLeft size={20} /></button><span>log a spend</span></div>
      <div className="amtwrap"><span className="rupee">₹</span><input className="amtinp" inputMode="decimal" placeholder="0" value={amt} autoFocus onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
      {over ? <div className="warnpill"><AlertTriangle size={14} /> Puts you {inr(bal - +amt)} over — shows as owing.</div> : null}
      <label className="lbl">category</label>
      <div className="chips">{CATS.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{EMO[c]} {c}</button>)}</div>
      <label className="lbl" style={{ marginTop: 18 }}>note <span className="opt">(optional)</span></label>
      <input className="inp" value={note} placeholder="what's this for?" onChange={(e) => setNote(e.target.value)} />
      <label className="lbl" style={{ marginTop: 18 }}>pay to UPI id <span className="opt">(optional)</span></label>
      <input className="inp" value={vpa} placeholder="name@oksbi" onChange={(e) => setVpa(e.target.value)} />
      <div className="btnrow">
        <button className="primary" onClick={() => save(false)}><Check size={18} /> Save</button>
        <button className="pay" disabled={!vpa.trim()} onClick={() => save(true)}>Save &amp; Pay ⚡</button>
      </div>
      <p className="finehint">Logs first — the record stays no matter what. On iPhone the pay-launch may not auto-open; just open your UPI app and pay. Overspend is allowed, shows as owing.</p>
    </div>
  );
}

function SendScreen({ profile, members, sendMoney, go }) {
  const others = members.filter((m) => m.id !== profile.id);
  const [to, setTo] = useState(others[0]?.id || "");
  const [amt, setAmt] = useState(""); const [method, setMethod] = useState("bank"); const [note, setNote] = useState("");
  return (
    <div className="screen">
      <div className="formhdr"><button className="back" onClick={() => go("home")}><ArrowLeft size={20} /></button><span>send money</span></div>
      <label className="lbl">to</label>
      <select className="inp sel" value={to} onChange={(e) => setTo(e.target.value)}>{others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>
      <div className="amtwrap green" style={{ marginTop: 16 }}><span className="rupee">₹</span><input className="amtinp" inputMode="decimal" placeholder="0" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
      <label className="lbl">how</label>
      <div className="methodrow">{["bank","upi","cash"].map((x) => <button key={x} className={"methodbtn" + (method === x ? " on" : "")} onClick={() => setMethod(x)}>{x === "bank" ? "🏦 Bank" : x === "upi" ? "📲 UPI" : "💵 Cash"}</button>)}</div>
      <label className="lbl" style={{ marginTop: 16 }}>note <span className="opt">(optional)</span></label>
      <input className="inp" value={note} placeholder="e.g. weekly pocket money" onChange={(e) => setNote(e.target.value)} />
      <button className="primary big" style={{ marginTop: 20 }} disabled={!to || !amt} onClick={() => sendMoney({ toId: to, amount: +amt, method, note: note.trim() })}><Send size={17} /> I've sent it — record ✓</button>
      <p className="finehint">You transfer via your own bank/UPI (or hand cash), then tap to record it into their wallet.</p>
    </div>
  );
}

function SchedScreen({ hid, members, scheds, reload, flash }) {
  const [to, setTo] = useState(members[0]?.id || "");
  const [amt, setAmt] = useState(""); const [cadence, setCadence] = useState("weekly"); const [anchor, setAnchor] = useState(1);
  const add = async () => {
    if (!to || !amt) { flash("Pick person + amount"); return; }
    await supabase.from("schedules").insert({ household_id: hid, to_member_id: to, amount: +amt, cadence, anchor: +anchor, next_due: todayISO() });
    setAmt(""); reload(); flash("Schedule added");
  };
  const stop = async (id) => { await supabase.from("schedules").update({ active: false }).eq("id", id); reload(); };
  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || "—";
  return (
    <div className="screen">
      <div className="sectionhdr" style={{ marginTop: 4 }}>allowance schedules</div>
      <p className="sub sm">Set who gets how much, how often. On the due date you'll get a “time to send” nudge on Home — you tap Sent ✓ after transferring.</p>
      <div className="card">
        <label className="lbl">to</label>
        <select className="inp sel" value={to} onChange={(e) => setTo(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>
        <label className="lbl" style={{ marginTop: 12 }}>amount</label>
        <input className="inp" inputMode="decimal" value={amt} placeholder="500" onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
        <label className="lbl" style={{ marginTop: 12 }}>how often</label>
        <div className="methodrow">{["weekly","monthly"].map((c) => <button key={c} className={"methodbtn" + (cadence === c ? " on" : "")} onClick={() => setCadence(c)}>{c}</button>)}</div>
        <label className="lbl" style={{ marginTop: 12 }}>{cadence === "weekly" ? "day of week" : "day of month"}</label>
        {cadence === "weekly"
          ? <select className="inp sel" value={anchor} onChange={(e) => setAnchor(e.target.value)}>{DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
          : <input className="inp" inputMode="numeric" value={anchor} onChange={(e) => setAnchor(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1-28" />}
        <button className="primary" onClick={add}><Plus size={16} /> Add schedule</button>
      </div>
      <div className="memlist">{scheds.length === 0 ? <div className="empty">No schedules yet.</div> : scheds.map((s) => (
        <div className="schedrow" key={s.id}>
          <span className="avatar sm" style={{ background: members.find((m) => m.id === s.to_member_id)?.color }}>{nameOf(s.to_member_id)[0]}</span>
          <div style={{ flex: 1 }}><div className="memname">{nameOf(s.to_member_id)} · {inr(s.amount)}</div><div className="whorole">{s.cadence} · next {s.next_due}</div></div>
          <button className="x" onClick={() => stop(s.id)}>stop</button>
        </div>))}
      </div>
    </div>
  );
}

function StatsScreen({ profile, parent, members, txns, balanceOf, monthOf }) {
  const exp = (parent ? txns : txns.filter((t) => t.member_id === profile.id)).filter((t) => t.type === "expense" && ymKey(t.created_at) === nowYM());
  const total = exp.reduce((s, t) => s + +t.amount, 0);
  const byCat = {}; exp.forEach((t) => byCat[t.category] = (byCat[t.category] || 0) + +t.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]); const mc = cats[0]?.[1] || 1;
  const byMem = {}; if (parent) exp.forEach((t) => byMem[t.member_id] = (byMem[t.member_id] || 0) + +t.amount);
  const mems = Object.entries(byMem).sort((a, b) => b[1] - a[1]); const mm = mems[0]?.[1] || 1;
  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || "—";
  return (
    <div className="screen">
      <div className="sectionhdr" style={{ marginTop: 4 }}>{parent ? "the family — this month" : "your month"}</div>
      <div className="totalcard"><span>total spent</span><b>{inr(total)}</b></div>
      {parent && mems.length > 0 && (<><div className="sectionhdr">who spent what</div>
        {mems.map(([id, v]) => { const m = members.find((x) => x.id === id); return (
          <div className="catrow" key={id}><div className="catlbl"><span className="dot" style={{ background: m?.color }} />{nameOf(id)}</div><div className="catbar"><span style={{ width: (v / mm) * 100 + "%", background: m?.color }} /></div><div className="catval">{inr(v)}</div></div>); })}
      </>)}
      <div className="sectionhdr">where it went</div>
      {cats.length === 0 ? <div className="empty">No spending this month.</div> : cats.map(([c, v]) => (
        <div className="catrow" key={c}><div className="catlbl">{EMO[c]} {c}</div><div className="catbar"><span style={{ width: (v / mc) * 100 + "%" }} /></div><div className="catval">{inr(v)}</div></div>))}
    </div>
  );
}
