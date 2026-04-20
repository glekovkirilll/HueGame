import { Module } from "@nestjs/common";

import { AuthSessionModule } from "../auth-session/auth-session.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { RoundsModule } from "../rounds/rounds.module";
import { HostService } from "./host.service";

@Module({
  imports: [PersistenceModule, RoundsModule, AuthSessionModule],
  providers: [HostService],
  exports: [HostService]
})
export class HostModule {}
