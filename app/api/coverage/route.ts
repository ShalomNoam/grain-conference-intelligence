import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { newId } from "@/lib/id";
import type { CoverageStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const conferenceId: string | undefined = body.conferenceId;
  const repName: string | undefined = body.repName?.trim();
  const status: CoverageStatus = body.status === "confirmed" ? "confirmed" : "considering";

  if (!conferenceId || !repName) {
    return NextResponse.json({ error: "conferenceId and repName are required" }, { status: 400 });
  }

  const db = await getDb();
  const existing = db.coverage.find((c) => c.conferenceId === conferenceId && c.repName.toLowerCase() === repName.toLowerCase());
  if (existing) {
    existing.status = status;
  } else {
    db.coverage.push({ id: newId("cov"), conferenceId, repName, status });
  }
  await saveDb(db);
  return NextResponse.json({ coverage: db.coverage });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const db = await getDb();
  db.coverage = db.coverage.filter((c) => c.id !== id);
  await saveDb(db);
  return NextResponse.json({ coverage: db.coverage });
}
