import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import { BackendProvider, useUser } from "./data/store";
import { ToastProvider } from "./components/ui";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Scoreboard from "./pages/Scoreboard";
import Play from "./pages/Play";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/admin/Admin";
import Notifications from "./pages/Notifications";
import Faq from "./pages/Faq";

function Guard({ role, children }: { role: "player" | "admin"; children: React.ReactNode }) {
  const user = useUser();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/password" replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/play"} replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/password" element={<ChangePassword />} />
      <Route path="/scoreboard" element={<Scoreboard />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/play" element={<Guard role="player"><Play /></Guard>} />
      <Route path="/admin/*" element={<Guard role="admin"><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* HashRouter: GitHub Pages has no server-side routing, so URLs look like /ecocypher/#/scoreboard */}
    <HashRouter>
      <BackendProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BackendProvider>
    </HashRouter>
  </React.StrictMode>,
);
