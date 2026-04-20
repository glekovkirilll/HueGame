import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthSessionModule } from "./modules/auth-session/auth-session.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { GameModule } from "./modules/game/game.module";
import { HostModule } from "./modules/host/host.module";
import { I18nModule } from "./modules/i18n/i18n.module";
import { PaletteModule } from "./modules/palette/palette.module";
import { PersistenceModule } from "./modules/persistence/persistence.module";
import { PlayersModule } from "./modules/players/players.module";
import { RealtimeGatewayModule } from "./modules/realtime-gateway/realtime-gateway.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { RoundsModule } from "./modules/rounds/rounds.module";
import { VotingModule } from "./modules/voting/voting.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PersistenceModule,
    AuthSessionModule,
    RoomsModule,
    HostModule,
    PlayersModule,
    GameModule,
    RoundsModule,
    VotingModule,
    CategoriesModule,
    PaletteModule,
    RealtimeGatewayModule,
    I18nModule
  ]
})
export class AppModule {}
