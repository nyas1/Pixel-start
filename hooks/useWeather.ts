import { useState, useEffect, useCallback } from 'react';
import { WeatherData, processWeatherData } from '../utils/weatherUtils';
import { useAppContext } from '../contexts/AppContext';

export const useWeather = () => {
  const { weatherLocation, weatherLocationMode } = useAppContext();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatLocationParts = (geoData: any): { locality: string; state: string } => {
    if (!geoData || typeof geoData !== 'object') return { locality: 'Unknown', state: '' };

    const locality = String(geoData.locality || geoData.localityInfo?.informative?.[0]?.name || geoData.city || '').trim();
    const state = String(geoData.principalSubdivision || '').trim();
    return {
      locality: locality || state || 'Unknown',
      state
    };
  };

  const fetchWeather = useCallback(async (lat: number, lon: number, options: { defaultCity?: string, showError?: boolean } = {}) => {
    const { defaultCity, showError = true } = options;

    try {
      // Parallelize requests
      const geoPromise = (async () => {
        let resolvedLocation = { locality: defaultCity || 'Unknown', state: '' };
        if (!defaultCity) {
          try {
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const geoData = await geoRes.json();
            const formattedLocation = formatLocationParts(geoData);
            if (formattedLocation.locality) resolvedLocation = formattedLocation;
          } catch (e) { /* ignore */ }
        }
        return resolvedLocation;
      })();

      const weatherPromise = fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,visibility&hourly=temperature_2m,weather_code,precipitation_probability&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      );

      const [location, response] = await Promise.all([geoPromise, weatherPromise]);

      if (!response.ok) throw new Error('API Error');

      const result = await response.json();

      // Use the new helper function
      const newData = processWeatherData(location.locality, result, new Date(), location.state);

      setData(newData);
      setLoading(false);
      setError(null);

      // Update Cache
      localStorage.setItem('tui-weather-cache', JSON.stringify(newData));

    } catch (err) {
      console.error(err);
      if (showError) {
        setError("fetch failed");
        setLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("no geo support");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Force show error on retry
        fetchWeather(position.coords.latitude, position.coords.longitude, { showError: true });
      },
      (err: any) => {
        console.error("Geolocation Error:", err);
        setError(err.message || "loc error");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 0 } // Force fresh location on retry
    );
  }, [fetchWeather]);

  useEffect(() => {
    // 1. Try to load from cache
    const cached = localStorage.getItem('tui-weather-cache');
    let hasCache = false;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setData(parsed);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {
        console.error("Weather cache parse error", e);
      }
    }

    // If in manual mode and no coordinates set, don't auto-fetch
    if (weatherLocationMode === 'manual' && (!weatherLocation.latitude || !weatherLocation.longitude)) {
      if (!hasCache) {
        setError("manual mode: set coordinates in weather settings");
        setLoading(false);
      }
      return;
    }

    if (!navigator.geolocation) {
      if (!hasCache) {
        setError("no geo support");
        setLoading(false);
      }
      return;
    }

    // If in manual mode, use stored coordinates; if auto mode, fetch via geolocation
    if (weatherLocationMode === 'manual') {
      if (weatherLocation.latitude && weatherLocation.longitude) {
        fetchWeather(Number(weatherLocation.latitude), Number(weatherLocation.longitude), { showError: true });
      }
      return;
    }

    // Auto mode: fetch via geolocation
    // Delay fetch if we have cache, otherwise fetch immediately
    const delay = hasCache ? 1000 : 0;

    const timer = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude, { showError: !hasCache });
        },
        (err: any) => {
          console.error("Geolocation Error:", err);
          if (!hasCache) {
            setError(err.message || "loc error");
            setLoading(false);
          }
        },
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [fetchWeather, weatherLocationMode, weatherLocation]);


  useEffect(() => {
    // Refetch when location changes in manual mode (e.g. user updates in settings)
    if (weatherLocationMode === 'manual' && weatherLocation.latitude && weatherLocation.longitude && weatherLocation.latitude !== null && weatherLocation.longitude !== null) {
      fetchWeather(Number(weatherLocation.latitude), Number(weatherLocation.longitude), { showError: true });
    }
  }, [weatherLocation, weatherLocationMode, fetchWeather]);

  return { data, loading, error, refetch };
};
