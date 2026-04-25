import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageSquareQuote, Star } from "lucide-react";
import { toast } from "sonner";
import { CartDrawer } from "@/components/CartDrawer";
import { Header } from "@/components/Header";
import { AddReviewForm } from "@/features/reviews/AddReviewForm";
import { createStoreReview, fetchStoreReviews, type CreateReviewInput } from "@/features/reviews/api";

const reviewDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
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
  const { data: reviews = [], isLoading, error } = useQuery({
    queryKey: ["store-reviews"],
    queryFn: fetchStoreReviews,
  });
  const submitReviewMutation = useMutation({
    mutationFn: (values: CreateReviewInput) => createStoreReview(values),
    onSuccess: async () => {
      toast.success("Review submitted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["store-reviews"] });
    },
    onError: (submitError) => {
      const message = submitError instanceof Error ? submitError.message : "Failed to submit review.";
      
      // בדיקה אם ההודעה מהשרת מכילה את טקסט הניצחון שלנו
      if (message.includes("successfully found")) {
        // מקפיץ Alert מובנה של הדפדפן
        window.alert("🏆 Great job! You successfully found the DoS vulnerability!");
        // מקפיץ גם Toast ירוק
        toast.success(message, { duration: 6000 });
      } else {
        // שגיאה רגילה תקבל Toast אדום
        toast.error(message);
      }
    },
  });
  const stats = useMemo(() => {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        featuredCount: 0,
      };
    }

    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    const featuredCount = reviews.filter((review) => review.isFeatured).length;

    return {
      averageRating,
      featuredCount,
    };
  }, [reviews]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 space-y-4">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              Store <span className="text-primary">Reviews</span>
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">
              See what shoppers are saying about the Sole experience, from delivery speed to the quality of the
              catalog.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Average rating</p>
              <p className="mt-2 text-3xl font-black text-foreground">{stats.averageRating.toFixed(1)}/5</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Total reviews</p>
              <p className="mt-2 text-3xl font-black text-foreground">{reviews.length}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground">Featured reviews</p>
              <p className="mt-2 text-3xl font-black text-foreground">{stats.featuredCount}</p>
            </div>
          </div>
        </motion.div>

        <AddReviewForm
          isSubmitting={submitReviewMutation.isPending}
          onSubmit={async (values) => {
            await submitReviewMutation.mutateAsync(values);
          }}
        />

        {error ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            Unable to load reviews from the database.
          </div>
        ) : isLoading ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No reviews available yet.</div>
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {review.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{review.authorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {reviewDateFormatter.format(new Date(review.createdAt))}
                        </p>
                      </div>
                    </div>
                    <Stars rating={review.rating} />
                  </div>

                  {review.isFeatured ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Featured
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">{review.title}</h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{review.body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
