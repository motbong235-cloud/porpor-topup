import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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

function readBootAdminPath() {
  if (typeof window === "undefined") return "pp-console";
  if (window.__ADMIN_PATH__) return String(window.__ADMIN_PATH__).replace(/^\/+|\/+$/g, "") || "pp-console";
  return "pp-console";
}

/** Map /admin/orders → /{adminPath}/orders */
function AdminLegacyRedirect({ adminPath }) {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/admin\/?/, "");
  const to = rest ? `/${adminPath}/${rest}` : `/${adminPath}`;
  return <Navigate to={to} replace />;
}

/** Map /pp-console/... → /{adminPath}/... */
function PpConsoleRedirect({ adminPath }) {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/pp-console\/?/, "");
  const to = rest ? `/${adminPath}/${rest}` : `/${adminPath}`;
  return <Navigate to={to} replace />;
}

export default function App() {
  const location = useLocation();
  const [adminPath, setAdminPath] = useState(readBootAdminPath);
  const [adminPathReady, setAdminPathReady] = useState(!!(typeof window !== "undefined" && window.__ADMIN_PATH__));

  // Always confirm private path from server (fixes mismatch when env ADMIN_PATH ≠ default)
  useEffect(() => {
    let alive = true;
    fetch("/api/public-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.adminPath) return;
        const p = String(d.adminPath).replace(/^\/+|\/+$/g, "") || "pp-console";
        if (typeof window !== "undefined") window.__ADMIN_PATH__ = p;
        setAdminPath(p);
      })
      .catch(() => {})
      .finally(() => alive && setAdminPathReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const path = location.pathname;
  const isAdminRoute =
    path === `/${adminPath}` ||
    path.startsWith(`/${adminPath}/`) ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/pp-console" ||
    path.startsWith("/pp-console/");

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

  // If user opened /pp-console but real path is different → redirect once ready
  useEffect(() => {
    if (!adminPathReady) return;
    if (adminPath === "pp-console") return;
    if (path === "/pp-console" || path.startsWith("/pp-console/")) {
      const rest = path.replace(/^\/pp-console\/?/, "");
      const to = rest ? `/${adminPath}/${rest}` : `/${adminPath}`;
      if (to !== path) window.location.replace(to);
    }
  }, [adminPathReady, adminPath, path]);

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

  if (isAdminRoute) {
    // Wait for real path so we do not mount wrong routes
    if (!adminPathReady) {
      return (
        <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", color: "#64748b" }}>
          Loading admin…
        </div>
      );
    }
    return (
      <Routes>
        <Route path={`/${adminPath}`} element={<AdminLayout adminPath={adminPath} />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="services" element={<ServicesAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="*" element={<Navigate to={`/${adminPath}`} replace />} />
        </Route>
        <Route path="/admin/*" element={<AdminLegacyRedirect adminPath={adminPath} />} />
        <Route path="/admin" element={<Navigate to={`/${adminPath}`} replace />} />
        <Route path="/pp-console/*" element={<PpConsoleRedirect adminPath={adminPath} />} />
        <Route path="/pp-console" element={<Navigate to={`/${adminPath}`} replace />} />
        <Route path="*" element={<Navigate to={`/${adminPath}`} replace />} />
      </Routes>
    );
  }

  return (
    <Shell lang={lang} theme={theme} setLang={setLang} setTheme={setTheme} settings={remoteSettings}>
      <Routes>
        <Route path="/" element={<Home lang={lang} settings={remoteSettings} />} />
        <Route path="/game/:id" element={<Game lang={lang} addOrder={addOrder} settings={remoteSettings} />} />
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
