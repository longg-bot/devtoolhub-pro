"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, ScanFace, Hand, Smile, Gauge } from "lucide-react";

type Mode = "face" | "gesture" | "expression";

interface DetectionBox { x: number; y: number; width: number; height: number; score: number }

export function VisionTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  const [mode, setMode] = useState<Mode>("face");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [faces, setFaces] = useState<DetectionBox[]>([]);
  const [gesture, setGesture] = useState("");
  const [expression, setExpression] = useState("");
  const [fps, setFps] = useState(0);

  const fpsRef = useRef({ lastTime: 0, count: 0 });

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

      // Try to initialize FaceDetector (Chrome 94+)
      if ("FaceDetector" in window) {
        try {
          const FD = (window as any).FaceDetector;
          detectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 5 });
        } catch {
          detectorRef.current = null;
        }
      }
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

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    // Method 1: Native FaceDetector API
    if (detectorRef.current) {
      try {
        const detected = await detectorRef.current.detect(canvas);
        const boxes: DetectionBox[] = detected.map((d: any) => ({
          x: d.boundingBox.x,
          y: d.boundingBox.y,
          width: d.boundingBox.width,
          height: d.boundingBox.height,
          score: 1.0,
        }));
        setFaces(boxes);
        if (boxes.length > 0) setExpression("detected");
        return;
      } catch { /* fallthrough */ }
    }

    // Method 2: Skin-color based face detection (fallback)
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    // Downscale for performance - sample every 4 pixels
    const step = 3;
    const skinPixels: { x: number; y: number }[] = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Skin color detection in RGB
        if (
          r > 60 && g > 40 && b > 20 &&
          r > g && r > b &&
          Math.abs(r - g) > 15 &&
          r - Math.min(g, b) > 15
        ) {
          skinPixels.push({ x, y });
        }
      }
    }

    // Cluster skin pixels into regions (simple grid-based clustering)
    if (skinPixels.length > 50) {
      const gridSize = 40;
      const clusters: Map<string, { x: number; y: number; count: number }> = new Map();

      for (const p of skinPixels) {
        const gx = Math.floor(p.x / gridSize);
        const gy = Math.floor(p.y / gridSize);
        const key = `${gx},${gy}`;
        const existing = clusters.get(key);
        if (existing) {
          existing.x += p.x;
          existing.y += p.y;
          existing.count++;
        } else {
          clusters.set(key, { x: p.x, y: p.y, count: 1 });
        }
      }

      // Find the largest cluster → likely face
      let bestCluster: { x: number; y: number; count: number } | null = null;
      for (const c of Array.from(clusters.values())) {
        if (!bestCluster || c.count > bestCluster.count) {
          bestCluster = c;
        }
      }

      if (bestCluster && bestCluster.count > 20) {
        const cx = bestCluster.x / bestCluster.count;
        const cy = bestCluster.y / bestCluster.count;
        const faceSize = Math.sqrt(bestCluster.count) * step * 2.5;
        const box: DetectionBox = {
          x: cx - faceSize / 2,
          y: cy - faceSize / 2,
          width: faceSize,
          height: faceSize * 1.3,
          score: Math.min(bestCluster.count / 200, 1.0),
        };
        setFaces([box]);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.fillStyle = "#3b82f6";
        ctx.font = "12px sans-serif";
        ctx.fillText(`Face ${Math.round(box.score * 100)}%`, box.x, box.y - 4);
        setExpression("检测到面部");
        return;
      }
    }
    setFaces([]);
  }, []);

  const detectHandGesture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    // Sample center region (where hand is likely to be)
    const roi = { x: Math.floor(w * 0.1), y: Math.floor(h * 0.2), w: Math.floor(w * 0.8), h: Math.floor(h * 0.6) };
    const imageData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
    const pixels = imageData.data;

    const step = 2;
    const handPoints: { x: number; y: number }[] = [];

    for (let y = 0; y < roi.h; y += step) {
      for (let x = 0; x < roi.w; x += step) {
        const i = (y * roi.w + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        if (
          r > 80 && g > 55 && b > 35 &&
          r > g && r > b &&
          Math.abs(r - g) > 10 && r > 95
        ) {
          handPoints.push({ x: roi.x + x, y: roi.y + y });
        }
      }
    }

    // Analyze hand shape
    if (handPoints.length > 100) {
      // Calculate convex hull approximation
      const avgX = handPoints.reduce((s, p) => s + p.x, 0) / handPoints.length;
      const avgY = handPoints.reduce((s, p) => s + p.y, 0) / handPoints.length;

      // Find extreme points (potential fingertips)
      const topPoints = handPoints.filter((p) => p.y < avgY - 20);
      const rightPoints = handPoints.filter((p) => p.x > avgX + 30);
      const leftPoints = handPoints.filter((p) => p.x < avgX - 30);

      let detectedGesture = "open_hand";

      if (topPoints.length < 10) {
        detectedGesture = "fist";
      } else if (topPoints.length < 30 && rightPoints.length > 10) {
        detectedGesture = "pointing";
      } else if (topPoints.length > 50) {
        detectedGesture = "open_hand";
      }

      // Draw hand region
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      const minX = Math.max(0, avgX - 80);
      const minY = Math.max(0, avgY - 100);

      ctx.strokeRect(minX, minY, 160, 180);
      ctx.fillStyle = "#10b981";
      ctx.font = "12px sans-serif";
      const gestureLabels: Record<string, string> = {
        open_hand: "张开手掌",
        fist: "握拳",
        pointing: "指向",
      };
      ctx.fillText(gestureLabels[detectedGesture] || detectedGesture, minX, minY - 4);

      // Draw hand points
      for (const p of handPoints.slice(0, 50)) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
        ctx.fillRect(p.x, p.y, 2, 2);
      }

      setGesture(gestureLabels[detectedGesture] || detectedGesture);
    } else {
      setGesture("");
    }
  }, []);

  const expressLabels: Record<string, string> = {
    detected: "🧑 已检测到面部",
    smile: "😊 微笑",
    neutral: "😐 平静",
  };

  const detectLoop = useCallback(() => {
    const now = performance.now();
    if (now - fpsRef.current.lastTime >= 1000) {
      setFps(fpsRef.current.count);
      fpsRef.current = { lastTime: now, count: 0 };
    }
    fpsRef.current.count++;

    switch (mode) {
      case "face":
      case "expression":
        detectFaces();
        break;
      case "gesture":
        if (fpsRef.current.count % 3 === 0) detectHandGesture();
        break;
    }

    animRef.current = requestAnimationFrame(detectLoop);
  }, [mode, detectFaces, detectHandGesture]);

  useEffect(() => {
    if (cameraOn) {
      fpsRef.current = { lastTime: performance.now(), count: 0 };
      animRef.current = requestAnimationFrame(detectLoop);
    }
    return () => { cancelAnimationFrame(animRef.current); };
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
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline muted
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
            <div className="text-center">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">点击「开启摄像头」开始</p>
              <p className="text-sm text-white/60 mt-1">所有运算在本地完成 · 数据不上传 · 无需下载模型</p>
            </div>
          </div>
        )}
      </div>

      <ResultCards mode={mode} faces={faces} gesture={gesture} expression={expression} />
    </div>
  );
}

