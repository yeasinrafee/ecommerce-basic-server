import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { env } from '../../config/env.js';

const connectionOptions = {
  host: env.redisHost,
  port: env.redisPort,
  password: env.redisPassword,
  maxRetriesPerRequest: null,
};

export const createQueue = (queueName: string) => {
  return new Queue(queueName, {
    connection: connectionOptions as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
};

export const createWorker = (
  queueName: string,
  processor: (job: Job) => Promise<any>,
  concurrency: number = 5
) => {
  const worker = new Worker(queueName, processor, {
    connection: connectionOptions as any,
    concurrency,
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`Worker error: ${err.message}`);
  });

  return worker;
};

export const createQueueEvents = (queueName: string) => {
  return new QueueEvents(queueName, { connection: connectionOptions as any });
};
