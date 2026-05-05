import type { Metadata } from "next";
import { Link } from "@/lib/i18n";
import { FileJson, Code2, Regex, Wand2, Type, ScanFace } from "lucide-react";

export const metadata: Metadata = {
  title: "在线开发工具 — JSON 格式化 · Base64 · 正则 · 视觉识别",
  description: "免费在线开发工具集合，所有工具在浏览器本地运行，数据不上传。",
};

const tools = [
  {
    href: "/interactive/vision",
    icon: ScanFace,
    name: "AI 视觉识别",
    desc: "人脸检测、手势识别、表情分析、年龄性别预测",
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950",
  },
  {
    href: "/interactive/json",
    icon: FileJson,
    name: "JSON 格式化",
    desc: "JSON 美化、压缩、验证、转义，支持树形查看",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950",
  },
  {
    href: "/interactive/base64",
    icon: Code2,
    name: "Base64 编解码",
    desc: "在线 Base64 编码与解码，完美支持 Unicode",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    href: "/interactive/regex",
    icon: Regex,
    name: "正则表达式测试",
    desc: "可视化正则匹配，支持 g/i/m/s 修饰符",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
  },
  {
    href: "/interactive/formatter",
    icon: Wand2,
    name: "代码格式化",
    desc: "JS/TS/CSS/HTML 代码一键格式化与压缩",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950",
  },
  {
    href: "/interactive/diff",
    icon: Type,
    name: "文本差异对比",
    desc: "逐行对比两段文本，高亮显示差异",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
  },
];

export default function InteractivePage() {
  return (
    <div className="container py-10 max-w-6xl">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          在线开发工具
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          所有工具在浏览器本地运行，无需下载，数据绝对不上传。隐私优先，即开即用。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group relative rounded-xl border p-6 hover:shadow-lg hover:border-primary/30 transition-all"
          >
            <div className={`inline-flex p-2.5 rounded-lg ${t.bg} mb-4`}>
              <t.icon className={`h-6 w-6 ${t.color}`} />
            </div>
            <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
              {t.name}
            </h3>
            <p className="text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
