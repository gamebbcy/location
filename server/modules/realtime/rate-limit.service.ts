import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly userTimestamps = new Map<string, number[]>();

  /**
   * 检查用户是否在速率限制窗口内。
   * 返回 true 表示允许通过，false 表示超出限制。
   */
  check(userId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = this.userTimestamps.get(userId) ?? [];

    // 清理窗口过期的时间戳
    const validTimestamps: number[] = timestamps.filter(
      (t: number): boolean => t > windowStart,
    );

    if (validTimestamps.length >= limit) {
      this.logger.log(
        `Rate limit exceeded for user ${userId}: ${validTimestamps.length}/${limit} in ${windowMs}ms`,
      );
      return false;
    }

    validTimestamps.push(now);
    this.userTimestamps.set(userId, validTimestamps);
    return true;
  }

  /**
   * 清理指定用户的速率限制记录（用户断开时调用）。
   */
  clear(userId: string): void {
    this.userTimestamps.delete(userId);
  }
}
