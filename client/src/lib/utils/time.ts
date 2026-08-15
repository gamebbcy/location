import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

export function formatStayDuration(seconds: number): string {
  if (seconds < 60) return '刚刚';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) {
    return remainMins > 0 ? `${hours}小时${remainMins}分` : `${hours}小时`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
}

export function formatMessageTime(ts: number): string {
  const time = dayjs(ts);
  const now = dayjs();

  if (time.isSame(now, 'day')) {
    return time.format('HH:mm');
  }
  if (time.isSame(now.subtract(1, 'day'), 'day')) {
    return `昨天 ${time.format('HH:mm')}`;
  }
  return time.format('MM-DD');
}

export function getDateKey(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}
