export const APP_CONFIG = {
  amapKey: 'b1128ed68cbe06206648c9d444e94397',
  amapSecurityCode: '1cbfe581ba5cd2391d45f9b0d5e5325b',
  weatherKey: 'b1128ed68cbe06206648c9d444e94397',
  wsUrl: '',
  locationUpdateInterval: 5000,
  trajectoryRetentionDays: 7,
  inviteCodeLength: 6,
  defaultNickname: '新朋友',
} as const;

export type AppConfig = typeof APP_CONFIG;
