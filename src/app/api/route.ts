import { NextResponse } from "next/server";

// Health check endpoint - does NOT use the database
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: Date.now() });
}
