import { NextResponse } from "next/server";
import { supa, toInFilter } from "@/lib/supabaseRest";

export async function POST(request, { params }) {
  const { id } = await params;
  const projectId = Number(id);
  const body = await request.json().catch(() => ({}));

  // Determine if we are receiving one expense (form) or an array (CSV)
  const items = Array.isArray(body) ? body : [body];
  const rowsToInsert = [];

  for (const item of items) {
    const enteredAmount = Number(item.amount);
    const description = String(item.description || "").trim();
    const type = String(item.type || "");
    const expenseDate = String(item.expenseDate || "").trim();
    const memberAId = Number(item.memberAId);
    const memberBId = Number(item.memberBId);

    if (!enteredAmount || enteredAmount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    if (!expenseDate) return NextResponse.json({ error: "Expense date is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    if (!memberAId || !memberBId) return NextResponse.json({ error: "Please choose two users" }, { status: 400 });
    if (memberAId === memberBId) return NextResponse.json({ error: "Please choose two different users" }, { status: 400 });

    const membershipRows = await supa("/project_members", {
      query: {
        project_id: `eq.${projectId}`,
        user_id: `in.${toInFilter([memberAId, memberBId])}`,
        select: "user_id",
      },
    });
    if (!membershipRows || membershipRows.length !== 2) {
      return NextResponse.json({ error: "Both users must be project members" }, { status: 400 });
    }

    let payerId;
    let borrowerId;
    let amount;

    if (type === "A_PAID_SPLIT") {
      payerId = memberAId; borrowerId = memberBId; amount = enteredAmount / 2;
    } else if (type === "A_OWE_FULL") {
      payerId = memberBId; borrowerId = memberAId; amount = enteredAmount;
    } else if (type === "B_PAID_SPLIT") {
      payerId = memberBId; borrowerId = memberAId; amount = enteredAmount / 2;
    } else if (type === "B_OWE_FULL") {
      payerId = memberAId; borrowerId = memberBId; amount = enteredAmount;
    } else {
      return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });
    }

    rowsToInsert.push({
      project_id: projectId,
      description,
      amount: Number(amount.toFixed(2)),
      entered_amount: Number(enteredAmount.toFixed(2)),
      payer_id: payerId,
      borrower_id: borrowerId,
      type,
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

