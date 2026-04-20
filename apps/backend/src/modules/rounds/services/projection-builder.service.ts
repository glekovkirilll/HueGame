import { Injectable } from "@nestjs/common";

import {
  buildActivePlayerSnapshotFromRoom,
  buildHostSnapshotFromRoom,
  buildJoinedWaitingSnapshotFromRoom,
  buildPlayerSnapshotFromRoom
} from "@huegame/domain";

@Injectable()
export class ProjectionBuilder {
  buildHostSnapshot(room: Parameters<typeof buildHostSnapshotFromRoom>[0]) {
    return buildHostSnapshotFromRoom(room);
  }

  buildPlayerSnapshot(
    room: Parameters<typeof buildPlayerSnapshotFromRoom>[0],
    player: Parameters<typeof buildPlayerSnapshotFromRoom>[1]
  ) {
    return buildPlayerSnapshotFromRoom(room, player);
  }

  buildActivePlayerSnapshot(
    room: Parameters<typeof buildActivePlayerSnapshotFromRoom>[0],
    player: Parameters<typeof buildActivePlayerSnapshotFromRoom>[1]
  ) {
    return buildActivePlayerSnapshotFromRoom(room, player);
  }

  buildJoinedWaitingSnapshot(
    room: Parameters<typeof buildJoinedWaitingSnapshotFromRoom>[0],
    player: Parameters<typeof buildJoinedWaitingSnapshotFromRoom>[1]
  ) {
    return buildJoinedWaitingSnapshotFromRoom(room, player);
  }
}
