"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
  num?: number;
}

function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const m = leftLines.length;
  const n = rightLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = leftLines[i - 1] === rightLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      result.unshift({ type: "same", text: leftLines[i - 1], num: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", text: rightLines[j - 1], num: j });
      j--;
    } else {
      result.unshift({ type: "removed", text: leftLines[i - 1], num: i });
      i--;
    }
  }
  return result;
}

export function DiffTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const result = useMemo(() => computeDiff(left, right), [left, right]);
  const changes = result.filter((l) => l.type !== "same").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1.5 block">原始文本</label>
          <Textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="粘贴原始文本..."
            className="h-64 font-mono text-sm resize-y"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">对比文本</label>
          <Textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="粘贴对比文本..."
            className="h-64 font-mono text-sm resize-y"
          />
        </div>
      </div>

      {(left || right) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium">对比结果</label>
            <Badge variant={changes > 0 ? "default" : "secondary"}>{changes} 处差异</Badge>
          </div>
          <div className="rounded-lg border bg-card font-mono text-sm max-h-96 overflow-auto">
            {result.map((line, i) => (
              <div
                key={i}
                className={`flex px-4 py-0.5 ${
                  line.type === "added"
                    ? "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200"
                    : line.type === "removed"
                    ? "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200"
                    : ""
                }`}
              >
                <span className="w-6 text-muted-foreground text-xs flex-shrink-0 select-none">
                  {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                </span>
                <span className="w-10 text-muted-foreground text-xs flex-shrink-0 select-none">
                  {line.num || ""}
                </span>
                <span className="whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
