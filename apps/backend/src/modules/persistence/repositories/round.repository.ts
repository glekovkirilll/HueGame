import { Injectable } from "@nestjs/common";

import {
  GameStatus,
  PlacementStatus,
  PlayerLifecycleState,
  QuorumStatus,
  RoundRole,
  RoundState,
  RoomStatus,
  SkippedReason,
  type Prisma
} from "@huegame/database";
import {
  buildRoundSummary,
  pickTargetCell,
  selectNextActivePlayer
} from "@huegame/domain";

import { PersistenceService } from "../persistence.service";

type AdvanceRoundInput = {
  roomCode: string;
  hostSessionTokenHash: string;
};

@Injectable()
export class RoundRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async advanceCurrentRound(input: AdvanceRoundInput) {
    return this.advanceRoundInternal(input.roomCode, input.hostSessionTokenHash);
  }

  async listDueRoomCodes(now: Date) {
    const rounds = await this.persistence.prisma.round.findMany({
      where: {
        OR: [
          {
            phaseDeadlineAt: {
              lte: now
            }
          },
          {
            hardVotingDeadlineAt: {
              lte: now
            }
          }
        ]
      },
      select: {
        number: true,
        game: {
          select: {
            currentRoundNumber: true,
            room: {
              select: {
                code: true
              }
            }
          }
        }
      }
    });

    return [...new Set(
      rounds
        .filter((round) => round.number === round.game.currentRoundNumber)
        .map((round) => round.game.room.code)
    )];
  }

  async advanceDueRound(roomCode: string) {
    return this.advanceRoundInternal(roomCode, null);
  }

  private async advanceRoundInternal(roomCode: string, hostSessionTokenHash: string | null) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: roomCode },
        include: {
          settings: true,
          hostSession: true,
          players: {
            orderBy: {
              joinOrder: "asc"
            }
          },
          currentGame: {
            include: {
              paletteSnapshot: true,
              rounds: {
                orderBy: {
                  number: "desc"
                },
                take: 1,
                include: {
                  category: true,
                  activePlayer: true,
                  participants: true,
                  placements: true
                }
              }
            }
          }
        }
      });

      if (!room || !room.hostSession || !room.settings || !room.currentGame) {
        return { kind: "room-not-found" as const };
      }

      if (hostSessionTokenHash !== null && room.hostSession.sessionTokenHash !== hostSessionTokenHash) {
        return { kind: "invalid-token" as const };
      }

      const currentRound = room.currentGame.rounds[0];

      if (!currentRound) {
        return { kind: "round-not-found" as const };
      }

      const now = new Date();
      const isDueTransition =
        (currentRound.phaseDeadlineAt !== null && currentRound.phaseDeadlineAt <= now) ||
        (currentRound.hardVotingDeadlineAt !== null && currentRound.hardVotingDeadlineAt <= now);

      if (hostSessionTokenHash === null && !isDueTransition) {
        return { kind: "not-due" as const };
      }

      switch (currentRound.state) {
        case RoundState.PREPARE_ROUND: {
          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.CLUE_VISIBLE,
              stateEnteredAt: now,
              phaseDeadlineAt: now
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.CLUE_VISIBLE };
        }

        case RoundState.CLUE_VISIBLE: {
          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.VOTING_OPEN,
              stateEnteredAt: now,
              allConfirmedAt: null,
              phaseDeadlineAt: null,
              hardVotingDeadlineAt: room.settings.hardVotingDeadlineMs
                ? new Date(now.getTime() + room.settings.hardVotingDeadlineMs)
                : null
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.VOTING_OPEN };
        }

        case RoundState.VOTING_OPEN: {
          await tx.placement.updateMany({
            where: {
              roundId: currentRound.id,
              status: PlacementStatus.DRAFT
            },
            data: {
              status: PlacementStatus.LOCKED,
              resolvedAt: now
            }
          });

          for (const participant of currentRound.participants) {
            if (participant.role === RoundRole.ACTIVE_PLAYER) {
              await tx.roundParticipant.update({
                where: {
                  roundId_playerId: {
                    roundId: participant.roundId,
                    playerId: participant.playerId
                  }
                },
                data: {
                  quorumStatus: QuorumStatus.NOT_REQUIRED,
                  skippedReason: SkippedReason.ACTIVE_PLAYER
                }
              });
              continue;
            }

            const lockedCount = await tx.placement.count({
              where: {
                roundId: currentRound.id,
                playerId: participant.playerId,
                status: PlacementStatus.LOCKED
              }
            });

            await tx.roundParticipant.update({
              where: {
                roundId_playerId: {
                  roundId: participant.roundId,
                  playerId: participant.playerId
                }
              },
              data: {
                quorumStatus: lockedCount > 0 && participant.confirmVersion === participant.placementVersion
                  ? QuorumStatus.SATISFIED
                  : QuorumStatus.BLOCKING,
                skippedReason: lockedCount === 0 ? SkippedReason.NO_PLACEMENTS_AT_CLOSE : null
              }
            });
          }

          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.ALL_CONFIRMED_PENDING_FINALIZE,
              stateEnteredAt: now,
              votingClosedAt: now,
              phaseDeadlineAt: now
            }
          });

          return {
            kind: "advanced" as const,
            nextState: RoundState.ALL_CONFIRMED_PENDING_FINALIZE
          };
        }

        case RoundState.ALL_CONFIRMED_PENDING_FINALIZE: {
          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.REVEAL_VOTES,
              stateEnteredAt: now,
              phaseDeadlineAt: new Date(now.getTime() + room.settings.revealVotesMs)
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.REVEAL_VOTES };
        }

        case RoundState.REVEAL_VOTES: {
          for (const placement of currentRound.placements.filter((item) => item.status === PlacementStatus.LOCKED)) {
            const resolved = this.classifyPlacement(
              { x: placement.x, y: placement.y },
              { x: currentRound.targetCellX, y: currentRound.targetCellY }
            );

            await tx.placement.update({
              where: { id: placement.id },
              data: {
                status: resolved.status,
                multiplier: resolved.multiplier
              }
            });
          }

          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.REVEAL_ZONE,
              stateEnteredAt: now,
              phaseDeadlineAt: new Date(now.getTime() + room.settings.revealZoneMs)
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.REVEAL_ZONE };
        }

        case RoundState.REVEAL_ZONE: {
          const refreshedRound = await tx.round.findUnique({
            where: { id: currentRound.id },
            include: {
              category: true,
              placements: true
            }
          });

          if (!refreshedRound) {
            return { kind: "round-not-found" as const };
          }

          const summary = buildRoundSummary({
            roundNumber: refreshedRound.number,
            target: {
              x: refreshedRound.targetCellX,
              y: refreshedRound.targetCellY
            },
            categoryName: room.settings.defaultLocale === "en"
              ? refreshedRound.category.nameEn
              : refreshedRound.category.nameRu,
            activePlayerId: currentRound.activePlayerId,
            players: room.players
              .filter((player) => currentRound.participants.some((participant) => participant.playerId === player.id))
              .map((player) => ({
              id: player.id,
              name: player.name,
              chips: player.chips
            })),
            placements: refreshedRound.placements.map((placement) => ({
              playerId: placement.playerId,
              x: placement.x,
              y: placement.y
            }))
          });

          for (const outcome of summary.outcomes) {
            await tx.player.update({
              where: { id: outcome.playerId },
              data: {
                chips: outcome.newChips,
                lifecycleState: PlayerLifecycleState.ACTIVE
              }
            });
          }

          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.ROUND_RESULTS,
              stateEnteredAt: now,
              phaseDeadlineAt: new Date(now.getTime() + room.settings.roundResultsMs),
              resolvedAt: now,
              summaryJson: summary as Prisma.InputJsonValue
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.ROUND_RESULTS };
        }

        case RoundState.ROUND_RESULTS: {
          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              state: RoundState.ROUND_TRANSITION,
              stateEnteredAt: now,
              phaseDeadlineAt: new Date(now.getTime() + room.settings.roundTransitionMs)
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.ROUND_TRANSITION };
        }

        case RoundState.ROUND_TRANSITION: {
          await tx.player.updateMany({
            where: {
              roomId: room.id,
              canParticipateNextRound: false
            },
            data: {
              canParticipateNextRound: true
            }
          });

          if (room.currentGame.currentRoundNumber >= room.currentGame.roundsPlanned) {
            await tx.round.update({
              where: { id: currentRound.id },
              data: {
                state: RoundState.GAME_FINISHED,
                stateEnteredAt: now,
                phaseDeadlineAt: null
              }
            });

            await tx.game.update({
              where: { id: room.currentGame.id },
              data: {
                status: GameStatus.FINISHED,
                finishedAt: now
              }
            });

            await tx.room.update({
              where: { id: room.id },
              data: {
                status: RoomStatus.FINISHED,
                finishedAt: now
              }
            });

            return { kind: "advanced" as const, nextState: RoundState.GAME_FINISHED };
          }

          const playersForNextRound = await tx.player.findMany({
            where: {
              roomId: room.id
            },
            orderBy: {
              joinOrder: "asc"
            }
          });

          const activeCandidate = selectNextActivePlayer(
            playersForNextRound.filter((player) => player.lifecycleState === PlayerLifecycleState.ACTIVE),
            room.currentGame.lastActiveJoinOrder
          );

          if (!activeCandidate || !room.currentGame.paletteSnapshot) {
            await tx.round.update({
              where: { id: currentRound.id },
              data: {
                phaseDeadlineAt: null
              }
            });

            await tx.game.update({
              where: { id: room.currentGame.id },
              data: {
                roundStartBlockedAt: now
              }
            });

            return { kind: "round-start-blocked" as const };
          }

          const nextRoundNumber = room.currentGame.currentRoundNumber + 1;
          const categories = await tx.category.findMany({
            where: {
              isActive: true
            },
            orderBy: [
              { sortOrder: "asc" },
              { createdAt: "asc" }
            ]
          });

          if (categories.length === 0) {
            return { kind: "category-missing" as const };
          }

          const previousRounds = await tx.round.findMany({
            where: {
              gameId: room.currentGame.id
            },
            select: {
              categoryId: true
            }
          });
          const usedCategoryIds = previousRounds.map((round) => round.categoryId);
          const categoryPool = room.settings.allowCategoryRepeats
            ? categories
            : categories.filter((category) => !usedCategoryIds.includes(category.id));
          const finalCategoryPool = categoryPool.length > 0 ? categoryPool : categories;
          const selectedCategory = finalCategoryPool[Math.floor(Math.random() * finalCategoryPool.length)];

          const targetCell = pickTargetCell(`${room.currentGame.paletteSnapshot.seed}:round:${nextRoundNumber}`);
          const eligibleParticipants = playersForNextRound.filter(
            (player) => player.lifecycleState === PlayerLifecycleState.ACTIVE && player.canParticipateNextRound
          );

          await tx.round.create({
            data: {
              gameId: room.currentGame.id,
              number: nextRoundNumber,
              state: RoundState.VOTING_OPEN,
              stateEnteredAt: now,
              activePlayerId: activeCandidate.id,
              categoryId: selectedCategory.id,
              targetCellX: targetCell.x,
              targetCellY: targetCell.y,
              paletteSnapshotId: room.currentGame.paletteSnapshot.id,
              participants: {
                create: eligibleParticipants.map((player) => ({
                  playerId: player.id,
                  role: player.id === activeCandidate.id ? RoundRole.ACTIVE_PLAYER : RoundRole.VOTER,
                  mustBet: player.id !== activeCandidate.id,
                  chipsAtRoundStart: player.chips,
                  quorumStatus: player.id === activeCandidate.id ? QuorumStatus.NOT_REQUIRED : QuorumStatus.BLOCKING,
                  skippedReason: player.id === activeCandidate.id ? SkippedReason.ACTIVE_PLAYER : null
                }))
              }
            }
          });

          await tx.round.update({
            where: { id: currentRound.id },
            data: {
              phaseDeadlineAt: null
            }
          });

          await tx.game.update({
            where: { id: room.currentGame.id },
            data: {
              currentRoundNumber: nextRoundNumber,
              lastActiveJoinOrder: activeCandidate.joinOrder,
              roundStartBlockedAt: null
            }
          });

          return { kind: "advanced" as const, nextState: RoundState.VOTING_OPEN };
        }

        default:
          return {
            kind: "transition-not-allowed" as const,
            roundState: currentRound.state
          };
      }
    });
  }

  private classifyPlacement(
    placement: { x: number; y: number },
    target: { x: number; y: number }
  ) {
    const deltaX = Math.abs(placement.x - target.x);
    const deltaY = Math.abs(placement.y - target.y);
    const chebyshevDistance = Math.max(deltaX, deltaY);

    if (chebyshevDistance === 0) {
      return { status: PlacementStatus.CENTER, multiplier: 3 };
    }

    if (chebyshevDistance === 1) {
      return { status: PlacementStatus.NEAR, multiplier: 2 };
    }

    if (chebyshevDistance === 2) {
      return { status: PlacementStatus.EDGE, multiplier: 1 };
    }

    return { status: PlacementStatus.MISS, multiplier: 0 };
  }
}
