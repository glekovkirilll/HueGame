import { Module } from "@nestjs/common";

import { GameRepository } from "./repositories/game.repository";
import { PlayerRepository } from "./repositories/player.repository";
import { RoundRepository } from "./repositories/round.repository";
import { RoomRepository } from "./repositories/room.repository";
import { SnapshotRepository } from "./repositories/snapshot.repository";
import { VotingRepository } from "./repositories/voting.repository";
import { PersistenceService } from "./persistence.service";

@Module({
  providers: [PersistenceService, RoomRepository, PlayerRepository, SnapshotRepository, GameRepository, RoundRepository, VotingRepository],
  exports: [PersistenceService, RoomRepository, PlayerRepository, SnapshotRepository, GameRepository, RoundRepository, VotingRepository]
})
export class PersistenceModule {}
