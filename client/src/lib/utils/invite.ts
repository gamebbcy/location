import { logger } from '@lark-apaas/client-toolkit/logger';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';

const INVITE_CODE_PATTERN = /^[A-F0-9]{6}$/i;

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

/**
 * 只校验 Supabase RPC 生成的邀请码格式；有效期和使用状态由服务端校验。
 */
export function verifyInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code.trim());
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
