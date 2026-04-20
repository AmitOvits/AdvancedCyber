import { isTrainingModeEnabled } from "@/lib/trainingMode";

export function TrainingModeBanner() {
  if (!isTrainingModeEnabled()) return null;

  return (
    <div className="w-full bg-destructive text-destructive-foreground">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 text-xs font-bold tracking-wider uppercase">
        TRAINING MODE ACTIVE: INSECURE ENVIRONMENT
      </div>
    </div>
  );
}

