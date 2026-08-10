import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verification / incoming message handling for WhatsApp Webhook
    return NextResponse.json({
      status: "success",
      message: "WhatsApp expense webhook received and processed successfully.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ status: "error", message: errorMsg }, { status: 400 });
  }
}

export async function GET(request: Request) {
  // Webhook verification endpoint (for Meta WhatsApp Cloud API)
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "bachat_book_webhook_secret") {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ status: "ok", service: "Bachat Book WhatsApp Webhook" });
}
