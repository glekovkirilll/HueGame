import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";

import { GameStatus, PlayerConnectionState, PlayerLifecycleState } from "@huegame/contracts";
import { selectNextActivePlayer, type QueuePlayer } from "@huegame/domain";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { GameRepository } from "../persistence/repositories/game.repository";
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { ProjectionBuilder } from "../rounds/services/projection-builder.service";

export type StartGameCommand = {
  roomCode: string;
  sessionToken: string;
};

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder,
    private readonly authSessionService: AuthSessionService
  ) {}

  buildInitialGame(roundsPlanned: number) {
    return {
      status: GameStatus.PENDING,
      roundsPlanned,
      currentRoundNumber: 0
    };
  }

  selectNextActive(joinOrders: number[], lastActiveJoinOrder: number | null) {
    const queue: QueuePlayer[] = joinOrders.map((joinOrder) => ({
      id: String(joinOrder),
      joinOrder,
      connectionState: PlayerConnectionState.CONNECTED,
      lifecycleState: PlayerLifecycleState.ACTIVE,
      canParticipateNextRound: true
    }));

    return selectNextActivePlayer(queue, lastActiveJoinOrder);
  }

  async startGame(command: StartGameCommand) {
    const result = await this.gameRepository.startGame({
      roomCode: command.roomCode.toUpperCase(),
      hostSessionTokenHash: this.authSessionService.hashSessionToken(command.sessionToken)
    });

    if (result.kind === "room-not-found") {
      throw new NotFoundException("Room not found.");
    }

    if (result.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid host session token.");
    }

    if (result.kind === "room-not-startable") {
      throw new ConflictException(`Room is not startable in status ${result.roomStatus}.`);
    }

    if (result.kind === "game-already-active") {
      throw new ConflictException("A game is already active in this room.");
    }

    if (result.kind === "not-enough-round-ready-players") {
      throw new ConflictException("At least two connected eligible players are required to start the game.");
    }

    if (result.kind === "category-missing") {
      throw new ConflictException("No active categories are available.");
    }

    const room = await this.snapshotRepository.findRoomForSnapshot(command.roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundException("Room not found after game start.");
    }

    return this.projectionBuilder.buildHostSnapshot(room);
  }
}
