import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";

export async function DELETE(_request, { params }) {
  const { id, userId } = await params;
  const projectId = String(id);
  const resolvedUserId = String(userId);

  const hasExpense = await supa("/expenses", {
    query: {
      project_id: `eq.${projectId}`,
      or: `(payer_id.eq.${resolvedUserId},borrower_id.eq.${resolvedUserId})`,
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
    query: { project_id: `eq.${projectId}`, user_id: `eq.${resolvedUserId}` },
  });
  return NextResponse.json({ success: true });
}

