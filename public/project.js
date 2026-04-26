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

const params = new URLSearchParams(window.location.search);
const projectId = Number(params.get("id"));

const projectTitle = document.getElementById("project-title");
const memberUserSelect = document.getElementById("member-user-select");
const addMemberForm = document.getElementById("add-member-form");
const membersList = document.getElementById("members-list");
const addExpenseForm = document.getElementById("add-expense-form");
const descriptionInput = document.getElementById("expense-description");
const amountInput = document.getElementById("expense-amount");
const memberASelect = document.getElementById("member-a-select");
const memberBSelect = document.getElementById("member-b-select");
const expenseTypeSelect = document.getElementById("expense-type-select");
const balancesList = document.getElementById("balances-list");
const settlementsList = document.getElementById("settlements-list");
const expensesList = document.getElementById("expenses-list");

let allUsers = [];
let state = null;

function optionHtml(users) {
  return users.map((u) => `<option value="${u.id}">${u.name}</option>`).join("");
}

function setExpenseTypeLabels() {
  const aName = memberASelect.selectedOptions[0]?.textContent || "UserA";
  const bName = memberBSelect.selectedOptions[0]?.textContent || "UserB";
  expenseTypeSelect.innerHTML = `
    <option value="A_PAID_SPLIT">${aName} paid and split equally</option>
    <option value="A_OWE_FULL">${aName} owe the full amount</option>
    <option value="B_PAID_SPLIT">${bName} paid and split equally</option>
    <option value="B_OWE_FULL">${bName} owe the full amount</option>
  `;
}

function render() {
  if (!state) {
    return;
  }
  projectTitle.textContent = `Project: ${state.project.name}`;

  const availableToAdd = allUsers.filter(
    (user) => !state.members.some((member) => member.id === user.id)
  );
  memberUserSelect.innerHTML =
    availableToAdd.length > 0
      ? optionHtml(availableToAdd)
      : `<option value="">No available users</option>`;

  membersList.innerHTML = "";
  if (state.members.length === 0) {
    membersList.innerHTML = `<li class="muted">No members yet.</li>`;
  } else {
    state.members.forEach((member) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <strong>${member.name}</strong>
          <button class="danger" data-remove-member="${member.id}">Remove</button>
        </div>
      `;
      membersList.appendChild(li);
    });
  }

  const memberOptions = state.members.length > 0 ? optionHtml(state.members) : `<option value="">No members</option>`;
  memberASelect.innerHTML = memberOptions;
  memberBSelect.innerHTML = memberOptions;
  if (state.members.length > 1) {
    memberBSelect.selectedIndex = 1;
  }
  setExpenseTypeLabels();

  balancesList.innerHTML = "";
  if (state.balances.length === 0) {
    balancesList.innerHTML = `<li class="muted">No balances yet.</li>`;
  } else {
    state.balances.forEach((entry) => {
      let text = "settled";
      let className = "muted";
      if (entry.balance > 0.009) {
        text = `should receive Rs ${entry.balance.toFixed(2)}`;
        className = "good";
      } else if (entry.balance < -0.009) {
        text = `owes Rs ${Math.abs(entry.balance).toFixed(2)}`;
        className = "bad";
      }
      const li = document.createElement("li");
      li.innerHTML = `<strong>${entry.userName}</strong> <span class="${className}">${text}</span>`;
      balancesList.appendChild(li);
    });
  }

  settlementsList.innerHTML = "";
  if (state.settlements.length === 0) {
    settlementsList.innerHTML = `<li class="good">All settled up.</li>`;
  } else {
    state.settlements.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.fromUserName} pays ${s.toUserName}: Rs ${s.amount.toFixed(2)}`;
      settlementsList.appendChild(li);
    });
  }

  expensesList.innerHTML = "";
  if (state.expenses.length === 0) {
    expensesList.innerHTML = `<li class="muted">No transactions yet.</li>`;
  } else {
    [...state.expenses]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((exp) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div><strong>${exp.description}</strong></div>
          <div class="muted">Entered: Rs ${exp.enteredAmount.toFixed(2)} | Owed transfer: Rs ${exp.amount.toFixed(2)}</div>
          <div>${exp.borrowerName} owes ${exp.payerName}</div>
        `;
        expensesList.appendChild(li);
      });
  }
}

async function loadData() {
  allUsers = await api("/api/users");
  state = await api(`/api/projects/${projectId}`);
  render();
}

memberASelect.addEventListener("change", setExpenseTypeLabels);
memberBSelect.addEventListener("change", setExpenseTypeLabels);

addMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = Number(memberUserSelect.value);
  if (!userId) {
    alert("No available user to add.");
    return;
  }
  try {
    await api(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    await loadData();
  } catch (err) {
    alert(err.message);
  }
});

membersList.addEventListener("click", async (event) => {
  const userId = event.target.getAttribute("data-remove-member");
  if (!userId) {
    return;
  }
  if (!confirm("Remove this member from project?")) {
    return;
  }
  try {
    await api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    await loadData();
  } catch (err) {
    alert(err.message);
  }
});

addExpenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.members.length < 2) {
    alert("At least two members are required.");
    return;
  }
  const payload = {
    description: descriptionInput.value,
    amount: Number(amountInput.value),
    memberAId: Number(memberASelect.value),
    memberBId: Number(memberBSelect.value),
    type: expenseTypeSelect.value,
  };
  try {
    await api(`/api/projects/${projectId}/expenses`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    addExpenseForm.reset();
    render();
    await loadData();
  } catch (err) {
    alert(err.message);
  }
});

if (!projectId) {
  alert("Missing project id. Open this page from Project Management.");
} else {
  loadData().catch((err) => alert(err.message));
}
