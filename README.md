# Paddleboard Weather Advisor

A web app for planning stand-up paddleboarding sessions at Greek beaches. It combines real-time weather forecasts with local geographic analysis to rate how suitable conditions are for paddling.

## Features

- **Add beaches by URL or manually.** Paste a Google Maps link and the app extracts coordinates automatically. You can also enter latitude and longitude directly.
- **Suggested locations.** Quickly add a list of popular Greek spots with one click.
- **Weather & marine forecast.** Data comes from the [Open‑Meteo](https://open-meteo.com/) API. The app fetches wind, temperature, wave height and more for each beach.
- **Geographic protection scoring.** Custom GIS datasets of the Greek coastline and islands are used to analyse how sheltered each beach is from wind and waves.
- **Paddle score.** All factors are combined into a 0–100 rating so you can easily compare spots. An FAQ explains how the score is calculated.
- **Local storage.** Your beaches and preferred "home" beach are saved in the browser so they appear on your next visit.

## Development

```bash
npm install     # install dependencies
npm run dev     # start Vite in development mode
```

Open `http://localhost:5173` in your browser to view the app.

Run tests with:

```bash
npm test
```

To create a production build:

```bash
npm run build
```

## About the data

Weather and marine forecasts are provided by Open‑Meteo. Geographic protection calculations rely on coastline and island data processed from GADM datasets. Always verify local conditions before heading out.
