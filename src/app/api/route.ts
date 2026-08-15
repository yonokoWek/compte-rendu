import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";

// Health check endpoint - does NOT use the database
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: Date.now(),
    database: isDatabaseConfigured() ? "configured" : "not_configured",
  });
}
