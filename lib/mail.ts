import "server-only";
import nodemailer from "nodemailer";
import { getServerEnv } from "./env";

const env = getServerEnv();
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  connectionTimeout: 5000,
  socketTimeout: 10000,
});

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  try {
    const result = await transport.sendMail({
      from: env.SMTP_FROM,
      ...message,
    });

    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new Error("SMTP rejected the recipient");
    }
  } catch {
    // Do not expose SMTP details or message content through auth error logs.
    throw new Error("Email delivery failed. Please try again later.");
  }
}
