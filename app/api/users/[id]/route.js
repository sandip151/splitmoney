import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function PUT(request, { params }) {
  const userId = Number(params.id);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const updated = await supa("/users", {
    method: "PATCH",
    query: { id: `eq.${userId}` },
    body: { name },
    preferReturn: true,
  });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(updated[0]);
}

export async function DELETE(_request, { params }) {
  const userId = Number(params.id);

  const membership = await supa("/project_members", {
    query: { user_id: `eq.${userId}`, select: "project_id", limit: "1" },
  });
  if (membership && membership.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete user assigned to a project" },
      { status: 400 }
    );
  }

  await supa("/users", { method: "DELETE", query: { id: `eq.${userId}` } });
  return NextResponse.json({ success: true });
}

