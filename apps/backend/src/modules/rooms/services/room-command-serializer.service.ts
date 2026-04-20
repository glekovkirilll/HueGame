import { Injectable } from "@nestjs/common";

@Injectable()
export class RoomCommandSerializer {
  private readonly activeRooms = new Set<string>();

  tryAcquire(roomId: string): boolean {
    if (this.activeRooms.has(roomId)) {
      return false;
    }

    this.activeRooms.add(roomId);
    return true;
  }

  release(roomId: string): void {
    this.activeRooms.delete(roomId);
  }
}
