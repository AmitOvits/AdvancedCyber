import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createReviewSchema, type CreateReviewInput } from "@/features/reviews/api";

interface AddReviewFormProps {
  onSubmit: (values: CreateReviewInput) => Promise<void>;
  isSubmitting?: boolean;
}

const defaultValues: CreateReviewInput = {
  authorName: "",
  rating: 5,
  title: "",
  body: "",
  isFeatured: false,
};

export function AddReviewForm({ onSubmit, isSubmitting = false }: AddReviewFormProps) {
  const form = useForm<CreateReviewInput>({
    resolver: zodResolver(createReviewSchema),
    defaultValues,
  });

  async function handleSubmit(values: CreateReviewInput) {
    await onSubmit(values);
    form.reset(defaultValues);
  }

  return (
    <div className="glass rounded-2xl p-6 mb-8">
      <h2 className="text-2xl font-black text-foreground">Submit a Review</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Add a new review to the `store_reviews` table.
      </p>

      <Form {...form}>
        <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              control={form.control}
              name="authorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Author Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating (1 - 5)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Great shoes and fast delivery" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body</FormLabel>
                <FormControl>
                  <Textarea rows={5} maxLength={1000} placeholder="Tell us about your experience..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Is Featured</FormLabel>
                  <FormDescription>Optional schema field (`is_featured`).</FormDescription>
                </div>
              </FormItem>
            )}
          />

          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
