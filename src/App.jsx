import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import FactChecker from "./pages/FactChecker.jsx";
import VideoChecker from "./pages/VideoChecker.jsx";
import VersusMode from "./pages/VersusMode.jsx";
import History from "./pages/History.jsx";
import Settings from "./pages/Settings.jsx";
import Upgrade from "./pages/Upgrade.jsx";
import Login from "./pages/Login.jsx";
import { loadSettings, saveSettings } from "./lib/storage.js";
import { themeAllowed, fetchUsage } from "./lib/plans.js";
import { onAuthChange } from "./lib/auth.js";

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", loadSettings().theme);

    const applyThemeCheck = () => {
      fetchUsage().then(info => {
        if (!info) return;
        const settings = loadSettings();
        if (!themeAllowed(settings.theme, info.plan)) {
          saveSettings({ theme: "paper" });
          document.documentElement.setAttribute("data-theme", "paper");
        }
      }).catch(() => {});
    };
    applyThemeCheck();
    const unsubscribe = onAuthChange(() => applyThemeCheck());
    return unsubscribe;
  }, []);

  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<FactChecker />} />
          <Route path="/video" element={<VideoChecker />} />
          <Route path="/versus" element={<VersusMode />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}
