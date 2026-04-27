var http = require("http");
var fs = require("fs");
var path = require("path");
var URLCtor = require("url").URL;

var port = process.env.PORT || 3000;
var publicDir = path.join(__dirname, "..", "public");

var supabaseUrl = process.env.SUPABASE_URL; // e.g. https://xxxx.supabase.co
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
var supabaseRestUrl =
  process.env.SUPABASE_REST_URL || (supabaseUrl ? supabaseUrl + "/rest/v1" : null);

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseRestUrl) {
  throw new Error(
    "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (and/or SUPABASE_REST_URL) environment variables"
  );
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getRequestBody(req) {
  return new Promise(function (resolve, reject) {
    var raw = "";
    req.on("data", function (chunk) {
      raw += chunk.toString();
    });
    req.on("end", function () {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function simplifyDebts(balances) {
  var debtors = balances
    .filter(function (item) {
      return item.balance < -0.009;
    })
    .map(function (item) {
      return Object.assign({}, item, { remaining: Math.abs(item.balance) });
    });
  var creditors = balances
    .filter(function (item) {
      return item.balance > 0.009;
    })
    .map(function (item) {
      return Object.assign({}, item, { remaining: item.balance });
    });

  var settlements = [];
  var i = 0;
  var j = 0;
  while (i < debtors.length && j < creditors.length) {
    var debtor = debtors[i];
    var creditor = creditors[j];
    var amount = Number(Math.min(debtor.remaining, creditor.remaining).toFixed(2));

    settlements.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,
      toUserId: creditor.userId,
      toUserName: creditor.userName,
      amount: amount,
    });

    debtor.remaining = Number((debtor.remaining - amount).toFixed(2));
    creditor.remaining = Number((creditor.remaining - amount).toFixed(2));

    if (debtor.remaining <= 0.009) i += 1;
    if (creditor.remaining <= 0.009) j += 1;
  }

  return settlements;
}

function computeBalances(members, expenses) {
  var totals = {};
  for (var k = 0; k < members.length; k++) {
    totals[members[k].id] = 0;
  }

  for (var e = 0; e < expenses.length; e++) {
    var exp = expenses[e];
    if (!(exp.payer_id in totals) || !(exp.borrower_id in totals)) continue;
    totals[exp.borrower_id] -= Number(exp.amount);
    totals[exp.payer_id] += Number(exp.amount);
  }

  return members
    .map(function (member) {
      return {
        userId: member.id,
        userName: member.name,
        balance: Number(Number(totals[member.id] || 0).toFixed(2)),
      };
    })
    .sort(function (a, b) {
      return a.userName.localeCompare(b.userName);
    });
}

function serveStaticFile(filePath, res) {
  fs.readFile(filePath, function (err, data) {
    if (err) return sendText(res, 404, "Not found");

    var ext = path.extname(filePath).toLowerCase();
    var mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function qs(params) {
  var sp = new URLSearchParams();
  var entries = Object.entries(params || {});
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    var value = entries[i][1];
    if (value === undefined || value === null) continue;
    sp.set(key, value);
  }
  return sp.toString();
}

function toInFilter(ids) {
  return "(" + ids.join(",") + ")"; // in.(1,2,3)
}

async function supa(pathname, opts) {
  opts = opts || {};
  var method = opts.method || "GET";
  var query = opts.query;
  var body = opts.body;
  var preferReturn = !!opts.preferReturn;
  var url = supabaseRestUrl + pathname + (query ? "?" + qs(query) : "");

  var headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: "Bearer " + supabaseServiceRoleKey,
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (preferReturn) headers.Prefer = "return=representation";

  var response = await fetch(url, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  var text = await response.text();
  var json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    var message =
      (json && (json.message || json.error_description || json.details || json.hint)) ||
      text ||
      "Supabase error";
    var err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return json;
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/users") {
      var users = await supa("/users", {
        query: { select: "id,name,created_at", order: "name.asc" },
      });
      return sendJson(res, 200, users);
    }

    if (req.method === "POST" && pathname === "/api/users") {
      var body = await getRequestBody(req);
      var name = String(body.name || "").trim();
      if (!name) return sendJson(res, 400, { error: "Name is required" });

      var created = await supa("/users", { method: "POST", body: { name: name }, preferReturn: true });
      return sendJson(res, 201, created[0]);
    }

    var userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (userMatch && req.method === "PUT") {
      var userId = Number(userMatch[1]);
      var bodyPut = await getRequestBody(req);
      var nextName = String(bodyPut.name || "").trim();
      if (!nextName) return sendJson(res, 400, { error: "Name is required" });

      var updated = await supa("/users", {
        method: "PATCH",
        query: { id: "eq." + userId },
        body: { name: nextName },
        preferReturn: true,
      });
      if (!updated || updated.length === 0) return sendJson(res, 404, { error: "User not found" });
      return sendJson(res, 200, updated[0]);
    }

    if (userMatch && req.method === "DELETE") {
      var userIdDel = Number(userMatch[1]);
      var membership = await supa("/project_members", {
        query: { user_id: "eq." + userIdDel, select: "project_id", limit: "1" },
      });
      if (membership && membership.length > 0) {
        return sendJson(res, 400, { error: "Cannot delete user assigned to a project" });
      }
      await supa("/users", { method: "DELETE", query: { id: "eq." + userIdDel } });
      return sendJson(res, 200, { success: true });
    }

    if (req.method === "GET" && pathname === "/api/projects") {
      var projects = await supa("/projects", {
        query: { select: "id,name,created_at", order: "created_at.desc" },
      });

      var enriched = [];
      for (var p = 0; p < projects.length; p++) {
        var project = projects[p];
        var members = await supa("/project_members", {
          query: { project_id: "eq." + project.id, select: "user_id" },
        });
        var expenses = await supa("/expenses", { query: { project_id: "eq." + project.id, select: "id" } });
        enriched.push({
          id: project.id,
          name: project.name,
          memberIds: members.map(function (m) {
            return m.user_id;
          }),
          memberCount: members.length,
          expenseCount: expenses.length,
        });
      }

      return sendJson(res, 200, enriched);
    }

    if (req.method === "POST" && pathname === "/api/projects") {
      var bodyProj = await getRequestBody(req);
      var projName = String(bodyProj.name || "").trim();
      if (!projName) return sendJson(res, 400, { error: "Project name is required" });

      var createdProj = await supa("/projects", {
        method: "POST",
        body: { name: projName },
        preferReturn: true,
      });
      return sendJson(res, 201, Object.assign({}, createdProj[0], { memberIds: [] }));
    }

    var projectMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
    if (projectMatch && req.method === "PUT") {
      var projectIdPut = Number(projectMatch[1]);
      var bodyProjectPut = await getRequestBody(req);
      var nextProjectName = String(bodyProjectPut.name || "").trim();
      if (!nextProjectName) return sendJson(res, 400, { error: "Project name is required" });

      var updatedProj = await supa("/projects", {
        method: "PATCH",
        query: { id: "eq." + projectIdPut },
        body: { name: nextProjectName },
        preferReturn: true,
      });
      if (!updatedProj || updatedProj.length === 0) return sendJson(res, 404, { error: "Project not found" });
      return sendJson(res, 200, updatedProj[0]);
    }

    if (projectMatch && req.method === "DELETE") {
      var projectIdDel = Number(projectMatch[1]);
      await supa("/projects", { method: "DELETE", query: { id: "eq." + projectIdDel } });
      return sendJson(res, 200, { success: true });
    }

    if (projectMatch && req.method === "GET") {
      var projectIdGet = Number(projectMatch[1]);
      var projectsFound = await supa("/projects", {
        query: { id: "eq." + projectIdGet, select: "id,name" },
      });
      if (!projectsFound || projectsFound.length === 0) return sendJson(res, 404, { error: "Project not found" });
      var proj = projectsFound[0];

      var membershipRows = await supa("/project_members", {
        query: { project_id: "eq." + projectIdGet, select: "user_id" },
      });
      var memberIds = membershipRows.map(function (r) {
        return r.user_id;
      });

      var members =
        memberIds.length === 0
          ? []
          : await supa("/users", {
              query: { id: "in." + toInFilter(memberIds), select: "id,name", order: "name.asc" },
            });

      var expensesRows = await supa("/expenses", {
        query: {
          project_id: "eq." + projectIdGet,
          select: "id,project_id,description,amount,entered_amount,payer_id,borrower_id,type,created_at",
          order: "created_at.desc",
        },
      });

      var memberIdSet = new Set(memberIds);
      var visibleExpenses = expensesRows.filter(function (ex) {
        return memberIdSet.has(ex.payer_id) && memberIdSet.has(ex.borrower_id);
      });

      var userById = new Map(
        members.map(function (m) {
          return [m.id, m];
        })
      );

      var apiExpenses = visibleExpenses.map(function (ex) {
        return {
          id: ex.id,
          projectId: ex.project_id,
          description: ex.description,
          amount: Number(Number(ex.amount).toFixed(2)),
          enteredAmount: Number(Number(ex.entered_amount).toFixed(2)),
          payerId: ex.payer_id,
          borrowerId: ex.borrower_id,
          type: ex.type,
          createdAt: ex.created_at,
          payerName: (userById.get(ex.payer_id) || {}).name || "User " + ex.payer_id,
          borrowerName: (userById.get(ex.borrower_id) || {}).name || "User " + ex.borrower_id,
        };
      });

      var balances = computeBalances(members, visibleExpenses);
      var settlements = simplifyDebts(balances);

      return sendJson(res, 200, {
        project: { id: proj.id, name: proj.name, memberIds: memberIds },
        members: members,
        expenses: apiExpenses,
        balances: balances,
        settlements: settlements,
      });
    }

    var membersMatch = pathname.match(/^\/api\/projects\/(\d+)\/members$/);
    if (membersMatch && req.method === "POST") {
      var projectIdMember = Number(membersMatch[1]);
      var bodyMember = await getRequestBody(req);
      var userIdMember = Number(bodyMember.userId);
      if (!userIdMember) return sendJson(res, 400, { error: "userId is required" });

      var projCheck = await supa("/projects", { query: { id: "eq." + projectIdMember, select: "id" } });
      if (!projCheck || projCheck.length === 0) return sendJson(res, 404, { error: "Project not found" });

      var userCheck = await supa("/users", { query: { id: "eq." + userIdMember, select: "id" } });
      if (!userCheck || userCheck.length === 0) return sendJson(res, 404, { error: "User not found" });

      try {
        await supa("/project_members", {
          method: "POST",
          body: { project_id: projectIdMember, user_id: userIdMember },
        });
      } catch (e) {
        return sendJson(res, 400, { error: "User already in project" });
      }

      return sendJson(res, 201, { success: true });
    }

    var memberDeleteMatch = pathname.match(/^\/api\/projects\/(\d+)\/members\/(\d+)$/);
    if (memberDeleteMatch && req.method === "DELETE") {
      var projectIdRm = Number(memberDeleteMatch[1]);
      var userIdRm = Number(memberDeleteMatch[2]);

      var hasExpense = await supa("/expenses", {
        query: {
          project_id: "eq." + projectIdRm,
          or: "(payer_id.eq." + userIdRm + ",borrower_id.eq." + userIdRm + ")",
          select: "id",
          limit: "1",
        },
      });
      if (hasExpense && hasExpense.length > 0) {
        return sendJson(res, 400, { error: "Cannot remove member with existing expenses" });
      }

      await supa("/project_members", {
        method: "DELETE",
        query: { project_id: "eq." + projectIdRm, user_id: "eq." + userIdRm },
      });
      return sendJson(res, 200, { success: true });
    }

    var expensesMatch = pathname.match(/^\/api\/projects\/(\d+)\/expenses$/);
    if (expensesMatch && req.method === "POST") {
      var projectIdExp = Number(expensesMatch[1]);
      var bodyExp = await getRequestBody(req);

      var enteredAmount = Number(bodyExp.amount);
      var description = String(bodyExp.description || "").trim();
      var type = String(bodyExp.type || "");
      var memberAId = Number(bodyExp.memberAId);
      var memberBId = Number(bodyExp.memberBId);

      if (!enteredAmount || enteredAmount <= 0) return sendJson(res, 400, { error: "Amount must be greater than 0" });
      if (!description) return sendJson(res, 400, { error: "Description is required" });
      if (!memberAId || !memberBId) return sendJson(res, 400, { error: "Please choose two users" });
      if (memberAId === memberBId) return sendJson(res, 400, { error: "Please choose two different users" });

      var membershipRows = await supa("/project_members", {
        query: {
          project_id: "eq." + projectIdExp,
          user_id: "in." + toInFilter([memberAId, memberBId]),
          select: "user_id",
        },
      });
      if (!membershipRows || membershipRows.length !== 2) {
        return sendJson(res, 400, { error: "Both users must be project members" });
      }

      var payerId;
      var borrowerId;
      var amount;

      if (type === "A_PAID_SPLIT") {
        payerId = memberAId;
        borrowerId = memberBId;
        amount = enteredAmount / 2;
      } else if (type === "A_OWE_FULL") {
        payerId = memberBId;
        borrowerId = memberAId;
        amount = enteredAmount;
      } else if (type === "B_PAID_SPLIT") {
        payerId = memberBId;
        borrowerId = memberAId;
        amount = enteredAmount / 2;
      } else if (type === "B_OWE_FULL") {
        payerId = memberAId;
        borrowerId = memberBId;
        amount = enteredAmount;
      } else {
        return sendJson(res, 400, { error: "Invalid expense type" });
      }

      var inserted = await supa("/expenses", {
        method: "POST",
        body: {
          project_id: projectIdExp,
          description: description,
          amount: Number(amount.toFixed(2)),
          entered_amount: Number(enteredAmount.toFixed(2)),
          payer_id: payerId,
          borrower_id: borrowerId,
          type: type,
        },
        preferReturn: true,
      });

      var ex = inserted[0];
      return sendJson(res, 201, {
        id: ex.id,
        projectId: ex.project_id,
        description: ex.description,
        amount: Number(Number(ex.amount).toFixed(2)),
        enteredAmount: Number(Number(ex.entered_amount).toFixed(2)),
        payerId: ex.payer_id,
        borrowerId: ex.borrower_id,
        type: ex.type,
        createdAt: ex.created_at,
      });
    }

    return sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    var status = error && error.status && Number.isFinite(error.status) ? error.status : 400;
    return sendJson(res, status, { error: (error && error.message) || "Request failed" });
  }
}

var server = http.createServer(async function (req, res) {
  var parsedUrl = new URLCtor(req.url, "http://localhost:" + port);
  var pathname = parsedUrl.pathname;

  if (pathname.indexOf("/api/") === 0) {
    return handleApi(req, res, pathname);
  }

  var routeToFile = {
    "/": "index.html",
    "/users": "users.html",
    "/projects": "projects.html",
    "/project": "project.html",
  };

  if (routeToFile[pathname]) {
    return serveStaticFile(path.join(publicDir, routeToFile[pathname]), res);
  }

  var safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  var staticPath = path.join(publicDir, safePath);
  if (staticPath.indexOf(publicDir) === 0) {
    return serveStaticFile(staticPath, res);
  }

  return sendText(res, 404, "Not found");
});

server.listen(port, function () {
  console.log("SplitMoney server running at http://localhost:" + port);
});

