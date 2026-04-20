export function isTrainingModeEnabled() {
  const nodeEnv = process.env.NODE_ENV;
  const allow = process.env.ALLOW_INSECURE_LAB;
  return nodeEnv === "development" && allow === "true";
}

export function assertTrainingModeSafeToRun() {
  if (process.env.ALLOW_INSECURE_LAB === "true" && process.env.NODE_ENV !== "development") {
    throw new Error(
      "Refusing to start: ALLOW_INSECURE_LAB=true is only permitted when NODE_ENV=development."
    );
  }
}