function ResultCards({ mode, faces, gesture, expression }: {
  mode: Mode;
  faces: DetectionBox[];
  gesture: string;
  expression: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">检测结果</h3>
        <div className="space-y-2 text-sm">
          {mode === "face" && (
            <>
              <Row label="检测到面部" value={`${faces.length} 个`} />
              {faces.map((f, i) => (
                <Row
                  key={i}
                  label={`面部 ${i + 1}`}
                  value={`置信度 ${Math.round(f.score * 100)}%`}
                />
              ))}
              {faces.length === 0 && (
                <p className="text-muted-foreground">未检测到面部，请对准摄像头</p>
              )}
            </>
          )}
          {mode === "gesture" && (
            <>
              <Row label="检测到手势" value={gesture || "未检测到"} />
            </>
          )}
          {mode === "expression" && (
            <Row label="表情" value={expression || "未检测到面部"} />
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">说明</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>人脸检测：</strong>基于肤色识别 + 浏览器原生 FaceDetector API</p>
          <p><strong>手势识别：</strong>肤色检测 + 手掌形态分析（握拳/张开/指向）</p>
          <p><strong>表情分析：</strong>检测面部是否存在</p>
          <p className="text-xs mt-3 text-green-600 dark:text-green-400">
            100% 浏览器本地运算，无需下载模型，不采集数据
          </p>
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
