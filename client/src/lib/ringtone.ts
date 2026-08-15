import { logger } from '@lark-apaas/client-toolkit/logger';

/**
 * RingtonePlayer — Web Audio API 合成电话铃声
 * 双音节奏：1秒响 + 0.5秒停 + 1秒响 + 2秒停（循环）
 * 频率：800Hz + 1000Hz
 */
class RingtonePlayerClass {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ringTimer: number | null = null;
  private vibrateTimer: number | null = null;
  private isPlaying = false;
  private volume = 0.5;

  private getCtx(): AudioContext {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  /** 播放一组双音 beep */
  private playBeep(startAt: number, duration: number): void {
    const ctx = this.getCtx();
    if (!this.masterGain) return;

    const freqs: number[] = [800, 1000];
    for (const freq of freqs) {
      const osc: OscillatorNode = ctx.createOscillator();
      const gain: GainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // 短渐入渐出避免爆音
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.5, startAt + 0.03);
      gain.gain.setValueAtTime(0.5, startAt + duration - 0.03);
      gain.gain.linearRampToValueAtTime(0, startAt + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
    }
  }

  /** 播放一轮铃声模式：响-停-响-停 */
  private playPattern(): void {
    const ctx = this.getCtx();
    const now: number = ctx.currentTime;
    this.playBeep(now, 1.0);         // 1 秒响
    this.playBeep(now + 1.5, 1.0);   // 停 0.5s 后再响 1s
    // 之后停 2s 再由 interval 触发下一轮
  }

  /** 震动一轮 */
  private vibratePattern(): void {
    if (!navigator.vibrate) return;
    try {
      // 500ms 震 + 200ms 停 + 500ms 震 + 500ms 停
      navigator.vibrate([500, 200, 500, 500]);
    } catch (err) {
      logger.error('vibrate failed', String(err));
    }
  }

  /** 开始播放铃声（含渐入） */
  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const ctx = this.getCtx();

      // 全局音量渐入：从 0 到目标音量
      if (this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 1.5);
      }

      // 立即播放一轮，再按节奏循环
      this.playPattern();
      this.vibratePattern();

      // 一轮总时长：1 + 0.5 + 1 + 2 = 4.5 秒
      const cycleMs = 4500;
      this.ringTimer = window.setInterval(() => {
        if (!this.isPlaying) return;
        this.playPattern();
        this.vibratePattern();
      }, cycleMs);
    } catch (err) {
      logger.error('ringtone play failed', String(err));
      this.isPlaying = false;
    }
  }

  /** 停止铃声（含渐出） */
  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    try {
      if (this.ringTimer !== null) {
        clearInterval(this.ringTimer);
        this.ringTimer = null;
      }
      if (this.vibrateTimer !== null) {
        clearInterval(this.vibrateTimer);
        this.vibrateTimer = null;
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(0); } catch { /* ignore */ }
      }

      // 音量渐出
      if (this.audioCtx && this.masterGain) {
        const ctx = this.audioCtx;
        const now: number = ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + 0.2);
      }
    } catch (err) {
      logger.error('ringtone stop failed', String(err));
    }
  }

  /** 设置音量（0-1） */
  setVolume(vol: number): void {
    const clamped: number = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.linearRampToValueAtTime(
        clamped,
        this.audioCtx.currentTime + 0.1,
      );
    }
  }

  /** 是否正在播放 */
  get playing(): boolean {
    return this.isPlaying;
  }
}

export const RingtonePlayer: RingtonePlayerClass = new RingtonePlayerClass();

// 兼容旧接口
export function playRingtone(): void {
  RingtonePlayer.play();
}

export function stopRingtone(): void {
  RingtonePlayer.stop();
}

export function startVibration(): void {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate([500, 200, 500, 500]);
  } catch (err) {
    logger.error('vibration failed', String(err));
  }
}

export function stopVibration(): void {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(0);
  } catch (err) {
    logger.error('stop vibration failed', String(err));
  }
}
