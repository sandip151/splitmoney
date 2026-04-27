import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function GET() {
  const users = await supa("/users", {
    query: { select: "id,name,created_at", order: "name.asc" },
  });
  return NextResponse.json(users);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const created = await supa("/users", { method: "POST", body: { name }, preferReturn: true });
  return NextResponse.json(created[0], { status: 201 });
}

