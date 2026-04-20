import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";

import {
  PlayerConnectionState,
  PlayerLifecycleState,
  RoundState
} from "@huegame/contracts";
import {
  selectNextActivePlayer,
  type QueuePlayer
} from "@huegame/domain";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { RoundRepository } from "../persistence/repositories/round.repository";
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { RecoveryService } from "./services/recovery.service";
import { ProjectionBuilder } from "./services/projection-builder.service";

export type AdvanceRoundCommand = {
  roomCode: string;
  sessionToken: string;
};

@Injectable()
export class RoundsService {
  constructor(
    private readonly roundRepository: RoundRepository,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder,
    private readonly authSessionService: AuthSessionService,
    private readonly recoveryService: RecoveryService
  ) {}

  createRound(roundNumber: number) {
    return {
      number: roundNumber,
      state: RoundState.PREPARE_ROUND,
      stateEnteredAt: new Date()
    };
  }

  selectNextActivePlayerCandidate(
    players: Array<{
      id: string;
      joinOrder: number;
      connectionState: PlayerConnectionState;
      lifecycleState: PlayerLifecycleState;
      canParticipateNextRound: boolean;
    }>,
    lastActiveJoinOrder: number | null
  ) {
    const queue: QueuePlayer[] = players.map((player) => ({
      id: player.id,
      joinOrder: player.joinOrder,
      connectionState: player.connectionState,
      lifecycleState: player.lifecycleState,
      canParticipateNextRound: player.canParticipateNextRound
    }));

    return selectNextActivePlayer(queue, lastActiveJoinOrder);
  }

  async advanceRound(command: AdvanceRoundCommand) {
    const result = await this.roundRepository.advanceCurrentRound({
      roomCode: command.roomCode.toUpperCase(),
      hostSessionTokenHash: this.authSessionService.hashSessionToken(command.sessionToken)
    });

    if (result.kind === "room-not-found") {
      throw new NotFoundException("Room or current round not found.");
    }

    if (result.kind === "round-not-found") {
      throw new NotFoundException("Current round not found.");
    }

    if (result.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid host session token.");
    }

    if (result.kind === "transition-not-allowed") {
      throw new ConflictException(`Round transition is not allowed from state ${result.roundState}.`);
    }

    if (result.kind === "category-missing") {
      throw new ConflictException("No active categories are available for the next round.");
    }

    const room = await this.snapshotRepository.findRoomForSnapshot(command.roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundException("Room not found after round transition.");
    }

    return this.projectionBuilder.buildHostSnapshot(room);
  }

  async tickDueRounds() {
    return this.recoveryService.advanceDueRounds();
  }
}
