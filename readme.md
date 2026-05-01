# SplitMoney 💸

SplitMoney is a lightweight, zero-dependency web application designed to track shared expenses and settle debts among friends, heavily inspired by Splitwise. It provides a simple, intuitive interface to manage users, group them into projects, and automatically calculate who owes whom based on shared transactions.

SplitMoney is a **Next.js (App Router)** web app designed for **Vercel**. It stores data in **Supabase Postgres** via server-side API routes, making it 100% free to host and run.

## 🚀 Key Features

### 1. Global User Management
Before splitting costs, you define a global pool of users in the **User Management** page. 
* Add users by simply entering their name.
* Edit or delete users globally.

### 2. Project (Group) Management
Expenses are grouped logically into **Projects** (e.g., "Goa Road Trip", "Apartment Rent").
* Create, edit, and delete projects.
* Add or remove multiple users to a project from the global user pool.

### 3. Expense Tracking & Multi-Member Splitting
Within a project, you can log transactions between any number of users. The app supports infinite members per project and handles dynamic expense allocation through two primary modes:
1. **Split Equally:** The frontend takes the Total Amount and divides it equally among all project members. It automatically creates debts for everyone owed to the Payer.
2. **Custom Amounts:** The user can specify exactly how much each specific member owes the Payer. The UI strictly validates that the sum of these custom debts matches the Total Amount paid before submitting.

### 4. Mass CSV Upload
For migrating old trips or entering massive amounts of data at once, SplitMoney supports bulk CSV uploads. 
* Instantly upload hundreds of transactions at once.
* The CSV parser automatically maps your data and executes a bulk database insertion.

**Required CSV Format:**
The first row MUST be headers. Dates must be formatted as `YYYY-MM-DD`. Commas are not allowed in the description field. `PayerId` and `BorrowerId` must use the numerical database IDs of the users.
```csv
Date,Description,TotalAmount,PayerId,BorrowerId,DebtAmount
2026-04-15,Dinner at Goa,1500,1,2,500
2026-04-15,Dinner at Goa,1500,1,3,500
```

### 5. Smart Debt Simplification & Balances
You don't need to do any math. As you add or delete expenses, SplitMoney runs a greedy simplification algorithm behind the scenes to calculate:

* **Total Trip Cost:** A quick-glance sum of every transaction entered.
* **Balances:** A color-coded status for each user showing if they are in the green (`gets back ₹X`) or in the red (`owes ₹X`).
* **Settlement Suggestions:** Simplified transactions required to make everyone whole (e.g., "Satish pays Sandip: ₹500").
* **Transaction History:** A chronological ledger of all entered expenses.

---

## 🛠️ Technical Architecture

### Tech Stack
* **Frontend:** Next.js (App Router), React 19, CSS modules.
* **Backend:** Next.js API Routes (Serverless Functions).
* **Database:** Supabase (PostgreSQL).
* **Hosting:** Vercel.

### Next.js Routing
* **UI pages**:
  * `/users` → `app/users/page.js`
  * `/projects` → `app/projects/page.js`
  * `/project/[id]` → `app/project/[id]/page.js`
* **API routes**:
  * `GET/POST /api/users`
  * `PUT/DELETE /api/users/[id]`
  * `GET/POST /api/projects`
  * `GET/PUT/DELETE /api/projects/[id]`
  * `POST /api/projects/[id]/members`
  * `DELETE /api/projects/[id]/members/[userId]`
  * `POST /api/projects/[id]/expenses` (Handles bulk Array processing)
  * `DELETE /api/projects/[id]/expenses/[expenseId]`

---

## 💻 Getting Started
1. Clone the repository.
2. Run `npm install` or `yarn install`.
3. Set your local `.env.local` variables (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`).
4. Run `npm run dev`.