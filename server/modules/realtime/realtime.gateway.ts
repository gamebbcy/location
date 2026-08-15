import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  LocationUpdatePayload,
  AlertSendPayload,
  StatusUpdatePayload,
  FriendStatusPayload,
  PokeSendPayload,
} from '@shared/api.interface';
import { ConnectionService } from './connection.service';
import { LocationService } from './location.service';
import { MessageService } from './message.service';

@WebSocketGateway({
  namespace: '/location',
  path: '/api/socket.io',
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly locationService: LocationService,
    private readonly messageService: MessageService,
  ) {}

  afterInit(): void {
    this.locationService.setServer(this.server);
    this.messageService.setServer(this.server);
    this.logger.log('RealtimeGateway initialized on /location namespace');
  }

  /**
   * 处理新连接：鉴权（token 非空校验）+ 注册连接 + 广播上线。
   */
  handleConnection(client: Socket): void {
    const userId =
      (client.handshake.auth?.userId as string) ||
      (client.handshake.query.userId as string);
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query.token as string);

    // 简单鉴权：userId 和 token 非空校验
    if (!userId || !token) {
      this.logger.log(
        `Connection rejected: missing userId or token (socket=${client.id})`,
      );
      client.disconnect(true);
      return;
    }

    // 如果用户已有连接，先断开旧的（同一用户只保留一个连接）
    const existingSocketId = this.connectionService.getSocketId(userId);
    if (existingSocketId && existingSocketId !== client.id) {
      const oldSocket = this.server.sockets.sockets.get(existingSocketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
        this.logger.log(`Old connection replaced for user ${userId}`);
      }
    }

    this.connectionService.addConnection(userId, client.id);

    // 定向广播上线通知：只推送给将该用户视为好友的在线用户
    const watchers = this.connectionService.getOnlineUsersWhoHaveFriend(userId);
    if (watchers.length > 0) {
      const onlinePayload: FriendStatusPayload = { userId };
      for (const watcherId of watchers) {
        const watcherSocketId = this.connectionService.getSocketId(watcherId);
        if (watcherSocketId) {
          client.to(watcherSocketId).emit('friend:online', onlinePayload);
        }
      }
      this.logger.log(
        `User ${userId} online broadcast to ${watchers.length} friends`,
      );
    }

    this.logger.log(
      `User ${userId} connected. Online count: ${this.connectionService.getOnlineCount()}`,
    );
  }

  /**
   * 处理断开连接：清除映射 + 广播下线。
   */
  handleDisconnect(client: Socket): void {
    const userId = this.connectionService.removeConnection(client.id);

    if (userId) {
      // 定向广播下线通知：只推送给将该用户视为好友的在线用户
      const watchers = this.connectionService.getOnlineUsersWhoHaveFriend(userId);
      if (watchers.length > 0) {
        const offlinePayload: FriendStatusPayload = { userId };
        for (const watcherId of watchers) {
          const watcherSocketId = this.connectionService.getSocketId(watcherId);
          if (watcherSocketId) {
            this.server.to(watcherSocketId).emit('friend:offline', offlinePayload);
          }
        }
        this.logger.log(
          `User ${userId} offline broadcast to ${watchers.length} friends`,
        );
      }

      // 清理速率限制记录
      this.messageService.clearUserRateLimit(userId);

      this.logger.log(
        `User ${userId} disconnected. Online count: ${this.connectionService.getOnlineCount()}`,
      );
    }
  }

  /**
   * 客户端上报位置。
   */
  @SubscribeMessage('location:update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationUpdatePayload,
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(`location:update from unknown socket: ${client.id}`);
      return;
    }

    this.locationService.handleLocationUpdate(userId, payload);
  }

  /**
   * 客户端请求好友位置。
   */
  @SubscribeMessage('friend:location:request')
  handleFriendLocationRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { friendUserId: string },
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(
        `friend:location:request from unknown socket: ${client.id}`,
      );
      return;
    }

    const { friendUserId } = data;
    this.locationService.handleFriendLocationRequest(client, userId, friendUserId);
  }

  /**
   * 客户端发送强提醒。
   */
  @SubscribeMessage('alert:send')
  handleAlertSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AlertSendPayload,
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(`alert:send from unknown socket: ${client.id}`);
      return;
    }

    const fromNickname: string =
      (client.handshake.auth?.nickname as string) ||
      (client.handshake.auth?.userName as string) ||
      userId;

    this.messageService.handleAlertSend(userId, fromNickname, payload);
  }

  /**
   * 客户端发送戳一戳。
   */
  @SubscribeMessage('poke:send')
  handlePokeSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PokeSendPayload,
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(`poke:send from unknown socket: ${client.id}`);
      return;
    }

    this.messageService.handlePokeSend(userId, payload);
  }

  /**
   * 客户端更新状态。
   */
  @SubscribeMessage('status:update')
  handleStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StatusUpdatePayload,
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(`status:update from unknown socket: ${client.id}`);
      return;
    }

    this.locationService.handleStatusUpdate(userId, payload);
  }

  /**
   * 客户端上报好友列表，用于定向广播上下线事件。
   */
  @SubscribeMessage('friends:sync')
  handleFriendsSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { friendUserIds: string[] },
  ): void {
    const userId = this.connectionService.getUserId(client.id);
    if (!userId) {
      this.logger.log(`friends:sync from unknown socket: ${client.id}`);
      return;
    }

    const friendUserIds: string[] = Array.isArray(data?.friendUserIds)
      ? data.friendUserIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    this.connectionService.syncFriends(userId, friendUserIds);

    // 同步后立即向客户端推送其好友的当前在线状态
    const onlineFriends: string[] = [];
    for (const friendId of friendUserIds) {
      if (this.connectionService.isOnline(friendId)) {
        onlineFriends.push(friendId);
      }
    }
    if (onlineFriends.length > 0) {
      client.emit('friends:online:snapshot', { userIds: onlineFriends });
    }
  }
}
