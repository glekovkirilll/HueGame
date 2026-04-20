import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoundsModule } from "../rounds/rounds.module";
import { GameService } from "./game.service";

@Module({
  imports: [PersistenceModule, AuthSessionModule, RoundsModule],
  providers: [GameService],
  exports: [GameService]
})
export class GameModule {}
