import { NextResponse } from "next/server";
import { getDb, isSharedStorageEnabled } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  return NextResponse.json({
    conferences: db.conferences,
    coverage: db.coverage,
    sharedStorage: isSharedStorageEnabled(),
  });
}
