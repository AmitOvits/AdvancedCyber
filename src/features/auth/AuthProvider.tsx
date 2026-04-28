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

/** SQLi lab: no real JWT — Supabase keeps firing session=null; without this we wipe the synthetic user (BOLA then “kicks you out”). */
const STORAGE_SQLI_BYPASS = "advancedcyber-sqli-bypass-active";
const STORAGE_SQLI_BYPASS_USER = "advancedcyber-sqli-bypass-user-json";

function asError(error: unknown) {
  return error instanceof Error ? error : new Error("Unexpected authentication error.");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutValue: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(timeoutValue);
      }
    }, timeoutMs);

    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(timeoutValue);
        }
      });
  });
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

      if (nextSession?.user) {
        try {
          sessionStorage.removeItem(STORAGE_SQLI_BYPASS);
          sessionStorage.removeItem(STORAGE_SQLI_BYPASS_USER);
        } catch {
          /* ignore */
        }

        const nextUser = nextSession.user;
        setSession(nextSession);
        setUser(nextUser);

        try {
          const admin = await withTimeout(checkAdminRole(nextUser.id), 4000, false);
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
        return;
      }

      try {
        if (sessionStorage.getItem(STORAGE_SQLI_BYPASS) === "1") {
          const raw = sessionStorage.getItem(STORAGE_SQLI_BYPASS_USER);
          if (raw) {
            const parsed = JSON.parse(raw) as { id: string; email: string; username: string };
            const bypassedUser = {
              id: parsed.id,
              email: parsed.email,
              user_metadata: { username: parsed.username },
              app_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            } as User;

            setSession(null);
            setUser(bypassedUser);

            try {
              const admin = await withTimeout(checkAdminRole(parsed.id), 4000, false);
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
            return;
          }
        }
      } catch {
        /* corrupt storage */
      }

      setSession(null);
      setUser(null);
      setIsAdmin(false);
      if (isMounted) {
        setLoading(false);
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
      const result = await signUpWithCredentials(email, username, password);
      return { error: null, role: result.user?.role };
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
    try {
      sessionStorage.removeItem(STORAGE_SQLI_BYPASS);
      sessionStorage.removeItem(STORAGE_SQLI_BYPASS_USER);
    } catch {
      /* ignore */
    }
    await signOutCurrentUser();
  };

  const simulateBypass = async (fakeUser: any) => {
    try {
      sessionStorage.setItem(STORAGE_SQLI_BYPASS, "1");
      sessionStorage.setItem(
        STORAGE_SQLI_BYPASS_USER,
        JSON.stringify({
          id: fakeUser.id,
          email: fakeUser.email,
          username: fakeUser.username,
        }),
      );
    } catch {
      /* ignore */
    }

    const bypassedUser = {
      id: fakeUser.id,
      email: fakeUser.email,
      user_metadata: { username: fakeUser.username },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString()
    } as User;

    setSession(null);
    setUser(bypassedUser);
    
    // התוספת: אנחנו בודקים ב-DB האם למשתמש שפרצנו אליו יש תפקיד 'admin'
    try {
      const adminRole = await checkAdminRole(fakeUser.id);
      setIsAdmin(adminRole);
    } catch (err) {
      console.error("Failed to fetch roles for bypassed user", err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signUp, signIn, signOut, simulateBypass }}>
      {children}
    </AuthContext.Provider>
  );
}
