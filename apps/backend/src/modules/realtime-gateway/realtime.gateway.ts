import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { RoomsService, type CreateRoomCommand } from "../rooms/rooms.service";
import {
  PlayersService,
  type JoinPlayerCommand,
  type PlayerDisconnectCommand,
  type PlayerReconnectCommand
} from "../players/players.service";
import {
  HostService,
  type HostDisconnectCommand,
  type HostReconnectCommand
} from "../host/host.service";
import { GameService, type StartGameCommand } from "../game/game.service";
import { RoundsService, type AdvanceRoundCommand } from "../rounds/rounds.service";
import {
  VotingService,
  type PlaceChipCommand,
  type PlayerBetCommand,
  type RemoveChipCommand
} from "../voting/voting.service";
import {
  validateCreateRoomPayload,
  validatePlaceChipPayload,
  validateRoomCodePayload
} from "./realtime.validation";

@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class HueRealtimeGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly playersService: PlayersService,
    private readonly hostService: HostService,
    private readonly gameService: GameService,
    private readonly roundsService: RoundsService,
    private readonly votingService: VotingService
  ) {}

  @SubscribeMessage("room.create")
  async handleCreateRoom(@MessageBody() command: CreateRoomCommand, @ConnectedSocket() client: Socket) {
    const room = await this.roomsService.createRoom(validateCreateRoomPayload(command));
    client.join(room.roomCode);

    return room;
  }

  @SubscribeMessage("room.join")
  async handleJoinRoom(@MessageBody() command: JoinPlayerCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, true, false) as JoinPlayerCommand;
    const player = await this.playersService.joinRoom({
      ...validated,
      sessionToken: typeof command.sessionToken === "string" ? command.sessionToken : undefined
    });
    client.join(player.roomCode);

    return player;
  }

  @SubscribeMessage("host.reconnect")
  async handleHostReconnect(@MessageBody() command: HostReconnectCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.hostService.reconnect(validateRoomCodePayload(command, false, true) as HostReconnectCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("room.reconnect")
  async handlePlayerReconnect(@MessageBody() command: PlayerReconnectCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.playersService.reconnect(validateRoomCodePayload(command, true, true) as PlayerReconnectCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("host.disconnect")
  async handleHostDisconnect(@MessageBody() command: HostDisconnectCommand) {
    return this.hostService.disconnect(validateRoomCodePayload(command, false, true) as HostDisconnectCommand);
  }

  @SubscribeMessage("room.disconnect")
  async handlePlayerDisconnect(@MessageBody() command: PlayerDisconnectCommand) {
    return this.playersService.disconnect(validateRoomCodePayload(command, true, true) as PlayerDisconnectCommand);
  }

  @SubscribeMessage("game.start")
  async handleStartGame(@MessageBody() command: StartGameCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.gameService.startGame(validateRoomCodePayload(command, false, true) as StartGameCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("round.advance")
  async handleAdvanceRound(@MessageBody() command: AdvanceRoundCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.roundsService.advanceRound(validateRoomCodePayload(command, false, true) as AdvanceRoundCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.placeChip")
  async handlePlaceChip(@MessageBody() command: PlaceChipCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.votingService.placeChip(validatePlaceChipPayload(command));
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.removeChip")
  async handleRemoveChip(@MessageBody() command: RemoveChipCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.votingService.removeChip(validatePlaceChipPayload(command));
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.confirmBet")
  async handleConfirmBet(@MessageBody() command: PlayerBetCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.votingService.confirmBet(validateRoomCodePayload(command, true, true) as PlayerBetCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.unconfirmBet")
  async handleUnconfirmBet(@MessageBody() command: PlayerBetCommand, @ConnectedSocket() client: Socket) {
    const snapshot = await this.votingService.unconfirmBet(validateRoomCodePayload(command, true, true) as PlayerBetCommand);
    client.join(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("system.tick")
  async handleSystemTick() {
    return this.roundsService.tickDueRounds();
  }
}
