/* 前后端共享的类型写在这里 */

export type MotionState = 'stay' | 'walk' | 'run' | 'vehicle';

export interface MusicState {
  app: string;
  song: string;
}

export interface LocationUpdatePayload {
  lat: number;
  lng: number;
  accuracy: number;
  motionState: MotionState;
  battery: number;
  batteryCharging: boolean;
  networkType: string;
  deviceModel: string;
  status: string;
  musicState: MusicState | null;
  stayDuration: number;
}

export interface FriendLocationUpdate {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  motionState: MotionState;
  battery: number;
  batteryCharging: boolean;
  networkType: string;
  deviceModel: string;
  status: string;
  musicState: MusicState | null;
  stayDuration: number;
  lastUpdate: number;
}

export interface AlertSendPayload {
  toUserIds: string[];
  messageId: string;
  timestamp: number;
  /** 通知标题，最多 6 个字 */
  title: string;
  /** 通知内容，最多 6 个字 */
  content: string;
}

export interface AlertReceivePayload {
  fromUserId: string;
  fromNickname: string;
  messageId: string;
  timestamp: number;
  /** 通知标题，最多 6 个字 */
  title: string;
  /** 通知内容，最多 6 个字 */
  content: string;
}

export interface FriendStatusPayload {
  userId: string;
}

export interface FriendsSyncPayload {
  friendUserIds: string[];
}

export interface FriendsOnlineSnapshotPayload {
  userIds: string[];
}

export interface StatusUpdatePayload {
  status: string;
  musicState: MusicState | null;
}

export interface PokeSendPayload {
  toUserId: string;
  messageId: string;
  timestamp: number;
}

export interface PokeReceivePayload {
  fromUserId: string;
  fromNickname?: string;
  fromAvatar?: string;
  messageId: string;
  timestamp: number;
}

export interface Friend {
  userId: string;
  nickname: string;
  avatar: string;
  phone?: string;
  inviteCode: string;
  addedAt: number;
  isOnline: boolean;
  status: string;
  motionState: MotionState;
  remark?: string;
}
