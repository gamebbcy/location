import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  Loader2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { APP_CONFIG } from '@client/src/config';

interface WeatherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationName: string;
  lat?: number;
  lng?: number;
}

interface WeatherInfo {
  temp: number;
  condition: string;
  wind: string;
  humidity: number;
  feelsLike: number;
  high: number;
  low: number;
  aqi: number;
  aqiLabel: string;
}

// Mock weather data for when no API key or on error
function getMockWeather(baseTemp = 26): WeatherInfo {
  return {
    temp: baseTemp,
    condition: '多云',
    wind: '东南风 3级',
    humidity: 65,
    feelsLike: baseTemp + 2,
    high: baseTemp + 4,
    low: baseTemp - 4,
    aqi: 58,
    aqiLabel: '良',
  };
}

// 高德地图天气 API
async function fetchRealWeather(
  lat: number,
  lng: number,
): Promise<WeatherInfo> {
  const key = APP_CONFIG.weatherKey || APP_CONFIG.amapKey;
  if (!key) throw new Error('no weather key');

  const url = `https://restapi.amap.com/v3/weather/weatherInfo?city=${lng.toFixed(4)},${lat.toFixed(4)}&key=${encodeURIComponent(key)}&extensions=all`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== '1' || !data.forecasts?.[0]?.casts?.[0]) {
    throw new Error(data.info || 'weather api error');
  }

  const cast = data.forecasts[0].casts[0];
  const dayweather = cast.dayweather || '';
  const nightweather = cast.nightweather || '';
  const condition = dayweather || nightweather || '晴';
  const daytemp = Number(cast.daytemp);
  const nighttemp = Number(cast.nighttemp);
  const high = Math.max(daytemp, nighttemp);
  const low = Math.min(daytemp, nighttemp);
  const temp = Math.round((high + low) / 2);

  return {
    temp,
    condition,
    wind: `${cast.daywind || '无'}风 ${cast.daypower || ''}级`,
    humidity: Number(cast.daytemp) || 50,
    feelsLike: temp,
    high,
    low,
    aqi: 0,
    aqiLabel: '-',
  };
}

const WeatherDialog: React.FC<WeatherDialogProps> = ({
  open,
  onOpenChange,
  locationName,
  lat,
  lng,
}) => {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    if (APP_CONFIG.weatherKey && lat !== undefined && lng !== undefined) {
      fetchRealWeather(lat, lng)
        .then((data) => {
          setWeather(data);
        })
        .catch((err: unknown) => {
          logger.warn('WeatherDialog: fetch weather failed, fall back to mock', err);
          setWeather(getMockWeather());
          setError('天气信息暂不可用，显示模拟数据');
        })
        .finally(() => setLoading(false));
    } else {
      // No key — mock
      setTimeout(() => {
        setWeather(getMockWeather());
        setLoading(false);
        if (!APP_CONFIG.weatherKey) {
          setError('天气数据为模拟展示，配置天气 Key 后获取实时数据');
        }
      }, 300);
    }
  }, [open, lat, lng]);

  const isSunny = weather?.condition.includes('晴');
  const isRainy = weather?.condition.includes('雨');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden max-w-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent to-transparent pointer-events-none" />
        <DialogHeader className="relative">
          <DialogTitle className="text-base text-muted-foreground font-normal">
            {locationName}
          </DialogTitle>
          <DialogDescription className="sr-only">天气信息</DialogDescription>
        </DialogHeader>
        <div className="relative">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {!loading && weather && (
            <>
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  {isRainy ? (
                    <CloudRain className="size-16 text-blue-400" />
                  ) : isSunny ? (
                    <Sun className="size-16 text-amber-500" />
                  ) : (
                    <Cloud className="size-16 text-slate-400" />
                  )}
                  <div>
                    <div className="text-5xl font-light leading-none">
                      {weather.temp}°
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {weather.condition}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">
                    最高 {weather.high}° / 最低 {weather.low}°
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    体感 {weather.feelsLike}°
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t pt-4">
                <div className="flex flex-col items-center gap-1">
                  <Wind className="size-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">风力</span>
                  <span className="text-sm font-medium">{weather.wind}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Droplets className="size-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">湿度</span>
                  <span className="text-sm font-medium">
                    {weather.humidity}%
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Thermometer className="size-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">空气质量</span>
                  <span className="text-sm font-medium">
                    {weather.aqi} {weather.aqiLabel}
                  </span>
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="text-xs text-muted-foreground text-center pt-3">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WeatherDialog;
