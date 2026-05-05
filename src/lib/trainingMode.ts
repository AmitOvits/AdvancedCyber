/**
 * Client training flag — must match .env `VITE_ALLOW_INSECURE_LAB=true` for lab UI + progress storage.
 * (Do not also require `import.meta.env.MODE === "development"`; preview and alternate Vite modes would break recording.)
 */
export function isTrainingModeEnabled() {
  return String(import.meta.env.VITE_ALLOW_INSECURE_LAB ?? "").toLowerCase() === "true";
}

