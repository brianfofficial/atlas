/**
 * Weather API Client
 *
 * Integration with OpenWeatherMap API for current conditions and forecasts.
 */

import { apiGet, apiPost } from './client'

const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5'

export interface WeatherCondition {
  id: number
  main: string
  description: string
  icon: string
}

export interface CurrentWeather {
  location: string
  country: string
  temperature: number
  feelsLike: number
  humidity: number
  pressure: number
  windSpeed: number
  windDirection: number
  visibility: number
  clouds: number
  condition: WeatherCondition
  sunrise: Date
  sunset: Date
  updatedAt: Date
}

export interface DailyForecast {
  date: Date
  high: number
  low: number
  humidity: number
  condition: WeatherCondition
  pop: number // probability of precipitation
  rain?: number
  snow?: number
}

export interface WeatherAlert {
  event: string
  sender: string
  start: Date
  end: Date
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface WeatherData {
  current: CurrentWeather
  forecast: DailyForecast[]
  alerts: WeatherAlert[]
}

/**
 * Get weather by coordinates
 */
export async function getWeatherByCoords(
  lat: number,
  lon: number
): Promise<WeatherData> {
  // If we have an API key, call OpenWeatherMap directly
  if (OPENWEATHER_API_KEY) {
    return fetchOpenWeatherData(lat, lon)
  }

  // Otherwise, use our backend proxy
  return apiGet<WeatherData>(`/api/integrations/weather?lat=${lat}&lon=${lon}`)
}

/**
 * Get weather by city name
 */
export async function getWeatherByCity(city: string): Promise<WeatherData> {
  if (OPENWEATHER_API_KEY) {
    // First geocode the city
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_API_KEY}`
    const geoResponse = await fetch(geoUrl)
    const geoData = await geoResponse.json()

    if (!geoData.length) {
      throw new Error(`City not found: ${city}`)
    }

    return fetchOpenWeatherData(geoData[0].lat, geoData[0].lon)
  }

  return apiGet<WeatherData>(`/api/integrations/weather?city=${encodeURIComponent(city)}`)
}

/**
 * Get weather for user's current location
 */
export async function getWeatherForCurrentLocation(): Promise<WeatherData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await getWeatherByCoords(
            position.coords.latitude,
            position.coords.longitude
          )
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`))
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  })
}

/**
 * Save weather preferences
 */
export async function saveWeatherPreferences(prefs: {
  defaultLocation?: string
  units?: 'metric' | 'imperial'
}): Promise<void> {
  return apiPost('/api/integrations/weather/preferences', prefs)
}

// Internal helper to fetch from OpenWeatherMap
async function fetchOpenWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const url = `${OPENWEATHER_BASE}/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&units=imperial&appid=${OPENWEATHER_API_KEY}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`)
  }

  const data = await response.json()

  // Transform OpenWeatherMap response to our format
  return {
    current: {
      location: data.timezone.split('/').pop()?.replace(/_/g, ' ') || 'Unknown',
      country: '',
      temperature: data.current.temp,
      feelsLike: data.current.feels_like,
      humidity: data.current.humidity,
      pressure: data.current.pressure,
      windSpeed: data.current.wind_speed,
      windDirection: data.current.wind_deg,
      visibility: data.current.visibility,
      clouds: data.current.clouds,
      condition: data.current.weather[0],
      sunrise: new Date(data.current.sunrise * 1000),
      sunset: new Date(data.current.sunset * 1000),
      updatedAt: new Date(data.current.dt * 1000),
    },
    forecast: data.daily.slice(0, 7).map((day: any) => ({
      date: new Date(day.dt * 1000),
      high: day.temp.max,
      low: day.temp.min,
      humidity: day.humidity,
      condition: day.weather[0],
      pop: day.pop,
      rain: day.rain,
      snow: day.snow,
    })),
    alerts: (data.alerts || []).map((alert: any) => ({
      event: alert.event,
      sender: alert.sender_name,
      start: new Date(alert.start * 1000),
      end: new Date(alert.end * 1000),
      description: alert.description,
      severity: classifyAlertSeverity(alert.event),
    })),
  }
}

function classifyAlertSeverity(event: string): 'low' | 'medium' | 'high' {
  const lowEvents = ['wind advisory', 'frost advisory', 'heat advisory']
  const highEvents = ['tornado', 'hurricane', 'severe thunderstorm', 'flash flood', 'blizzard']

  const eventLower = event.toLowerCase()

  if (highEvents.some((e) => eventLower.includes(e))) return 'high'
  if (lowEvents.some((e) => eventLower.includes(e))) return 'low'
  return 'medium'
}

/**
 * Get weather icon URL
 */
export function getWeatherIconUrl(iconCode: string, size: '1x' | '2x' | '4x' = '2x'): string {
  return `https://openweathermap.org/img/wn/${iconCode}@${size}.png`
}

/**
 * Convert weather condition to emoji
 */
export function getWeatherEmoji(condition: string): string {
  const map: Record<string, string> = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌦️',
    Thunderstorm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️',
    Fog: '🌫️',
    Haze: '🌫️',
    Smoke: '💨',
    Dust: '💨',
    Sand: '💨',
    Ash: '🌋',
    Squall: '💨',
    Tornado: '🌪️',
  }

  return map[condition] || '🌡️'
}
