import type { Metadata } from "next";
import { RegexTool } from "./RegexTool";

export const metadata: Metadata = {
  title: "正则表达式在线测试 — 免费 Regex 匹配工具",
  description: "在线正则表达式测试工具，支持 g/i/m/s 修饰符，实时高亮匹配结果。",
};

export default function RegexPage() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">正则表达式测试器</h1>
        <p className="text-muted-foreground">输入正则和测试文本，实时查看匹配结果。</p>
      </div>
      <RegexTool />
    </div>
  );
}
