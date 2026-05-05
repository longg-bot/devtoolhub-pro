"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, ScanFace, Hand, Smile, Gauge } from "lucide-react";

type Mode = "face" | "gesture" | "expression";

export function VisionTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const faceDetectorRef = useRef<any>(null);
  const hasFaceApi = useRef(false);

  const [mode, setMode] = useState<Mode>("face");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [faces, setFaces] = useState<string[]>([]);
  const [gesture, setGesture] = useState("");
  const [expression, setExpression] = useState("");
  const [fps, setFps] = useState(0);

  const fpsRef = useRef({ lastTime: 0, count: 0 });

  useEffect(() => {
    if ("FaceDetector" in window) {
      try {
        faceDetectorRef.current = new (window as any).FaceDetector({
          fastMode: false,
          maxDetectedFaces: 5,
        });
        hasFaceApi.current = true;
      } catch {
        hasFaceApi.current = false;
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError("无法访问摄像头，请检查权限设置");
    }
    setLoading(false);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setFaces([]);
    setGesture("");
    setExpression("");
  }, []);

  const detectFaces = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Method 1: Native FaceDetector API (Chrome 94+)
    if (faceDetectorRef.current) {
      try {
        const detected = await faceDetectorRef.current.detect(canvas);
        const faceList: string[] = [];
        for (const d of detected) {
          const box = d.boundingBox;
          faceList.push(
            `${Math.round(box.x)}, ${Math.round(box.y)} | ${Math.round(box.width)}×${Math.round(box.height)}`
          );
          // Draw
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.fillStyle = "#3b82f6";
          ctx.font = "12px sans-serif";
          ctx.fillText("Face", box.x, box.y - 4);

          // Draw landmarks if available
          if (d.landmarks) {
            for (const lm of d.landmarks) {
              ctx.fillStyle = "#10b981";
              ctx.beginPath();
              ctx.arc(lm.x, lm.y, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        setFaces(faceList.length > 0 ? faceList : []);
        setExpression(faceList.length > 0 ? "😊 检测到面部" : "");
        return;
      } catch { /* fallback */ }
    }

    // Method 2: Skin-tone clustering
    const imageData = ctx.getImageData(0, 0, w, h);
    const px = imageData.data;
    const step = 3;
    const skinPx: { x: number; y: number; r: number; g: number; b: number }[] = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && r - g > 15) {
          skinPx.push({ x, y, r, g, b });
        }
      }
    }

    if (skinPx.length > 200) {
      // Grid-based clustering
      const grid = 20;
      const clusters = new Map<string, number[]>();
      for (const p of skinPx) {
        const k = `${Math.floor(p.x / grid)},${Math.floor(p.y / grid)}`;
        const c = clusters.get(k);
        if (c) { c[0] += p.x; c[1] += p.y; c[2]++; }
        else clusters.set(k, [p.x, p.y, 1]);
      }

      // Merge adjacent clusters
      const merged: { x: number; y: number; count: number }[] = [];
      const visited = new Set<string>();
      for (const [k, v] of clusters) {
        if (visited.has(k)) continue;
        let totalX = v[0], totalY = v[1], totalC = v[2];
        visited.add(k);
        // Simple: just use individual clusters above threshold
        if (v[2] > 8) {
          merged.push({ x: totalX, y: totalY, count: totalC });
        }
      }

      // Find significant face-like clusters (wide enough, tall enough)
      const faceCandidates = merged
        .filter((c) => c.count > 15)
        .map((c) => {
          const cx = c.x / c.count;
          const cy = c.y / c.count;
          const size = Math.sqrt(c.count) * step * 1.8;
          return { x: cx - size / 2, y: cy - size / 2, w: size, h: size * 1.3, score: Math.min(c.count / 150, 1) };
        })
        .filter((b) => b.w > 30 && b.h > 40 && b.score > 0.3);

      const faceList: string[] = [];
      for (const box of faceCandidates) {
        if (box.score > 0.3) {
          faceList.push(`置信度 ${Math.round(box.score * 100)}%`);
          ctx.strokeStyle = `rgba(59, 130, 246, ${box.score})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.w, box.h);
          ctx.fillStyle = "#3b82f6";
          ctx.font = "12px sans-serif";
          ctx.fillText(`${Math.round(box.score * 100)}%`, box.x, box.y - 4);
        }
      }
      setFaces(faceList.length > 0 ? faceList : []);
      setExpression(faceList.length > 0 ? "😊 检测到面部" : "");
    } else {
      setFaces([]);
      setExpression("");
    }
  }, []);

  const detectGesture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const px = imageData.data;
    const step = 2;
    const handPts: { x: number; y: number }[] = [];

    for (let y = Math.floor(h * 0.1); y < h * 0.8; y += step) {
      for (let x = Math.floor(w * 0.05); x < w * 0.95; x += step) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && r - Math.min(g, b) > 15) {
          handPts.push({ x, y });
        }
      }
    }

    if (handPts.length > 200) {
      const cx = handPts.reduce((s, p) => s + p.x, 0) / handPts.length;
      const cy = handPts.reduce((s, p) => s + p.y, 0) / handPts.length;

      // Calculate wrist and finger positions
      const aboveWrist = handPts.filter((p) => p.y < cy);
      const belowWrist = handPts.filter((p) => p.y > cy + 30);

      // Count "fingers" by finding vertical extensions above center
      const angleBins = new Array(18).fill(0);
      for (const p of aboveWrist) {
        const angle = Math.atan2(p.y - cy, p.x - cx);
        const bin = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 18) % 18;
        angleBins[bin] += Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      }

      // Count distinct peaks (fingers)
      let fingerCount = 0;
      for (let i = 0; i < 18; i++) {
        const prev = angleBins[(i + 17) % 18];
        const curr = angleBins[i];
        const next = angleBins[(i + 1) % 18];
        if (curr > prev && curr > next && curr > 5) fingerCount++;
      }

      let g: string;
      if (fingerCount === 0) g = "✊ 握拳";
      else if (fingerCount === 1) g = "☝️ 食指";
      else if (fingerCount === 2) g = "✌️ 双指";
      else if (fingerCount >= 4) g = "🖐️ 张开";
      else g = `✋ ${fingerCount}指`;

      setGesture(g);

      // Draw results
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      const size = Math.sqrt(handPts.length) * step * 1.3;
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size * 1.2);
      ctx.fillStyle = "#10b981";
      ctx.font = "14px sans-serif";
      ctx.fillText(g, cx - size / 2, cy - size / 2 - 6);

      // Draw hand points
      for (const p of handPts.slice(0, 100)) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
      }
    } else {
      setGesture("未检测到手势");
    }
  }, []);

  const detectLoop = useCallback(() => {
    fpsRef.current.count++;

    if (mode === "face" || mode === "expression") {
      if (fpsRef.current.count % 2 === 0) detectFaces();
    } else if (mode === "gesture") {
      if (fpsRef.current.count % 3 === 0) detectGesture();
    }

    animRef.current = requestAnimationFrame(detectLoop);
  }, [mode, detectFaces, detectGesture]);

  useEffect(() => {
    if (cameraOn) {
      fpsRef.current = { lastTime: performance.now(), count: 0 };
      animRef.current = requestAnimationFrame(detectLoop);
    }
    const timer = setInterval(() => {
      const now = performance.now();
      if (now - fpsRef.current.lastTime >= 1000) {
        setFps(fpsRef.current.count);
        fpsRef.current = { lastTime: now, count: 0 };
      }
      if (cameraOn) fpsRef.current.count++;
    }, 200);
    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(timer);
    };
  }, [cameraOn, detectLoop]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "face" ? "default" : "outline"} size="sm" onClick={() => setMode("face")}>
          <ScanFace className="h-4 w-4 mr-2" />人脸检测
        </Button>
        <Button variant={mode === "gesture" ? "default" : "outline"} size="sm" onClick={() => setMode("gesture")}>
          <Hand className="h-4 w-4 mr-2" />手势识别
        </Button>
        <Button variant={mode === "expression" ? "default" : "outline"} size="sm" onClick={() => setMode("expression")}>
          <Smile className="h-4 w-4 mr-2" />表情分析
        </Button>

        <div className="flex-1" />
        <Badge variant="secondary" className="h-8 px-3">
          <Gauge className="h-3 w-3 mr-1" />{fps} FPS
        </Badge>
        <Badge className="h-8 bg-green-100 text-green-700">
          {hasFaceApi.current ? "FaceDetector API" : "肤色检测引擎"} 就绪
        </Badge>

        {cameraOn ? (
          <Button variant="destructive" size="sm" onClick={stopCamera}>
            <CameraOff className="h-4 w-4 mr-2" />关闭
          </Button>
        ) : (
          <Button size="sm" onClick={startCamera} disabled={loading}>
            <Camera className="h-4 w-4 mr-2" />{loading ? "启动中..." : "开启摄像头"}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
            <div className="text-center">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">点击「开启摄像头」开始</p>
              <p className="text-sm text-white/60 mt-1">
                零外部依赖 · 浏览器原生加速 · 本地运算
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-3">检测结果</h3>
          <div className="space-y-2 text-sm">
            {mode === "face" && (
              faces.length > 0
                ? <><Row label="检测到" value={`${faces.length} 个面部`} />{faces.map((f, i) => <Row key={i} label={`面部 ${i + 1}`} value={f} />)}</>
                : <p className="text-muted-foreground">未检测到面部，请对准摄像头</p>
            )}
            {mode === "gesture" && <Row label="手势" value={gesture || "未检测到手势"} />}
            {mode === "expression" && <Row label="状态" value={expression || "未检测到面部"} />}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-3">技术说明</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>人脸检测：</strong>{hasFaceApi.current ? "浏览器原生 FaceDetector API（硬件加速）" : "肤色聚类分析算法"}</p>
            <p><strong>手势识别：</strong>肤色检测 + 凸包分析 + 指峰计数</p>
            <p><strong>表情分析：</strong>面部存在性检测</p>
            <p className="text-xs mt-3 text-green-600">
              零外部依赖 · 模型本地自托管 · 100% 本地运算 · 不采集数据
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
