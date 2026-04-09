import { Outlet, NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  ClipboardList,
  Plus,
  Download,
  Layers,
  BookOpen,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { NewTaskDialog } from "./NewTaskDialog";
import { EndTaskDialog } from "./EndTaskDialog";
import { ManualSessionDialog } from "./ManualSessionDialog";
import { GuideModal } from "./GuideModal";

const navItems = [
  { to: "/", label: "计时", icon: LayoutDashboard },
  { to: "/todo", label: "待办", icon: ClipboardList },
  { to: "/worklog", label: "数据", icon: FileText },
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
  const {
    tasks,
    showNewTaskDialog,
    setShowNewTaskDialog,
    showEndTaskDialog,
    showManualSessionDialog,
    taskToEnd,
    exportToCSV,
  } = useApp();
  const [showGuide, setShowGuide] = useState(false);

  const runningCount = tasks.filter((t) => t.isRunning).length;
  const totalElapsed = tasks
    .filter((t) => t.category === "工作" || t.category === "学习")
    .reduce((sum, t) => sum + t.elapsed, 0);
  const totalHours = Math.floor(totalElapsed / 3600);
  const totalMin = Math.floor((totalElapsed % 3600) / 60);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#0B0D14", color: "#E8EAF0" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: "1px solid #252836",
          background: "#111318",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 28, height: 28, background: "linear-gradient(135deg,#4F7FFF,#A855F7)" }}
          >
            <Layers size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>TimeBox</span>
          {runningCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-md text-xs"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", fontFamily: "monospace" }}
            >
              {runningCount}⏱
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 34, height: 34, color: "#8B8FA8" }}
            title="使用指南"
          >
            <BookOpen size={16} />
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 34, height: 34, color: "#8B8FA8" }}
            title="导出 CSV"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowNewTaskDialog(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            新建
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>

      {/* Bottom Tab Bar */}
      <nav
        className="flex items-stretch flex-shrink-0"
        style={{
          background: "#111318",
          borderTop: "1px solid #252836",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={({ isActive }) => ({
              color: isActive ? "#4F7FFF" : "#525675",
              background: isActive ? "rgba(79,127,255,0.06)" : "transparent",
            })}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Modals */}
      {showNewTaskDialog && <NewTaskDialog />}
      {showEndTaskDialog && taskToEnd && <EndTaskDialog />}
      {showManualSessionDialog && <ManualSessionDialog />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

    </div>
  );
}
