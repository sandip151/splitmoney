"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await response.text();
  let data = {};
  try {
    if (text) data = JSON.parse(text);
  } catch {
    throw new Error(`Server error: ${response.status}`);
  }
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}`);
  return data;
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = Number(params?.id);
  const [allUsers, setAllUsers] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));

  const availableToAdd = useMemo(() => {
    if (!state) return [];
    const memberIds = new Set(state.members.map((m) => m.id));
    return allUsers.filter((u) => !memberIds.has(u.id));
  }, [allUsers, state]);

  async function load() {
    setLoading(true);
    try {
      const [users, project] = await Promise.all([api("/api/users"), api(`/api/projects/${projectId}`)]);
      setAllUsers(users);
      setState(project);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => alert(e.message));
  }, [projectId]);

  async function addMember(e) {
    e.preventDefault();
    const userId = Number(e.target.userId.value);
    if (!userId) return;
    try {
      await api(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify({ userId }) });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeMember(userId) {
    if (!confirm("Remove this member from project?")) return;
    try {
      await api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      description: form.description.value,
      amount: Number(form.amount.value),
      memberAId: Number(form.memberAId.value),
      memberBId: Number(form.memberBId.value),
      type: form.type.value,
      expenseDate: expenseDate, // <-- Added this line to include expenseDate
    };
    try {
      await api(`/api/projects/${projectId}/expenses`, { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteExpense(expenseId) {
    if (!confirm("Delete this transaction? This will automatically recalculate all balances.")) return;
    try {
      await api(`/api/projects/${projectId}/expenses/${expenseId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCSVUpload(e) {
    e.preventDefault();
    const fileInput = e.target.csvFile;
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);
      
      // Remove the header line
      const dataLines = lines.slice(1);
      if (dataLines.length === 0) {
        alert("No valid data found in CSV");
        return;
      }

      const payload = dataLines.map(line => {
        const [expenseDate, description, amountStr, type] = line.split(",");
        return {
          description: description.trim(),
          amount: Number(amountStr),
          memberAId: memberA?.id,
          memberBId: memberB?.id,
          type: type.trim(),
          expenseDate: expenseDate.trim()
        };
      });

      try {
        await api(`/api/projects/${projectId}/expenses`, { method: "POST", body: JSON.stringify(payload) });
        fileInput.value = ""; // reset input
        alert(`${payload.length} transactions uploaded successfully!`);
        await load();
      } catch (err) {
        alert("Failed to upload CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  if (loading && !state) {
    return <div className="muted">Loading…</div>;
  }

  if (!state) {
    return <div className="muted">Project not found.</div>;
  }

  const members = state.members || [];
  const canAddExpense = members.length === 2;
  const [memberA, memberB] = members;

  const expenseOptions = canAddExpense
    ? [
        {
          value: "A_PAID_SPLIT",
          label: `🤝 ${memberA.name} paid, split 50/50`,
        },
        {
          value: "B_PAID_SPLIT",
          label: `🤝 ${memberB.name} paid, split 50/50`,
        },
        {
          value: "B_OWE_FULL",
          label: `🎯 ${memberA.name} paid fully for ${memberB.name}`,
        },
        {
          value: "A_OWE_FULL",
          label: `🎯 ${memberB.name} paid fully for ${memberA.name}`,
        },
      ]
    : [];

  const topSettlement = state.settlements?.[0];
  const summaryText =
    !members.length || !state.settlements.length
      ? "All settled"
      : state.settlements.length === 1
      ? `${topSettlement.fromUserName} owes Rs ${topSettlement.amount.toFixed(
          2
        )} to ${topSettlement.toUserName}`
      : "Multiple pending settlements";
  const summaryClass = !members.length || !state.settlements.length ? "good" : "bad";

  const groupedExpenses = (state.expenses || []).reduce((acc, exp) => {
    const key = exp.expenseDate || String(exp.createdAt || "").slice(0, 10) || "Unknown date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  const orderedDates = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <h1>Project: {state.project.name}</h1>
      <p className={summaryClass}>
        <strong>{summaryText}</strong>
      </p>

      <div className="card">
        <h3>Project Members</h3>
        <form onSubmit={addMember}>
          <select name="userId" defaultValue={availableToAdd[0]?.id ?? ""}>
            {availableToAdd.length === 0 ? (
              <option value="">No available users</option>
            ) : (
              availableToAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))
            )}
          </select>
          <button type="submit">Add Member</button>
        </form>
        {members.length === 0 ? (
          <div className="muted">No members yet.</div>
        ) : (
          <ul>
            {members.map((m) => (
              <li key={m.id}>
                <div className="row">
                  <strong>{m.name}</strong>
                  <button className="danger" type="button" onClick={() => removeMember(m.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Add Transaction</h3>
        <form onSubmit={addExpense}>
          <input name="description" placeholder="Description" required />
          <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required />
          <input
            name="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
          <input type="hidden" name="memberAId" value={memberA?.id ?? ""} />
          <input type="hidden" name="memberBId" value={memberB?.id ?? ""} />
          <select name="type" defaultValue="A_PAID_SPLIT" disabled={!canAddExpense}>
            {canAddExpense ? (
              expenseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            ) : (
              <option value="">Exactly 2 members required</option>
            )}
          </select>
          <button type="submit" disabled={!canAddExpense}>
            Add Expense
          </button>
        </form>
        <p className="muted">Add description, amount, date, and choose transaction type.</p>
        {!canAddExpense && (
          <p className="bad">
            This flow is optimized for 2-member projects. Please keep exactly 2 members to add transactions.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Mass Upload (CSV)</h3>
        <form onSubmit={handleCSVUpload} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input type="file" name="csvFile" accept=".csv" required disabled={!canAddExpense} />
          <button type="submit" className="secondary" disabled={!canAddExpense}>Upload CSV</button>
        </form>
        <p className="muted" style={{ fontSize: "12px", marginTop: "8px" }}>
          Format: <code>Date,Description,Amount,Type</code><br/>
          (Types: A_PAID_SPLIT, B_PAID_SPLIT, A_OWE_FULL, B_OWE_FULL) — 'A' is the first member listed above, 'B' is the second.
        </p>
      </div>

      <div className="card">
        <h3>Balances</h3>
        {state.balances.length === 0 ? (
          <div className="muted">No balances yet.</div>
        ) : (
          <ul>
            {state.balances.map((b) => {
              let text = "settled";
              let className = "muted";
              if (b.balance > 0.009) {
                text = `should receive Rs ${b.balance.toFixed(2)}`;
                className = "good";
              } else if (b.balance < -0.009) {
                text = `owes Rs ${Math.abs(b.balance).toFixed(2)}`;
                className = "bad";
              }
              return (
                <li key={b.userId}>
                  <strong>{b.userName}</strong> <span className={className}>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Settlement Suggestions</h3>
        {state.settlements.length === 0 ? (
          <div className="good">All settled up.</div>
        ) : (
          <ul>
            {state.settlements.map((s, idx) => (
              <li key={idx}>
                {s.fromUserName} pays {s.toUserName}: Rs {s.amount.toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Transactions</h3>
        {state.expenses.length === 0 ? (
          <div className="muted">No transactions yet.</div>
        ) : (
          orderedDates.map((date) => (
            <div key={date} style={{ marginBottom: "12px" }}>
              <div
                className="muted"
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  marginBottom: "6px",
                }}
              >
                <strong>{new Date(date).toLocaleDateString()}</strong>
              </div>
              <ul>
                {groupedExpenses[date].map((exp) => {
                  // Determine the exact wording based on the transaction type
                  let typeDescription = "";
                  if (exp.type === "A_OWE_FULL" || exp.type === "B_OWE_FULL") {
                    typeDescription = `🎯 Fully owed by ${exp.borrowerName} (Personal)`;
                  } else {
                    typeDescription = `🤝 Split equally`;
                  }

                  return (
                    <li key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong>{exp.description}</strong>
                          <span style={{ fontSize: "11px", backgroundColor: "#e5e7eb", padding: "2px 6px", borderRadius: "10px", color: "#4b5563" }}>
                            {typeDescription}
                          </span>
                        </div>
                        <div className="muted" style={{ marginTop: "4px" }}>
                          Total: ₹{Number(exp.enteredAmount).toFixed(2)} | {exp.borrowerName} owes ₹{Number(exp.amount).toFixed(2)}
                        </div>
                        <div style={{ fontSize: "13px", color: "#059669", marginTop: "2px" }}>
                          Paid by {exp.payerName}
                        </div>
                      </div>
                      <button className="danger" onClick={() => deleteExpense(exp.id)} style={{ marginLeft: "12px" }}>Delete</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </>
  );
}

