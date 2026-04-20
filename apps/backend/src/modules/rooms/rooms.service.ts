import { Injectable, InternalServerErrorException } from "@nestjs/common";

import { type RoomSettingsDefaults } from "@huegame/contracts";

import { AuthSessionService } from "../auth-session/auth-session.service";
import { RoomRepository } from "../persistence/repositories/room.repository";

export type CreateRoomCommand = {
  hostName: string;
  settings?: Partial<RoomSettingsDefaults>;
};

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly authSessionService: AuthSessionService
  ) {}

  async createRoom(command: CreateRoomCommand) {
    const sessionToken = this.authSessionService.issueSessionToken();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const roomCode = this.generateRoomCode();
      const existingRoom = await this.roomRepository.findByCode(roomCode);

      if (existingRoom) {
        continue;
      }

      const room = await this.roomRepository.createRoom({
        code: roomCode,
        hostName: command.hostName,
        hostSessionTokenHash: this.authSessionService.hashSessionToken(sessionToken),
        settings: command.settings
      });

      return {
        roomCode: room.code,
        hostName: command.hostName,
        hostSessionToken: sessionToken,
        status: room.status,
        settings: room.settings
      };
    }

    throw new InternalServerErrorException("Failed to allocate a unique room code.");
  }

  private generateRoomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  }
}
