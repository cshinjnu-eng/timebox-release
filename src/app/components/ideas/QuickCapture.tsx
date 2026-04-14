import { useState } from "react";
import { Send } from "lucide-react";
import { useApp } from "../../context/AppContext";

export function QuickCapture() {
  const { captureIdea } = useApp();
  const [text, setText] = useState("");

  function handleSubmit() {
    if (!text.trim()) return;
    captureIdea(text.trim());
    setText("");
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: "#161820",
        border: "1px solid #252836",
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder="一句话记录灵感..."
        className="flex-1 outline-none bg-transparent"
        style={{ fontSize: 14, color: "#E8EAF0" }}
      />
      <button
        onClick={handleSubmit}
        className="flex items-center justify-center rounded-lg transition-all flex-shrink-0"
        style={{
          width: 34,
          height: 34,
          background: text.trim() ? "rgba(79, 127, 255, 0.15)" : "transparent",
          color: text.trim() ? "#4F7FFF" : "#525675",
          border: text.trim() ? "1px solid rgba(79, 127, 255, 0.2)" : "1px solid transparent",
        }}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
