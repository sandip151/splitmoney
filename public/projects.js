async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

const list = document.getElementById("projects-list");
const form = document.getElementById("add-project-form");
const input = document.getElementById("new-project-name");

async function loadProjects() {
  const projects = await api("/api/projects");
  list.innerHTML = "";

  if (projects.length === 0) {
    list.innerHTML = `<li class="muted">No projects yet.</li>`;
    return;
  }

  projects
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((project) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <div>
            <a href="/project?id=${project.id}"><strong>${project.name}</strong></a>
            <div class="muted">${project.memberCount} members | ${project.expenseCount} transactions</div>
          </div>
          <div>
            <button class="secondary" data-edit="${project.id}">Edit</button>
            <button class="danger" data-delete="${project.id}">Delete</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: input.value }),
    });
    input.value = "";
    await loadProjects();
  } catch (err) {
    alert(err.message);
  }
});

list.addEventListener("click", async (event) => {
  const editId = event.target.getAttribute("data-edit");
  const deleteId = event.target.getAttribute("data-delete");

  if (editId) {
    const current = event.target.closest("li").querySelector("strong").textContent;
    const nextName = prompt("Update project name:", current);
    if (!nextName) {
      return;
    }
    try {
      await api(`/api/projects/${editId}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName }),
      });
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  }

  if (deleteId) {
    if (!confirm("Delete this project and all transactions?")) {
      return;
    }
    try {
      await api(`/api/projects/${deleteId}`, { method: "DELETE" });
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  }
});

loadProjects().catch((err) => alert(err.message));
