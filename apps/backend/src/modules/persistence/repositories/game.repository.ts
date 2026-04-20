import { Injectable } from "@nestjs/common";

import {
  GameStatus,
  PlayerLifecycleState,
  QuorumStatus,
  RoundRole,
  RoundState,
  RoomStatus
} from "@huegame/database";
import {
  buildDeterministicPaletteCells,
  buildPaletteSeed,
  pickTargetCell,
  selectNextActivePlayer
} from "@huegame/domain";

import { PersistenceService } from "../persistence.service";

type StartGameInput = {
  roomCode: string;
  hostSessionTokenHash: string;
};

@Injectable()
export class GameRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async startGame(input: StartGameInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: input.roomCode },
        include: {
          settings: true,
          hostSession: true,
          currentGame: true,
          players: {
            orderBy: {
              joinOrder: "asc"
            }
          },
          games: {
            select: {
              id: true
            }
          }
        }
      });

      if (!room || !room.settings || !room.hostSession) {
        return { kind: "room-not-found" as const };
      }

      if (room.hostSession.sessionTokenHash !== input.hostSessionTokenHash) {
        return { kind: "invalid-token" as const };
      }

      if (room.status !== RoomStatus.LOBBY) {
        return { kind: "room-not-startable" as const, roomStatus: room.status };
      }

      if (room.currentGame) {
        return { kind: "game-already-active" as const };
      }

      const activePlayers = room.players.filter((player) => player.lifecycleState === PlayerLifecycleState.ACTIVE);
      const activeCandidate = selectNextActivePlayer(activePlayers, null);

      if (!activeCandidate) {
        return { kind: "not-enough-round-ready-players" as const };
      }

      const category = await tx.category.findFirst({
        where: {
          isActive: true
        },
        orderBy: [
          { sortOrder: "asc" },
          { createdAt: "asc" }
        ]
      });

      if (!category) {
        return { kind: "category-missing" as const };
      }

      const now = new Date();
      const nextGameOrdinal = room.games.length + 1;
      const paletteSeed = buildPaletteSeed(room.code, nextGameOrdinal, room.settings.paletteSeed);
      const paletteCells = buildDeterministicPaletteCells(paletteSeed);
      const targetCell = pickTargetCell(paletteSeed);

      const game = await tx.game.create({
        data: {
          roomId: room.id,
          status: GameStatus.ACTIVE,
          roundsPlanned: room.settings.roundsCount,
          currentRoundNumber: 1,
          lastActiveJoinOrder: activeCandidate.joinOrder,
          startedAt: now
        }
      });

      const paletteSnapshot = await tx.paletteSnapshot.create({
        data: {
          roomId: room.id,
          gameId: game.id,
          seed: paletteSeed,
          cellsJson: paletteCells
        }
      });

      const eligibleParticipants = room.players.filter(
        (player) => player.lifecycleState === PlayerLifecycleState.ACTIVE && player.canParticipateNextRound
      );

      await tx.round.create({
        data: {
          gameId: game.id,
          number: 1,
          state: RoundState.PREPARE_ROUND,
          stateEnteredAt: now,
          activePlayerId: activeCandidate.id,
          categoryId: category.id,
          targetCellX: targetCell.x,
          targetCellY: targetCell.y,
          paletteSnapshotId: paletteSnapshot.id,
          participants: {
            create: eligibleParticipants.map((player) => ({
              playerId: player.id,
              role: player.id === activeCandidate.id ? RoundRole.ACTIVE_PLAYER : RoundRole.VOTER,
              mustBet: player.id !== activeCandidate.id,
              chipsAtRoundStart: player.chips,
              quorumStatus: player.id === activeCandidate.id ? QuorumStatus.NOT_REQUIRED : QuorumStatus.BLOCKING
            }))
          }
        }
      });

      await tx.room.update({
        where: {
          id: room.id
        },
        data: {
          status: RoomStatus.IN_GAME,
          currentGameId: game.id,
          startedAt: now
        }
      });

      return {
        kind: "started" as const,
        roomId: room.id,
        gameId: game.id
      };
    });
  }
}
