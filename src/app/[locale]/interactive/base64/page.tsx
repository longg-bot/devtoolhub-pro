import type { Metadata } from "next";
import { Base64Tool } from "./Base64Tool";

export const metadata: Metadata = {
  title: "Base64 在线编解码 — 免费 Base64 编码解码",
  description: "免费在线 Base64 编码与解码工具，支持 Unicode 字符。浏览器本地处理，数据不上传。",
};

export default function Base64Page() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Base64 编解码</h1>
        <p className="text-muted-foreground">在线 Base64 编码与解码，完美支持中文等 Unicode 文本。</p>
      </div>
      <Base64Tool />
    </div>
  );
}
