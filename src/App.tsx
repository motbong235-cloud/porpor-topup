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
import ChatAdmin from "./pages/admin/ChatAdmin";

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

const PUBLIC_FIRST = new Set(["", "game", "orders", "track", "success", "support", "reseller", "legal"]);

function pathLooksAdmin(pathname) {
  const seg = String(pathname || "").split("/").filter(Boolean)[0] || "";
  if (!seg) return false;
  if (PUBLIC_FIRST.has(seg)) return false;
  // private admin path, legacy aliases, or any non-public first segment
  return true;
}

export default function App() {
  const location = useLocation();
  const path = location.pathname;
  const boot = readBootAdminPath();
  // If user already opened /porpor-panel-06 (or current ADMIN_PATH), use it immediately — no blank wait
  const fromUrl = (() => {
    const seg = path.split("/").filter(Boolean)[0] || "";
    if (seg === "pp-console" || seg === "admin") return boot;
    if (seg && !PUBLIC_FIRST.has(seg)) return seg;
    return boot;
  })();
  const [adminPath, setAdminPath] = useState(fromUrl);
  const [adminPathReady, setAdminPathReady] = useState(true); // show UI immediately; refine path in background

  // Confirm private path from server (short timeout — never block the page)
  useEffect(() => {
    let alive = true;
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ac?.abort?.(), 2500);
    fetch("/api/public-config", { signal: ac?.signal, credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.adminPath) return;
        const p = String(d.adminPath).replace(/^\/+|\/+$/g, "") || "pp-console";
        if (typeof window !== "undefined") window.__ADMIN_PATH__ = p;
        setAdminPath(p);
        try {
          sessionStorage.setItem("pp_admin_path", p);
        } catch {}
      })
      .catch(() => {
        try {
          const saved = sessionStorage.getItem("pp_admin_path");
          if (saved) setAdminPath(saved.replace(/^\/+|\/+$/g, ""));
        } catch {}
      })
      .finally(() => {
        clearTimeout(timer);
        if (alive) setAdminPathReady(true);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      ac?.abort?.();
    };
  }, []);

  const isAdminRoute =
    path === `/${adminPath}` ||
    path.startsWith(`/${adminPath}/`) ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/pp-console" ||
    path.startsWith("/pp-console/") ||
    pathLooksAdmin(path);

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

  // FIX: if the URL is not a known public page and the real admin path has not loaded yet,
  // do NOT fall through to the public "*" route (it redirects to "/" before the admin path is known).
  const isKnownPublic =
    path === "/" ||
    /^\/(game|orders|track|success|support|reseller|legal)(\/|$)/.test(path);
  if (!adminPathReady && !isAdminRoute && !isKnownPublic) {
    return (
      <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", color: "#64748b" }}>
        កំពុងផ្ទុក…
      </div>
    );
  }

  if (isAdminRoute) {
    return (
      <Routes>
        <Route path={`/${adminPath}`} element={<AdminLayout adminPath={adminPath} />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="services" element={<ServicesAdmin />} />
          <Route path="chat" element={<ChatAdmin />} />
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
