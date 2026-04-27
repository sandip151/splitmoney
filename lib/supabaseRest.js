function qs(params) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

export function toInFilter(ids) {
  // Supabase REST expects: in.(1,2,3)
  return `(${ids.join(",")})`;
}

export async function supa(pathname, { method = "GET", query, body, preferReturn = false } = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseRestUrl =
    process.env.SUPABASE_REST_URL || (supabaseUrl ? `${supabaseUrl}/rest/v1` : null);

  if (!supabaseRestUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL/SUPABASE_REST_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url = `${supabaseRestUrl}${pathname}${query ? `?${qs(query)}` : ""}`;

  const headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (preferReturn) headers.Prefer = "return=representation";

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (json && (json.message || json.error_description || json.details || json.hint)) ||
      text ||
      "Supabase error";
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return json;
}

