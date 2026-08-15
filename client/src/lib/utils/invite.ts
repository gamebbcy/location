import { logger } from '@lark-apaas/client-toolkit/logger';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';
import { getProfile, setProfile } from '@client/src/lib/storage';
import { APP_CONFIG } from '@client/src/config';

// 排除易混淆字符 0/O/1/I
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;
const INVITE_EXPIRY_MS = 3 * 60 * 1000; // 3 分钟

const LS_CODE_KEY = 'fl_my_invite_code';
const LS_EXPIRY_KEY = 'fl_my_invite_expires_at';

// ========== 基础工具 ==========

export function generateInviteCode(length: number = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * INVITE_CHARS.length);
    code += INVITE_CHARS[idx];
  }
  return code;
}

export function generateInviteLink(code: string): string {
  return resolveAppUrl(`/add?code=${code}`);
}

export async function shareInvite(
  code: string,
  nickname: string,
): Promise<void> {
  const url = generateInviteLink(code);
  const title = `${nickname} 邀请你加入好朋友位置报备`;
  const text = `${nickname} 邀请你实时共享位置，快来加入吧~`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      logger.warn('navigator.share failed, fallback to clipboard', err);
    }
  }

  try {
    await navigator.clipboard.writeText(`${title}\n${url}`);
  } catch (err) {
    logger.error('clipboard write failed', err);
    throw err;
  }
}

// ========== 邀请码生命周期 ==========

export interface InviteCodeInfo {
  code: string;
  expiresAt: number | null;
}

/**
 * 获取当前邀请码及过期时间戳。
 * - 若本地有存储且未过期，直接返回
 * - 若过期或不存在，生成新的邀请码（不过期）并持久化
 * - 同步到 profile.inviteCode
 */
export function getMyInviteCode(): InviteCodeInfo {
  const storedCode = localStorage.getItem(LS_CODE_KEY);
  const storedExpiryStr = localStorage.getItem(LS_EXPIRY_KEY);
  const storedExpiry = storedExpiryStr ? Number(storedExpiryStr) : null;
  const now = Date.now();

  // 有未过期的邀请码 → 直接返回
  if (storedCode && (!storedExpiry || storedExpiry > now)) {
    return { code: storedCode.toUpperCase(), expiresAt: storedExpiry };
  }

  // 过期或不存在 → 生成新码（不过期），落库
  const code = generateInviteCode(APP_CONFIG.inviteCodeLength);
  persistInviteCode(code, null);
  return { code, expiresAt: null };
}

/**
 * 刷新邀请码，新码 3 分钟后过期。
 * 复制后 / 立即刷新时调用。
 */
export function refreshInviteCode(): InviteCodeInfo & { expiresAt: number } {
  const code = generateInviteCode(APP_CONFIG.inviteCodeLength);
  const expiresAt = Date.now() + INVITE_EXPIRY_MS;
  persistInviteCode(code, expiresAt);
  return { code, expiresAt };
}

/**
 * 验证邀请码是否有效（本地 demo 用）。
 * - 格式：6 位大写字母+数字（排除易混淆字符可放宽，仅校验长度和字符合法性）
 * - 过期检查：如果是"自己的邀请码"才检查过期；其他人的码本地无法判断，视为格式合法即有效
 *
 * 本地 demo 环境下，只要格式合法就认为有效（由 addFriend 做去重）。
 */
export function verifyInviteCode(code: string): boolean {
  const clean = code.trim().toUpperCase();
  if (clean.length !== INVITE_CODE_LENGTH) return false;
  // 每位都必须在允许字符集中
  for (let i = 0; i < clean.length; i++) {
    if (!INVITE_CHARS.includes(clean[i])) return false;
  }
  return true;
}

/**
 * 从邀请链接中解析邀请码。
 * 支持：https://.../add?code=ABC123 / /add?code=ABC123 / ?code=ABC123
 */
export function parseInviteCodeFromLink(link: string): string | null {
  try {
    let url: URL;
    if (link.startsWith('http')) {
      url = new URL(link);
    } else {
      // 相对路径，拼接一个假 origin
      url = new URL(link, 'https://example.com');
    }
    const code = url.searchParams.get('code');
    if (!code) return null;
    return verifyInviteCode(code) ? code.toUpperCase() : null;
  } catch (err) {
    logger.warn('parse invite link failed', err);
    // fallback：正则提取 code= 后面的 6 位
    const match = link.match(/code=([A-Za-z0-9]{6})/);
    if (match && verifyInviteCode(match[1])) {
      return match[1].toUpperCase();
    }
    return null;
  }
}

// ========== 内部工具 ==========

function persistInviteCode(code: string, expiresAt: number | null): void {
  const upper = code.toUpperCase();
  localStorage.setItem(LS_CODE_KEY, upper);
  if (expiresAt === null) {
    localStorage.removeItem(LS_EXPIRY_KEY);
  } else {
    localStorage.setItem(LS_EXPIRY_KEY, String(expiresAt));
  }

  // 同步到 profile
  try {
    const profile = getProfile();
    if (profile) {
      setProfile({
        ...profile,
        // @ts-expect-error inviteCode 是运行时扩展字段
        inviteCode: upper,
      });
    }
  } catch (err) {
    logger.warn('sync invite code to profile failed', err);
  }
}
