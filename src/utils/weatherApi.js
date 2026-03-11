export const fetchWeeklyWeather = async () => {
  const lat = 40.00;
  const lon = 116.33; // Tsinghua University
  
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&hourly=relative_humidity_2m&timezone=Asia%2FShanghai`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=Asia%2FShanghai`;
    
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl)
    ]);
    
    const weatherData = await weatherRes.json();
    const aqiData = await aqiRes.json();
    
    const days = weatherData.daily.time;
    return days.map((dateStr, index) => {
      // Calculate daily metrics from hourly data where needed
      const dayStartIndex = index * 24;
      const dayEndIndex = dayStartIndex + 24;
      
      const dayHumidity = weatherData.hourly.relative_humidity_2m.slice(dayStartIndex, dayEndIndex);
      const avgHumidity = dayHumidity.length ? Math.round(dayHumidity.reduce((a, b) => a + b, 0) / dayHumidity.length) : 50;
      
      const dayAqi = aqiData.hourly.us_aqi.slice(dayStartIndex, dayEndIndex);
      const startAqis = dayAqi.filter(a => a !== null);
      const maxAqi = startAqis.length > 0 ? Math.max(...startAqis) : 50;

      return {
        date: dateStr,
        weatherCode: weatherData.daily.weather_code[index],
        icon: getWeatherIcon(weatherData.daily.weather_code[index]),
        description: getWeatherDescription(weatherData.daily.weather_code[index]),
        tempMax: weatherData.daily.temperature_2m_max[index],
        tempMin: weatherData.daily.temperature_2m_min[index],
        windSpeed: weatherData.daily.wind_speed_10m_max[index],
        humidity: avgHumidity,
        aqi: maxAqi,
        aqiLabel: getAqiLabel(maxAqi)
      };
    });
  } catch (err) {
    console.error("Weather Fetch Error:", err);
    return [];
  }
};

const getWeatherIcon = (code) => {
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '☁️';
};

const getWeatherDescription = (code) => {
  if (code === 0) return 'Sunny';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

const getAqiLabel = (aqi) => {
  if (aqi <= 50) return { label: 'Good', color: '#10b981' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#7c3aed' };
  return { label: 'Hazardous', color: '#881337' };
};
