import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function GET() {
  const projects = await supa("/projects", {
    query: { select: "id,name,created_at", order: "created_at.desc" },
  });

  const enriched = [];
  for (const project of projects) {
    const members = await supa("/project_members", {
      query: { project_id: `eq.${project.id}`, select: "user_id" },
    });
    const expenses = await supa("/expenses", {
      query: { project_id: `eq.${project.id}`, select: "id" },
    });
    enriched.push({
      id: project.id,
      name: project.name,
      memberIds: members.map((m) => m.user_id),
      memberCount: members.length,
      expenseCount: expenses.length,
    });
  }

  return NextResponse.json(enriched);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  const created = await supa("/projects", { method: "POST", body: { name }, preferReturn: true });
  return NextResponse.json({ ...created[0], memberIds: [] }, { status: 201 });
}

