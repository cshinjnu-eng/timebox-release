/**
 * CSV 数据导出 — 从 WorkSession 数组生成并下载 CSV 文件
 */

import type { WorkSession } from "../context/AppContext";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDurationForCSV(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h${m}m${s}s`;
}

export function generateCSV(sessions: WorkSession[]): string {
  const headers = [
    "任务名称",
    "定性标签",
    "评估标签",
    "自定义标签",
    "日期",
    "开始时间",
    "结束时间",
    "持续时间",
    "持续时间(秒)",
    "预计时间(分钟)",
    "完成感受",
  ];

  const rows = sessions.map((s) => [
    escapeCSV(s.taskName),
    escapeCSV(s.category),
    escapeCSV(s.evalTag || ""),
    escapeCSV(s.tags.map((t) => `#${t}`).join(" ")),
    escapeCSV(formatDate(s.startTime)),
    escapeCSV(formatTime(s.startTime)),
    escapeCSV(formatTime(s.endTime)),
    escapeCSV(formatDurationForCSV(s.duration)),
    String(s.duration),
    s.estimatedMinutes ? String(s.estimatedMinutes) : "",
    escapeCSV(s.feeling || ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export function downloadCSV(sessions: WorkSession[], filename?: string): void {
  const csv = generateCSV(sessions);
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const content = BOM + csv;
  const defaultName = filename || `TimeBox_导出_${new Date().toISOString().slice(0, 10)}.csv`;

  if (Capacitor.getPlatform() === "android") {
    // Android: Use Filesystem & Share
    (async () => {
      try {
        const result = await Filesystem.writeFile({
          path: defaultName,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        await Share.share({
          title: "导出 TimeBox 数据",
          text: "这里是你的时间记录数据 CSR 文件",
          url: result.uri,
          dialogTitle: "分享 CSV 文件",
        });
      } catch (e) {
        console.error("Android 导出失败", e);
      }
    })();
  } else {
    // Web: Legacy Blob Download
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
