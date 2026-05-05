import { FTP_LAB_FILES } from "@/data/ftpLabFiles";

/**
 * SPA mirror of the `/ftp/` directory listing (same filenames as serve-index).
 * Raw HTML listing for scanners stays at http://localhost:3001/ftp/ (proxied from :8080/ftp/).
 */
export default function FtpLab() {
  return (
    <main className="container max-w-2xl py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">FTP (lab)</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Same dummy filenames as the backend <code className="rounded bg-muted px-1 py-0.5">/ftp/</code>{" "}
        directory (OWASP Juice Shop style). Open the real listing for{" "}
        <code className="rounded bg-muted px-1 py-0.5">dirb</code> / automation:{" "}
        <a className="text-primary underline" href="/ftp/">
          /ftp/
        </a>
      </p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-sm">
        {FTP_LAB_FILES.map((name) => (
          <li key={name}>
            <a
              className="text-primary hover:underline"
              href={`/ftp/${encodeURI(name)}`}
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-semibold text-foreground">Hint (training):</p>
        <p className="mt-1 text-muted-foreground">
          Look for clues in the FTP files. One of them hints that using
          <code className="rounded bg-muted px-1 py-0.5">../</code> can expose hidden dotfiles like
          <code className="rounded bg-muted px-1 py-0.5">.env</code>.
        </p>
      </div>
    </main>
  );
}
