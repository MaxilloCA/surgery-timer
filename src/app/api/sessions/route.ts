import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { anesthetistName, date } = await req.json();

    if (!anesthetistName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [session] = await getDb()
      .insert(sessions)
      .values({ anesthetistName, date })
      .returning();

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allSessions = await getDb()
      .select()
      .from(sessions)
      .orderBy(desc(sessions.date));

    return NextResponse.json(allSessions);
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
