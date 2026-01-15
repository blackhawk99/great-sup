import React from "react";
import ReactDOM from "react-dom/client";
// @ts-ignore - Suppress TypeScript error about default export
import App from "./App.jsx";
import "./index.css";
// Initialize i18n for internationalization
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
