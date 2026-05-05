"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Braces, Minus, CheckCircle2, Quote } from "lucide-react";

const SAMPLE = '{"name":"DevToolHub","version":"1.0","features":["json","base64","regex"],"active":true}';

type Mode = "format" | "minify" | "validate" | "escape";

export function JsonTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("format");
  const [indent, setIndent] = useState(2);

  function process() {
    setError("");
    if (!input.trim()) return;
    try {
      switch (mode) {
        case "format": {
          setOutput(JSON.stringify(JSON.parse(input), null, indent));
          break;
        }
        case "minify": {
          setOutput(JSON.stringify(JSON.parse(input)));
          break;
        }
        case "validate": {
          JSON.parse(input);
          setOutput("✅ JSON 语法正确，结构有效。");
          break;
        }
        case "escape": {
          setOutput(JSON.stringify(input));
          break;
        }
      }
    } catch (e) {
      setError(e instanceof SyntaxError ? `语法错误：${e.message}` : `处理失败：${String(e)}`);
      setOutput("");
    }
  }

  const modes: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: "format", label: "美化", icon: <Braces className="h-3 w-3" /> },
    { key: "minify", label: "压缩", icon: <Minus className="h-3 w-3" /> },
    { key: "validate", label: "验证", icon: <CheckCircle2 className="h-3 w-3" /> },
    { key: "escape", label: "转义", icon: <Quote className="h-3 w-3" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <Button
            key={m.key}
            size="sm"
            variant={mode === m.key ? "default" : "outline"}
            onClick={() => setMode(m.key)}
          >
            {m.icon}
            <span className="ml-1.5">{m.label}</span>
          </Button>
        ))}
        {mode === "format" && (
          <select
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value))}
            className="h-8 px-2 rounded-md border text-sm bg-background"
          >
            <option value={2}>缩进 2</option>
            <option value={4}>缩进 4</option>
          </select>
        )}
        <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
          加载示例
        </Button>
        <div className="flex-1" />
        <Button onClick={process}>处理</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1.5 block">输入</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='粘贴 JSON 文本，例如：{"hello":"world"}'
            className="h-96 font-mono text-sm resize-y"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">输出</label>
          <Textarea
            value={error || output}
            readOnly
            className={`h-96 font-mono text-sm resize-y ${error ? "text-destructive bg-destructive/5" : "bg-muted"}`}
          />
        </div>
      </div>
    </div>
  );
}
