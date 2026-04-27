import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function DELETE(_request, { params }) {
  const projectId = Number(params.id);
  const userId = Number(params.userId);

  const hasExpense = await supa("/expenses", {
    query: {
      project_id: `eq.${projectId}`,
      or: `(payer_id.eq.${userId},borrower_id.eq.${userId})`,
      select: "id",
      limit: "1",
    },
  });
  if (hasExpense && hasExpense.length > 0) {
    return NextResponse.json(
      { error: "Cannot remove member with existing expenses" },
      { status: 400 }
    );
  }

  await supa("/project_members", {
    method: "DELETE",
    query: { project_id: `eq.${projectId}`, user_id: `eq.${userId}` },
  });
  return NextResponse.json({ success: true });
}

