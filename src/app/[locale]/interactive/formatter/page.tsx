import type { Metadata } from "next";
import { FormatterTool } from "./FormatterTool";

export const metadata: Metadata = {
  title: "代码格式化 & 压缩 — JS/TS/CSS/HTML 在线美化",
  description: "免费在线代码格式化工具，支持 JavaScript、TypeScript、CSS、HTML 的一键美化和压缩。",
};

export default function FormatterPage() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">代码格式化 & 压缩</h1>
        <p className="text-muted-foreground">支持 JS/TS/CSS/HTML，一键美化或压缩。</p>
      </div>
      <FormatterTool />
    </div>
  );
}
