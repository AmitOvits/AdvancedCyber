import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "./context";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading, simulateBypass } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isLogin = pathname !== "/auth/sign-up";

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [navigate, user]);

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { error } = isLogin
      ? await signIn(username, password)
      : await signUp(email, username, password);

    setLoading(false);

    if (error) {
      if (error.message.startsWith("SQL_INJECTION_BYPASS")) {
        const [, leakedCount, targetUserData, role] = error.message.split("|");
        const targetUser = JSON.parse(targetUserData);
      
        if (role === 'admin') {
          // הודעה דרמטית עבור מנהל
          alert(`🚨 CRITICAL VULNERABILITY EXPLOITED! 🚨\n\nADMIN ACCESS GRANTED via SQL Injection.\nAccount: ${targetUser.username}\nLeaked Records: ${leakedCount}\n\nSystem control is now compromised.`);
          toast.error("⚠️ FULL SYSTEM BYPASS: ADMIN LOGGED IN", { duration: 10000 });
        } else {
          // הודעה סטנדרטית עבור לקוח
          alert(`🔍 SQL Injection Successful\n\nLogged in as regular customer: ${targetUser.username}\nLeaked Records: ${leakedCount}\n\nNote: Admin privileges were not obtained with this payload.`);
          toast.info(`Bypassed auth for customer: ${targetUser.username}`);
        }
      
        await simulateBypass(targetUser);
        navigate("/"); 
        return;
      }

      toast.error(error.message);
      return;
    }

    if (isLogin) {
      toast.success("Welcome back!");
      navigate("/");
      return;
    }

    toast.success("Account created and saved to the database. You can sign in now.");
    navigate("/auth/sign-in");
    setPassword("");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/">
            <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">
              Sole<span className="text-primary">.</span>
            </h1>
          </Link>
        </div>

        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              {isLogin ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Sign in to continue" : "Join SOLE. today"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder={isLogin ? "username or email" : "yourusername"}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                className="rounded-xl bg-accent border-border h-11"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="rounded-xl bg-accent border-border h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="rounded-xl bg-accent border-border h-11"
              />
            </div>

            <Button type="submit" className="w-full rounded-full font-semibold h-11" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => {
                resetForm();
                navigate(isLogin ? "/auth/sign-up" : "/auth/sign-in");
              }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
