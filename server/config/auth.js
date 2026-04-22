import crypto from "crypto";

export function getJwtSecret() {
  return process.env.JWT_SECRET ?? crypto.randomUUID();
}

export function getDemoLoginCredentials() {
  return {
    email: process.env.DEMO_LOGIN_EMAIL ?? "student@example.edu",
    password: process.env.DEMO_LOGIN_PASSWORD ?? "password123",
  };
}
