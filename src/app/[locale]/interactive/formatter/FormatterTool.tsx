"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Lang = "js" | "css" | "html";

function minify(code: string, lang: Lang): string {
  switch (lang) {
    case "js": return code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    case "css": return code.replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
    case "html": return code.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
  }
}

function formatJS(code: string): string {
  let result = "";
  let indent = 0;
  const lines = code.replace(/([{};])/g, "\n$1\n").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "}" || t === ")" || t === "]") indent = Math.max(0, indent - 1);
    result += "  ".repeat(indent) + t + "\n";
    if (t === "{" || t === "(" || t === "[") indent++;
  }
  return result.trim();
}

function formatCSS(code: string): string {
  return code.replace(/\s*{\s*/g, " {\n  ").replace(/\s*;\s*/g, ";\n  ").replace(/\s*}\s*/g, "\n}\n\n").trim();
}

function formatHTML(code: string): string {
  let result = "";
  let indent = 0;
  const tokens = code.replace(/</g, "\n<").replace(/>/g, ">\n").split("\n").filter(Boolean);
  for (const t of tokens) {
    const s = t.trim();
    if (!s) continue;
    if (s.startsWith("</")) indent = Math.max(0, indent - 1);
    result += "  ".repeat(indent) + s + "\n";
    if (s.startsWith("<") && !s.startsWith("</") && !s.endsWith("/>") && !s.startsWith("<!")) indent++;
  }
  return result.trim();
}

function format(code: string, lang: Lang): string {
  switch (lang) {
    case "js": return formatJS(code);
    case "css": return formatCSS(code);
    case "html": return formatHTML(code);
  }
}

export function FormatterTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [lang, setLang] = useState<Lang>("js");
  const [mode, setMode] = useState<"format" | "minify">("format");

  function process() {
    if (!input.trim()) return;
    setOutput(mode === "format" ? format(input, lang) : minify(input, lang));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="h-9 px-3 rounded-md border text-sm bg-background"
        >
          <option value="js">JavaScript / TypeScript</option>
          <option value="css">CSS</option>
          <option value="html">HTML</option>
        </select>
        <Button size="sm" variant={mode === "format" ? "default" : "outline"} onClick={() => setMode("format")}>
          格式化
        </Button>
        <Button size="sm" variant={mode === "minify" ? "default" : "outline"} onClick={() => setMode("minify")}>
          压缩
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={process}>执行</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1.5 block">输入</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴代码..."
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
