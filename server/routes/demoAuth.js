import express from "express";
import jwt from "jsonwebtoken";
import { getDemoLoginCredentials } from "../config/auth.js";
import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

function normalizeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function asErrorMessage(error, fallback) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export function createDemoAuthRouter(jwtSecret) {
  const router = express.Router();
  const demoCredentials = getDemoLoginCredentials();

  router.post("/auth/register", async (req, res) => {
    try {
      const email = normalizeValue(req.body?.email);
      const username = normalizeValue(req.body?.username);
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      // --- תחילת החולשה (CWE-284) ---
      // השרת בודק אם נשלח תפקיד בבקשה. אם לא, הוא ברירת מחדל ל-'customer'.
      // החולשה: אין בדיקה האם למשתמש הנוכחי מותר להגדיר לעצמו תפקיד!
      const requestedRole = req.body?.role || "customer";
      // --- סוף החולשה ---

      if (!email || !username || !password.trim()) {
        return res.status(400).json({ error: "Email, username, and password are required." });
      }

      if (password.trim().length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }

      const supabaseAdmin = getSupabaseAdminClient();

      const { data: existingUsername, error: usernameError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (usernameError) {
        return res.status(500).json({ error: asErrorMessage(usernameError, "Failed to validate username.") });
      }

      if (existingUsername) {
        return res.status(409).json({ error: "That username is already taken." });
      }

      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
        },
      });

      if (createUserError) {
        const message = createUserError.message.toLowerCase();
        const status = message.includes("already") || message.includes("exists") ? 409 : 400;
        return res.status(status).json({ error: createUserError.message });
      }

      const userId = createdUser.user?.id;

      if (!userId) {
        return res.status(500).json({ error: "User was created without an id." });
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          id: userId,
          email,
          username,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: asErrorMessage(profileError, "Failed to save the user profile.") });
      }

      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: userId,
          role: requestedRole, // <--- במקום "customer"
        },
        { onConflict: "user_id,role" },
      );

      if (roleError) {
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: asErrorMessage(roleError, "Failed to save the user role.") });
      }

      return res.status(201).json({
        user: {
          id: userId,
          email,
          username,
          role: requestedRole, // <--- במקום "customer"
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: asErrorMessage(
          error,
          "Signup server is missing its Supabase configuration. Add SUPABASE_SERVICE_ROLE_KEY and try again.",
        ),
      });
    }
  });

  router.post("/auth/login", (req, res) => {
    const { email, password } = req.body ?? {};
    const okEmail = email === demoCredentials.email;
    const okPass = password === demoCredentials.password;

    if (!okEmail || !okPass) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ sub: email, role: "student" }, jwtSecret, { expiresIn: "2h" });
    return res.json({ token });
  });

  return router;
}
