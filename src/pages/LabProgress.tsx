import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";
import { isTrainingModeEnabled } from "@/lib/trainingMode";
import {
  LAB_VULNERABILITY_CATALOG,
  LAB_VULNERABILITY_FOUND_EVENT,
  getFoundLabVulnerabilityIds,
} from "@/lib/labVulnerabilityProgress";
import { CheckCircle2, Lock, Crosshair } from "lucide-react";

export default function LabProgress() {
  const [foundIds, setFoundIds] = useState<string[]>(() => getFoundLabVulnerabilityIds());

  useEffect(() => {
    const sync = () => setFoundIds(getFoundLabVulnerabilityIds());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(LAB_VULNERABILITY_FOUND_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(LAB_VULNERABILITY_FOUND_EVENT, sync as EventListener);
    };
  }, []);

  const foundSet = useMemo(() => new Set(foundIds), [foundIds]);
  const total = LAB_VULNERABILITY_CATALOG.length;
  const foundCount = foundIds.length;
  const percent = total === 0 ? 0 : Math.round((foundCount / total) * 100);

  if (!isTrainingModeEnabled()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-10 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Crosshair className="h-6 w-6" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-widest">Training lab</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-foreground">Vulnerability progress</h1>
          <p className="text-muted-foreground max-w-xl">
            Findings unlock here as you trigger each intentional weakness. Undiscovered slots stay hidden so you can track how
            many are left without spoilers.
          </p>
        </div>

        <Card className="glass border-border/80">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg font-bold">Overall progress</CardTitle>
              <Badge variant={foundCount === total ? "default" : "secondary"} className="font-mono text-sm">
                {foundCount} / {total} found
              </Badge>
            </div>
            <CardDescription>
              {foundCount === total
                ? "You have surfaced every planted finding in this environment."
                : `${total - foundCount} finding${total - foundCount === 1 ? "" : "s"} still hidden.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={percent} className="h-2" />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Findings</h2>
          <ul className="space-y-3">
            {LAB_VULNERABILITY_CATALOG.map((entry, index) => {
              const unlocked = foundSet.has(entry.id);
              return (
                <li key={entry.id}>
                  <Card
                    className={`transition-colors border ${
                      unlocked ? "border-primary/40 bg-primary/5" : "border-border/60 opacity-90"
                    }`}
                  >
                    <CardContent className="py-4 px-4 flex gap-4">
                      <div className="shrink-0 mt-0.5">
                        {unlocked ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
                        ) : (
                          <Lock className="h-6 w-6 text-muted-foreground/50" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-mono text-muted-foreground">Finding {index + 1}</p>
                        {unlocked ? (
                          <p className="font-bold text-foreground leading-snug">{entry.title}</p>
                        ) : (
                          <p className="font-medium text-muted-foreground italic">Not yet discovered — keep testing.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
