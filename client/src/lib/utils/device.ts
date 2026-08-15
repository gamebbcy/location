export function parseDeviceModel(ua?: string): string {
  const userAgent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // iPhone
  const iphoneMatch = userAgent.match(/iPhone\s*([\d,]+)/i);
  if (iphoneMatch) {
    return `iPhone ${iphoneMatch[1].replace(',', ' ')}`;
  }

  // iPad
  if (/iPad/i.test(userAgent)) return 'iPad';

  // Android / Pixel / Samsung
  const pixelMatch = userAgent.match(/Pixel\s*(\d+(?:\s*Pro)?)/i);
  if (pixelMatch) return `Pixel ${pixelMatch[1]}`;

  const samsungMatch = userAgent.match(/SM-([A-Z0-9]+)/i);
  if (samsungMatch) return `Galaxy ${samsungMatch[1]}`;

  const androidMatch = userAgent.match(/Android\s+([\d.]+)/i);
  if (androidMatch) return `Android ${androidMatch[1]}`;

  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS 设备';
  if (/Android/i.test(userAgent)) return 'Android 设备';

  return '未知设备';
}

export function parseOS(ua?: string): 'ios' | 'android' | 'other' {
  const userAgent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

export function getNetworkType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  if (!conn) return 'unknown';
  const effectiveType: string = conn.effectiveType || 'unknown';
  // NetworkInformation 提供 effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
  // 简单映射，wifi 需通过 rtt/downlink 推断或直接返回 effectiveType
  if (effectiveType === '4g' && conn.downlink >= 10) return 'wifi';
  if (effectiveType === '5g') return '5g';
  return effectiveType || 'unknown';
}

interface BatteryInfo {
  level: number;
  charging: boolean;
}

export async function getBattery(): Promise<BatteryInfo> {
  const nav = navigator as any;
  if (nav.getBattery) {
    try {
      const battery = await nav.getBattery();
      return {
        level: battery.level,
        charging: battery.charging,
      };
    } catch {
      // fallthrough
    }
  }
  return { level: 1, charging: false };
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}
