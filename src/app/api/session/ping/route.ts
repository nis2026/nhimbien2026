import { NextResponse } from "next/server";

// The single-active-device check for /api/* paths already runs in
// src/proxy.ts and returns 401 before this handler is ever reached once the
// caller's device has been kicked. Reaching this line just means "still the
// active device" — the client polls this endpoint to find out.
export async function GET() {
  return NextResponse.json({ ok: true });
}
