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
    };
    try {
      await api(`/api/projects/${projectId}/expenses`, { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading && !state) {
    return <div className="muted">Loading…</div>;
  }

  if (!state) {
    return <div className="muted">Project not found.</div>;
  }

  const members = state.members || [];

  return (
    <>
      <h1>Project: {state.project.name}</h1>

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
          <select name="memberAId" defaultValue={members[0]?.id ?? ""}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select name="memberBId" defaultValue={members[1]?.id ?? members[0]?.id ?? ""}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select name="type" defaultValue="A_PAID_SPLIT">
            <option value="A_PAID_SPLIT">UserA paid and split equally</option>
            <option value="A_OWE_FULL">UserA Owe the full amount</option>
            <option value="B_PAID_SPLIT">UserB paid and split equally</option>
            <option value="B_OWE_FULL">UserB owe the full amount</option>
          </select>
          <button type="submit">Add Expense</button>
        </form>
        <p className="muted">Pick UserA/UserB and one of the 4 options.</p>
        {members.length < 2 && <p className="bad">Add at least 2 members to create transactions.</p>}
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
          <ul>
            {state.expenses.map((exp) => (
              <li key={exp.id}>
                <div>
                  <strong>{exp.description}</strong>
                </div>
                <div className="muted">
                  Entered: Rs {Number(exp.enteredAmount).toFixed(2)} | Owed transfer: Rs{" "}
                  {Number(exp.amount).toFixed(2)}
                </div>
                <div>
                  {exp.borrowerName} owes {exp.payerName}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

