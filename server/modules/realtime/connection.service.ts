import { Injectable, Logger } from '@nestjs/common';
import type {
  FriendLocationUpdate,
  MusicState,
} from '@shared/api.interface';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  /** userId → socketId 映射 */
  private readonly userIdToSocketId = new Map<string, string>();
  /** socketId → userId 映射（反向查找） */
  private readonly socketIdToUserId = new Map<string, string>();
  /** userId → 位置状态快照 */
  private readonly locationSnapshots = new Map<string, FriendLocationUpdate>();
  /** userId → 好友 userId 列表（客户端连接后上报，用于定向广播上下线） */
  private readonly friendMap = new Map<string, Set<string>>();

  /**
   * 注册用户连接。
   */
  addConnection(userId: string, socketId: string): void {
    this.userIdToSocketId.set(userId, socketId);
    this.socketIdToUserId.set(socketId, userId);
    this.logger.log(`User connected: ${userId} (socket: ${socketId})`);
  }

  /**
   * 移除用户连接，返回被移除的 userId，若未找到返回 null。
   */
  removeConnection(socketId: string): string | null {
    const userId = this.socketIdToUserId.get(socketId);
    if (!userId) {
      this.logger.log(`Socket ${socketId} not found in connection map`);
      return null;
    }

    this.userIdToSocketId.delete(userId);
    this.socketIdToUserId.delete(socketId);
    this.locationSnapshots.delete(userId);
    this.friendMap.delete(userId);

    this.logger.log(`User disconnected: ${userId} (socket: ${socketId})`);
    return userId;
  }

  /**
   * 根据 userId 获取 socketId。
   */
  getSocketId(userId: string): string | undefined {
    return this.userIdToSocketId.get(userId);
  }

  /**
   * 根据 socketId 获取 userId。
   */
  getUserId(socketId: string): string | undefined {
    return this.socketIdToUserId.get(socketId);
  }

  /**
   * 判断用户是否在线。
   */
  isOnline(userId: string): boolean {
    return this.userIdToSocketId.has(userId);
  }

  /**
   * 获取在线用户总数。
   */
  getOnlineCount(): number {
    return this.userIdToSocketId.size;
  }

  /**
   * 获取所有在线用户的 userId 列表。
   */
  getAllOnlineUserIds(): string[] {
    return Array.from(this.userIdToSocketId.keys());
  }

  /**
   * 设置用户位置快照。
   */
  setLocationSnapshot(userId: string, snapshot: FriendLocationUpdate): void {
    this.locationSnapshots.set(userId, snapshot);
  }

  /**
   * 获取用户位置快照。
   */
  getLocationSnapshot(userId: string): FriendLocationUpdate | undefined {
    return this.locationSnapshots.get(userId);
  }

  /**
   * 移除用户位置快照。
   */
  removeLocationSnapshot(userId: string): void {
    this.locationSnapshots.delete(userId);
  }

  /**
   * 更新用户状态（status + musicState）。
   */
  updateStatus(userId: string, status: string, musicState: MusicState | null): void {
    const snapshot = this.locationSnapshots.get(userId);
    if (snapshot) {
      snapshot.status = status;
      snapshot.musicState = musicState;
      snapshot.lastUpdate = Date.now();
    }
  }

  /**
   * 同步用户的好友列表（用于定向广播上下线事件）。
   */
  syncFriends(userId: string, friendUserIds: string[]): void {
    this.friendMap.set(userId, new Set(friendUserIds));
    this.logger.log(
      `Friends synced for user ${userId}: ${friendUserIds.length} friends`,
    );
  }

  /**
   * 获取某用户的好友 ID 列表（若未同步则返回空数组）。
   */
  getFriendIds(userId: string): string[] {
    const set = this.friendMap.get(userId);
    return set ? Array.from(set) : [];
  }

  /**
   * 获取所有以指定用户为好友的在线用户 ID（即会收到该用户上下线通知的人）。
   * 由于好友关系是双向的，我们需要遍历 friendMap 找到包含 targetUserId 的条目。
   */
  getOnlineUsersWhoHaveFriend(targetUserId: string): string[] {
    const result: string[] = [];
    for (const [userId, friends] of this.friendMap) {
      if (friends.has(targetUserId) && this.userIdToSocketId.has(userId)) {
        result.push(userId);
      }
    }
    return result;
  }
}
