import { Job, Queue, Worker } from "bullmq";
import { LeadErrorMessages } from "@errors/error-messages.js";
import { config } from "@/config.js";
import { createLeadLogger } from "@/logging/logger.js";
import { ApiError } from "@/utils/api-error.js";
import { queueBackpressureCounter } from "@/utils/metrics.js";
import { propagation, context } from "@opentelemetry/api";

type LeadIntelligenceProcessor = {
  processNormalizationJob: (job: Job) => Promise<void>;
  processAnalysisJob: (job: Job) => Promise<void>;
  processActionJob: (job: Job) => Promise<void>;
  processWebhookJob: (job: Job) => Promise<void>;
};

const queueLogger = createLeadLogger("queue");

const redisUrl = new URL(config.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

const BACKPRESSURE_STATES = [
  "waiting",
  "delayed",
  "prioritized",
  "active",
] as const;

export const normalizationQueue = new Queue("lead-normalization", {
  connection,
  prefix: config.LEAD_QUEUE_PREFIX,
  defaultJobOptions,
});

export const analysisQueue = new Queue("lead-analysis", {
  connection,
  prefix: config.LEAD_QUEUE_PREFIX,
  defaultJobOptions,
});

export const actionsQueue = new Queue("lead-actions", {
  connection,
  prefix: config.LEAD_QUEUE_PREFIX,
  defaultJobOptions,
});

export const notificationsQueue = new Queue("lead-notifications", {
  connection,
  prefix: config.LEAD_QUEUE_PREFIX,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 10, // Industry standard: more retries for webhooks
  },
});

export const assertQueueCapacity = async (queue: Queue, queueName: string) => {
  const counts = await queue.getJobCounts(...BACKPRESSURE_STATES);
  const depth = BACKPRESSURE_STATES.reduce(
    (sum, state) => sum + (counts[state] || 0),
    0,
  );

  if (depth < config.LEAD_QUEUE_BACKPRESSURE_THRESHOLD) {
    return;
  }

  queueBackpressureCounter.inc({ queue_name: queueName });
  queueLogger.warn(
    {
      queueName,
      depth,
      threshold: config.LEAD_QUEUE_BACKPRESSURE_THRESHOLD,
      counts,
    },
    "Queue backpressure threshold reached",
  );

  throw new ApiError(
    "QUEUE_BACKPRESSURE",
    LeadErrorMessages.billing.queueBackpressure,
    [],
    {
      queueName,
      depth,
      threshold: config.LEAD_QUEUE_BACKPRESSURE_THRESHOLD,
    },
  );
};

let workers: Worker[] = [];

const wireWorkerLogging = (worker: Worker, workerName: string) => {
  worker.on("completed", (job) => {
    queueLogger.info(
      { workerName, jobId: job.id, jobName: job.name },
      "Lead queue job completed",
    );
  });

  worker.on("failed", (job, error) => {
    queueLogger.error(
      {
        workerName,
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
        error: error.message,
      },
      "Lead queue job failed",
    );
  });
};

export const startLeadIntelligenceWorkers = async (
  processor: LeadIntelligenceProcessor,
) => {
  if (workers.length > 0) {
    return;
  }

  queueLogger.info("Starting Lead Intelligence Workers...");

  workers = [
    new Worker(
      "lead-normalization",
      (job) => {
        const parentContext = propagation.extract(
          context.active(),
          (job.data as any).traceContext || {},
        );
        return context.with(parentContext, () =>
          processor.processNormalizationJob(job),
        );
      },
      {
        connection,
        prefix: config.LEAD_QUEUE_PREFIX,
        concurrency: 5,
      },
    ),
    new Worker(
      "lead-analysis",
      (job) => {
        const parentContext = propagation.extract(
          context.active(),
          (job.data as any).traceContext || {},
        );
        return context.with(parentContext, () =>
          processor.processAnalysisJob(job),
        );
      },
      {
        connection,
        prefix: config.LEAD_QUEUE_PREFIX,
        concurrency: 3,
      },
    ),
    new Worker(
      "lead-actions",
      (job) => {
        const parentContext = propagation.extract(
          context.active(),
          (job.data as any).traceContext || {},
        );
        return context.with(parentContext, () =>
          processor.processActionJob(job),
        );
      },
      {
        connection,
        prefix: config.LEAD_QUEUE_PREFIX,
        concurrency: 5,
      },
    ),
    new Worker(
      "lead-notifications",
      (job) => {
        const parentContext = propagation.extract(
          context.active(),
          (job.data as any).traceContext || {},
        );
        return context.with(parentContext, () =>
          processor.processWebhookJob(job),
        );
      },
      {
        connection,
        prefix: config.LEAD_QUEUE_PREFIX,
        concurrency: 5,
      },
    ),
  ];

  workers.forEach((worker, index) =>
    wireWorkerLogging(worker, `worker-${index + 1}`),
  );

  queueLogger.info(
    { count: workers.length },
    "Lead Intelligence Workers Started",
  );
};

export const stopLeadIntelligenceWorkers = async () => {
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
};
