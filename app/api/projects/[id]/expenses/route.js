import { NextResponse } from "next/server";
import { supa, toInFilter } from "@/lib/supabaseRest";

export async function POST(request, { params }) {
  const { id } = await params;
  const projectId = Number(id);
  const body = await request.json().catch(() => ({}));

  const enteredAmount = Number(body.amount);
  const description = String(body.description || "").trim();
  const type = String(body.type || "");
  const memberAId = Number(body.memberAId);
  const memberBId = Number(body.memberBId);

  if (!enteredAmount || enteredAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
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
    payerId = memberAId;
    borrowerId = memberBId;
    amount = enteredAmount / 2;
  } else if (type === "A_OWE_FULL") {
    payerId = memberBId;
    borrowerId = memberAId;
    amount = enteredAmount;
  } else if (type === "B_PAID_SPLIT") {
    payerId = memberBId;
    borrowerId = memberAId;
    amount = enteredAmount / 2;
  } else if (type === "B_OWE_FULL") {
    payerId = memberAId;
    borrowerId = memberBId;
    amount = enteredAmount;
  } else {
    return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });
  }

  const inserted = await supa("/expenses", {
    method: "POST",
    body: {
      project_id: projectId,
      description,
      amount: Number(amount.toFixed(2)),
      entered_amount: Number(enteredAmount.toFixed(2)),
      payer_id: payerId,
      borrower_id: borrowerId,
      type,
    },
    preferReturn: true,
  });

  const e = inserted[0];
  return NextResponse.json(
    {
      id: e.id,
      projectId: e.project_id,
      description: e.description,
      amount: Number(Number(e.amount).toFixed(2)),
      enteredAmount: Number(Number(e.entered_amount).toFixed(2)),
      payerId: e.payer_id,
      borrowerId: e.borrower_id,
      type: e.type,
      createdAt: e.created_at,
    },
    { status: 201 }
  );
}

