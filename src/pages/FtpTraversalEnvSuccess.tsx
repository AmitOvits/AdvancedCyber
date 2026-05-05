import { useEffect } from "react";
import { Link } from "react-router-dom";
import { recordLabVulnerability } from "@/lib/labVulnerabilityProgress";

export default function FtpTraversalEnvSuccess() {
  useEffect(() => {
    recordLabVulnerability("PATH_TRAVERSAL_CONFIRMED");
    window.alert("Victory! Path traversal confirmed and added to Lab Progress.");
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Path Traversal Success</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You reached <code className="rounded bg-muted px-1 py-0.5">/ftp/.env</code> and exposed hidden sensitive
          configuration data.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">The finding was recorded in your lab progress.</p>
        <Link
          to="/"
          className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Return to shop
        </Link>
      </div>
    </main>
  );
}
