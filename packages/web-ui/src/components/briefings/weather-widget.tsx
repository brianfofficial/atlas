'use client'

import { useState, useEffect } from 'react'
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface WeatherData {
  location: string
  current: {
    temp: number
    feelsLike: number
    condition: string
    humidity: number
    windSpeed: number
    icon: string
  }
  today: {
    high: number
    low: number
  }
  forecast: Array<{
    day: string
    high: number
    low: number
    condition: string
  }>
  alerts?: Array<{
    title: string
    severity: 'low' | 'medium' | 'high'
  }>
}

interface WeatherWidgetProps {
  className?: string
  data?: WeatherData
  isLoading?: boolean
  onRefresh?: () => void
}

export function WeatherWidget({
  className,
  data,
  isLoading,
  onRefresh,
}: WeatherWidgetProps) {
  const WeatherIcon = getWeatherIcon(data?.current?.condition)

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Weather data unavailable</p>
            {onRefresh && (
              <Button variant="link" size="sm" onClick={onRefresh} className="mt-2">
                Try again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            {data.location}
          </CardTitle>
          {onRefresh && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current conditions */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <WeatherIcon className="h-10 w-10 text-primary" />
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{Math.round(data.current.temp)}°</span>
              <span className="text-muted-foreground mb-1 capitalize">
                {data.current.condition}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Feels like {Math.round(data.current.feelsLike)}°
            </p>
          </div>
        </div>

        {/* Today's details */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <Thermometer className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">High / Low</p>
            <p className="font-medium text-sm">
              {Math.round(data.today.high)}° / {Math.round(data.today.low)}°
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <Droplets className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Humidity</p>
            <p className="font-medium text-sm">{data.current.humidity}%</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <Wind className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Wind</p>
            <p className="font-medium text-sm">{Math.round(data.current.windSpeed)} mph</p>
          </div>
        </div>

        {/* Alerts */}
        {data.alerts && data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.map((alert, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg text-sm',
                  alert.severity === 'high'
                    ? 'bg-danger/10 text-danger'
                    : alert.severity === 'medium'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">{alert.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* 3-day forecast */}
        {data.forecast && data.forecast.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">3-Day Forecast</p>
            <div className="grid grid-cols-3 gap-2">
              {data.forecast.slice(0, 3).map((day, index) => {
                const DayIcon = getWeatherIcon(day.condition)
                return (
                  <div key={index} className="text-center">
                    <p className="text-xs font-medium">{day.day}</p>
                    <DayIcon className="h-5 w-5 mx-auto my-1 text-muted-foreground" />
                    <p className="text-xs">
                      {Math.round(day.high)}° / {Math.round(day.low)}°
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getWeatherIcon(condition?: string) {
  const c = condition?.toLowerCase() || ''
  if (c.includes('sun') || c.includes('clear')) return Sun
  if (c.includes('rain')) return CloudRain
  if (c.includes('snow')) return CloudSnow
  if (c.includes('thunder') || c.includes('lightning')) return CloudLightning
  if (c.includes('wind')) return Wind
  return Cloud
}

// Hook for fetching weather data
export function useWeather(location?: string) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Import the weather API client dynamically to avoid circular deps
      const { getWeatherByCity, getWeatherForCurrentLocation } = await import('@/lib/api/weather')

      let weatherData
      if (location) {
        weatherData = await getWeatherByCity(location)
      } else {
        try {
          // Try to get weather for current location
          weatherData = await getWeatherForCurrentLocation()
        } catch {
          // Fall back to a default city if geolocation fails
          weatherData = await getWeatherByCity('New York')
        }
      }

      // Transform API response to widget format
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      setData({
        location: weatherData.current.location,
        current: {
          temp: weatherData.current.temperature,
          feelsLike: weatherData.current.feelsLike,
          condition: weatherData.current.condition.main,
          humidity: weatherData.current.humidity,
          windSpeed: weatherData.current.windSpeed,
          icon: weatherData.current.condition.icon,
        },
        today: {
          high: weatherData.forecast[0]?.high ?? weatherData.current.temperature + 5,
          low: weatherData.forecast[0]?.low ?? weatherData.current.temperature - 10,
        },
        forecast: weatherData.forecast.slice(1, 4).map((day) => ({
          day: dayNames[day.date.getDay()],
          high: day.high,
          low: day.low,
          condition: day.condition.main.toLowerCase(),
        })),
        alerts: weatherData.alerts?.map((alert) => ({
          title: alert.event,
          severity: alert.severity,
        })),
      })
    } catch (err) {
      console.error('Weather fetch error:', err)
      setError('Failed to load weather data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [location])

  return { data, isLoading, error, refresh: fetchWeather }
}
