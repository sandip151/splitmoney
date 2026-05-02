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
  const projectId = String(params?.id);
  const [allUsers, setAllUsers] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [splitType, setSplitType] = useState("equal");

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
    const userId = String(e.target.userId.value);
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
    const currentGroupId = window.crypto.randomUUID();
    const description = form.description.value;
    const totalAmount = Number(form.amount.value);
    const payerId = String(form.payerId.value);
    const splitType = form.splitType.value;
    const expenseDateVal = expenseDate;

    if (!description || !totalAmount || !payerId) {
      alert("Please fill in all fields");
      return;
    }

    // Build array of debts based on split type
    const debts = [];
    
    if (splitType === "equal") {
      // 1. Split equally among all members except payer
      const splitAmount = totalAmount / members.length;
      for (const member of members) {
        if (member.id !== payerId) {
          debts.push({
            groupId: currentGroupId,
            description,
            enteredAmount: totalAmount,
            payerId,
            borrowerId: String(member.id),
            amount: splitAmount,
            expenseDate: expenseDateVal,
          });
        }
      }
    } else if (splitType.startsWith("full_")) {
      // 2. Quick Option: One specific person owes 100% of the bill
      const fullOweUserId = String(splitType.replace("full_", ""));
      if (fullOweUserId === payerId) {
        alert("The Payer cannot owe 100% to themselves (that's just a personal expense with no shared debt).");
        return;
      }
      debts.push({
        groupId: currentGroupId,
        description,
        enteredAmount: totalAmount,
        payerId,
        borrowerId: fullOweUserId,
        amount: totalAmount,
        expenseDate: expenseDateVal,
      });
    } else {
      // 3. Custom split - read custom amounts for each member
      let othersDebtSum = 0;
      const payerShare = Number(form[`custom_${payerId}`]?.value || 0);
      
      for (const member of members) {
        if (member.id !== payerId) {
          const customAmount = Number(form[`custom_${member.id}`]?.value || 0);
          othersDebtSum += customAmount;
          if (customAmount > 0) {
            debts.push({
              groupId: currentGroupId,
              description,
              enteredAmount: totalAmount,
              payerId,
              borrowerId: String(member.id),
              amount: customAmount,
              expenseDate: expenseDateVal,
            });
          }
        }
      }
      
      const totalAllocated = othersDebtSum + payerShare;
      if (Math.abs(totalAllocated - totalAmount) > 0.01) {
         alert(`Error: Total allocated (₹${totalAllocated.toFixed(2)}) doesn't match receipt (₹${totalAmount.toFixed(2)}).`);
         return;
      }
    }

    if (debts.length === 0) {
      alert("Please specify at least one debt");
      return;
    }

    try {
      await api(`/api/projects/${projectId}/expenses`, { method: "POST", body: JSON.stringify(debts) });
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
        const [expenseDate, description, totalAmountStr, payerIdStr, borrowerIdStr, amountStr, groupIdStr] = line.split(",");
        return {
          description: description.trim(),
          enteredAmount: Number(totalAmountStr),
          payerId: String(payerIdStr),
          borrowerId: String(borrowerIdStr),
          amount: Number(amountStr),
          expenseDate: expenseDate.trim(),
          groupId: groupIdStr ? groupIdStr.trim() : window.crypto.randomUUID()
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
        <h3>Add Transaction</h3>
        {members.length < 2 ? (
          <p className="bad">Add at least 2 members to create transactions.</p>
        ) : (
          <form onSubmit={addExpense}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#6b7280", fontWeight: "bold" }}>Who paid?</label>
                <select name="payerId" required style={{ width: "100%" }}>
                  <option value="">Select payer</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "2 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#6b7280", fontWeight: "bold" }}>Description</label>
                <input name="description" placeholder="e.g., Dinner at Goa" required style={{ width: "100%" }} />
              </div>

              <div style={{ flex: "1 1 120px" }}>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#6b7280", fontWeight: "bold" }}>Total Amount (₹)</label>
                <input name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required style={{ width: "100%" }} />
              </div>

              <div style={{ flex: "1 1 130px" }}>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#6b7280", fontWeight: "bold" }}>Date</label>
                <input name="expenseDate" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required style={{ width: "100%" }} />
              </div>

              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#6b7280", fontWeight: "bold" }}>Split type:</label>
                <select name="splitType" value={splitType} onChange={(e) => setSplitType(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
                  <option value="equal">Split equally</option>
                  <option value="custom">Custom exact amounts</option>
                  <optgroup label="Someone owes 100%">
                    {members.map((m) => (
                      <option key={`full_${m.id}`} value={`full_${m.id}`}>
                        {m.name} owes the full amount
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

            </div>

            {splitType === "custom" && (
              <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#4b5563" }}>Enter exactly how much each person owes the Payer (must sum to the Total Amount):</p>
                {members.map((m) => (
                  <div key={m.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "8px", borderBottom: "1px dashed #d1d5db", paddingBottom: "8px" }}>
                    <span style={{ flex: "1 1 120px", fontSize: "14px", fontWeight: "bold", color: "#111827" }}>{m.name}</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ marginRight: "6px", color: "#6b7280", fontWeight: "bold" }}>₹</span>
                      <input name={`custom_${m.id}`} type="number" step="0.01" min="0" placeholder="0.00" style={{ width: "100px" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" style={{ width: "100%", padding: "10px", fontSize: "15px", fontWeight: "bold" }}>Add Transaction</button>
          </form>
        )}
      </div>

      {/* --- LEDGER ZONE --- */}
      <div className="card">
        <h3>Transaction History</h3>
        {state.expenses.length === 0 ? (
          <div className="muted">No transactions yet.</div>
        ) : (
          orderedDates.map((date) => (
            <div key={date} style={{ marginBottom: "20px" }}>
              <div style={{ background: "#e5e7eb", borderRadius: "6px", padding: "6px 10px", marginBottom: "10px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold", color: "#4b5563" }}>
                {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {(() => {
                  // 1. Group perfectly by the unique database group_id
                  const receipts = {};
                  groupedExpenses[date].forEach(exp => {
                    // Group exactly by the database groupId
                    const receiptKey = exp.groupId;
                    if (!receipts[receiptKey]) receipts[receiptKey] = [];
                    receipts[receiptKey].push(exp);
                  });
                  return Object.values(receipts).map((receiptItems) => {
                    const exp = receiptItems[0];
                    const totalReceipt = Number(exp.enteredAmount) || 0;
                    const debtAmount = receiptItems.reduce((sum, item) => sum + Number(item.amount), 0);
                  // If the user's specific debt equals the total receipt cost, they owe the whole thing.
                  const isFullyOwed = totalReceipt > 0 && Math.abs(debtAmount - totalReceipt) < 0.01;
                  
                  // Calculate the percentage share for the badge
                  const percentage = totalReceipt > 0 ? Math.round((debtAmount / totalReceipt) * 100) : 0;
                  const typeDescription = isFullyOwed ? `🎯 Personal` : `🤝 Shared (${percentage}%)`;

                  return (
                      <li key={exp.groupId} style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center", padding: "14px 8px", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ flex: "1 1 200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <strong style={{ fontSize: "16px", color: "#111827" }}>{exp.description}</strong>
                          <span style={{ fontSize: "11px", backgroundColor: isFullyOwed ? "#fef2f2" : "#eff6ff", border: isFullyOwed ? "1px solid #fecaca" : "1px solid #bfdbfe", padding: "3px 8px", borderRadius: "12px", color: isFullyOwed ? "#991b1b" : "#1e40af", fontWeight: "bold" }}>
                            {typeDescription}
                          </span>
                        </div>
                        <div style={{ fontSize: "14px", color: "#4b5563" }}>
                            {receiptItems.map(item => (
                              <div key={item.id}>
                                <strong>{item.borrowerName}</strong> owes <strong>₹{Number(item.amount).toFixed(2)}</strong> to {item.payerName}
                              </div>
                            ))}
                        </div>
                      </div>
                      <button onClick={() => deleteExpense(exp.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#dc2626", fontSize: "13px", fontWeight: "bold", cursor: "pointer", padding: "6px 12px" }}>Delete</button>
                    </li>
                  );
                  });
                })()}
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
            <input type="file" name="csvFile" accept=".csv" required disabled={members.length < 2} style={{ background: "#fff" }} />
            <button type="submit" className="secondary" disabled={members.length < 2}>Upload CSV Data</button>
          </form>
          
          <details style={{ marginTop: "12px", fontSize: "12px", color: "#4b5563" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2563eb", outline: "none" }}>ℹ️ How to format your CSV</summary>
            <div style={{ marginTop: "8px", padding: "10px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
              <p style={{ margin: "0 0 6px 0" }}>1. Create a file with exactly these 6 headers:</p>
              <code style={{ display: "block", background: "#f3f4f6", padding: "6px", marginBottom: "10px", borderRadius: "4px" }}>Date,Description,TotalAmount,PayerId,BorrowerId,DebtAmount</code>
              <p style={{ margin: "0 0 6px 0" }}>2. <strong>Date</strong> must be formatted as <code>YYYY-MM-DD</code> (e.g., 2026-04-15).</p>
              <p style={{ margin: "0 0 6px 0" }}>3. <strong>PayerId</strong> and <strong>BorrowerId</strong> must be valid user IDs from this project:</p>
              <div style={{ background: "#f3f4f6", padding: "6px", marginBottom: "10px", borderRadius: "4px", fontSize: "11px" }}>
                {members.map((m) => (
                  <div key={m.id}><strong>{m.id}</strong> = {m.name}</div>
                ))}
              </div>
              <p style={{ margin: "10px 0 0 0", color: "#dc2626", fontWeight: "bold" }}>* Do NOT use commas inside your descriptions.</p>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

