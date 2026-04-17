import { useState } from "react";
import { X, Zap, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { PROVIDERS } from "../services/ai";

export function AISettings() {
  const { aiConfig, updateAIConfig, testAIConnection, setShowAISettings } = useApp();

  const providerConfig = PROVIDERS.dashscope;
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || "");
  const [model, setModel] = useState(aiConfig?.model || "glm-5.1");
  const [autoInsights, setAutoInsights] = useState(aiConfig?.enableAutoInsights || false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    await updateAIConfig({ provider: "dashscope", apiKey, model, enableAutoInsights: autoInsights });
    const result = await testAIConnection();
    setTestResult(result);
    setTesting(false);
  }

  async function handleSave() {
    await updateAIConfig({ provider: "dashscope", apiKey, model, enableAutoInsights: autoInsights });
    setShowAISettings(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowAISettings(false); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="relative rounded-t-2xl flex flex-col"
        style={{
          width: "100%",
          maxHeight: "85vh",
          background: "#161820",
          border: "1px solid #252836",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div>
            <h2 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>
              <Zap size={16} style={{ color: "#F59E0B" }} />
              AI 助手设置
            </h2>
            <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>
              {providerConfig.name} &middot; 支持多模型切换
            </p>
          </div>
          <button
            onClick={() => setShowAISettings(false)}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: "#252836", color: "#8B8FA8" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex-1 flex flex-col gap-5" style={{ overflowY: "auto", minHeight: 0 }}>
          {/* API Key */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              API Key <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder="输入阿里百炼平台的 API Key..."
                className="w-full rounded-lg px-3 py-2.5 pr-10 outline-none"
                style={{
                  background: "#0B0D14",
                  border: "1px solid #252836",
                  color: "#E8EAF0",
                  fontSize: 13,
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "#525675" }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#525675", marginTop: 4 }}>
              前往 bailian.console.aliyun.com 获取 Key
            </p>
          </div>

          {/* 模型选择 */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              模型
            </label>
            <div className="flex flex-col gap-2">
              {providerConfig.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-left"
                  style={{
                    background: model === m.id ? "rgba(79,127,255,0.12)" : "#1A1D29",
                    border: `1.5px solid ${model === m.id ? "#4F7FFF" : "#252836"}`,
                    color: model === m.id ? "#4F7FFF" : "#8B8FA8",
                    fontSize: 13,
                    fontWeight: model === m.id ? 600 : 400,
                  }}
                >
                  <span className="rounded-full inline-block" style={{
                    width: 7, height: 7,
                    background: model === m.id ? "#4F7FFF" : "#525675",
                  }} />
                  <span className="flex-1">{m.name}</span>
                  {m.cheap && (
                    <span style={{ fontSize: 10, color: "#10B981", background: "rgba(16,185,129,0.12)", padding: "1px 6px", borderRadius: 4 }}>
                      省钱
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 自动洞察开关 */}
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 500 }}>自动洞察</p>
              <p style={{ fontSize: 11, color: "#525675" }}>打开 App 时自动分析今日数据</p>
            </div>
            <button
              onClick={() => setAutoInsights(!autoInsights)}
              className="flex items-center rounded-full transition-colors"
              style={{
                width: 40,
                height: 22,
                background: autoInsights ? "#F59E0B" : "#252836",
                padding: 2,
                justifyContent: autoInsights ? "flex-end" : "flex-start",
              }}
            >
              <span className="rounded-full" style={{ width: 18, height: 18, background: "#fff", display: "block" }} />
            </button>
          </div>

          {/* 测试连接 */}
          <button
            onClick={handleTest}
            disabled={!apiKey || testing}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg transition-all"
            style={{
              background: !apiKey ? "#1A1D29" : "rgba(245,158,11,0.08)",
              border: `1px solid ${!apiKey ? "#252836" : "#F59E0B33"}`,
              color: !apiKey ? "#525675" : "#F59E0B",
              fontSize: 13,
              fontWeight: 500,
              opacity: testing ? 0.6 : 1,
            }}
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : testResult?.ok ? (
              <CheckCircle2 size={14} style={{ color: "#10B981" }} />
            ) : testResult && !testResult.ok ? (
              <AlertCircle size={14} style={{ color: "#EF4444" }} />
            ) : (
              <Zap size={14} />
            )}
            {testing ? "连接中..." : testResult?.ok ? "连接成功!" : testResult?.error ? "连接失败" : "测试连接"}
          </button>
          {testResult && !testResult.ok && testResult.error && (
            <p style={{ fontSize: 11, color: "#EF4444", marginTop: -8 }}>{testResult.error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid #252836", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => setShowAISettings(false)}
            className="px-4 py-2.5 rounded-lg"
            style={{ background: "#252836", color: "#8B8FA8", fontSize: 14 }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg hover:opacity-90"
            style={{
              background: apiKey ? "linear-gradient(135deg, #F59E0B, #F97316)" : "#252836",
              color: apiKey ? "#fff" : "#525675",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Zap size={15} />
            保存配置
          </button>
        </div>
      </motion.div>
    </div>
  );
}
