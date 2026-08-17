export const APP_CONFIG = {
  amapKey: import.meta.env.VITE_AMAP_KEY ?? '',
  amapSecurityCode: import.meta.env.VITE_AMAP_SECURITY_CODE ?? '',
  weatherKey: import.meta.env.VITE_WEATHER_KEY ?? '',
  locationUpdateInterval: 5000,
  trajectoryRetentionDays: 7,
  inviteCodeLength: 6,
  defaultNickname: '新朋友',
} as const;

export type AppConfig = typeof APP_CONFIG;
