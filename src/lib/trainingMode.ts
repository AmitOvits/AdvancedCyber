export function isTrainingModeEnabled() {
  return import.meta.env.MODE === "development" && import.meta.env.VITE_ALLOW_INSECURE_LAB === "true";
}

