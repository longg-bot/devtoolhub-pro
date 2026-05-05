"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight } from "lucide-react";

export function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  function process() {
    if (!input.trim()) return;
    try {
      if (mode === "encode") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
    } catch {
      setOutput("❌ 处理失败，请检查输入内容。");
    }
  }

  function swapMode() {
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(output);
    setOutput("");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={mode === "encode" ? "default" : "outline"} onClick={() => { setMode("encode"); setOutput(""); }}>
          编码 Encode
        </Button>
        <Button size="sm" variant={mode === "decode" ? "default" : "outline"} onClick={() => { setMode("decode"); setOutput(""); }}>
          解码 Decode
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={swapMode}>
          <ArrowLeftRight className="h-3 w-3 mr-1" /> 交换
        </Button>
        <Button size="sm" onClick={process}>执行</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            {mode === "encode" ? "输入文本" : "输入 Base64"}
          </label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "输入要编码的文本..." : "输入 Base64 字符串..."}
            className="h-96 font-mono text-sm resize-y"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">输出</label>
          <Textarea value={output} readOnly className="h-96 font-mono text-sm resize-y bg-muted" />
        </div>
      </div>
    </div>
  );
}
