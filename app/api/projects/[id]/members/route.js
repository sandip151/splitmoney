import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function POST(request, { params }) {
  const { id } = await params;
  const projectId = Number(id);
  const body = await request.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const proj = await supa("/projects", { query: { id: `eq.${projectId}`, select: "id" } });
  if (!proj || proj.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const user = await supa("/users", { query: { id: `eq.${userId}`, select: "id" } });
  if (!user || user.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await supa("/project_members", {
      method: "POST",
      body: { project_id: projectId, user_id: userId },
    });
  } catch {
    return NextResponse.json({ error: "User already in project" }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

