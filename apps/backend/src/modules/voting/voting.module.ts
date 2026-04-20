import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoundsModule } from "../rounds/rounds.module";
import { VotingService } from "./voting.service";

@Module({
  imports: [PersistenceModule, AuthSessionModule, RoundsModule],
  providers: [VotingService],
  exports: [VotingService]
})
export class VotingModule {}
