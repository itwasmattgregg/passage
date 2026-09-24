import { randomBytes } from "node:crypto";

export function createSlug() {
  return randomBytes(6).toString("base64url");
}
