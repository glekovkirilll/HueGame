import { Module } from "@nestjs/common";

import { GameModule } from "../game/game.module";
import { HostModule } from "../host/host.module";
import { PlayersModule } from "../players/players.module";
import { RoundsModule } from "../rounds/rounds.module";
import { RoomsModule } from "../rooms/rooms.module";
import { VotingModule } from "../voting/voting.module";
import { HueRealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [RoomsModule, PlayersModule, HostModule, GameModule, RoundsModule, VotingModule],
  providers: [HueRealtimeGateway]
})
export class RealtimeGatewayModule {}
