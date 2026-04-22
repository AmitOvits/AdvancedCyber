import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, username: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (error) throw error;
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => checkAdmin(session.user.id), 0);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdmin(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const upsertProfile = async (userId: string, email: string, username: string) => {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email,
        username,
      },
      { onConflict: "id" },
    );

    if (error) throw error;
  };

  const signUp = async (email: string, username: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedEmail || !normalizedUsername || !password.trim()) {
      return { error: new Error("Email, username, and password are required.") };
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existingProfileError) {
      return { error: existingProfileError as Error };
    }

    if (existingProfile) {
      return { error: new Error("That username is already taken.") };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
      },
    });

    if (error) {
      return { error: error as Error | null };
    }

    if (data.user?.id) {
      try {
        await upsertProfile(data.user.id, normalizedEmail, normalizedUsername);
      } catch (profileError) {
        return { error: profileError as Error };
      }
    }

    return { error: null };
  };

  const signIn = async (identifier: string, password: string) => {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    if (!normalizedIdentifier || !password.trim()) {
      return { error: new Error("Username/email and password are required.") };
    }

    let email = normalizedIdentifier;

    if (!normalizedIdentifier.includes("@")) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", normalizedIdentifier)
        .maybeSingle();

      if (profileError) {
        return { error: profileError as Error };
      }

      if (!profile?.email) {
        return { error: new Error("Username not found.") };
      }

      email = profile.email;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
