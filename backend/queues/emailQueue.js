const { Queue } = require('bullmq');
const QueueMQ = require('bullmq').Queue;
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null
});

const emailSequenceQueue = new Queue('EmailSequenceQueue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false
  }
});

module.exports = {
  emailSequenceQueue,
  connection
};
