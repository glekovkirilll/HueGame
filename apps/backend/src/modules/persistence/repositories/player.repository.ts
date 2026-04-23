import { Injectable } from "@nestjs/common";

import {
  PlayerConnectionState,
  RoomStatus,
  SessionActorType,
  SessionAuditEventType,
  type Prisma
} from "@huegame/database";

import { PersistenceService } from "../persistence.service";

type JoinPlayerInput = {
  roomCode: string;
  displayName: string;
  normalizedName: string;
  sessionTokenHash: string;
};

@Injectable()
export class PlayerRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async joinPlayer(input: JoinPlayerInput) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: input.roomCode },
        include: {
          settings: true,
          players: {
            orderBy: {
              joinOrder: "desc"
            }
          }
        }
      });

      if (!room) {
        return { kind: "room-not-found" as const };
      }

      if (room.status === RoomStatus.FINISHED || room.status === RoomStatus.ARCHIVED) {
        return { kind: "room-not-joinable" as const, roomStatus: room.status };
      }

      const existingByName = room.players.find((player) => player.nameNormalized === input.normalizedName);
      const isReconnect = existingByName?.sessionTokenHash === input.sessionTokenHash;

      if (existingByName && !isReconnect) {
        await tx.sessionAuditEvent.create({
          data: {
            roomId: room.id,
            playerId: existingByName.id,
            actorType: SessionActorType.PLAYER,
            eventType: SessionAuditEventType.NAME_CONFLICT_REJECTED,
            metadata: {
              attemptedName: input.displayName
            } as Prisma.InputJsonValue
          }
        });

        return { kind: "name-conflict" as const };
      }

      if (existingByName && isReconnect) {
        const player = await tx.player.update({
          where: { id: existingByName.id },
          data: {
            connectionState: PlayerConnectionState.CONNECTED,
            lastSeenAt: new Date()
          }
        });

        await tx.sessionAuditEvent.create({
          data: {
            roomId: room.id,
            playerId: player.id,
            actorType: SessionActorType.PLAYER,
            eventType: SessionAuditEventType.RECONNECT_ACCEPTED
          }
        });

        return {
          kind: "reconnected" as const,
          room,
          player
        };
      }

      const nextJoinOrder = (room.players[0]?.joinOrder ?? 0) + 1;
      const player = await tx.player.create({
        data: {
          roomId: room.id,
          name: input.displayName,
          nameNormalized: input.normalizedName,
          sessionTokenHash: input.sessionTokenHash,
          connectionState: PlayerConnectionState.CONNECTED,
          chips: 0,
          joinOrder: nextJoinOrder,
          canParticipateNextRound: room.status !== RoomStatus.IN_GAME
        }
      });

      await tx.sessionAuditEvent.create({
        data: {
          roomId: room.id,
          playerId: player.id,
          actorType: SessionActorType.PLAYER,
          eventType: SessionAuditEventType.ROOM_JOINED
        }
      });

      return {
        kind: "joined" as const,
        room,
        player
      };
    });
  }
}
