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
The first row MUST be headers. Dates must be formatted as `YYYY-MM-DD`. Commas are not allowed in the description field. `PayerId` and `BorrowerId` must use the secure UUIDs of the users from the database.
To group multiple debts into a single receipt (e.g., 3 people split one dinner), you must pass the exact same UUID in the optional `GroupId` column. If left blank, the system auto-generates a unique group ID for that specific row.
