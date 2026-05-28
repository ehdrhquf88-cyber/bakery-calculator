import { createClient } from "@supabase/supabase-js";

const APP_ACCESS_ROLES = ["admin", "user"];

export async function getRequestUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) {
    return { user: null, error: "Missing authorization token" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Missing Supabase environment variables" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid authorization token" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || !APP_ACCESS_ROLES.includes(profile.role)) {
    return { user: null, error: "Forbidden" };
  }

  return { user: data.user, supabase, error: null };
}
