import { Injectable } from "@nestjs/common";

import {
  PlayerConnectionState,
  QuorumStatus,
  RoundRole,
  RoundState,
  SessionActorType,
  SessionAuditEventType
} from "@huegame/database";

import { PersistenceService } from "../persistence.service";

@Injectable()
export class SnapshotRepository {
  constructor(private readonly persistence: PersistenceService) {}

  async findRoomForSnapshot(roomCode: string) {
    return this.persistence.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        settings: true,
        hostSession: true,
        players: {
          orderBy: {
            joinOrder: "asc"
          },
          include: {
            placements: true
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
                category: {
                  select: {
                    nameRu: true,
                    nameEn: true
                  }
                },
                participants: {
                  select: {
                    playerId: true,
                    role: true,
                    placementVersion: true,
                    confirmVersion: true
                  }
                },
                activePlayer: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  async reconnectHost(roomCode: string, sessionTokenHash: string) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: roomCode },
        include: {
          hostSession: true
        }
      });

      if (!room || !room.hostSession) {
        return { kind: "room-not-found" as const };
      }

      if (room.hostSession.sessionTokenHash !== sessionTokenHash) {
        await tx.sessionAuditEvent.create({
          data: {
            roomId: room.id,
            hostSessionId: room.hostSession.id,
            actorType: SessionActorType.HOST,
            eventType: SessionAuditEventType.RECONNECT_REJECTED
          }
        });

        return { kind: "invalid-token" as const };
      }

      await tx.hostSession.update({
        where: {
          id: room.hostSession.id
        },
        data: {
          connectionState: PlayerConnectionState.CONNECTED,
          lastSeenAt: new Date()
        }
      });

      await tx.sessionAuditEvent.create({
        data: {
          roomId: room.id,
          hostSessionId: room.hostSession.id,
          actorType: SessionActorType.HOST,
          eventType: SessionAuditEventType.RECONNECT_ACCEPTED
        }
      });

      return { kind: "reconnected" as const, roomId: room.id };
    });
  }

  async reconnectPlayer(roomCode: string, normalizedName: string, sessionTokenHash: string) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: roomCode },
        include: {
          players: true
        }
      });

      if (!room) {
        return { kind: "room-not-found" as const };
      }

      const player = room.players.find((item) => item.nameNormalized === normalizedName);

      if (!player) {
        return { kind: "player-not-found" as const };
      }

      if (player.sessionTokenHash !== sessionTokenHash) {
        await tx.sessionAuditEvent.create({
          data: {
            roomId: room.id,
            playerId: player.id,
            actorType: SessionActorType.PLAYER,
            eventType: SessionAuditEventType.RECONNECT_REJECTED
          }
        });

        return { kind: "invalid-token" as const };
      }

      await tx.player.update({
        where: {
          id: player.id
        },
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

      return { kind: "reconnected" as const, playerId: player.id };
    });
  }

  async disconnectHost(roomCode: string, sessionTokenHash: string) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: roomCode },
        include: {
          hostSession: true
        }
      });

      if (!room || !room.hostSession) {
        return { kind: "room-not-found" as const };
      }

      if (room.hostSession.sessionTokenHash !== sessionTokenHash) {
        return { kind: "invalid-token" as const };
      }

      await tx.hostSession.update({
        where: { id: room.hostSession.id },
        data: {
          connectionState: PlayerConnectionState.DISCONNECTED,
          lastSeenAt: new Date()
        }
      });

      await tx.sessionAuditEvent.create({
        data: {
          roomId: room.id,
          hostSessionId: room.hostSession.id,
          actorType: SessionActorType.HOST,
          eventType: SessionAuditEventType.SOCKET_DISCONNECTED
        }
      });

      return { kind: "disconnected" as const };
    });
  }

  async disconnectPlayer(roomCode: string, normalizedName: string, sessionTokenHash: string) {
    return this.persistence.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: roomCode },
        include: {
          players: true,
          settings: true,
          currentGame: {
            include: {
              rounds: {
                orderBy: {
                  number: "desc"
                },
                take: 1,
                include: {
                  participants: true
                }
              }
            }
          }
        }
      });

      if (!room) {
        return { kind: "room-not-found" as const };
      }

      const player = room.players.find((item) => item.nameNormalized === normalizedName);

      if (!player) {
        return { kind: "player-not-found" as const };
      }

      if (player.sessionTokenHash !== sessionTokenHash) {
        return { kind: "invalid-token" as const };
      }

      await tx.player.update({
        where: { id: player.id },
        data: {
          connectionState: PlayerConnectionState.DISCONNECTED,
          lastSeenAt: new Date()
        }
      });

      await tx.sessionAuditEvent.create({
        data: {
          roomId: room.id,
          playerId: player.id,
          actorType: SessionActorType.PLAYER,
          eventType: SessionAuditEventType.SOCKET_DISCONNECTED
        }
      });

      const currentRound = room.currentGame?.rounds[0];

      if (currentRound && currentRound.state === RoundState.VOTING_OPEN) {
        const participant = currentRound.participants.find((item) => item.playerId === player.id);

        if (participant && participant.role === RoundRole.VOTER) {
          await tx.roundParticipant.update({
            where: {
              roundId_playerId: {
                roundId: participant.roundId,
                playerId: participant.playerId
              }
            },
            data: {
              quorumStatus: QuorumStatus.EXCLUDED
            }
          });

          const allBlockingResolved = currentRound.participants
            .filter((item) => item.role === RoundRole.VOTER && item.playerId !== player.id)
            .every((item) => item.quorumStatus === QuorumStatus.SATISFIED || item.quorumStatus === QuorumStatus.EXCLUDED);

          if (allBlockingResolved) {
            const now = new Date();
            const allConfirmedWindowMs = room.settings?.allConfirmedWindowMs ?? 10_000;

            await tx.round.update({
              where: { id: currentRound.id },
              data: {
                allConfirmedAt: currentRound.allConfirmedAt ?? now,
                phaseDeadlineAt: currentRound.phaseDeadlineAt ?? new Date(now.getTime() + allConfirmedWindowMs)
              }
            });
          }
        }
      }

      return { kind: "disconnected" as const };
    });
  }
}
