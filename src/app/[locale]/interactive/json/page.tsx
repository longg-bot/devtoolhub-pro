import type { Metadata } from "next";
import { JsonTool } from "./JsonTool";

export const metadata: Metadata = {
  title: "JSON 在线格式化 & 验证 — 免费 JSON 美化压缩",
  description: "JSON 在线格式化、压缩、验证、转义。所有处理在浏览器本地完成，数据不上传。",
};

export default function JsonPage() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">JSON 格式化 & 验证</h1>
        <p className="text-muted-foreground">粘贴 JSON 文本，一键美化、压缩或验证语法错误。</p>
      </div>
      <JsonTool />
    </div>
  );
}
