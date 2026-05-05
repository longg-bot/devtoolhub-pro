"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function RegexTool() {
  const [pattern, setPattern] = useState("\\d+");
  const [text, setText] = useState("Phone: 123-456-7890, ID: 999");
  const [flags, setFlags] = useState("g");

  const result = useMemo(() => {
    if (!pattern) return { matches: [], error: null };
    try {
      const re = new RegExp(pattern, flags);
      const matches = Array.from(text.matchAll(re));
      return {
        matches: matches.map((m) => ({
          full: m[0],
          index: m.index,
          groups: Array.from(m).slice(1),
        })),
        error: null,
      };
    } catch (e: unknown) {
      return { matches: [], error: (e as Error).message };
    }
  }, [pattern, text, flags]);

  const highlighted = useMemo(() => {
    if (!pattern || result.error) return text;
    try {
      const re = new RegExp(pattern, "g" + flags.replace("g", ""));
      const parts: { text: string; match: boolean }[] = [];
      let lastIndex = 0;
      const matchArr = Array.from(text.matchAll(re));
      for (const m of matchArr) {
        if (m.index! > lastIndex) parts.push({ text: text.slice(lastIndex, m.index!), match: false });
        parts.push({ text: m[0], match: true });
        lastIndex = m.index! + m[0].length;
      }
      if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false });
      return parts;
    } catch {
      return null;
    }
  }, [text, pattern, flags, result.error]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1.5 block">正则 /pattern/</label>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\d+"
            className="font-mono"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">修饰符</label>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="g"
            className="w-24 font-mono"
          />
        </div>
        <Badge variant="secondary" className="h-9 px-3">
          {result.matches.length} 个匹配
        </Badge>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">测试文本</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-36 font-mono text-sm resize-y"
        />
      </div>

      {result.error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-mono">{result.error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1.5 block">高亮结果</label>
          <div className="min-h-36 p-4 rounded-lg border bg-card font-mono text-sm whitespace-pre-wrap break-all">
            {highlighted && Array.isArray(highlighted)
              ? highlighted.map((p, i) =>
                  p.match ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-black dark:text-yellow-100 rounded px-0.5">
                      {p.text}
                    </mark>
                  ) : (
                    <span key={i}>{p.text}</span>
                  )
                )
              : text}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">匹配列表</label>
          <div className="min-h-36 max-h-80 p-4 rounded-lg border bg-muted font-mono text-sm overflow-auto">
            {result.matches.length === 0 ? (
              <span className="text-muted-foreground">无匹配</span>
            ) : (
              result.matches.map((m, i) => (
                <div key={i} className="mb-2 p-2 rounded bg-card border text-sm">
                  <span className="text-primary font-medium">[{i}]</span> &quot;{m.full}&quot;
                  <span className="text-muted-foreground ml-2">位置: {m.index}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
