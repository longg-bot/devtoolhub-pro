import type { Metadata } from "next";
import { DiffTool } from "./DiffTool";

export const metadata: Metadata = {
  title: "文本差异在线对比 — 免费 Diff 工具",
  description: "在线文本差异对比工具，逐行对比两段文本，高亮显示添加、删除和修改的内容。",
};

export default function DiffPage() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">文本差异对比</h1>
        <p className="text-muted-foreground">粘贴两段文本，逐行对比差异。</p>
      </div>
      <DiffTool />
    </div>
  );
}
