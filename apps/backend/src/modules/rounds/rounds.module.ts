import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoundDeadlineRunnerService } from "./services/round-deadline-runner.service";
import { ProjectionBuilder } from "./services/projection-builder.service";
import { RecoveryService } from "./services/recovery.service";
import { RoundsService } from "./rounds.service";

@Module({
  imports: [PersistenceModule, AuthSessionModule],
  providers: [RoundsService, ProjectionBuilder, RecoveryService, RoundDeadlineRunnerService],
  exports: [RoundsService, ProjectionBuilder, RecoveryService]
})
export class RoundsModule {}
