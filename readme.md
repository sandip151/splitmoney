# SplitMoney 💸

SplitMoney is a Next.js web application designed to track shared expenses and settle debts among friends, heavily inspired by Splitwise. It provides a simple interface to manage users, group them into projects, and calculate who owes whom based on shared transactions.

SplitMoney is a **Next.js (App Router)** web app designed for **Vercel**. It stores data in **Supabase Postgres** via server-side API routes.

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

### Next.js App
* **UI pages**:
  * `/users` → `app/users/page.js`
  * `/projects` → `app/projects/page.js`
  * `/project/[id]` → `app/project/[id]/page.js`
* **API routes** (server-side, talk to Supabase):
  * `GET/POST /api/users`
  * `PUT/DELETE /api/users/:id`
  * `GET/POST /api/projects`
  * `GET/PUT/DELETE /api/projects/:id`
  * `POST /api/projects/:id/members`
  * `DELETE /api/projects/:id/members/:userId`
  * `POST /api/projects/:id/expenses`
* **Debt algorithm**: same greedy simplification used to compute balances and settlement suggestions.

---

## 💻 Getting Started

This is a Next.js app (App Router). Install dependencies and run the dev server.

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Execution
1. Clone the repository:
   ```bash
   git clone git@github.com:sandip151/splitmoney.git
   cd splitmoney
(Local) Install:

```bash
npm install
```

Set environment variables (example):

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export PORT=3000
npm run dev
```

(Vercel) Add environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)




(Note: we are planning to make this website with 0 cost so no paid any subscription for hosting or database or anything else)
