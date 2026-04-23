import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";

import {
  calculateAvailableChips,
  canConfirmBet,
  isParticipantConfirmed,
  normalizePlayerName,
  nextPlacementVersion,
  type ParticipantConfirmationState
} from "@huegame/domain";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { VotingRepository } from "../persistence/repositories/voting.repository";
import { ProjectionBuilder } from "../rounds/services/projection-builder.service";

export type PlaceChipCommand = {
  roomCode: string;
  playerName: string;
  sessionToken: string;
  x: number;
  y: number;
};

export type RemoveChipCommand = PlaceChipCommand;

export type PlayerBetCommand = {
  roomCode: string;
  playerName: string;
  sessionToken: string;
};

@Injectable()
export class VotingService {
  constructor(
    private readonly votingRepository: VotingRepository,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder,
    private readonly authSessionService: AuthSessionService
  ) {}

  updatePlacementVersion(currentPlacementVersion: number): number {
    return nextPlacementVersion(currentPlacementVersion);
  }

  calculateAvailableBank(reservedChips: number): number {
    return calculateAvailableChips(reservedChips);
  }

  canConfirm(state: ParticipantConfirmationState): boolean {
    return canConfirmBet(state);
  }

  isConfirmed(state: ParticipantConfirmationState): boolean {
    return isParticipantConfirmed(state);
  }

  async placeChip(command: PlaceChipCommand) {
    return this.mutateAndProject("placeChip", command);
  }

  async removeChip(command: RemoveChipCommand) {
    return this.mutateAndProject("removeChip", command);
  }

  async confirmBet(command: PlayerBetCommand) {
    return this.mutateAndProject("confirmBet", command);
  }

  async unconfirmBet(command: PlayerBetCommand) {
    return this.mutateAndProject("unconfirmBet", command);
  }

  private async mutateAndProject(
    action: "placeChip" | "removeChip" | "confirmBet" | "unconfirmBet",
    command: PlaceChipCommand | RemoveChipCommand | PlayerBetCommand
  ) {
    const actorInput = {
      roomCode: command.roomCode.toUpperCase(),
      normalizedName: normalizePlayerName(command.playerName),
      sessionTokenHash: this.authSessionService.hashSessionToken(command.sessionToken)
    };

    const result =
      action === "placeChip"
        ? await this.votingRepository.placeChip({
            ...actorInput,
            x: (command as PlaceChipCommand).x,
            y: (command as PlaceChipCommand).y
          })
        : action === "removeChip"
          ? await this.votingRepository.removeChip({
              ...actorInput,
              x: (command as RemoveChipCommand).x,
              y: (command as RemoveChipCommand).y
            })
          : action === "confirmBet"
            ? await this.votingRepository.confirmBet(actorInput)
            : await this.votingRepository.unconfirmBet(actorInput);

    if (result.kind === "room-not-found" || result.kind === "round-not-found") {
      throw new NotFoundException("Room or round not found.");
    }

    if (result.kind === "player-not-found" || result.kind === "participant-not-found") {
      throw new NotFoundException("Player is not participating in the current round.");
    }

    if (result.kind === "invalid-token") {
      throw new UnauthorizedException("Invalid player session token.");
    }

    if (result.kind === "player-disconnected") {
      throw new ConflictException("Disconnected player cannot mutate round state.");
    }

    if (result.kind === "round-not-open") {
      throw new ConflictException(`Voting is not open in state ${result.roundState}.`);
    }

    if (result.kind === "not-voter") {
      throw new ConflictException("Active player cannot perform voting actions.");
    }

    if (result.kind === "invalid-coordinate") {
      throw new BadRequestException("Invalid board coordinate.");
    }

    if (result.kind === "placement-exists") {
      throw new ConflictException("Placement already exists on that cell.");
    }

    if (result.kind === "placement-not-found") {
      throw new NotFoundException("Placement not found on that cell.");
    }

    if (result.kind === "no-available-chips") {
      throw new ConflictException("The round limit of five chips has been reached.");
    }

    if (result.kind === "confirm-rejected") {
      throw new ConflictException("At least one placement is required before confirmation.");
    }

    const room = await this.snapshotRepository.findRoomForSnapshot(command.roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundException("Room not found after voting mutation.");
    }

    const player = room.players.find((candidate) => candidate.nameNormalized === normalizePlayerName(command.playerName));

    if (!player) {
      throw new NotFoundException("Player not found after voting mutation.");
    }

    return this.projectionBuilder.buildPlayerSnapshot(room, player);
  }
}
