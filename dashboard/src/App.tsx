import { Routes, Route, NavLink } from "react-router-dom";
import ServersPage from "./pages/Servers.tsx";
import ToolsPage from "./pages/Tools.tsx";
import TesterPage from "./pages/Tester.tsx";
import IntegrationsPage from "./pages/Integrations.tsx";

export default function App() {
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">
            <span className="text-indigo-400 font-bold text-lg mr-4">
              MCP Hub
            </span>
            <NavLink to="/" end className={navCls}>
              Servers
            </NavLink>
            <NavLink to="/tools" className={navCls}>
              Tools
            </NavLink>
            <NavLink to="/tester" className={navCls}>
              Tester
            </NavLink>
            <NavLink to="/integrations" className={navCls}>
              Integrations
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ServersPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/tester" element={<TesterPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
        </Routes>
      </main>
    </div>
  );
}
