"use client";

import { useEffect, useState } from "react";

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

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => alert(e.message));
  }, []);

  async function addUser(e) {
    e.preventDefault();
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function editUser(user) {
    const nextName = prompt("Update user name:", user.name);
    if (!nextName) return;
    try {
      await api(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify({ name: nextName }) });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteUser(user) {
    if (!confirm("Delete this user?")) return;
    try {
      await api(`/api/users/${user.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <h1>User Management</h1>

      <div className="card">
        <h3>Add User</h3>
        <form onSubmit={addUser}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="User name"
            required
          />
          <button type="submit">Add User</button>
        </form>
      </div>

      <div className="card">
        <h3>All Users</h3>
        {loading ? (
          <div className="muted">Loading…</div>
        ) : users.length === 0 ? (
          <div className="muted">No users yet.</div>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u.id}>
                <div className="row">
                  <strong>{u.name}</strong>
                  <div>
                    <button className="secondary" type="button" onClick={() => editUser(u)}>
                      Edit
                    </button>{" "}
                    <button className="danger" type="button" onClick={() => deleteUser(u)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

