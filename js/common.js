// Code shared by every page: footer year, Calgary clock, weather and saving data.

// Calgary weather from Open-Meteo (no API key needed)
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=51.0447&longitude=-114.0719" +
  "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=America/Edmonton";

// Keys used to save data in the browser so a page refresh keeps it
const STORAGE_KEYS = {
  order: "heroBurger.order",
  mazeVoucher: "heroBurger.mazeVoucher",
};

// Maze levels, used by the maze page and the order page.
// Bigger mazes give a bigger discount but fewer extra moves and less time per step.
const MAZE_LEVELS = [
  { name: "Easy", minSize: 5, maxSize: 7, code: "MAZE5", percent: 5, moveFactor: 2, secondsPerStep: 1.5 },
  { name: "Medium", minSize: 8, maxSize: 10, code: "MAZE10", percent: 10, moveFactor: 1.7, secondsPerStep: 1.2 },
  { name: "Hard", minSize: 11, maxSize: 13, code: "MAZE15", percent: 15, moveFactor: 1.5, secondsPerStep: 1 },
  { name: "Expert", minSize: 14, maxSize: 15, code: "MAZE20", percent: 20, moveFactor: 1.3, secondsPerStep: 0.8 },
];

function getMazeLevel(size) {
  return MAZE_LEVELS.find((level) => size >= level.minSize && size <= level.maxSize);
}

// Open-Meteo sends a number for the weather; this turns it into text
const WEATHER_DESCRIPTIONS = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent rain showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm with hail", icon: "⛈️" },
  99: { label: "Thunderstorm with hail", icon: "⛈️" },
};

// localStorage only stores text, so objects are saved as JSON
function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadFromStorage(key, fallbackValue) {
  const storedText = localStorage.getItem(key);
  return storedText === null ? fallbackValue : JSON.parse(storedText);
}

function updateClock() {
  document.getElementById("local-time").textContent = new Date().toLocaleTimeString("en-CA", {
    timeZone: "America/Edmonton",
  });
}

async function loadWeather() {
  const summaryElement = document.getElementById("weather-summary");
  const detailsElement = document.getElementById("weather-details");

  try {
    const response = await fetch(WEATHER_URL);
    const weatherData = await response.json();
    const current = weatherData.current;
    const description = WEATHER_DESCRIPTIONS[current.weather_code] || { label: "Unknown", icon: "🌡️" };

    summaryElement.textContent = `${description.icon} ${Math.round(current.temperature_2m)}°C · ${description.label}`;
    detailsElement.textContent = `Feels like ${Math.round(current.apparent_temperature)}°C · Wind ${Math.round(current.wind_speed_10m)} km/h`;
  } catch (error) {
    summaryElement.textContent = "Weather unavailable right now.";
    detailsElement.textContent = "";
  }
}

document.getElementById("current-year").textContent = new Date().getFullYear();

updateClock();
setInterval(updateClock, 1000);

loadWeather();
setInterval(loadWeather, 15 * 60 * 1000); // refresh every 15 minutes
