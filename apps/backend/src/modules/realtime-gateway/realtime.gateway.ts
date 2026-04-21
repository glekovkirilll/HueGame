import {
  ConnectedSocket,
  OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { type RoomRoleSnapshot } from "@huegame/contracts";
import {
  normalizePlayerName,
  resolvePlayerRoundRole
} from "@huegame/domain";

import { RoomsService, type CreateRoomCommand, type DeleteRoomCommand } from "../rooms/rooms.service";
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
import { SnapshotRepository } from "../persistence/repositories/snapshot.repository";
import { ProjectionBuilder } from "../rounds/services/projection-builder.service";
import {
  validateCreateRoomPayload,
  validatePlaceChipPayload,
  validateRoomCodePayload
} from "./realtime.validation";

type ClientIdentity =
  | {
      role: "host";
      roomCode: string;
      sessionToken: string;
    }
  | {
      role: "player";
      roomCode: string;
      playerName: string;
      sessionToken: string;
    };
type RoomDeletedPayload = {
  roomCode: string;
};

@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class HueRealtimeGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly identities = new Map<string, ClientIdentity>();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly playersService: PlayersService,
    private readonly hostService: HostService,
    private readonly gameService: GameService,
    private readonly roundsService: RoundsService,
    private readonly votingService: VotingService,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly projectionBuilder: ProjectionBuilder
  ) {}

  async handleDisconnect(client: Socket) {
    const identity = this.identities.get(client.id);
    this.identities.delete(client.id);

    if (!identity) {
      return;
    }

    try {
      if (identity.role === "host") {
        await this.hostService.disconnect({
          roomCode: identity.roomCode,
          sessionToken: identity.sessionToken
        });
      } else {
        await this.playersService.disconnect({
          roomCode: identity.roomCode,
          playerName: identity.playerName,
          sessionToken: identity.sessionToken
        });
      }
    } catch {
      return;
    }

    await this.broadcastRoomSnapshots(identity.roomCode);
  }

  @SubscribeMessage("room.create")
  async handleCreateRoom(@MessageBody() command: CreateRoomCommand, @ConnectedSocket() client: Socket) {
    const room = await this.roomsService.createRoom(validateCreateRoomPayload(command));
    this.identifyHost(client, room.roomCode, room.hostSessionToken);
    await this.emitSnapshotToClient(client);

    return room;
  }

  @SubscribeMessage("room.join")
  async handleJoinRoom(@MessageBody() command: JoinPlayerCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, true, false) as JoinPlayerCommand;
    const player = await this.playersService.joinRoom({
      ...validated,
      sessionToken: typeof command.sessionToken === "string" ? command.sessionToken : undefined
    });
    this.identifyPlayer(client, player.roomCode, player.playerName, player.sessionToken);
    await this.broadcastRoomSnapshots(player.roomCode);

    return player;
  }

  @SubscribeMessage("room.delete")
  async handleDeleteRoom(@MessageBody() command: DeleteRoomCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, false, true) as DeleteRoomCommand;
    const result = await this.roomsService.deleteRoom(validated);
    const normalizedRoomCode = result.roomCode.toUpperCase();
    const sockets = await this.server.in(normalizedRoomCode).fetchSockets();

    await Promise.all(
      sockets.map(async (socket) => {
        socket.emit("room.deleted", { roomCode: normalizedRoomCode } satisfies RoomDeletedPayload);
        this.identities.delete(socket.id);
        await socket.leave(normalizedRoomCode);
      })
    );
    this.identities.delete(client.id);

    return result;
  }

  @SubscribeMessage("host.reconnect")
  async handleHostReconnect(@MessageBody() command: HostReconnectCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, false, true) as HostReconnectCommand;
    const snapshot = await this.hostService.reconnect(validated);
    this.identifyHost(client, snapshot.roomCode, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("room.reconnect")
  async handlePlayerReconnect(@MessageBody() command: PlayerReconnectCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, true, true) as PlayerReconnectCommand;
    const snapshot = await this.playersService.reconnect(validated);
    this.identifyPlayer(client, snapshot.roomCode, validated.playerName, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("host.disconnect")
  async handleHostDisconnect(@MessageBody() command: HostDisconnectCommand, @ConnectedSocket() client: Socket) {
    const result = await this.hostService.disconnect(validateRoomCodePayload(command, false, true) as HostDisconnectCommand);
    this.identities.delete(client.id);
    await client.leave(result.roomCode);
    await this.broadcastRoomSnapshots(result.roomCode);

    return result;
  }

  @SubscribeMessage("room.disconnect")
  async handlePlayerDisconnect(@MessageBody() command: PlayerDisconnectCommand, @ConnectedSocket() client: Socket) {
    const result = await this.playersService.disconnect(validateRoomCodePayload(command, true, true) as PlayerDisconnectCommand);
    this.identities.delete(client.id);
    await client.leave(result.roomCode);
    await this.broadcastRoomSnapshots(result.roomCode);

    return result;
  }

  @SubscribeMessage("game.start")
  async handleStartGame(@MessageBody() command: StartGameCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, false, true) as StartGameCommand;
    const snapshot = await this.gameService.startGame(validated);
    this.identifyHost(client, snapshot.roomCode, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("round.advance")
  async handleAdvanceRound(@MessageBody() command: AdvanceRoundCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, false, true) as AdvanceRoundCommand;
    const snapshot = await this.roundsService.advanceRound(validated);
    this.identifyHost(client, snapshot.roomCode, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.placeChip")
  async handlePlaceChip(@MessageBody() command: PlaceChipCommand, @ConnectedSocket() client: Socket) {
    const validated = validatePlaceChipPayload(command);
    const snapshot = await this.votingService.placeChip(validated);
    this.identifyPlayer(client, snapshot.roomCode, validated.playerName, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.removeChip")
  async handleRemoveChip(@MessageBody() command: RemoveChipCommand, @ConnectedSocket() client: Socket) {
    const validated = validatePlaceChipPayload(command);
    const snapshot = await this.votingService.removeChip(validated);
    this.identifyPlayer(client, snapshot.roomCode, validated.playerName, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.confirmBet")
  async handleConfirmBet(@MessageBody() command: PlayerBetCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, true, true) as PlayerBetCommand;
    const snapshot = await this.votingService.confirmBet(validated);
    this.identifyPlayer(client, snapshot.roomCode, validated.playerName, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("vote.unconfirmBet")
  async handleUnconfirmBet(@MessageBody() command: PlayerBetCommand, @ConnectedSocket() client: Socket) {
    const validated = validateRoomCodePayload(command, true, true) as PlayerBetCommand;
    const snapshot = await this.votingService.unconfirmBet(validated);
    this.identifyPlayer(client, snapshot.roomCode, validated.playerName, validated.sessionToken);
    await this.broadcastRoomSnapshots(snapshot.roomCode);

    return snapshot;
  }

  @SubscribeMessage("system.tick")
  async handleSystemTick() {
    const results = await this.roundsService.tickDueRounds();

    await Promise.all(results.map((item) => this.broadcastRoomSnapshots(item.roomCode)));

    return results;
  }

  @SubscribeMessage("client.snapshot")
  async handleClientSnapshot(@ConnectedSocket() client: Socket) {
    return this.buildSnapshotForClient(client.id);
  }

  private identifyHost(client: Socket, roomCode: string, sessionToken: string) {
    const normalizedRoomCode = roomCode.toUpperCase();
    this.identities.set(client.id, {
      role: "host",
      roomCode: normalizedRoomCode,
      sessionToken
    });
    void client.join(normalizedRoomCode);
  }

  private identifyPlayer(client: Socket, roomCode: string, playerName: string, sessionToken: string) {
    const normalizedRoomCode = roomCode.toUpperCase();
    this.identities.set(client.id, {
      role: "player",
      roomCode: normalizedRoomCode,
      playerName,
      sessionToken
    });
    void client.join(normalizedRoomCode);
  }

  private async emitSnapshotToClient(client: Socket) {
    const snapshot = await this.buildSnapshotForClient(client.id);

    if (snapshot) {
      client.emit("snapshot.updated", snapshot);
    }
  }

  private async broadcastRoomSnapshots(roomCode: string) {
    const normalizedRoomCode = roomCode.toUpperCase();
    const sockets = await this.server.in(normalizedRoomCode).fetchSockets();

    await Promise.all(
      sockets.map(async (socket) => {
        const identity = this.identities.get(socket.id);

        if (!identity || identity.roomCode !== normalizedRoomCode) {
          return;
        }

        const snapshot = await this.buildSnapshot(identity);

        if (snapshot) {
          socket.emit("snapshot.updated", snapshot);
        }
      })
    );
  }

  private async buildSnapshotForClient(socketId: string): Promise<RoomRoleSnapshot | null> {
    const identity = this.identities.get(socketId);

    if (!identity) {
      return null;
    }

    return this.buildSnapshot(identity);
  }

  private async buildSnapshot(identity: ClientIdentity): Promise<RoomRoleSnapshot | null> {
    const room = await this.snapshotRepository.findRoomForSnapshot(identity.roomCode);

    if (!room) {
      return null;
    }

    if (identity.role === "host") {
      return this.projectionBuilder.buildHostSnapshot(room);
    }

    const player = room.players.find(
      (candidate) => candidate.nameNormalized === normalizePlayerName(identity.playerName)
    );

    if (!player) {
      return null;
    }

    const role = resolvePlayerRoundRole(room, player);

    if (role === "active-player") {
      return this.projectionBuilder.buildActivePlayerSnapshot(room, player);
    }

    if (role === "joined-waiting") {
      return this.projectionBuilder.buildJoinedWaitingSnapshot(room, player);
    }

    return this.projectionBuilder.buildPlayerSnapshot(room, player);
  }
}
