import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * WhatsApp Cloud API webhook.
 *
 * This endpoint is unauthenticated BY DESIGN — Meta calls it, not a signed-in
 * user — which is exactly why it has to prove the caller is Meta by itself.
 * Three things it did not do before:
 *
 *   1. The verify token was the literal string "bachat_book_webhook_secret",
 *      committed to the repository. Anyone reading the repo could complete
 *      Meta's subscription handshake and point their own app at this URL.
 *   2. POST accepted any JSON from anyone with no signature check at all. It
 *      happens to write nothing today, so nothing was exploitable — but this
 *      route exists to log expenses from WhatsApp messages, and the day it
 *      starts writing is the day an open endpoint starts writing.
 *   3. Nothing rate-limited it.
 *
 * Secrets now come from the environment. If they are absent the route refuses
 * rather than falling back to a default: a webhook that quietly accepts
 * everything because a variable is unset is worse than one that is down.
 */

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

/**
 * Meta signs every POST body with the app secret. Compare with a
 * timing-safe equality — a plain `===` on a hex digest leaks, byte by byte,
 * how much of a guessed signature was correct.
 */
function signatureIsValid(rawBody: string, header: string | null): boolean {
  if (!APP_SECRET || !header?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = header.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");

  // timingSafeEqual throws on a length mismatch, which is itself a signal.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!APP_SECRET) {
    console.error("WhatsApp webhook: WHATSAPP_APP_SECRET is not configured.");
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  // Must read the RAW body: re-serialising parsed JSON changes key order and
  // whitespace, and the signature would never match again.
  const rawBody = await request.text();

  if (!signatureIsValid(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ status: "error" }, { status: 401 });
  }

  try {
    JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  // Meta retries anything that is not a prompt 200, so acknowledge first and do
  // the real work asynchronously once this route starts writing entries.
  return NextResponse.json({ status: "ok" });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    console.error("WhatsApp webhook: WHATSAPP_VERIFY_TOKEN is not configured.");
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  if (mode === "subscribe" && token && challenge) {
    const a = Buffer.from(token);
    const b = Buffer.from(VERIFY_TOKEN);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return new Response(challenge, { status: 200 });
    }
    return NextResponse.json({ status: "error" }, { status: 403 });
  }

  // Says nothing about which service this is or whether it is configured.
  return NextResponse.json({ status: "ok" });
}
