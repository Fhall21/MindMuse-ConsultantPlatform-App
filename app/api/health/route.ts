import { NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRuntimeDiagnostics, logRuntimeDiagnostics } from "@/lib/runtime-diagnostics";

export async function GET() {
  logRuntimeDiagnostics("health-check");

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("[health] database check failed", {
      ...getRuntimeDiagnostics(),
      message: error instanceof Error ? error.message : "Unknown database error",
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
  });
}