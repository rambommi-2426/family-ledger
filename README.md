# Family Ledger — wallet model (cloud, multi-device)

A shared family money app. Everyone has their own **wallet**; parents fund them.

## Roles
- **Provider / Guardian** (you + Amma) — fund anyone's wallet, have your own budget, see everyone, set schedules.
- **Kid** (Vishnu, Harsith) — gets pocket money, logs own spends, sees only their own wallet.

## How money works
- Each person has a **running balance** = money received − money spent. **Carryover**: unspent rolls forward, never resets.
- **Schedules**: set a fixed weekly/monthly amount per person. On the due date Home shows a **“time to send”** nudge; you transfer via your own bank/UPI, then tap **Sent ✓** to record it into their wallet (and the schedule rolls to the next date).
- **Send money**: ad-hoc top-ups any time, tagged Bank / UPI / Cash.
- **Overspend** is allowed — the balance goes negative and shows “owes”, with a warning. Never blocked.

## Logging spends
- Quick log: amount + category + note.
- Optional **Save & Pay**: if you enter a payee UPI id it best-effort opens your UPI app with the amount pre-filled. On iPhone this may not auto-launch — the spend is logged anyway; just open your UPI app and pay.

## Visibility
- Kids: only their own wallet + spends.
- Parents: every wallet + everyone's feed + the **Family** stats (who spent what, by category). On a tablet/laptop the layout widens.

---

## Setup
1. **Supabase** → SQL Editor → paste all of `supabase/schema.sql` → Run.
2. Authentication → Email → turn **OFF** “Confirm email” (so the family logs in immediately).
3. Project Settings → API → copy URL + anon key.
4. `cp .env.example .env` and paste them in.
5. `npm install` then `npm run dev`.
6. Deploy to Vercel (preset: Vite) with the two env vars.
7. Each phone: open the URL → Add to Home Screen (works on iPhone & Android).

## First run
- You sign up → **Create** household → get the 6-char code.
- Amma + the boys sign up → **Join** with the code, pick their role.
- You/Amma → **Schedule** tab → set each kid's weekly/monthly amount.

## Notes
- The “time to send” nudge appears in-app whenever something is due. **Proactive push/email reminders** (so you're pinged even without opening the app) are the next iteration — they need a notification channel (email or web-push) wired up; the schedule data is already there for it.
- This records money; it does not move it. Reconciling against a real bank statement is the petty-cash branch, not this app.
