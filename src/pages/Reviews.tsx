import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageSquareQuote, Star, Terminal, ShieldAlert, Search, Database, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { CartDrawer } from "@/components/CartDrawer";
import { Header } from "@/components/Header";
import { AddReviewForm } from "@/features/reviews/AddReviewForm";
import { fetchStoreReviews, type CreateReviewInput } from "@/features/reviews/api";

const reviewDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric",
});

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-primary">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < Math.round(rating) ? "fill-current" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function Reviews() {
  const queryClient = useQueryClient();
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // --- מצבי סריקה (Real Probing States) ---
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredEndpoint, setDiscoveredEndpoint] = useState<string | null>(null);
  const [useLegacyApi, setUseLegacyApi] = useState(false);
  const [scanLogs, setScanLogs] = useState<{msg: string, type: 'info' | 'success' | 'error'}[]>([]);

  // גלילה אוטומטית של הלוגים לתחתית
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [scanLogs]);

  const startNetworkScan = async () => {
    setIsScanning(true);
    setDiscoveredEndpoint(null);
    setScanLogs([{ msg: "Initializing asset discovery protocol...", type: 'info' }]);
    
    // רשימת נתיבים חשודים לסריקה (Fuzzing list)
    const pathsToScan = [
      "/api/v3/reviews",
      "/api/admin/reviews",
      "/api/backup/reviews",
      "/api/v1/reviews", // הנתיב הפגיע שלנו
      "/api/debug/reviews"
    ];

    for (const path of pathsToScan) {
      setScanLogs(prev => [...prev, { msg: `PROBING: ${path}`, type: 'info' }]);
      
      // השהייה קצרה לדימוי סריקה ויזואלית
      await new Promise(r => setTimeout(r, 800));

      try {
        const response = await fetch(path, { method: 'GET' });
        
        if (response.ok) {
          setScanLogs(prev => [...prev, { msg: `MATCH FOUND: ${path} returned 200 OK`, type: 'success' }]);
          setDiscoveredEndpoint(path);
          setIsScanning(false);
          toast.success("Security Insight: Shadow API Discovered!");
          return; // עוצרים ברגע שמצאנו
        } else {
          setScanLogs(prev => [...prev, { msg: `NOT FOUND: ${path} returned ${response.status}`, type: 'error' }]);
        }
      } catch (err) {
        setScanLogs(prev => [...prev, { msg: `REFUSED: ${path} connection failed`, type: 'error' }]);
      }
    }

    setIsScanning(false);
    setScanLogs(prev => [...prev, { msg: "Scan finished. No new assets found.", type: 'info' }]);
  };

  const { data: reviews = [], isLoading, error } = useQuery({
    queryKey: ["store-reviews"],
    queryFn: fetchStoreReviews,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (values: CreateReviewInput) => {
      const targetUrl = discoveredEndpoint && useLegacyApi ? "/api/v1/reviews" : "/api/v2/reviews";
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Request failed with status ${response.status}`);
      return payload;
    },
    onSuccess: async () => {
      toast.success("Review submitted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["store-reviews"] });
    },
    onError: (submitError) => {
      const message = submitError instanceof Error ? submitError.message : "Failed to submit review.";
      if (message.includes("Victory") || message.includes("successfully found")) {
        window.alert(message);
        toast.success("DoS Attack Successful!", { duration: 6000 });
      } else {
        toast.error(message);
      }
    },
  });

  const stats = useMemo(() => {
    if (reviews.length === 0) return { averageRating: 0, featuredCount: 0 };
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    const featuredCount = reviews.filter((review) => review.isFeatured).length;
    return { averageRating, featuredCount };
  }, [reviews]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 space-y-4">
          <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
            Store <span className="text-primary">Reviews</span>
          </h1>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground italic">Average rating</p>
              <p className="mt-2 text-3xl font-black text-foreground">{stats.averageRating.toFixed(1)}/5</p>
            </div>
            <div className="glass rounded-2xl p-5 border-l-4 border-primary">
              <p className="text-sm text-muted-foreground">Total reviews</p>
              <p className="mt-2 text-3xl font-black text-foreground">{reviews.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground font-mono">System Integrity</p>
              <p className="mt-2 text-xl font-bold text-emerald-500 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Operational
              </p>
            </div>
          </div>
        </motion.div>

        {/* --- כלי סריקת רשת אמיתי (Recon Tool) --- */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.2em]">Asset Discovery Console</span>
            </div>
            <div className={`h-2 w-2 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
          </div>

          <div className="p-6">
            {/* קונסולת לוגים */}
            <div 
              ref={logContainerRef}
              className="h-32 mb-6 overflow-y-auto rounded bg-black/50 border border-slate-800 p-3 font-mono text-[10px] space-y-1"
            >
              {scanLogs.length === 0 ? (
                <p className="text-slate-600">Terminal ready. Awaiting scan command...</p>
              ) : (
                scanLogs.map((log, i) => (
                  <p key={i} className={`flex items-center gap-2 ${
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'error' ? 'text-rose-500' : 'text-slate-400'
                  }`}>
                    {log.type === 'success' ? <CheckCircle2 className="h-3 w-3" /> : 
                     log.type === 'error' ? <XCircle className="h-3 w-3" /> : '>'}
                    {log.msg}
                  </p>
                ))
              )}
            </div>

            {!discoveredEndpoint ? (
              <div className="flex flex-col items-center">
                <button
                  onClick={startNetworkScan}
                  disabled={isScanning}
                  className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-mono text-xs hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isScanning ? "SCANNING ENDPOINTS..." : "EXECUTE NETWORK SCAN"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4 rounded-xl bg-yellow-500/10 p-4 border border-yellow-500/20">
                  <Database className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-mono text-[10px] font-bold text-yellow-500 uppercase">Legacy API Discovered</p>
                    <p className="font-mono text-sm text-slate-300">{discoveredEndpoint}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                  <span className="text-xs font-semibold text-white">Inject Payload to Legacy V1?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={useLegacyApi}
                      onChange={(e) => setUseLegacyApi(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <AddReviewForm
          isSubmitting={submitReviewMutation.isPending}
          onSubmit={async (values) => {
            await submitReviewMutation.mutateAsync(values);
          }}
        />

        <hr className="my-10 border-slate-200" />

        {error ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Unable to load reviews.</div>
        ) : isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="glass animate-pulse rounded-2xl p-6 h-40 bg-slate-100" />)}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {reviews.map((review, index) => (
              <motion.article
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {review.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-foreground leading-none">{review.authorName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase mt-1">Verified Student</p>
                    </div>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-foreground">{review.title}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}