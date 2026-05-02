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

-- 1. DROP EXISTING PROTOTYPE TABLES
DROP TABLE IF EXISTS public.expenses;
DROP TABLE IF EXISTS public.project_members;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.users;
-- 2. CREATE PRODUCTION USERS TABLE
CREATE TABLE public.users (
id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
name text NOT NULL,
email text UNIQUE,           -- For future email login
phone text UNIQUE,           -- For future mobile login
auth_id uuid UNIQUE,         -- Links "Dummy" users to real Supabase Auth accounts
created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
-- 3. CREATE PRODUCTION PROJECTS TABLE
CREATE TABLE public.projects (
id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
name text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
-- 4. CREATE PROJECT MEMBERS TABLE
CREATE TABLE public.project_members (
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
PRIMARY KEY (project_id, user_id)
);
-- 5. CREATE PRODUCTION EXPENSES TABLE
CREATE TABLE public.expenses (
id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
group_id uuid NOT NULL,      -- Links multi-person splits together!
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
description text NOT NULL,
amount numeric NOT NULL,
entered_amount numeric NOT NULL,
payer_id uuid REFERENCES public.users(id),
borrower_id uuid REFERENCES public.users(id),
type text NOT NULL,
expense_date date NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_expenses_project_date ON public.expenses(project_id, expense_date DESC);

