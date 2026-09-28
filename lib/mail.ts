import "server-only";
import { createConnection, type Socket } from "node:net";
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

export async function sendMail(
  message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  },
  deliveryTimeoutMs?: number,
) {
  let deliverySocket: Socket | undefined;
  let expired = false;
  // A bounded outbox delivery owns its connection so its deadline can close
  // that socket without interrupting another email or auth verification.
  const deliveryTransport =
    deliveryTimeoutMs === undefined
      ? transport
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: false,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
          getSocket(_options, callback) {
            if (expired) {
              callback(new Error("Email delivery timed out"));

              return;
            }

            const socket = createConnection({
              host: env.SMTP_HOST,
              port: env.SMTP_PORT,
            });
            deliverySocket = socket;
            const onError = (error: Error) => callback(error);
            const connectionTimer = setTimeout(
              () => socket.destroy(new Error("SMTP connection timed out")),
              5000,
            );
            socket.once("error", onError);
            socket.once("close", () => clearTimeout(connectionTimer));
            socket.once("connect", () => {
              clearTimeout(connectionTimer);
              socket.removeListener("error", onError);
              callback(null, { connection: socket });
            });
          },
        });
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const delivery = deliveryTransport.sendMail({
      from: env.SMTP_FROM,
      ...message,
    });
    const result =
      deliveryTimeoutMs === undefined
        ? await delivery
        : await Promise.race([
            delivery,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                expired = true;
                deliverySocket?.destroy();
                reject(new Error("Email delivery timed out"));
              }, deliveryTimeoutMs);
            }),
          ]);

    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new Error("SMTP rejected the recipient");
    }
  } catch {
    // Do not expose SMTP details or message content through auth error logs.
    throw new Error("Email delivery failed. Please try again later.");
  } finally {
    clearTimeout(timer);

    if (deliveryTimeoutMs !== undefined) {
      deliverySocket?.destroy();
      deliveryTransport.close();
    }
  }
}
