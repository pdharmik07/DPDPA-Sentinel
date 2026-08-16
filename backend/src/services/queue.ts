/**
 * Minimal in-process job queue.
 *
 * Analysis is CPU-bound and takes a few hundred milliseconds on a typical
 * policy, so a full broker (Redis/BullMQ) would be over-engineering for this
 * deployment. What is actually needed is: don't block the HTTP response, don't
 * run unbounded work concurrently, and let the client poll for status. That is
 * exactly what this provides.
 *
 * Trade-off, documented deliberately: jobs live in memory, so a process restart
 * loses in-flight work. Scans left in PROCESSING at boot are swept back to
 * FAILED by `recoverStuckScans` so nothing hangs in the UI forever.
 */

import { logger } from '../config/logger.js';

type Job = () => Promise<void>;

interface QueuedJob {
  id: string;
  run: Job;
}

export class JobQueue {
  private readonly pending: QueuedJob[] = [];
  private active = 0;

  constructor(private readonly concurrency: number) {}

  get size(): number {
    return this.pending.length;
  }

  get running(): number {
    return this.active;
  }

  enqueue(id: string, run: Job): void {
    this.pending.push({ id, run });
    queueMicrotask(() => this.drain());
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) break;

      this.active += 1;
      void job
        .run()
        .catch((error: unknown) => {
          // A job is responsible for recording its own failure state; reaching
          // here means even that failed, so log and keep the worker alive.
          logger.error({ jobId: job.id, err: error }, 'job threw outside its own error handling');
        })
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }

  /** Test helper: resolves once the queue has fully drained. */
  async idle(): Promise<void> {
    while (this.active > 0 || this.pending.length > 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}
