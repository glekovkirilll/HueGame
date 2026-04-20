import { Injectable } from "@nestjs/common";

import { RoundRepository } from "../../persistence/repositories/round.repository";

@Injectable()
export class RecoveryService {
  constructor(private readonly roundRepository: RoundRepository) {}

  recoverPendingDeadlines(now: Date, deadlines: Date[]) {
    return deadlines.filter((deadline) => deadline >= now);
  }

  async advanceDueRounds(now = new Date()) {
    const roomCodes = await this.roundRepository.listDueRoomCodes(now);
    const results = [];

    for (const roomCode of roomCodes) {
      results.push({
        roomCode,
        result: await this.roundRepository.advanceDueRound(roomCode)
      });
    }

    return results;
  }
}
