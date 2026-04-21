import { Injectable } from "@nestjs/common";

import {
  type Prisma,
  RoomStatus,
  SessionActorType,
  SessionAuditEventType
} from "@huegame/database";
import { createRoomSettingsDefaults } from "@huegame/domain";

import { PersistenceService } from "../persistence.service";

export type CreateRoomPersistenceInput = {
  code: string;
  hostName: string;
  hostSessionTokenHash: string;
  settings?: Partial<ReturnType<typeof createRoomSettingsDefaults>>;
};

@Injectable()
export class RoomRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async findByCode(code: string) {
    return this.persistence.prisma.room.findUnique({
      where: { code },
      include: {
        settings: true,
        hostSession: true,
        currentGame: true
      }
    });
  }

  async createRoom(input: CreateRoomPersistenceInput) {
    const defaults = {
      ...createRoomSettingsDefaults(),
      ...input.settings
    };

    return this.persistence.prisma.room.create({
      data: {
        code: input.code,
        status: RoomStatus.LOBBY,
        settings: {
          create: {
            roundsCount: defaults.roundsCount,
            startChips: defaults.startChips,
            showCellCodeToActivePlayer: defaults.showCellCodeToActivePlayer,
            allowCategoryRepeats: defaults.allowCategoryRepeats,
            defaultLocale: defaults.defaultLocale,
            playerPaletteAccessMode: defaults.playerPaletteAccessMode,
            allConfirmedWindowMs: defaults.allConfirmedWindowMs,
            revealVotesMs: defaults.revealVotesMs,
            revealZoneMs: defaults.revealZoneMs,
            roundResultsMs: defaults.roundResultsMs,
            roundTransitionMs: defaults.roundTransitionMs
          }
        },
        hostSession: {
          create: {
            sessionTokenHash: input.hostSessionTokenHash
          }
        },
        auditEvents: {
          create: {
            actorType: SessionActorType.HOST,
            eventType: SessionAuditEventType.ROOM_CREATED,
            metadata: {
              hostName: input.hostName
            } as Prisma.InputJsonValue
          }
        }
      },
      include: {
        settings: true,
        hostSession: true
      }
    });
  }

  async deleteRoom(roomCode: string, hostSessionTokenHash: string) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: {
          code: roomCode
        },
        include: {
          hostSession: true
        }
      });

      if (!room || !room.hostSession) {
        return { kind: "room-not-found" as const };
      }

      if (room.hostSession.sessionTokenHash !== hostSessionTokenHash) {
        return { kind: "invalid-token" as const };
      }

      await tx.room.delete({
        where: {
          id: room.id
        }
      });

      return { kind: "deleted" as const, roomCode };
    });
  }
}
