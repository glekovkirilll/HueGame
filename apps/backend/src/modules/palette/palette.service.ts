import { Injectable } from "@nestjs/common";

@Injectable()
export class PaletteService {
  createPaletteSeed(roomCode: string): string {
    return `palette:${roomCode}`;
  }
}
