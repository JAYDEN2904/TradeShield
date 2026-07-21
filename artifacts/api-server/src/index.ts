import http from "node:http";
import { createApp } from "./app";
import { createSessionMiddleware } from "./lib/session";
import { attachNotificationWebSocket } from "./lib/notificationWs";
import { logger } from "./lib/logger";
import { startAutoReleaseJob } from "./lib/autoRelease";
import { startPaymentReconciliationJob } from "./lib/paymentReconciliation";
import { startPendingExpiryJob } from "./lib/pendingExpiry";
import { startAutoReleaseReminderJob } from "./lib/autoReleaseReminder";
import { purgeExpiredNotifications } from "./lib/notifications";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const sessionMiddleware = createSessionMiddleware();
const app = createApp(sessionMiddleware);
const server = http.createServer(app);
attachNotificationWebSocket(server, sessionMiddleware);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startAutoReleaseJob();
  startPaymentReconciliationJob();
  startPendingExpiryJob();
  startAutoReleaseReminderJob();
  // Best-effort retention cleanup on boot + daily
  void purgeExpiredNotifications();
  setInterval(
    () => {
      void purgeExpiredNotifications();
    },
    24 * 60 * 60 * 1000,
  );
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
