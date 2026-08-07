import { Worker } from "bullmq";
import { processEmailSend } from "@/modules/email-marketing/services/send.service";
import { QUEUE_NAME } from "@/modules/email-marketing/config/defaults";

const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";

function getRedisConnection() {
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    // Legacy tag-action jobs are ignored; tags apply on open/click via tracking.
    if (job.name === "tag-action") {
      return;
    }

    const { sendId } = job.data as { sendId: string };
    await processEmailSend(sendId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  if (job.name === "tag-action") return;
  console.log(`[email-worker] completed send ${job.data.sendId}`);
});

worker.on("failed", (job, err) => {
  if (job?.name === "tag-action") return;
  console.error(`[email-worker] failed send ${job?.data?.sendId}:`, err.message);
});

console.log(`[email-worker] listening on queue "${QUEUE_NAME}" (${redisUrl})`);

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
