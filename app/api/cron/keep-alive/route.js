import { NextResponse } from "next/server";
import { supa } from "@/lib/supabaseRest";
// CRITICAL: This tells Vercel NEVER to cache this response
export const dynamic = 'force-dynamic'; 
export async function GET() {
try {
// Fetch exactly 1 user just to prove the DB is awake
await supa("/users", {
query: { select: "id", limit: "1" },
});
return NextResponse.json({ success: true, message: "Supabase is awake!" });
} catch (error) {
return NextResponse.json({ error: "Failed to ping database" }, { status: 500 });
}
}
