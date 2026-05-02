# SplitMoney: Project Skills & Knowledge Base

This file (`skills.md`) serves as the core technical and functional context for the **SplitMoney** project. Any AI assistant or developer reading this file should instantly understand the project's purpose, architecture, database schema, routing structure, and specific business logic.

---

## 1. Project Overview
**SplitMoney** is a lightweight, zero-dependency (conceptually) Next.js web application designed to track shared expenses and settle debts among friends, inspired by Splitwise. It is explicitly designed to be hosted for free on **Vercel** with a **Supabase (PostgreSQL)** backend.

### Core Philosophy
* **Mobile-First & Dashboard Driven:** Users immediately see total trip costs and who owes whom. Form entry is pushed to the bottom to prioritize data visibility.
* **Minimalist UI:** Clean, color-coded badges (Green for "gets back", Red for "owes"). 
* **Zero Math for the User:** The backend recalculates all debts dynamically upon any change (add, delete, bulk upload).

---

## 2. Technical Stack
* **Framework:** Next.js (App Router, React 19).
* **Package Manager:** `yarn` (NOT npm).
* **Styling:** Global CSS (`globals.css`) using flexbox and grid for responsive design. No heavy UI libraries like Tailwind or MUI.
* **Database:** Supabase (PostgreSQL).
* **API Communication:** Serverless API Routes (`app/api/...`) talking directly to Supabase via the Supabase REST API.
* **Deployment:** Vercel (Framework Preset MUST be set to "Next.js").

---

## 3. Database Schema (Supabase Postgres)
The application relies on four primary tables. All relationships use `ON DELETE CASCADE`.
