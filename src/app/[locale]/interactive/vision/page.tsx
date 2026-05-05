import type { Metadata } from "next";
import { VisionTool } from "./VisionTool";

export const metadata: Metadata = {
  title: "AI 视觉识别 — 人脸检测 · 手势识别 · 表情分析",
  description: "基于浏览器的 AI 视觉识别工具：人脸检测、手势识别、面部表情分析、年龄性别预测。100% 客户端运算，不上传任何数据。",
};

export default function VisionPage() {
  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          AI 视觉识别
        </h1>
        <p className="text-muted-foreground">
          人脸检测 · 手势识别 · 表情分析 · 年龄预测 — 全部在浏览器本地运算，不采集任何数据上传
        </p>
      </div>
      <VisionTool />
    </div>
  );
}
