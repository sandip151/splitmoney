import { NextResponse } from "next/server";
import { supa, toInFilter } from "@/lib/supabaseRest";

export async function POST(request, { params }) {
  const { id } = await params;
  const projectId = String(id);
  const body = await request.json().catch(() => ({}));

  // Determine if we are receiving one expense (form) or an array (CSV)
  const items = Array.isArray(body) ? body : [body];
  const rowsToInsert = [];

  // Collect all unique user IDs that need to be validated
  const allUserIds = [...new Set(items.flatMap(item => [String(item.payerId), String(item.borrowerId)]))];
  
  // Single membership check for all users in the request
  const membershipRows = await supa("/project_members", {
    query: {
      project_id: `eq.${projectId}`,
      user_id: `in.${toInFilter(allUserIds)}`,
      select: "user_id",
    },
  });
  const validUserIds = new Set(membershipRows.map((r) => r.user_id));

  // Generate a fallback group ID just in case it's missing
  const defaultGroupId = crypto.randomUUID();

  for (const item of items) {
    const enteredAmount = Number(item.enteredAmount);
    const description = String(item.description || "").trim();
    const expenseDate = String(item.expenseDate || "").trim();
    const payerId = String(item.payerId);
    const borrowerId = String(item.borrowerId);
    const amount = Number(item.amount);

    // Explicitly grab the groupId!
    const groupId = String(item.groupId || defaultGroupId);

    if (!enteredAmount || enteredAmount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    if (!expenseDate) return NextResponse.json({ error: "Expense date is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    if (!payerId || !borrowerId) return NextResponse.json({ error: "Please choose payer and borrower" }, { status: 400 });
    if (payerId === borrowerId) return NextResponse.json({ error: "Payer and borrower must be different" }, { status: 400 });

    // Verify both users are project members using the pre-fetched set
    if (!validUserIds.has(payerId) || !validUserIds.has(borrowerId)) {
      return NextResponse.json({ error: "Both users must be project members" }, { status: 400 });
    }

    rowsToInsert.push({
      project_id: projectId,
      group_id: groupId, // Save to database
      description,
      amount: Number(amount.toFixed(2)),
      entered_amount: Number(enteredAmount.toFixed(2)),
      payer_id: payerId,
      borrower_id: borrowerId,
      type: "MANUAL",
      expense_date: expenseDate,
    });
  }

  // Insert all rows at once
  await supa("/expenses", {
    method: "POST",
    body: rowsToInsert,
    preferReturn: true,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

