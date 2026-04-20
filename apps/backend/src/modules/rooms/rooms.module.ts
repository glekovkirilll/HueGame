import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoomCommandSerializer } from "./services/room-command-serializer.service";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [PersistenceModule, AuthSessionModule],
  providers: [RoomsService, RoomCommandSerializer],
  exports: [RoomsService, RoomCommandSerializer]
})
export class RoomsModule {}
