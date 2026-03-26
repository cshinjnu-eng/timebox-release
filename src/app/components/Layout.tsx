import { Outlet, NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  Timer,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  Layers,
  Download,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { NewTaskDialog } from "./NewTaskDialog";
import { EndTaskDialog } from "./EndTaskDialog";
import { FloatingWidget } from "./FloatingWidget";

const navItems = [
  { to: "/", label: "仪表盘", icon: LayoutDashboard },
  { to: "/worklog", label: "数据审查", icon: FileText },
  { to: "/timeline", label: "时间轴", icon: GitBranch },
];

function getNow() {
  const now = new Date();
  return now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    tasks,
    showNewTaskDialog,
    setShowNewTaskDialog,
    showEndTaskDialog,
    setShowEndTaskDialog,
    taskToEnd,
    setTaskToEnd,
    showFloatingWidget,
    setShowFloatingWidget,
    exportToCSV,
  } = useApp();

  const runningCount = tasks.filter((t) => t.isRunning).length;
  const totalElapsed = tasks.reduce((sum, t) => sum + t.elapsed, 0);
  const totalHours = Math.floor(totalElapsed / 3600);
  const totalMin = Math.floor((totalElapsed % 3600) / 60);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0B0D14", color: "#E8EAF0" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300 relative z-20"
        style={{
          width: collapsed ? 64 : 220,
          background: "#111318",
          borderRight: "1px solid #252836",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-5 flex-shrink-0"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 32, height: 32, background: "linear-gradient(135deg,#4F7FFF,#A855F7)" }}
          >
            <Layers size={16} color="#fff" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0", letterSpacing: "-0.02em" }}>
                TimeBox
              </span>
              <span style={{ fontSize: 11, color: "#8B8FA8" }}>并行计时工作台</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg transition-all duration-150 ${collapsed ? "px-2 justify-center" : "px-3"} py-2.5`
              }
              style={({ isActive }) => ({
                background: isActive ? "rgba(79,127,255,0.15)" : "transparent",
                color: isActive ? "#4F7FFF" : "#8B8FA8",
              })}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span style={{ fontSize: 14 }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Stats */}
        {!collapsed && (
          <div className="px-3 py-3 mx-2 mb-2 rounded-lg" style={{ background: "#1A1D29", border: "1px solid #252836" }}>
            <div className="flex items-center gap-2 mb-2">
              <Timer size={13} style={{ color: "#4F7FFF" }} />
              <span style={{ fontSize: 11, color: "#8B8FA8" }}>今日计时</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#E8EAF0", fontFamily: "monospace", letterSpacing: "0.02em" }}>
              {String(totalHours).padStart(2, "0")}:{String(totalMin).padStart(2, "0")}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span
                className="rounded-full"
                style={{ width: 6, height: 6, background: runningCount > 0 ? "#10B981" : "#8B8FA8", display: "inline-block" }}
              />
              <span style={{ fontSize: 11, color: "#8B8FA8" }}>{runningCount} 个计时进行中</span>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="px-2 pb-4 flex flex-col gap-1" style={{ borderTop: "1px solid #252836" }}>
          <div className="pt-3 flex flex-col gap-1">
            <button
              onClick={() => setShowFloatingWidget(!showFloatingWidget)}
              className="flex items-center gap-3 rounded-lg py-2.5 transition-colors"
              style={{
                paddingLeft: collapsed ? 8 : 12,
                paddingRight: collapsed ? 8 : 12,
                justifyContent: collapsed ? "center" : "flex-start",
                color: showFloatingWidget ? "#4F7FFF" : "#8B8FA8",
              }}
              title={collapsed ? "悬浮窗" : undefined}
            >
              <Bell size={17} />
              {!collapsed && <span style={{ fontSize: 14 }}>悬浮窗</span>}
            </button>
            <button
              className="flex items-center gap-3 rounded-lg py-2.5 transition-colors"
              style={{
                paddingLeft: collapsed ? 8 : 12,
                paddingRight: collapsed ? 8 : 12,
                justifyContent: collapsed ? "center" : "flex-start",
                color: "#8B8FA8",
              }}
              title={collapsed ? "设置" : undefined}
            >
              <Settings size={17} />
              {!collapsed && <span style={{ fontSize: 14 }}>设置</span>}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-3 rounded-lg py-2.5 transition-colors"
              style={{
                paddingLeft: collapsed ? 8 : 12,
                paddingRight: collapsed ? 8 : 12,
                justifyContent: collapsed ? "center" : "flex-start",
                color: "#10B981",
              }}
              title={collapsed ? "导出 CSV" : undefined}
            >
              <Download size={17} />
              {!collapsed && <span style={{ fontSize: 14 }}>导出 CSV</span>}
            </button>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 flex items-center justify-center rounded-full transition-colors"
          style={{
            width: 24,
            height: 24,
            background: "#1A1D29",
            border: "1px solid #252836",
            color: "#8B8FA8",
            zIndex: 10,
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 56,
            borderBottom: "1px solid #252836",
            background: "#111318",
          }}
        >
          <div style={{ fontSize: 13, color: "#8B8FA8" }}>{getNow()}</div>
          <button
            onClick={() => setShowNewTaskDialog(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={15} />
            新建任务
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Modals */}
      {showNewTaskDialog && <NewTaskDialog />}
      {showEndTaskDialog && taskToEnd && <EndTaskDialog />}

      {/* Floating widget */}
      {showFloatingWidget && <FloatingWidget />}
    </div>
  );
}
