import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

/**
 * @param {import("express").Request} req
 * @returns {Promise<string | null>} Supabase user id, or null
 */
export async function getRequestUserId(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      const supabase = getSupabaseAdminClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user?.id) {
        return user.id;
      }
    }
  }

  if (process.env.ALLOW_INSECURE_LAB === "true") {
    const fromBody = req.body?.userId;
    const fromHeader = req.headers["x-user-id"];
    const raw = typeof fromBody === "string" && fromBody.trim() ? fromBody : fromHeader;
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }

  return null;
}

/**
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isUserAdmin(userId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    return false;
  }

  return !!data;
}
