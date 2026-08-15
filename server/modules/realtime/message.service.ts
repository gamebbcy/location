import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import type {
  AlertSendPayload,
  AlertReceivePayload,
  PokeSendPayload,
  PokeReceivePayload,
} from '@shared/api.interface';
import { ConnectionService } from './connection.service';
import { RateLimitService } from './rate-limit.service';

const MESSAGE_RATE_LIMIT = 60; // 每分钟最多 60 条
const MESSAGE_RATE_WINDOW_MS = 60 * 1000; // 1 分钟

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private server: Server | null = null;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly rateLimitService: RateLimitService,
  ) {}

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
    * 强提醒转发：仅当接收方在线时转发，离线则丢弃。
    */
  handleAlertSend(
    fromUserId: string,
    fromNickname: string,
    payload: AlertSendPayload,
  ): void {
    const server = this.getServer();
    const { toUserIds, messageId, timestamp, title, content } = payload;

    if (!toUserIds || toUserIds.length === 0) return;

    for (const toUserId of toUserIds) {
      // 强提醒也受速率限制保护
      const allowed = this.rateLimitService.check(
        toUserId,
        MESSAGE_RATE_LIMIT,
        MESSAGE_RATE_WINDOW_MS,
      );
      if (!allowed) {
        this.logger.log(
          `Alert dropped due to rate limit: to=${toUserId}, from=${fromUserId}`,
        );
        continue;
      }

      if (!this.connectionService.isOnline(toUserId)) {
        this.logger.log(
          `Alert dropped: recipient ${toUserId} is offline (from ${fromUserId})`,
        );
        continue;
      }

      const toSocketId = this.connectionService.getSocketId(toUserId);
      if (!toSocketId) continue;

      const receivePayload: AlertReceivePayload = {
        fromUserId,
        fromNickname,
        messageId,
        timestamp,
        title,
        content,
      };

      server.to(toSocketId).emit('alert:receive', receivePayload);
      this.logger.log(
        `Alert forwarded: ${fromUserId} → ${toUserId} (messageId=${messageId})`,
      );
    }
  }

  /**
   * 戳一戳转发：仅当接收方在线时转发，30秒内同一发送方只允许一次。
   */
  handlePokeSend(fromUserId: string, payload: PokeSendPayload): void {
    const server = this.getServer();
    const { toUserId, messageId, timestamp } = payload;

    const rateKey = `poke:${fromUserId}:${toUserId}`;
    const allowed = this.rateLimitService.check(
      rateKey,
      1,
      30 * 1000,
    );
    if (!allowed) {
      this.logger.log(
        `Poke dropped due to cooldown: ${fromUserId} → ${toUserId}`,
      );
      return;
    }

    if (!this.connectionService.isOnline(toUserId)) {
      this.logger.log(
        `Poke dropped: recipient ${toUserId} is offline (from ${fromUserId})`,
      );
      return;
    }

    const toSocketId = this.connectionService.getSocketId(toUserId);
    if (!toSocketId) return;

    const receivePayload: PokeReceivePayload = {
      fromUserId,
      messageId,
      timestamp,
    };

    server.to(toSocketId).emit('poke:receive', receivePayload);
    this.logger.log(
      `Poke forwarded: ${fromUserId} → ${toUserId}`,
    );
  }

  /**
   * 用户断开时清理其速率限制记录。
   */
  clearUserRateLimit(userId: string): void {
    this.rateLimitService.clear(userId);
  }
}
