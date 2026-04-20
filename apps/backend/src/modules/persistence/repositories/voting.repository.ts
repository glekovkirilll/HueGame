import { Injectable } from "@nestjs/common";

import {
  PlacementStatus,
  PlayerConnectionState,
  QuorumStatus,
  RoundRole,
  RoundState,
  type Prisma
} from "@huegame/database";
import {
  calculateAvailableChips,
  canConfirmBet,
  isValidCellCoordinate,
  nextPlacementVersion
} from "@huegame/domain";

import { PersistenceService } from "../persistence.service";

type VotingActorInput = {
  roomCode: string;
  normalizedName: string;
  sessionTokenHash: string;
};

type PlacementInput = VotingActorInput & {
  x: number;
  y: number;
};

@Injectable()
export class VotingRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async placeChip(input: PlacementInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const context = await this.loadVotingContext(tx, input);

      if (context.kind !== "ok") {
        return context;
      }

      if (!isValidCellCoordinate(input.x, input.y)) {
        return { kind: "invalid-coordinate" as const };
      }

      const existingPlacement = await tx.placement.findUnique({
        where: {
          roundId_playerId_x_y: {
            roundId: context.round.id,
            playerId: context.player.id,
            x: input.x,
            y: input.y
          }
        }
      });

      if (existingPlacement) {
        return { kind: "placement-exists" as const };
      }

      const reservedChips = await tx.placement.count({
        where: {
          roundId: context.round.id,
          playerId: context.player.id,
          status: PlacementStatus.DRAFT
        }
      });

      if (calculateAvailableChips(context.player.chips, reservedChips) <= 0) {
        return { kind: "no-available-chips" as const };
      }

      await tx.placement.create({
        data: {
          roundId: context.round.id,
          playerId: context.player.id,
          x: input.x,
          y: input.y,
          status: PlacementStatus.DRAFT
        }
      });

      const placementVersion = nextPlacementVersion(context.participant.placementVersion);
      await tx.roundParticipant.update({
        where: {
          roundId_playerId: {
            roundId: context.round.id,
            playerId: context.player.id
          }
        },
        data: {
          placementVersion,
          confirmedAt: null
        }
      });

      await this.syncVotingProgress(tx, context.round.id, context.room.settings?.allConfirmedWindowMs ?? 10_000);

      return { kind: "placed" as const };
    });
  }

  async removeChip(input: PlacementInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const context = await this.loadVotingContext(tx, input);

      if (context.kind !== "ok") {
        return context;
      }

      const existingPlacement = await tx.placement.findUnique({
        where: {
          roundId_playerId_x_y: {
            roundId: context.round.id,
            playerId: context.player.id,
            x: input.x,
            y: input.y
          }
        }
      });

      if (!existingPlacement) {
        return { kind: "placement-not-found" as const };
      }

      await tx.placement.delete({
        where: {
          id: existingPlacement.id
        }
      });

      const placementVersion = nextPlacementVersion(context.participant.placementVersion);
      await tx.roundParticipant.update({
        where: {
          roundId_playerId: {
            roundId: context.round.id,
            playerId: context.player.id
          }
        },
        data: {
          placementVersion,
          confirmedAt: null
        }
      });

      await this.syncVotingProgress(tx, context.round.id, context.room.settings?.allConfirmedWindowMs ?? 10_000);

      return { kind: "removed" as const };
    });
  }

  async confirmBet(input: VotingActorInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const context = await this.loadVotingContext(tx, input);

      if (context.kind !== "ok") {
        return context;
      }

      const reservedChips = await tx.placement.count({
        where: {
          roundId: context.round.id,
          playerId: context.player.id,
          status: PlacementStatus.DRAFT
        }
      });

      if (!canConfirmBet({
        reservedChips,
        placementVersion: context.participant.placementVersion,
        confirmVersion: context.participant.confirmVersion
      })) {
        return { kind: "confirm-rejected" as const };
      }

      await tx.roundParticipant.update({
        where: {
          roundId_playerId: {
            roundId: context.round.id,
            playerId: context.player.id
          }
        },
        data: {
          confirmVersion: context.participant.placementVersion,
          confirmedAt: new Date()
        }
      });

      await this.syncVotingProgress(tx, context.round.id, context.room.settings?.allConfirmedWindowMs ?? 10_000);

      return { kind: "confirmed" as const };
    });
  }

  async unconfirmBet(input: VotingActorInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const context = await this.loadVotingContext(tx, input);

      if (context.kind !== "ok") {
        return context;
      }

      await tx.roundParticipant.update({
        where: {
          roundId_playerId: {
            roundId: context.round.id,
            playerId: context.player.id
          }
        },
        data: {
          confirmVersion: null,
          confirmedAt: null
        }
      });

      await this.syncVotingProgress(tx, context.round.id, context.room.settings?.allConfirmedWindowMs ?? 10_000);

      return { kind: "unconfirmed" as const };
    });
  }

  private async syncVotingProgress(
    tx: Prisma.TransactionClient,
    roundId: string,
    allConfirmedWindowMs: number
  ) {
    const participants = await tx.roundParticipant.findMany({
      where: {
        roundId
      }
    });

    for (const participant of participants) {
      if (participant.role !== RoundRole.VOTER) {
        await tx.roundParticipant.update({
          where: {
            roundId_playerId: {
              roundId: participant.roundId,
              playerId: participant.playerId
            }
          },
          data: {
            quorumStatus: QuorumStatus.NOT_REQUIRED
          }
        });
        continue;
      }

      const reservedChips = await tx.placement.count({
        where: {
          roundId,
          playerId: participant.playerId,
          status: PlacementStatus.DRAFT
        }
      });

      const satisfied = canConfirmBet({
        reservedChips,
        placementVersion: participant.placementVersion,
        confirmVersion: participant.confirmVersion
      }) && participant.confirmVersion === participant.placementVersion;

      await tx.roundParticipant.update({
        where: {
          roundId_playerId: {
            roundId: participant.roundId,
            playerId: participant.playerId
          }
        },
        data: {
          quorumStatus: satisfied ? QuorumStatus.SATISFIED : QuorumStatus.BLOCKING
        }
      });
    }

    const refreshedRound = await tx.round.findUnique({
      where: {
        id: roundId
      },
      include: {
        participants: true
      }
    });

    if (!refreshedRound || refreshedRound.allConfirmedAt) {
      return;
    }

    const allBlockingSatisfied = refreshedRound.participants
      .filter((participant) => participant.role === RoundRole.VOTER)
      .every((participant) => participant.quorumStatus === QuorumStatus.SATISFIED);

    if (!allBlockingSatisfied || refreshedRound.participants.filter((participant) => participant.role === RoundRole.VOTER).length === 0) {
      return;
    }

    const now = new Date();
    await tx.round.update({
      where: {
        id: roundId
      },
      data: {
        allConfirmedAt: now,
        phaseDeadlineAt: new Date(now.getTime() + allConfirmedWindowMs)
      }
    });
  }

  private async loadVotingContext(tx: Prisma.TransactionClient, input: VotingActorInput) {
    const room = await tx.room.findUnique({
      where: { code: input.roomCode },
      include: {
        settings: true,
        players: true,
        currentGame: {
          include: {
            rounds: {
              orderBy: {
                number: "desc"
              },
              take: 1
            }
          }
        }
      }
    });

    if (!room || !room.currentGame) {
      return { kind: "room-not-found" as const };
    }

    const player = room.players.find((candidate) => candidate.nameNormalized === input.normalizedName);

    if (!player) {
      return { kind: "player-not-found" as const };
    }

    if (player.sessionTokenHash !== input.sessionTokenHash) {
      return { kind: "invalid-token" as const };
    }

    if (player.connectionState !== PlayerConnectionState.CONNECTED) {
      return { kind: "player-disconnected" as const };
    }

    const round = room.currentGame.rounds[0];

    if (!round) {
      return { kind: "round-not-found" as const };
    }

    if (round.state !== RoundState.VOTING_OPEN) {
      return { kind: "round-not-open" as const, roundState: round.state };
    }

    const participant = await tx.roundParticipant.findUnique({
      where: {
        roundId_playerId: {
          roundId: round.id,
          playerId: player.id
        }
      }
    });

    if (!participant) {
      return { kind: "participant-not-found" as const };
    }

    if (participant.role !== RoundRole.VOTER) {
      return { kind: "not-voter" as const };
    }

    return {
      kind: "ok" as const,
      room,
      round,
      player,
      participant
    };
  }
}
