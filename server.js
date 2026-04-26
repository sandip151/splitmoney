const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const db = {
  users: [],
  projects: [],
  expenses: [],
  nextUserId: 1,
  nextProjectId: 1,
  nextExpenseId: 1,
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getUserById(id) {
  return db.users.find((user) => user.id === id) || null;
}

function getProjectById(id) {
  return db.projects.find((project) => project.id === id) || null;
}

function getProjectExpenses(projectId) {
  return db.expenses.filter((expense) => expense.projectId === projectId);
}

function computeBalances(projectId) {
  const project = getProjectById(projectId);
  if (!project) {
    return [];
  }

  const totals = {};
  for (const userId of project.memberIds) {
    totals[userId] = 0;
  }

  for (const expense of getProjectExpenses(projectId)) {
    if (!(expense.payerId in totals) || !(expense.borrowerId in totals)) {
      continue;
    }
    totals[expense.borrowerId] -= expense.amount;
    totals[expense.payerId] += expense.amount;
  }

  return project.memberIds
    .map((memberId) => {
      const user = getUserById(memberId);
      return {
        userId: memberId,
        userName: user ? user.name : `User ${memberId}`,
        balance: Number(totals[memberId].toFixed(2)),
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

function simplifyDebts(balances) {
  const debtors = balances
    .filter((item) => item.balance < -0.009)
    .map((item) => ({ ...item, remaining: Math.abs(item.balance) }));
  const creditors = balances
    .filter((item) => item.balance > 0.009)
    .map((item) => ({ ...item, remaining: item.balance }));

  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Number(Math.min(debtor.remaining, creditor.remaining).toFixed(2));

    settlements.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,
      toUserId: creditor.userId,
      toUserName: creditor.userName,
      amount,
    });

    debtor.remaining = Number((debtor.remaining - amount).toFixed(2));
    creditor.remaining = Number((creditor.remaining - amount).toFixed(2));

    if (debtor.remaining <= 0.009) {
      i += 1;
    }
    if (creditor.remaining <= 0.009) {
      j += 1;
    }
  }

  return settlements;
}

function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/users") {
      return sendJson(res, 200, db.users);
    }

    if (req.method === "POST" && pathname === "/api/users") {
      const body = await getRequestBody(req);
      const name = String(body.name || "").trim();
      if (!name) {
        return sendJson(res, 400, { error: "Name is required" });
      }
      const user = { id: db.nextUserId++, name };
      db.users.push(user);
      return sendJson(res, 201, user);
    }

    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && req.method === "PUT") {
      const userId = Number(userMatch[1]);
      const user = getUserById(userId);
      if (!user) {
        return sendJson(res, 404, { error: "User not found" });
      }
      const body = await getRequestBody(req);
      const name = String(body.name || "").trim();
      if (!name) {
        return sendJson(res, 400, { error: "Name is required" });
      }
      user.name = name;
      return sendJson(res, 200, user);
    }

    if (userMatch && req.method === "DELETE") {
      const userId = Number(userMatch[1]);
      const isInProject = db.projects.some((project) => project.memberIds.includes(userId));
      if (isInProject) {
        return sendJson(res, 400, { error: "Cannot delete user assigned to a project" });
      }
      const index = db.users.findIndex((user) => user.id === userId);
      if (index < 0) {
        return sendJson(res, 404, { error: "User not found" });
      }
      db.users.splice(index, 1);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "GET" && pathname === "/api/projects") {
      const projects = db.projects.map((project) => ({
        ...project,
        memberCount: project.memberIds.length,
        expenseCount: getProjectExpenses(project.id).length,
      }));
      return sendJson(res, 200, projects);
    }

    if (req.method === "POST" && pathname === "/api/projects") {
      const body = await getRequestBody(req);
      const name = String(body.name || "").trim();
      if (!name) {
        return sendJson(res, 400, { error: "Project name is required" });
      }
      const project = { id: db.nextProjectId++, name, memberIds: [] };
      db.projects.push(project);
      return sendJson(res, 201, project);
    }

    const projectMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
    if (projectMatch && req.method === "GET") {
      const projectId = Number(projectMatch[1]);
      const project = getProjectById(projectId);
      if (!project) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      const members = project.memberIds
        .map((id) => getUserById(id))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      const expenses = getProjectExpenses(projectId).map((expense) => {
        const payer = getUserById(expense.payerId);
        const borrower = getUserById(expense.borrowerId);
        return {
          ...expense,
          payerName: payer ? payer.name : `User ${expense.payerId}`,
          borrowerName: borrower ? borrower.name : `User ${expense.borrowerId}`,
        };
      });
      const balances = computeBalances(projectId);
      const settlements = simplifyDebts(balances);
      return sendJson(res, 200, { project, members, expenses, balances, settlements });
    }

    if (projectMatch && req.method === "PUT") {
      const projectId = Number(projectMatch[1]);
      const project = getProjectById(projectId);
      if (!project) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      const body = await getRequestBody(req);
      const name = String(body.name || "").trim();
      if (!name) {
        return sendJson(res, 400, { error: "Project name is required" });
      }
      project.name = name;
      return sendJson(res, 200, project);
    }

    if (projectMatch && req.method === "DELETE") {
      const projectId = Number(projectMatch[1]);
      const projectIndex = db.projects.findIndex((project) => project.id === projectId);
      if (projectIndex < 0) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      db.projects.splice(projectIndex, 1);
      db.expenses = db.expenses.filter((expense) => expense.projectId !== projectId);
      return sendJson(res, 200, { success: true });
    }

    const membersMatch = pathname.match(/^\/api\/projects\/(\d+)\/members$/);
    if (membersMatch && req.method === "POST") {
      const projectId = Number(membersMatch[1]);
      const project = getProjectById(projectId);
      if (!project) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      const body = await getRequestBody(req);
      const userId = Number(body.userId);
      const user = getUserById(userId);
      if (!user) {
        return sendJson(res, 404, { error: "User not found" });
      }
      if (project.memberIds.includes(userId)) {
        return sendJson(res, 400, { error: "User already in project" });
      }
      project.memberIds.push(userId);
      return sendJson(res, 201, { success: true });
    }

    const memberDeleteMatch = pathname.match(/^\/api\/projects\/(\d+)\/members\/(\d+)$/);
    if (memberDeleteMatch && req.method === "DELETE") {
      const projectId = Number(memberDeleteMatch[1]);
      const userId = Number(memberDeleteMatch[2]);
      const project = getProjectById(projectId);
      if (!project) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      const hasExpense = getProjectExpenses(projectId).some(
        (expense) => expense.payerId === userId || expense.borrowerId === userId
      );
      if (hasExpense) {
        return sendJson(res, 400, { error: "Cannot remove member with existing expenses" });
      }
      project.memberIds = project.memberIds.filter((id) => id !== userId);
      return sendJson(res, 200, { success: true });
    }

    const expensesMatch = pathname.match(/^\/api\/projects\/(\d+)\/expenses$/);
    if (expensesMatch && req.method === "POST") {
      const projectId = Number(expensesMatch[1]);
      const project = getProjectById(projectId);
      if (!project) {
        return sendJson(res, 404, { error: "Project not found" });
      }
      const body = await getRequestBody(req);
      const amount = Number(body.amount);
      const description = String(body.description || "").trim();
      const type = String(body.type || "");
      const memberAId = Number(body.memberAId);
      const memberBId = Number(body.memberBId);

      if (!amount || amount <= 0) {
        return sendJson(res, 400, { error: "Amount must be greater than 0" });
      }
      if (!description) {
        return sendJson(res, 400, { error: "Description is required" });
      }
      if (memberAId === memberBId) {
        return sendJson(res, 400, { error: "Please choose two different users" });
      }
      if (!project.memberIds.includes(memberAId) || !project.memberIds.includes(memberBId)) {
        return sendJson(res, 400, { error: "Both users must be project members" });
      }

      let payerId;
      let borrowerId;
      let recordedAmount;

      if (type === "A_PAID_SPLIT") {
        payerId = memberAId;
        borrowerId = memberBId;
        recordedAmount = amount / 2;
      } else if (type === "A_OWE_FULL") {
        payerId = memberBId;
        borrowerId = memberAId;
        recordedAmount = amount;
      } else if (type === "B_PAID_SPLIT") {
        payerId = memberBId;
        borrowerId = memberAId;
        recordedAmount = amount / 2;
      } else if (type === "B_OWE_FULL") {
        payerId = memberAId;
        borrowerId = memberBId;
        recordedAmount = amount;
      } else {
        return sendJson(res, 400, { error: "Invalid expense type" });
      }

      const expense = {
        id: db.nextExpenseId++,
        projectId,
        description,
        amount: Number(recordedAmount.toFixed(2)),
        enteredAmount: Number(amount.toFixed(2)),
        payerId,
        borrowerId,
        type,
        createdAt: new Date().toISOString(),
      };
      db.expenses.push(expense);
      return sendJson(res, 201, expense);
    }

    return sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Request failed" });
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${port}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname);
  }

  const routeToFile = {
    "/": "index.html",
    "/users": "users.html",
    "/projects": "projects.html",
    "/project": "project.html",
  };

  if (routeToFile[pathname]) {
    return serveStaticFile(path.join(publicDir, routeToFile[pathname]), res);
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const staticPath = path.join(publicDir, safePath);
  if (staticPath.startsWith(publicDir)) {
    return serveStaticFile(staticPath, res);
  }

  return sendText(res, 404, "Not found");
});

server.listen(port, () => {
  console.log(`SplitMoney server running at http://localhost:${port}`);
});
