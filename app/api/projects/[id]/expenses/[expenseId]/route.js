import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function DELETE(_request, { params }) {
  const { id, expenseId } = await params;
  const projectId = String(id);
  const expId = String(expenseId);

  await supa("/expenses", {
    method: "DELETE",
    query: { id: `eq.${expId}`, project_id: `eq.${projectId}` },
  });

  return NextResponse.json({ success: true });
}