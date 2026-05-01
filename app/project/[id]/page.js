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

  const totalProjectCost = (state.expenses || []).reduce((sum, exp) => sum + exp.enteredAmount, 0);

  const orderedDates = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
        <div>
          <h1 style={{ marginBottom: "4px" }}>{state.project.name}</h1>
          <p className={summaryClass} style={{ margin: 0, fontSize: "14px" }}>
            <strong>{summaryText}</strong>
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Trip Cost</div>
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#111827" }}>₹{totalProjectCost.toFixed(2)}</div>
        </div>
      </div>

      {/* --- DASHBOARD ZONE --- */}
      <div className="card" style={{ borderTop: "4px solid #2563eb" }}>
        <h3 style={{ marginBottom: "12px" }}>How to Settle Up</h3>
        {state.settlements.length === 0 ? (
          <div className="good" style={{ padding: "12px", backgroundColor: "#ecfdf5", borderRadius: "6px" }}>✨ All settled up! No debts pending.</div>
        ) : (
          <ul style={{ marginBottom: "16px" }}>
            {state.settlements.map((s, idx) => (
              <li key={idx} style={{ padding: "8px 0", fontSize: "16px" }}>
                <strong>{s.fromUserName}</strong> pays <strong>{s.toUserName}</strong>: <span style={{ color: "#dc2626", fontWeight: "bold" }}>₹{s.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}

        <h4 style={{ fontSize: "14px", marginTop: "16px", marginBottom: "8px", color: "#4b5563" }}>Individual Balances</h4>
        {state.balances.length === 0 ? (
          <div className="muted" style={{ fontSize: "14px" }}>No balances yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {state.balances.map((b) => {
              let text = "settled";
              let color = "#6b7280";
              let bgColor = "#f3f4f6";
              
              if (b.balance > 0.009) {
                text = `gets back ₹${b.balance.toFixed(2)}`;
                color = "#059669";
                bgColor = "#ecfdf5";
              } else if (b.balance < -0.009) {
                text = `owes ₹${Math.abs(b.balance).toFixed(2)}`;
                color = "#dc2626";
                bgColor = "#fef2f2";
              }
              
              return (
                <div key={b.userId} style={{ padding: "8px 12px", backgroundColor: bgColor, borderRadius: "6px", fontSize: "14px", border: `1px solid ${color}40` }}>
                  <strong>{b.userName}</strong> <span style={{ color: color }}>{text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- ACTION ZONE --- */}
      <div className="card">
        <h3>Add Quick Transaction</h3>
        <form onSubmit={addExpense}>
          <input name="description" placeholder="What was this for?" required style={{ flex: "1 1 200px" }} />
          <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (₹)" required style={{ width: "120px" }} />
          <input name="expenseDate" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
          <input type="hidden" name="memberAId" value={memberA?.id ?? ""} />
          <input type="hidden" name="memberBId" value={memberB?.id ?? ""} />
          <select name="type" defaultValue="A_PAID_SPLIT" disabled={!canAddExpense} style={{ flex: "1 1 250px" }}>
            {canAddExpense ? expenseOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>) : <option value="">Exactly 2 members required</option>}
          </select>
          <button type="submit" disabled={!canAddExpense}>Add</button>
        </form>
        {!canAddExpense && <p className="bad" style={{ fontSize: "13px", marginTop: "8px" }}>Requires exactly 2 members to add transactions.</p>}
      </div>

      {/* --- LEDGER ZONE --- */}
      <div className="card">
        <h3>Transaction History</h3>
        {state.expenses.length === 0 ? (
          <div className="muted">No transactions yet.</div>
        ) : (
          orderedDates.map((date) => (
            <div key={date} style={{ marginBottom: "16px" }}>
              <div className="muted" style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb", padding: "6px 4px", marginBottom: "8px", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <strong>{new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              </div>
              <ul>
                {groupedExpenses[date].map((exp) => {
                  const isFullyOwed = exp.type === "A_OWE_FULL" || exp.type === "B_OWE_FULL";
                  const typeDescription = isFullyOwed ? `🎯 Personal` : `🤝 Split`;

                  return (
                    <li key={exp.id} style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "15px", color: "#111827" }}>{exp.description}</strong>
                          <span style={{ fontSize: "11px", backgroundColor: "#f3f4f6", padding: "2px 6px", borderRadius: "4px", color: "#6b7280" }}>{typeDescription}</span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#4b5563" }}>
                          {isFullyOwed ? (
                            <span><strong>{exp.borrowerName}</strong> owes <strong>₹{Number(exp.amount).toFixed(2)}</strong></span>
                          ) : (
                            <span>Total: ₹{Number(exp.enteredAmount).toFixed(2)} <span className="muted">|</span> <strong>{exp.borrowerName}</strong> owes <strong>₹{Number(exp.amount).toFixed(2)}</strong></span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "#059669", marginTop: "2px" }}>Paid by {exp.payerName}</div>
                      </div>
                      <button onClick={() => deleteExpense(exp.id)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer", padding: "4px 8px" }}>Delete</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* --- ADMIN ZONE --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "24px" }}>
        <div className="card" style={{ flex: "1 1 300px", margin: 0, backgroundColor: "#f9fafb" }}>
          <h4 style={{ fontSize: "14px", marginTop: 0 }}>Project Members</h4>
          <form onSubmit={addMember} style={{ marginBottom: "12px" }}>
            <select name="userId" defaultValue={availableToAdd[0]?.id ?? ""} style={{ flex: 1 }}>
              {availableToAdd.length === 0 ? <option value="">No available users</option> : availableToAdd.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button type="submit" className="secondary">Add</button>
          </form>
          <ul style={{ fontSize: "13px" }}>
            {members.map((m) => (
              <li key={m.id} style={{ padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                <strong>{m.name}</strong>
                <span onClick={() => removeMember(m.id)} style={{ color: "#dc2626", cursor: "pointer", textDecoration: "underline" }}>Remove</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ flex: "1 1 300px", margin: 0, backgroundColor: "#f9fafb" }}>
          <h4 style={{ fontSize: "14px", marginTop: 0 }}>Mass Upload (CSV)</h4>
          <form onSubmit={handleCSVUpload} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input type="file" name="csvFile" accept=".csv" required disabled={!canAddExpense} style={{ background: "#fff" }} />
            <button type="submit" className="secondary" disabled={!canAddExpense}>Upload CSV Data</button>
          </form>
          
          <details style={{ marginTop: "12px", fontSize: "12px", color: "#4b5563" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2563eb", outline: "none" }}>ℹ️ How to format your CSV</summary>
            <div style={{ marginTop: "8px", padding: "10px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
              <p style={{ margin: "0 0 6px 0" }}>1. Create a file with exactly these 4 headers:</p>
              <code style={{ display: "block", background: "#f3f4f6", padding: "6px", marginBottom: "10px", borderRadius: "4px" }}>Date,Description,Amount,Type</code>
              <p style={{ margin: "0 0 4px 0" }}>2. <strong>Type</strong> must be exactly one of these codes:</p>
              <ul style={{ margin: 0, paddingLeft: "16px", listStyleType: "circle", lineHeight: "1.6" }}>
                <li><code>A_PAID_SPLIT</code> (1st member paid, split 50/50)</li>
                <li><code>B_PAID_SPLIT</code> (2nd member paid, split 50/50)</li>
                <li><code>A_OWE_FULL</code> (2nd member paid fully for 1st)</li>
                <li><code>B_OWE_FULL</code> (1st member paid fully for 2nd)</li>
              </ul>
              <p style={{ margin: "10px 0 0 0", color: "#dc2626", fontWeight: "bold" }}>* Do NOT use commas inside your descriptions.</p>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

