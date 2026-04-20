import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { ProjectionBuilder } from "../rounds/services/projection-builder.service";

export type HostReconnectCommand = {
  roomCode: string;
  sessionToken: string;
};

export type HostDisconnectCommand = HostReconnectCommand;

@Injectable()
export class HostService {
  constructor(
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder,
    private readonly authSessionService: AuthSessionService
  ) {}

  async reconnect(command: HostReconnectCommand) {
    const reconnect = await this.snapshotRepository.reconnectHost(
      command.roomCode.toUpperCase(),
      this.authSessionService.hashSessionToken(command.sessionToken)
    );

    if (reconnect.kind === "room-not-found") {
      throw new NotFoundException("Room or host session not found.");
    }

    if (reconnect.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid host session token.");
    }

    const room = await this.snapshotRepository.findRoomForSnapshot(command.roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundException("Room not found after host reconnect.");
    }

    return this.projectionBuilder.buildHostSnapshot(room);
  }

  async disconnect(command: HostDisconnectCommand) {
    const result = await this.snapshotRepository.disconnectHost(
      command.roomCode.toUpperCase(),
      this.authSessionService.hashSessionToken(command.sessionToken)
    );

    if (result.kind === "room-not-found") {
      throw new NotFoundException("Room or host session not found.");
    }

    if (result.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid host session token.");
    }

    return {
      roomCode: command.roomCode.toUpperCase(),
      disconnected: true
    };
  }
}
