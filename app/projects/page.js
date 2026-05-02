"use client";

import Link from "next/link";
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setProjects(await api("/api/projects"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => alert(e.message));
  }, []);

  async function addProject(e) {
    e.preventDefault();
    try {
      await api("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function editProject(project) {
    const nextName = prompt("Update project name:", project.name);
    if (!nextName) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ name: nextName }) });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteProject(project) {
    if (!confirm("Delete this project and all transactions?")) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <h1>Project Management</h1>

      <div className="card">
        <h3>Create Project</h3>
        <form onSubmit={addProject}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            required
          />
          <button type="submit">Create Project</button>
        </form>
      </div>

      <div className="card">
        <h3>All Projects</h3>
        {loading ? (
          <div className="muted">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="muted">No projects yet.</div>
        ) : (
          <ul>
            {projects
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <li key={p.id}>
                  <div className="row">
                    <div>
                      <Link href={`/project/${p.id}`}>
                        <strong style={{ fontSize: "16px" }}>{p.name}</strong>
                      </Link>
                      <div className="muted" style={{ marginTop: "4px", fontSize: "13px" }}>
                        {p.memberCount} members | {p.expenseCount} transactions
                      </div>
                    </div>
                    <div>
                      <button className="secondary" type="button" onClick={() => editProject(p)}>
                        Edit
                      </button>{" "}
                      <button className="danger" type="button" onClick={() => deleteProject(p)}>
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

