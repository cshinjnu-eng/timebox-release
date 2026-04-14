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
  Boxes,
  Lightbulb,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { NewTaskDialog } from "./NewTaskDialog";
import { NewLongTaskDialog } from "./NewLongTaskDialog";
import { EndTaskDialog } from "./EndTaskDialog";
import { ManualSessionDialog } from "./ManualSessionDialog";
import { GuideModal } from "./GuideModal";

const navItems = [
  { to: "/", label: "计时", icon: LayoutDashboard },
  { to: "/ideas", label: "点子", icon: Lightbulb },
  { to: "/todo", label: "待办", icon: ClipboardList },
  { to: "/worklog", label: "数据", icon: FileText },
  { to: "/timeline", label: "时间轴", icon: GitBranch },
  { to: "/buckets", label: "应用桶", icon: Boxes },
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
    showNewLongTaskDialog,
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
          borderBottom: "1px solid rgba(37, 40, 54, 0.6)",
          background: "rgba(17, 19, 24, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingTop: "env(safe-area-inset-top)",
          boxShadow: "0 1px 24px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(79, 127, 255, 0.04)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              boxShadow: "0 0 12px rgba(79, 127, 255, 0.3), 0 0 4px rgba(168, 85, 247, 0.2)",
            }}
          >
            <Layers size={14} color="#fff" />
          </div>
          <span
            className="tb-mono"
            style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0", letterSpacing: "-0.01em" }}
          >
            TimeBox
          </span>
          {runningCount > 0 && (
            <span
              className="tb-mono px-1.5 py-0.5 rounded-md text-xs"
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10B981",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                boxShadow: "0 0 8px rgba(16, 185, 129, 0.1)",
              }}
            >
              {runningCount} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 34, height: 34, color: "#525675" }}
            title="使用指南"
          >
            <BookOpen size={16} />
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 34, height: 34, color: "#525675" }}
            title="导出 CSV"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowNewTaskDialog(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 2px 12px rgba(79, 127, 255, 0.25)",
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
          background: "rgba(17, 19, 24, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(37, 40, 54, 0.6)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -1px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all relative"
            style={({ isActive }) => ({
              color: isActive ? "#4F7FFF" : "#525675",
              background: isActive ? "rgba(79, 127, 255, 0.04)" : "transparent",
            })}
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "20%",
                      right: "20%",
                      height: 2,
                      borderRadius: 1,
                      background: "linear-gradient(90deg, transparent, #4F7FFF, transparent)",
                      boxShadow: "0 0 8px rgba(79, 127, 255, 0.4)",
                    }}
                  />
                )}
                <div
                  style={{
                    filter: isActive ? "drop-shadow(0 0 6px rgba(79, 127, 255, 0.4))" : "none",
                    transition: "filter 0.2s ease",
                  }}
                >
                  <Icon size={20} />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: "0.02em",
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Modals */}
      {showNewTaskDialog && <NewTaskDialog />}
      {showNewLongTaskDialog && <NewLongTaskDialog />}
      {showEndTaskDialog && taskToEnd && <EndTaskDialog />}
      {showManualSessionDialog && <ManualSessionDialog />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

    </div>
  );
}
