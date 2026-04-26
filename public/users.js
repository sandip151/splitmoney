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

const usersList = document.getElementById("users-list");
const addUserForm = document.getElementById("add-user-form");
const newUserName = document.getElementById("new-user-name");

async function loadUsers() {
  const users = await api("/api/users");
  usersList.innerHTML = "";

  if (users.length === 0) {
    usersList.innerHTML = `<li class="muted">No users yet.</li>`;
    return;
  }

  users
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((user) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <strong>${user.name}</strong>
          <div>
            <button class="secondary" data-edit="${user.id}">Edit</button>
            <button class="danger" data-delete="${user.id}">Delete</button>
          </div>
        </div>
      `;
      usersList.appendChild(li);
    });
}

addUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ name: newUserName.value }),
    });
    newUserName.value = "";
    await loadUsers();
  } catch (err) {
    alert(err.message);
  }
});

usersList.addEventListener("click", async (event) => {
  const editId = event.target.getAttribute("data-edit");
  const deleteId = event.target.getAttribute("data-delete");

  if (editId) {
    const current = event.target.closest("li").querySelector("strong").textContent;
    const nextName = prompt("Update user name:", current);
    if (!nextName) {
      return;
    }
    try {
      await api(`/api/users/${editId}`, {
        method: "PUT",
        body: JSON.stringify({ name: nextName }),
      });
      await loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  if (deleteId) {
    if (!confirm("Delete this user?")) {
      return;
    }
    try {
      await api(`/api/users/${deleteId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }
});

loadUsers().catch((err) => alert(err.message));
