# SplitMoney 💸

SplitMoney is a lightweight, zero-dependency web application designed to track shared expenses and settle debts among friends, heavily inspired by Splitwise. It provides a simple, intuitive interface to manage users, group them into projects, and automatically calculate who owes whom based on shared transactions.

SplitMoney is a **Next.js (App Router)** web app designed for **Vercel**. It stores data in **Supabase Postgres** via server-side API routes, making it 100% free to host and run.

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

### 3. Expense Tracking & Splitting (Optimized for Pairs)
Within a project, you can log transactions between any two users. To keep expense entry extremely fast and straightforward, the app dynamically reads the two project members and generates four specific split scenarios based on their actual names:
1. **[User A] paid, split 50/50:** User A paid the full amount, but the cost is shared equally. User B owes User A half the amount.
2. **[User B] paid, split 50/50:** User B paid the full amount, shared equally. User A owes User B half the amount.
3. **[User A] paid fully for [User B]:** User A paid the full amount for a personal purchase that belongs entirely to User B. User B owes User A the full amount.
4. **[User B] paid fully for [User A]:** User B paid the full amount for a personal purchase that belongs entirely to User A. User A owes User B the full amount.

*Every expense requires a date, a description, and a valid positive amount. Expenses can be individually deleted, which instantly recalculates all project balances.*

### 4. Mass CSV Upload
For migrating old trips or entering massive amounts of data at once, SplitMoney supports bulk CSV uploads. 
* Instantly upload 50+ transactions at once.
* The CSV parser automatically maps your data and applies the correct math based on transaction type.

**Required CSV Format:**
The first row MUST be headers. Dates must be formatted as `YYYY-MM-DD`. Commas are not allowed in the description field.
```csv
Date,Description,Amount,Type
2026-04-15,Dinner at Goa,1500,A_PAID_SPLIT
2026-04-16,Hotel Booking,4000,B_PAID_SPLIT
2026-04-17,Flight Ticket,3500,B_OWE_FULL
```
*(Types mapping: `A_PAID_SPLIT`, `B_PAID_SPLIT`, `A_OWE_FULL`, `B_OWE_FULL`)*

### 5. Smart Debt Simplification & Balances
You don't need to do any math. As you add or delete expenses, SplitMoney runs a greedy simplification algorithm behind the scenes to calculate:
* **Total Trip Cost:** A quick-glance sum of every transaction entered.
* **Balances:** A color-coded status for each user showing if they are in the green (`gets back ₹X`) or in the red (`owes ₹X`).
* **Settlement Suggestions:** A single, simplified transaction required to make everyone whole (e.g., "Satish pays Sandip: ₹500").
* **Transaction History:** A chronological ledger of all entered expenses, grouped beautifully by date.

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
  * `POST /api/projects/[id]/expenses` (Handles both single objects and bulk Arrays)
  * `DELETE /api/projects/[id]/expenses/[expenseId]`

---

## 💻 Getting Started

Because this is a Next.js app, install dependencies once and then run the dev server.

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.
* A free [Supabase](https://supabase.com/) account.

### Installation & Execution
1. Clone the repository:
   ```bash
   git clone git@github.com:sandip151/splitmoney.git
   cd splitmoney