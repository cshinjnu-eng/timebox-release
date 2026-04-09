import { useState } from "react";
import { X, ChevronDown, ChevronRight, BookOpen } from "lucide-react";

interface Section {
  emoji: string;
  title: string;
  content: React.ReactNode;
}

function AccordionSection({ emoji, title, content }: Section) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid #252836", marginBottom: 8 }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: open ? "#1A1D29" : "#161820" }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>{title}</span>
        {open ? (
          <ChevronDown size={14} style={{ color: "#525675", flexShrink: 0 }} />
        ) : (
          <ChevronRight size={14} style={{ color: "#525675", flexShrink: 0 }} />
        )}
      </button>
      {open && (
        <div
          className="px-4 py-3"
          style={{ background: "#0D0E14", borderTop: "1px solid #252836" }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: "#C4C8E0", lineHeight: 1.7, marginBottom: 6 }}>
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2" style={{ marginBottom: 5 }}>
      <span style={{ color: "#4F7FFF", flexShrink: 0, marginTop: 2, fontSize: 10 }}>◆</span>
      <span style={{ fontSize: 13, color: "#C4C8E0", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold mr-1 mb-1"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {children}
    </span>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3" style={{ marginBottom: 8 }}>
      <span
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 20, height: 20, background: "rgba(79,127,255,0.2)", color: "#4F7FFF", fontSize: 11, fontWeight: 700, marginTop: 1 }}
      >
        {n}
      </span>
      <span style={{ fontSize: 13, color: "#C4C8E0", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

const sections: Section[] = [
  {
    emoji: "🧭",
    title: "概览",
    content: (
      <>
        <P>TimeBox 是一个并行任务计时 + 时间记录 + 数据分析工具，帮助你了解时间都去哪了。</P>
        <P>核心理念：先记录，再反思。不强制你改变行为，只是让时间变得可见。</P>
        <div className="flex flex-wrap gap-1 mt-2">
          <Tag color="#4F7FFF">计时</Tag>
          <Tag color="#A855F7">待办</Tag>
          <Tag color="#10B981">数据</Tag>
          <Tag color="#06B6D4">时间轴</Tag>
        </div>
      </>
    ),
  },
  {
    emoji: "▶️",
    title: "开始计时",
    content: (
      <>
        <Step n={1}>点右上角「<b style={{color:"#E8EAF0"}}>新建</b>」按钮</Step>
        <Step n={2}>填写任务名（简短描述你在做什么）</Step>
        <Step n={3}>选<b style={{color:"#E8EAF0"}}>定性标签</b>（必选，5 选 1）：工作 / 学习 / 生活 / 琐事 / 睡觉</Step>
        <Step n={4}>选<b style={{color:"#E8EAF0"}}>评估标签</b>（可选，用于复盘）：必须有意义 / 必须没意义 / 不必须有意义 / 不必须没意义</Step>
        <Step n={5}>可填预计时长（分钟）用于事后对比</Step>
        <Step n={6}>提交后立即开始计时，可同时运行多个任务</Step>
      </>
    ),
  },
  {
    emoji: "⏹️",
    title: "停止任务",
    content: (
      <>
        <P>点任务卡片上的停止按钮（■），弹出结束对话框：</P>
        <Li>可填写「完成感受」，帮助事后复盘</Li>
        <Li>选择<Tag color="#10B981">完成任务</Tag>或<Tag color="#F59E0B">中途放弃</Tag>，区别会在数据页标注</Li>
        <Li>若设置了预计时长，会显示是否超时</Li>
        <P style={{ marginTop: 6 }}>⏸ 点播放/暂停按钮可临时暂停，不影响其他任务。</P>
      </>
    ),
  },
  {
    emoji: "🏷️",
    title: "标签体系",
    content: (
      <>
        <p style={{ fontSize: 12, color: "#8B8FA8", marginBottom: 8, fontWeight: 600 }}>定性标签（时间类型）</p>
        <div className="flex flex-wrap gap-1 mb-4">
          <Tag color="#4F7FFF">工作</Tag>
          <Tag color="#A855F7">学习</Tag>
          <Tag color="#10B981">生活</Tag>
          <Tag color="#F59E0B">琐事</Tag>
          <Tag color="#06B6D4">睡觉</Tag>
        </div>
        <p style={{ fontSize: 12, color: "#8B8FA8", marginBottom: 8, fontWeight: 600 }}>评估标签（事后复盘用）</p>
        <div className="flex flex-wrap gap-1">
          <Tag color="#10B981">必须 / 有意义</Tag>
          <Tag color="#F59E0B">必须 / 没意义</Tag>
          <Tag color="#A855F7">不必须 / 有意义</Tag>
          <Tag color="#EF4444">不必须 / 没意义</Tag>
        </div>
        <P style={{ marginTop: 10 }}>评估标签帮助你分析：哪些时间是被动消耗的（必须但没意义），哪些是主动选择的（不必须但有意义）。</P>
      </>
    ),
  },
  {
    emoji: "📊",
    title: "数据页",
    content: (
      <>
        <Li>顶部统计「学习/工作」总时长（仅统计这两类）</Li>
        <Li>时间分布柱状图：按小时展示，可切换「定性」/「评估」两种配色</Li>
        <Li>支持按日期、分类、关键词筛选</Li>
        <Li>✏️ hover 每条记录可编辑（时间、分类、感受等）</Li>
        <Li>「手动记录」：补录过去的时间段</Li>
        <Li>「日报」：生成当天总结（可分享/复制）</Li>
        <Li>右上角导出 CSV，支持用 Excel 进一步分析</Li>
      </>
    ),
  },
  {
    emoji: "🕐",
    title: "时间轴",
    content: (
      <>
        <P>以 24h 纵轴展示当天任务分布。右侧独立列显示手机屏幕使用时段（需授权使用情况权限）。</P>
        <Li>时间重叠的任务自动并排显示</Li>
        <Li>hover 任务块查看详情</Li>
        <Li>支持按日期切换、按分类过滤</Li>
        <Li>底部显示分类汇总、屏幕使用统计与 App 时间轴</Li>
      </>
    ),
  },
  {
    emoji: "📱",
    title: "悬浮窗（Android）",
    content: (
      <>
        <P>离开 App 后自动出现，显示所有运行中任务的计时。</P>
        <Li>点 header 区域 → 收起 / 展开</Li>
        <Li>点任务区域 → 回到 App</Li>
        <Li>点 ✕ → 停止所有计时</Li>
        <p style={{ fontSize: 12, color: "#F59E0B", marginTop: 8 }}>
          ⚠ 荣耀 / 华为 / 小米设备需在「时间轴 → 屏幕使用」里完成额外权限设置，否则 App 切后台后计时可能被杀。
        </p>
      </>
    ),
  },
  {
    emoji: "✅",
    title: "待办事项",
    content: (
      <>
        <Li>独立于计时任务，用于管理一次性任务</Li>
        <Li>支持高 / 中 / 低优先级，按分类归类</Li>
        <Li>完成情况会计入日报统计</Li>
      </>
    ),
  },
  {
    emoji: "💾",
    title: "数据存储与安全",
    content: (
      <>
        <P>所有数据存储在本地（IndexedDB），不联网，无服务器，隐私安全。</P>
        <Li>支持 CSV 导出备份</Li>
        <Li>「数据页 → 清空所有数据」可重置</Li>
        <Li>重新安装 App 会清空数据，建议定期导出 CSV</Li>
      </>
    ),
  },
];

export function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl flex flex-col"
        style={{ background: "#0D0E14", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #1A1D29" }}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={18} style={{ color: "#4F7FFF" }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>使用指南</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: "#1A1D29", color: "#8B8FA8" }}
          >
            <X size={16} />
          </button>
        </div>
        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {sections.map((s) => (
            <AccordionSection key={s.title} {...s} />
          ))}
          <p
            style={{ fontSize: 11, color: "#525675", textAlign: "center", marginTop: 12, marginBottom: 4 }}
          >
            TimeBox · 本地优先 · 不上传任何数据
          </p>
        </div>
      </div>
    </div>
  );
}
