import { NextResponse } from "next/server";
import { supa, toInFilter } from "@/lib/supabaseRest";
import { computeBalances, simplifyDebts } from "@/lib/balances";

export async function GET(_request, { params }) {
  const { id } = await params;
  const projectId = Number(id);

  const projects = await supa("/projects", {
    query: { id: `eq.${projectId}`, select: "id,name" },
  });
  if (!projects || projects.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const project = projects[0];

  const membershipRows = await supa("/project_members", {
    query: { project_id: `eq.${projectId}`, select: "user_id" },
  });
  const memberIds = membershipRows.map((r) => r.user_id);

  const members =
    memberIds.length === 0
      ? []
      : await supa("/users", {
          query: { id: `in.${toInFilter(memberIds)}`, select: "id,name", order: "name.asc" },
        });

  const expenses = await supa("/expenses", {
    query: {
      project_id: `eq.${projectId}`,
      select: "id,project_id,description,amount,entered_amount,payer_id,borrower_id,type,created_at",
      order: "created_at.desc",
    },
  });

  const memberIdSet = new Set(memberIds);
  const visibleExpenses = expenses.filter(
    (e) => memberIdSet.has(e.payer_id) && memberIdSet.has(e.borrower_id)
  );

  const userById = new Map(members.map((m) => [m.id, m]));
  const apiExpenses = visibleExpenses.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description,
    amount: Number(Number(e.amount).toFixed(2)),
    enteredAmount: Number(Number(e.entered_amount).toFixed(2)),
    payerId: e.payer_id,
    borrowerId: e.borrower_id,
    type: e.type,
    createdAt: e.created_at,
    payerName: userById.get(e.payer_id)?.name || `User ${e.payer_id}`,
    borrowerName: userById.get(e.borrower_id)?.name || `User ${e.borrower_id}`,
  }));

  const balances = computeBalances(members, visibleExpenses);
  const settlements = simplifyDebts(balances);

  return NextResponse.json({
    project: { id: project.id, name: project.name, memberIds },
    members,
    expenses: apiExpenses,
    balances,
    settlements,
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const projectId = Number(id);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

  const updated = await supa("/projects", {
    method: "PATCH",
    query: { id: `eq.${projectId}` },
    body: { name },
    preferReturn: true,
  });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(updated[0]);
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const projectId = Number(id);
  await supa("/projects", { method: "DELETE", query: { id: `eq.${projectId}` } });
  return NextResponse.json({ success: true });
}

