import { z } from "zod";

// Match the existing account password length policy; never trim a password.
export const eventPasswordSchema = z.string().min(10).max(128);
