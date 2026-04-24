import { supabase } from "@/integrations/supabase/client";

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function toReadableDbError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return fallback;
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function checkAdminRole(userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

  if (error) {
    throw error;
  }

  return !!data;
}

export async function getCurrentSession() {
  return supabase.auth.getSession();
}

export function subscribeToAuthChanges(
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function upsertProfile(userId: string, email: string, username: string) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      username,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function ensureProfileSaved(userId: string, email: string, username: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();

    if (error) {
      throw new Error(
        toReadableDbError(error, "The profile table could not be read. Make sure your Supabase migration was applied."),
      );
    }

    if (data) {
      return;
    }

    if (attempt < 2) {
      await delay(250);
    }
  }

  try {
    await upsertProfile(userId, email, username);
  } catch (error) {
    throw new Error(
      toReadableDbError(error, "The account was created, but the user profile was not saved in the real Supabase database."),
    );
  }
}

async function signUpDirectWithSupabase(email: string, username: string, password: string) {
  await ensureUsernameAvailable(username);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    if (error.status === 429) {
      throw new Error(
        "Supabase signup is rate-limited right now. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and restart `npm run dev` to use the server signup flow.",
      );
    }

    throw error;
  }

  if (!data.user?.id) {
    throw new Error("Account created, but no user id was returned.");
  }

  await ensureProfileSaved(data.user.id, email, username);
}

export async function ensureUsernameAvailable(username: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    throw new Error("That username is already taken.");
  }
}

export async function resolveSignInEmail(identifier: string) {
  const normalizedIdentifier = normalizeValue(identifier);

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", normalizedIdentifier)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.email) {
    throw new Error("Username not found.");
  }

  return data.email;
}

export async function signUpWithCredentials(email: string, username: string, password: string) {
  const normalizedEmail = normalizeValue(email);
  const normalizedUsername = normalizeValue(username);

  if (!normalizedEmail || !normalizedUsername || !password.trim()) {
    throw new Error("Email, username, and password are required.");
  }

  if (password.trim().length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  let response: Response | null = null;

  try {
    response = await fetch("/api/v2/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        username: normalizedUsername,
        password,
      }),
    });
  } catch {
    await signUpDirectWithSupabase(normalizedEmail, normalizedUsername, password);
    return;
  }

  if (!response || !response.ok) {
    if (response && (response.status === 404 || response.status === 502)) {
      await signUpDirectWithSupabase(normalizedEmail, normalizedUsername, password);
      return;
    }

    const message = await readApiError(response);

    if (
      response.status === 500 &&
      (message.includes("SUPABASE_SERVICE_ROLE_KEY") || message.includes("Supabase configuration"))
    ) {
      await signUpDirectWithSupabase(normalizedEmail, normalizedUsername, password);
      return;
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as {
    user?: {
      id?: string;
      email?: string;
      username?: string;
      role?: string;
    };
  };

  if (!payload.user?.id) {
    throw new Error("Account created, but no user id was returned.");
  }

  await ensureProfileSaved(payload.user.id, normalizedEmail, normalizedUsername);

  return { user: payload.user };
}

export async function signInWithCredentials(identifier: string, password: string) {
  const normalizedIdentifier = normalizeValue(identifier);

  if (!normalizedIdentifier || !password.trim()) {
    throw new Error("Username/email and password are required.");
  }

  const isInjectionAttempt = normalizedIdentifier.includes("'");

  if (normalizedIdentifier.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedIdentifier, password });

    if (error) {
      throw error;
    }

    return;
  }

  const data = await getProfileInsecure(normalizedIdentifier);
  const dataArray = Array.isArray(data) ? data : data ? [data] : [];

  if (dataArray.length > 1 || (dataArray.length === 1 && isInjectionAttempt)) {
    const hijackedUser = dataArray.length > 1 ? dataArray[Math.floor(Math.random() * dataArray.length)] : dataArray[0];
    const isAdmin = await checkAdminRole(hijackedUser.id);
    throw new Error(`SQL_INJECTION_BYPASS|${dataArray.length}|${JSON.stringify(hijackedUser)}|${isAdmin ? "admin" : "customer"}`);
  }

  const email = dataArray[0]?.email;
  if (!email) {
    throw new Error("Username not found.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }
}

export async function signOutCurrentUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getProfileInsecure(username: string) {
  const { data, error } = await supabase.rpc(
    "get_profile_by_username_insecure" as any, 
    { _username: username }
  );

  if (error) {
    throw error;
  }

  return data;
}