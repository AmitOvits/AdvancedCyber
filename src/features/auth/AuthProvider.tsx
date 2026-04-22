import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  checkAdminRole,
  getCurrentSession,
  signInWithCredentials,
  signOutCurrentUser,
  signUpWithCredentials,
  subscribeToAuthChanges,
} from "./api";
import { AuthContext } from "./context";

function asError(error: unknown) {
  return error instanceof Error ? error : new Error("Unexpected authentication error.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const admin = await checkAdminRole(nextUser.id);

        if (isMounted) {
          setIsAdmin(admin);
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = subscribeToAuthChanges(async (_event, nextSession) => {
      await syncSession(nextSession);
    });

    void getCurrentSession().then(({ data: { session: nextSession } }) => syncSession(nextSession));

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, username: string, password: string) => {
    try {
      await signUpWithCredentials(email, username, password);
      return { error: null };
    } catch (error) {
      return { error: asError(error) };
    }
  };

  const signIn = async (identifier: string, password: string) => {
    try {
      await signInWithCredentials(identifier, password);
      return { error: null };
    } catch (error) {
      return { error: asError(error) };
    }
  };

  const signOut = async () => {
    await signOutCurrentUser();
  };

  const simulateBypass = async (fakeUser: any) => {
    const bypassedUser = {
      id: fakeUser.id,
      email: fakeUser.email,
      user_metadata: { username: fakeUser.username },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString()
    } as User;

    setUser(bypassedUser);
    
    // התוספת: אנחנו בודקים ב-DB האם למשתמש שפרצנו אליו יש תפקיד 'admin'
    try {
      const adminRole = await checkAdminRole(fakeUser.id);
      setIsAdmin(adminRole);
    } catch (err) {
      console.error("Failed to fetch roles for bypassed user", err);
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut, simulateBypass }}>
      {children}
    </AuthContext.Provider>
  );
}
