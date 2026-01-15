import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts'

interface HourlyCondition {
  time: string
  windSpeed: number | null
  windGusts: number | null
  windDirection: number | null
  waveHeight: number | null
  swellHeight: number | null
  temperature: number | null
  waterTemperature: number | null
  precipitation: number | null
  cloudcover: number | null
  currentSpeed: number | null
}

interface ForecastChartProps {
  data: HourlyCondition[]
  selectedRange?: { startIndex: number; endIndex: number }
  theme?: 'light' | 'dark'
}

// Format time for display
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Format date for tooltip
const formatDate = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          {formatDate(label)} {formatTime(label)}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(1) ?? 'N/A'} {getUnit(entry.dataKey)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Get unit for data key
const getUnit = (dataKey: string): string => {
  const units: Record<string, string> = {
    windSpeed: 'km/h',
    windGusts: 'km/h',
    waveHeight: 'm',
    swellHeight: 'm',
    temperature: '°C',
    waterTemperature: '°C',
    precipitation: 'mm',
    cloudcover: '%',
    currentSpeed: 'm/s',
  }
  return units[dataKey] || ''
}

// Wind and Gusts Chart
export const WindChart: React.FC<ForecastChartProps> = ({ data, selectedRange, theme = 'light' }) => {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      isSelected: selectedRange
        ? index >= selectedRange.startIndex && index <= selectedRange.endIndex
        : false,
    }))
  }, [data, selectedRange])

  const colors = theme === 'dark'
    ? { wind: '#60a5fa', gusts: '#f87171', grid: '#374151', text: '#9ca3af' }
    : { wind: '#3b82f6', gusts: '#ef4444', grid: '#e5e7eb', text: '#6b7280' }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            label={{ value: 'km/h', angle: -90, position: 'insideLeft', fill: colors.text }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="5 5" label="Caution" />
          <Area
            type="monotone"
            dataKey="windGusts"
            name="Wind Gusts"
            fill={colors.gusts}
            fillOpacity={0.2}
            stroke={colors.gusts}
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="windSpeed"
            name="Wind Speed"
            stroke={colors.wind}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Wave Height Chart
export const WaveChart: React.FC<ForecastChartProps> = ({ data, selectedRange, theme = 'light' }) => {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      isSelected: selectedRange
        ? index >= selectedRange.startIndex && index <= selectedRange.endIndex
        : false,
    }))
  }, [data, selectedRange])

  const colors = theme === 'dark'
    ? { waves: '#22d3ee', swell: '#a78bfa', grid: '#374151', text: '#9ca3af' }
    : { waves: '#06b6d4', swell: '#8b5cf6', grid: '#e5e7eb', text: '#6b7280' }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            label={{ value: 'm', angle: -90, position: 'insideLeft', fill: colors.text }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={1.0} stroke="#f59e0b" strokeDasharray="5 5" label="Caution" />
          <Area
            type="monotone"
            dataKey="waveHeight"
            name="Wave Height"
            fill={colors.waves}
            fillOpacity={0.3}
            stroke={colors.waves}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="swellHeight"
            name="Swell Height"
            stroke={colors.swell}
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Temperature Chart
export const TemperatureChart: React.FC<ForecastChartProps> = ({ data, selectedRange, theme = 'light' }) => {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      isSelected: selectedRange
        ? index >= selectedRange.startIndex && index <= selectedRange.endIndex
        : false,
    }))
  }, [data, selectedRange])

  const colors = theme === 'dark'
    ? { air: '#fbbf24', water: '#2dd4bf', grid: '#374151', text: '#9ca3af' }
    : { air: '#f59e0b', water: '#14b8a6', grid: '#e5e7eb', text: '#6b7280' }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            label={{ value: '°C', angle: -90, position: 'insideLeft', fill: colors.text }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={15} stroke="#3b82f6" strokeDasharray="5 5" label="Cold Water" />
          <Line
            type="monotone"
            dataKey="temperature"
            name="Air Temp"
            stroke={colors.air}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="waterTemperature"
            name="Water Temp"
            stroke={colors.water}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Combined Overview Chart
export const OverviewChart: React.FC<ForecastChartProps> = ({ data, selectedRange, theme = 'light' }) => {
  const chartData = useMemo(() => {
    // Normalize data to 0-100 scale for overview
    const maxWind = Math.max(...data.map(d => d.windSpeed ?? 0), 30)
    const maxWave = Math.max(...data.map(d => d.waveHeight ?? 0), 2)

    return data.map((item, index) => ({
      time: item.time,
      windNormalized: ((item.windSpeed ?? 0) / maxWind) * 100,
      waveNormalized: ((item.waveHeight ?? 0) / maxWave) * 100,
      cloudcover: item.cloudcover ?? 0,
      isSelected: selectedRange
        ? index >= selectedRange.startIndex && index <= selectedRange.endIndex
        : false,
    }))
  }, [data, selectedRange])

  const colors = theme === 'dark'
    ? { wind: '#60a5fa', waves: '#22d3ee', clouds: '#9ca3af', grid: '#374151', text: '#9ca3af' }
    : { wind: '#3b82f6', waves: '#06b6d4', clouds: '#6b7280', grid: '#e5e7eb', text: '#6b7280' }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft', fill: colors.text }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length && label) {
                return (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {formatDate(String(label))} {formatTime(String(label))}
                    </p>
                    {payload.map((entry: any, index: number) => (
                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.value?.toFixed(0)}%
                      </p>
                    ))}
                  </div>
                )
              }
              return null
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="cloudcover"
            name="Cloud Cover"
            fill={colors.clouds}
            fillOpacity={0.2}
            stroke={colors.clouds}
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="windNormalized"
            name="Wind (rel.)"
            stroke={colors.wind}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="waveNormalized"
            name="Waves (rel.)"
            stroke={colors.waves}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Main ForecastCharts component that combines all charts
interface ForecastChartsProps extends ForecastChartProps {
  showWind?: boolean
  showWaves?: boolean
  showTemperature?: boolean
  showOverview?: boolean
}

export const ForecastCharts: React.FC<ForecastChartsProps> = ({
  data,
  selectedRange,
  theme = 'light',
  showWind = true,
  showWaves = true,
  showTemperature = true,
  showOverview = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No forecast data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showOverview && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Conditions Overview
          </h3>
          <OverviewChart data={data} selectedRange={selectedRange} theme={theme} />
        </div>
      )}

      {showWind && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Wind Forecast
          </h3>
          <WindChart data={data} selectedRange={selectedRange} theme={theme} />
        </div>
      )}

      {showWaves && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Wave Forecast
          </h3>
          <WaveChart data={data} selectedRange={selectedRange} theme={theme} />
        </div>
      )}

      {showTemperature && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Temperature Forecast
          </h3>
          <TemperatureChart data={data} selectedRange={selectedRange} theme={theme} />
        </div>
      )}
    </div>
  )
}

export default ForecastCharts
