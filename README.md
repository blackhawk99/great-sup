# Great SUP

Great SUP is a React and Tailwind-based web app that helps paddleboarders discover suitable beaches. It fetches weather and marine forecasts from the Open-Meteo API and computes a paddleability score (0–100) for each location. You can add your favourite spots, see wind and wave conditions, and open the beach directly in Google Maps. An integrated FAQ explains how scoring works and how to interpret the data.

On top of the standard Vite setup, [tailwindcss](https://tailwindcss.com/) is installed and ready to be used in React components.

## Features

- Add, edit and remove beaches
- Real-time forecasts for wind, waves and precipitation
- Automatic paddleability scoring with a detailed breakdown
- Greek coastline data with geographic protection analysis
- Built-in FAQ and helpful tips

## Development

Install dependencies and start a dev server:

```bash
npm install
npm run dev
```

To create a production build, run:

```bash
npm run build
```

## Additional references

- [Getting started with Vite](https://vitejs.dev/guide/)
- [Tailwind documentation](https://tailwindcss.com/docs/installation)
