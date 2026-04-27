# SplitMoney 💸

SplitMoney is a lightweight, zero-dependency web application designed to track shared expenses and settle debts among friends, heavily inspired by Splitwise. It provides a simple, intuitive interface to manage users, group them into projects, and automatically calculate who owes whom based on shared transactions.

SplitMoney uses a Vanilla Node.js backend and Vanilla JavaScript frontend. It stores data in **Supabase Postgres** via the Supabase **REST API** (no npm dependencies needed).

## 🚀 Key Features

### 1. Global User Management
Before splitting costs, you define a global pool of users in the **User Management** page. 
* Add users by simply entering their name.
* Edit or delete users globally. (Note: Deletion is prevented if a user is actively assigned to a project to maintain data integrity).

### 2. Project (Group) Management
Expenses are grouped logically into **Projects** (e.g., "Goa Road Trip", "Apartment Rent").
* Create, edit, and delete projects.
* Add available users to a project from the global user pool.
* Remove users from a project (prevented if they are part of any existing transactions within that specific project).

### 3. Expense Tracking & Splitting
Within a project, you can log transactions between any two users (User A and User B). To keep expense entry extremely fast and straightforward, the app supports **four specific split scenarios**:
1. **User A paid and split equally:** User A paid the full amount, but the cost is shared 50/50. User B owes User A half the amount.
2. **User A owe fully this amount:** User B paid the full amount for something that belongs entirely to User A. User A owes User B the full amount.
3. **User B paid and split equally:** User B paid the full amount, shared 50/50. User A owes User B half the amount.
4. **User B owe fully this amount:** User A paid the full amount for something that belongs entirely to User B. User B owes User A the full amount.

*Every expense requires a description and a valid positive amount.*

### 4. Smart Debt Simplification & Balances
You don't need to do any math. As you add expenses, SplitMoney runs an algorithm behind the scenes to calculate:
* **Balances:** A running total for each user showing if they are in the green (`should receive Rs X`) or in the red (`owes Rs X`). If everything balances out perfectly, they are considered settled up.
* **Settlement Suggestions:** A simplified list of transactions required to make everyone whole (e.g., "Sandip pays Satish: Rs 500").
* **Transaction History:** A chronological ledger of all entered expenses showing who paid, who owes, and the exact amounts transferred.

---

## 🛠️ Technical Architecture

The application is built entirely from scratch without heavy frameworks or external npm dependencies. It is designed to be a fast, understandable prototype.

### Backend (`src/main.js`)
* **No Frameworks:** Uses Node.js built-in `http`, `fs`, and `path` modules to serve HTML/CSS/JS and handle RESTful API routing.
* **Supabase Storage:** Reads/writes to Supabase Postgres tables: `users`, `projects`, `project_members`, `expenses` via `https://<project>.supabase.co/rest/v1`.
* **REST API Endpoints:** * `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`
  * `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
  * `POST /api/projects/:id/members`, `DELETE /api/projects/:id/members/:userId`
  * `POST /api/projects/:id/expenses`
* **Debt Algorithm:** Implements a greedy algorithm (`simplifyDebts`) that matches the highest debtors with the highest creditors to minimize the total number of payback transactions.

### Frontend (`public/`)
* **Vanilla Stack:** Pure HTML5, CSS3, and JavaScript. 
* **Dynamic Rendering:** Uses the native `fetch` API to communicate with the backend and dynamically updates the DOM without full page reloads.
* **Responsive Design:** Clean, card-based UI built with CSS Grid and Flexbox for a modern feel.

---

## 💻 Getting Started

Because this project has zero external dependencies, getting it running locally takes seconds.

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Execution
1. Clone the repository:
   ```bash
   git clone git@github.com:sandip151/splitmoney.git
   cd splitmoney
(Local) Set environment variables (example):

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export PORT=3000
node src/main.js
```

(Vercel) Add environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)



(Note: we are planning to make this website with 0 cost so no paid any subscription for hosting or database or anything else)
