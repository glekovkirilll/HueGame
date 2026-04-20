import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { RecoveryService } from "./recovery.service";

@Injectable()
export class RoundDeadlineRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundDeadlineRunnerService.name);
  private readonly intervalMs = Number(process.env.ROUND_TICK_INTERVAL_MS ?? 1000);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly recoveryService: RecoveryService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runTick();
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runTick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const results = await this.recoveryService.advanceDueRounds();

      if (results.length > 0) {
        this.logger.log(`Advanced ${results.length} due room(s).`);
      }
    } catch (error) {
      this.logger.error("Automatic round tick failed.", error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
