import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoundsModule } from "../rounds/rounds.module";
import { PlayersService } from "./players.service";

@Module({
  imports: [PersistenceModule, AuthSessionModule, RoundsModule],
  providers: [PlayersService],
  exports: [PlayersService]
})
export class PlayersModule {}
