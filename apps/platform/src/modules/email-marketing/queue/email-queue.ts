import { Queue } from "bullmq";
import { QUEUE_NAME } from "../config/defaults";

let queue: Queue | null = null;

function getRedisConnection() {
  const url = process.env.REDIS_URL?.trim() || "redis://localhost:6379";
  try {
    const parsed = new URL(url);
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

export function getEmailQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

export async function enqueueEmailSend(sendId: string, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const q = getEmailQueue();

  await q.add(
    "send",
    { sendId },
    {
      jobId: `send-${sendId}`,
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

export async function removeEmailSendJob(sendId: string) {
  try {
    const q = getEmailQueue();
    const job = await q.getJob(`send-${sendId}`);
    if (job) await job.remove();
  } catch (err) {
    console.error(
      `[email-queue] remove job send-${sendId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export type TagActionJobData = {
  advertiserId: string;
  contactId: string;
  tagId: string;
  action: "APPLY_TAG" | "REMOVE_TAG";
  automationId: string;
  stepId: string;
  leadId: string;
};

export async function enqueueTagAction(
  data: TagActionJobData,
  scheduledAt: Date,
) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const q = getEmailQueue();

  await q.add(
    "tag-action",
    data,
    {
      jobId: `tag-${data.automationId}-${data.stepId}-${data.leadId}`,
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

export async function closeEmailQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
