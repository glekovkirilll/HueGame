import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";

import {
  resolvePlayerRoundRole,
  sanitizeDisplayName,
  normalizePlayerName
} from "@huegame/domain";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { PlayerRepository } from "../persistence/repositories/player.repository";
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { ProjectionBuilder } from "../rounds/services/projection-builder.service";

export type JoinPlayerCommand = {
  roomCode: string;
  playerName: string;
  sessionToken?: string;
};

export type PlayerReconnectCommand = {
  roomCode: string;
  playerName: string;
  sessionToken: string;
};

export type PlayerDisconnectCommand = PlayerReconnectCommand;

@Injectable()
export class PlayersService {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder,
    private readonly authSessionService: AuthSessionService
  ) {}

  normalizeName(name: string): string {
    return normalizePlayerName(name);
  }

  async joinRoom(command: JoinPlayerCommand) {
    const playerName = sanitizeDisplayName(command.playerName);

    if (playerName.length < 2 || playerName.length > 64) {
      throw new BadRequestException("Player name must be between 2 and 64 characters.");
    }

    const sessionToken = command.sessionToken ?? this.authSessionService.issueSessionToken();
    const result = await this.playerRepository.joinPlayer({
      roomCode: command.roomCode.toUpperCase(),
      displayName: playerName,
      normalizedName: this.normalizeName(playerName),
      sessionTokenHash: this.authSessionService.hashSessionToken(sessionToken)
    });

    if (result.kind === "room-not-found") {
      throw new NotFoundException("Room not found.");
    }

    if (result.kind === "room-not-joinable") {
      throw new ConflictException(`Room is not joinable in status ${result.roomStatus}.`);
    }

    if (result.kind === "name-conflict") {
      throw new ConflictException("Player name is already occupied.");
    }

    return {
      mode: result.kind,
      roomCode: result.room.code,
      roomStatus: result.room.status,
      playerId: result.player.id,
      playerName: result.player.name,
      joinOrder: result.player.joinOrder,
      chips: result.player.chips,
      canParticipateNextRound: result.player.canParticipateNextRound,
      sessionToken
    };
  }

  async reconnect(command: PlayerReconnectCommand) {
    const normalizedName = this.normalizeName(command.playerName);
    const reconnect = await this.snapshotRepository.reconnectPlayer(
      command.roomCode.toUpperCase(),
      normalizedName,
      this.authSessionService.hashSessionToken(command.sessionToken)
    );

    if (reconnect.kind === "room-not-found") {
      throw new NotFoundException("Room not found.");
    }

    if (reconnect.kind === "player-not-found") {
      throw new NotFoundException("Player not found.");
    }

    if (reconnect.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid player session token.");
    }

    const room = await this.snapshotRepository.findRoomForSnapshot(command.roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundException("Room not found after player reconnect.");
    }

    const player = room.players.find((item) => item.id === reconnect.playerId);

    if (!player) {
      throw new NotFoundException("Player not found after reconnect.");
    }

    const role = resolvePlayerRoundRole(room, player);

    if (role === "active-player") {
      return this.projectionBuilder.buildActivePlayerSnapshot(room, player);
    }

    if (role === "joined-waiting") {
      return this.projectionBuilder.buildJoinedWaitingSnapshot(room, player);
    }

    return this.projectionBuilder.buildPlayerSnapshot(room, player);
  }

  async disconnect(command: PlayerDisconnectCommand) {
    const result = await this.snapshotRepository.disconnectPlayer(
      command.roomCode.toUpperCase(),
      this.normalizeName(command.playerName),
      this.authSessionService.hashSessionToken(command.sessionToken)
    );

    if (result.kind === "room-not-found") {
      throw new NotFoundException("Room not found.");
    }

    if (result.kind === "player-not-found") {
      throw new NotFoundException("Player not found.");
    }

    if (result.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid player session token.");
    }

    return {
      roomCode: command.roomCode.toUpperCase(),
      disconnected: true
    };
  }
}
