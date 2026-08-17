/**
 * The one scheduled job.
 *
 * Three gaps in this product were all the same missing piece: reminders were
 * computed but never left the browser, recurring tasks only generated when
 * someone happened to open the app, and a subscription could lapse with no
 * warning. All three need something that runs whether or not anyone is looking.
 *
 * Runs daily via pg_cron. Safe to run more than once a day — every send is
 * recorded against a dedupe key that includes the date, so a second run in the
 * same day sends nothing.
 *
 * Entitlement itself needs no job: user_plan_limits() checks the clock, so a
 * plan expires on read. This only sends the WARNING beforehand.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

type EmailSettings = {
  provider: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
};

type PendingRow = {
  kind: string;
  user_id: string;
  email: string;
  first_name: string | null;
  subject_ref: string;
  due_on: string;
  days_left: number;
  detail: Record<string, unknown>;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Service role, deliberately: this job writes for every user and must bypass
// RLS. It runs server-side only and is never exposed to a browser.
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_API_KEY = Deno.env.get("EMAIL_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://bachat-book-seven.vercel.app";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic on purpose. The account is configured in the admin console
 * (from name, from address, which provider) while the KEY stays an environment
 * variable — a stolen admin session should not also grant the ability to send
 * mail as the product.
 */
async function sendEmail(
  cfg: EmailSettings,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!EMAIL_API_KEY) return { ok: false, error: "EMAIL_API_KEY is not set" };
  if (!cfg.from_email) return { ok: false, error: "No from address configured" };

  const from = cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;

  try {
    if (cfg.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${EMAIL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          ...(cfg.reply_to ? { reply_to: cfg.reply_to } : {}),
        }),
      });
      if (!res.ok) return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
      return { ok: true };
    }

    if (cfg.provider === "postmark") {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": EMAIL_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          From: from,
          To: to,
          Subject: subject,
          HtmlBody: html,
          ...(cfg.reply_to ? { ReplyTo: cfg.reply_to } : {}),
          MessageStream: "outbound",
        }),
      });
      if (!res.ok) return { ok: false, error: `postmark ${res.status}: ${await res.text()}` };
      return { ok: true };
    }

    return { ok: false, error: `Provider "${cfg.provider}" is not implemented yet` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

function shell(body: string): string {
  // Inline styles and a table-free layout: every rule below survives Gmail,
  // Outlook and the Pakistani webmail clients that strip <style> blocks.
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#12161F">
  <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#C6A15B;margin:0 0 16px">Bachat Book</p>
  ${body}
  <hr style="border:0;border-top:1px solid #E2DCCE;margin:28px 0 14px">
  <p style="font-size:11px;color:#99A0AA;margin:0">
    You are getting this because you have an account with Bachat Book.
    <a href="${SITE_URL}/settings/preferences" style="color:#7A5F22">Change what you receive</a>.
  </p>
</div>`;
}

function subscriptionEmail(row: PendingRow) {
  // Escaped: a display name is user-supplied and goes straight into HTML.
  const name = escapeHtml(row.first_name || "there");
  const trialing = row.detail?.status === "trialing";
  const noun = trialing ? "trial" : "subscription";

  const subject =
    row.days_left <= 0
      ? `Your Bachat Book ${noun} has ended`
      : `Your Bachat Book ${noun} ends in ${row.days_left} day${row.days_left === 1 ? "" : "s"}`;

  const body =
    row.days_left <= 0
      ? `<h1 style="font-size:20px;margin:0 0 12px">Your ${noun} has ended</h1>
         <p style="font-size:14px;line-height:1.6;margin:0 0 14px">Assalam-o-Alaikum ${name}, your ${row.subject_ref} ${noun} finished today. You are on the free plan now.</p>
         <p style="font-size:14px;line-height:1.6;margin:0 0 18px"><strong>Nothing has been deleted.</strong> If you had more than two workspaces, the extra ones are still there and still readable — they just cannot be edited until you subscribe again.</p>`
      : `<h1 style="font-size:20px;margin:0 0 12px">${row.days_left} day${row.days_left === 1 ? "" : "s"} left</h1>
         <p style="font-size:14px;line-height:1.6;margin:0 0 14px">Assalam-o-Alaikum ${name}, your ${row.subject_ref} ${noun} ends on ${row.due_on}.</p>
         <p style="font-size:14px;line-height:1.6;margin:0 0 18px">When it does you drop to the free limits. Any workspace beyond the first two becomes view-only — everything inside stays readable, and comes back the moment you subscribe again.</p>`;

  return {
    subject,
    html: shell(
      `${body}<a href="${SITE_URL}/settings/plan" style="display:inline-block;background:#0B1A33;color:#EDE7DA;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600">View your plan</a>`,
    ),
  };
}

function taskEmail(rows: PendingRow[]) {
  const name = escapeHtml(rows[0].first_name || "there");
  const overdue = rows.filter((r) => r.days_left < 0);
  const today = rows.filter((r) => r.days_left === 0);

  const list = (items: PendingRow[]) =>
    items
      .map(
        (r) =>
          `<li style="margin-bottom:6px">${escapeHtml(r.subject_ref)}${
            r.days_left < 0 ? ` <span style="color:#A33A32">(${Math.abs(r.days_left)}d overdue)</span>` : ""
          }</li>`,
      )
      .join("");

  return {
    subject:
      overdue.length > 0
        ? `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} in Bachat Book`
        : `${today.length} task${today.length === 1 ? "" : "s"} due today`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 12px">What needs you</h1>
       <p style="font-size:14px;line-height:1.6;margin:0 0 14px">Assalam-o-Alaikum ${name},</p>
       ${today.length ? `<p style="font-size:13px;font-weight:600;margin:0 0 6px">Due today</p><ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 14px">${list(today)}</ul>` : ""}
       ${overdue.length ? `<p style="font-size:13px;font-weight:600;margin:0 0 6px">Overdue</p><ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 18px">${list(overdue)}</ul>` : ""}
       <a href="${SITE_URL}/tasks" style="display:inline-block;background:#0B1A33;color:#EDE7DA;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600">Open tasks</a>`,
    ),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Called by pg_cron with a shared secret, never from a browser.
  // Fails closed: with CRON_SECRET unset every request is refused, rather than
  // the endpoint standing wide open until someone remembers to configure it.
  const secret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected || !secret || secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const report = { generated: 0, queued: 0, sent: 0, skipped: 0, failed: 0, emailEnabled: false };

  // 1. Recurrence, whether or not anyone opened the app.
  const { data: generated, error: genErr } = await supabase.rpc(
    "generate_due_task_occurrences",
  );
  if (genErr) console.error("generation failed:", genErr.message);
  report.generated = generated ?? 0;

  // 2. What is worth telling people about.
  const { data: pending, error: pendErr } = await supabase.rpc("pending_notifications");
  if (pendErr) {
    console.error("pending_notifications failed:", pendErr.message);
    return Response.json({ ...report, error: pendErr.message }, { status: 500 });
  }
  const rows = (pending ?? []) as PendingRow[];
  report.queued = rows.length;

  // 3. Email config. Absent or switched off, the job still generates tasks and
  //    still records what it WOULD have sent — the in-app chips keep working.
  const { data: settingsRow } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();

  const cfg = (settingsRow?.value ?? {}) as EmailSettings;
  const canSend = Boolean(cfg.enabled && cfg.from_email && EMAIL_API_KEY);
  report.emailEnabled = canSend;

  // One task email per person per day, not one per task.
  const taskRows = rows.filter((r) => r.kind === "task_due");
  const byUser = new Map<string, PendingRow[]>();
  for (const r of taskRows) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  }

  const jobs: { key: string; row: PendingRow; subject: string; html: string }[] = [];

  for (const r of rows.filter((x) => x.kind === "subscription_expiring")) {
    const { subject, html } = subscriptionEmail(r);
    jobs.push({ key: `sub:${r.user_id}:${r.due_on}:${r.days_left}`, row: r, subject, html });
  }

  for (const [userId, items] of byUser) {
    const { subject, html } = taskEmail(items);
    jobs.push({ key: `tasks:${userId}:${today}`, row: items[0], subject, html });
  }

  for (const job of jobs) {
    // The unique constraint on dedupe_key is the real guard — two overlapping
    // runs cannot both send, because the second insert loses the race.
    const { error: claimErr } = await supabase.from("notification_log").insert({
      user_id: job.row.user_id,
      kind: job.row.kind,
      dedupe_key: job.key,
      status: canSend ? "sending" : "suppressed",
    });

    if (claimErr) {
      report.skipped++;
      continue;
    }

    if (!canSend) {
      report.skipped++;
      continue;
    }

    const result = await sendEmail(cfg, job.row.email, job.subject, job.html);
    await supabase
      .from("notification_log")
      .update({
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
      })
      .eq("dedupe_key", job.key);

    if (result.ok) report.sent++;
    else report.failed++;
  }

  return Response.json(report);
});
