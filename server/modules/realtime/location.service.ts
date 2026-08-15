import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  LocationUpdatePayload,
  FriendLocationUpdate,
  StatusUpdatePayload,
} from '@shared/api.interface';
import { ConnectionService } from './connection.service';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private server: Server | null = null;

  constructor(private readonly connectionService: ConnectionService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  private getServer(): Server {
    if (!this.server) {
      throw new Error('Server not initialized');
    }
    return this.server;
  }

  /**
   * 处理位置上报：更新内存中的位置快照。
   */
  handleLocationUpdate(userId: string, payload: LocationUpdatePayload): void {
    const snapshot: FriendLocationUpdate = {
      userId,
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy,
      motionState: payload.motionState,
      battery: payload.battery,
      batteryCharging: payload.batteryCharging,
      networkType: payload.networkType,
      deviceModel: payload.deviceModel,
      status: payload.status,
      musicState: payload.musicState,
      stayDuration: payload.stayDuration,
      lastUpdate: Date.now(),
    };

    this.connectionService.setLocationSnapshot(userId, snapshot);
    this.logger.log(
      `Location updated for user ${userId}: lat=${payload.lat}, lng=${payload.lng}`,
    );
  }

  /**
   * 处理好友位置请求：向请求方的 socket 推送目标好友的当前位置快照。
   */
  handleFriendLocationRequest(
    client: Socket,
    requesterUserId: string,
    friendUserId: string,
  ): void {
    const server = this.getServer();

    // 目标好友不在线 → 不推送（服务端不存储历史数据）
    if (!this.connectionService.isOnline(friendUserId)) {
      this.logger.log(
        `Friend location request: ${requesterUserId} requested ${friendUserId} but offline`,
      );
      return;
    }

    const snapshot = this.connectionService.getLocationSnapshot(friendUserId);
    if (!snapshot) {
      this.logger.log(
        `Friend location request: ${friendUserId} has no location snapshot`,
      );
      return;
    }

    const requesterSocketId = this.connectionService.getSocketId(requesterUserId);
    if (!requesterSocketId) {
      this.logger.log(
        `Friend location request: requester ${requesterUserId} socket not found`,
      );
      return;
    }

    server.to(requesterSocketId).emit('friend:location:update', snapshot);
    this.logger.log(
      `Location sent: ${friendUserId} → ${requesterUserId}`,
    );
  }

  /**
   * 处理状态更新：更新快照中的 status 和 musicState。
   */
  handleStatusUpdate(userId: string, payload: StatusUpdatePayload): void {
    this.connectionService.updateStatus(userId, payload.status, payload.musicState);
    this.logger.log(
      `Status updated for user ${userId}: status=${payload.status}`,
    );
  }
}
