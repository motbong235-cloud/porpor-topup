import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

const ADMIN_PATH = (typeof window !== "undefined" && window.__ADMIN_PATH__) || "pp-console";
import { Shell } from "./components/Shell";
import { getPrefs, savePrefs } from "./lib/store";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Orders from "./pages/Orders";
import Track from "./pages/Track";
import Success from "./pages/Success";
import Support from "./pages/Support";
import Reseller from "./pages/Reseller";
import Legal from "./pages/Legal";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import OrdersAdmin from "./pages/admin/OrdersAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import ServicesAdmin from "./pages/admin/ServicesAdmin";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname === `/${ADMIN_PATH}` || location.pathname.startsWith(`/${ADMIN_PATH}/`);
  const initial = getPrefs();
  const [lang, setLangState] = useState(initial.lang);
  const [theme, setThemeState] = useState(initial.theme);
  const [orders, setOrders] = useState(initial.orders);
  const [remoteSettings, setRemoteSettings] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setRemoteSettings(s))
      .catch(() => {});
  }, []);

  function setLang(v) {
    setLangState(v);
    savePrefs({ lang: v });
  }
  function setTheme(v) {
    setThemeState(v);
    savePrefs({ theme: v });
  }
  function addOrder(order) {
    setOrders((prev) => {
      const next = [order, ...prev].slice(0, 40);
      savePrefs({ orders: next });
      return next;
    });
  }

  if (isAdmin) {
    return (
      <Routes>
        <Route path={`/${ADMIN_PATH}`} element={<AdminLayout adminPath={ADMIN_PATH} />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="services" element={<ServicesAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Route>
        <Route path="/admin" element={<Navigate to={`/${ADMIN_PATH}`} replace />} />
        <Route path="/admin/*" element={<Navigate to={`/${ADMIN_PATH}`} replace />} />
        <Route path="*" element={<Navigate to={`/${ADMIN_PATH}`} replace />} />
      </Routes>
    );
  }

  return (
    <Shell lang={lang} theme={theme} setLang={setLang} setTheme={setTheme} settings={remoteSettings}>
      <Routes>
        <Route path="/" element={<Home lang={lang} settings={remoteSettings} />} />
        <Route
          path="/game/:id"
          element={
            <Game lang={lang} addOrder={addOrder} settings={remoteSettings} />
          }
        />
        <Route path="/orders" element={<Orders lang={lang} orders={orders} />} />
        <Route path="/track" element={<Track lang={lang} settings={remoteSettings} />} />
        <Route path="/success" element={<Success lang={lang} settings={remoteSettings} />} />
        <Route path="/support" element={<Support lang={lang} settings={remoteSettings} />} />
        <Route path="/reseller" element={<Reseller lang={lang} settings={remoteSettings} />} />
        <Route path="/legal/:slug" element={<Legal lang={lang} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
