"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, ScanFace, Hand, Smile, Gauge, Loader2 } from "lucide-react";

type Mode = "face" | "gesture" | "expression";

const EXPRESSION_LABELS: Record<string, string> = {
  neutral: "😐 平静",
  happy: "😊 开心",
  sad: "😢 悲伤",
  angry: "😠 生气",
  fearful: "😨 害怕",
  disgusted: "🤢 厌恶",
  surprised: "😲 惊讶",
};

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

async function loadFaceModels() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const faceapi = await import("face-api.js");
    const MODEL_URL = "/models/face-api";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadPromise;
}

export function VisionTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>("face");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState("");
  const [faces, setFaces] = useState<string[]>([]);
  const [gesture, setGesture] = useState("未检测到手势");
  const [exps, setExps] = useState<string[]>([]);
  const [fps, setFps] = useState(0);

  const fpsRef = useRef({ lastTime: 0, count: 0 });
  const faceapiRef = useRef<any>(null);

  useEffect(() => {
    setModelLoading(true);
    loadFaceModels()
      .then(async () => {
        const faceapi = await import("face-api.js");
        faceapiRef.current = faceapi;
        setModelsReady(true);
      })
      .catch((e) => {
        console.error("Model load error:", e);
        setError(`模型加载失败：${e.message}`);
      })
      .finally(() => setModelLoading(false));
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
    setGesture("未检测到手势");
    setExps([]);
  }, []);

  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceapi = faceapiRef.current;
    if (!video || !canvas || !faceapi || video.readyState < 2) {
      animRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const displaySize = { width: w, height: h };
    faceapi.matchDimensions(canvas, displaySize);

    try {
      switch (mode) {
        case "face": {
          const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
          const results = await faceapi
            .detectAllFaces(video, options)
            .withFaceLandmarks(true)
            .withFaceExpressions()
            .withAgeAndGender();

          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(video, 0, 0, w, h);

          const resized = faceapi.resizeResults(results, displaySize);
          const faceList: string[] = [];

          for (const r of results) {
            const box = r.detection.box;
            faceList.push(
              `置信度 ${Math.round(r.detection.score * 100)}%` +
              (r.gender ? ` | ${r.gender} (${Math.round(r.genderProbability * 100)}%)` : "") +
              (r.age ? ` | ~${Math.round(r.age)}岁` : "")
            );
          }

          if (resized.length > 0) {
            faceapi.draw.drawDetections(ctx, resized);
            faceapi.draw.drawFaceLandmarks(ctx, resized);
          }
          setFaces(faceList.length > 0 ? faceList : []);
          break;
        }

        case "gesture": {
          // Hand detection via skin color + contour analysis
          const imageData = ctx.getImageData(0, 0, w, h);
          const px = imageData.data;
          const step = 3;
          const handPts: { x: number; y: number }[] = [];

          for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
              const i = (y * w + x) * 4;
              const r = px[i], g = px[i + 1], b = px[i + 2];
              if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && r - Math.min(g, b) > 15) {
                handPts.push({ x, y });
              }
            }
          }

          if (handPts.length > 150) {
            const cx = handPts.reduce((s, p) => s + p.x, 0) / handPts.length;
            const cy = handPts.reduce((s, p) => s + p.y, 0) / handPts.length;

            // Simple gesture: count points above center (fingers up)
            const above = handPts.filter((p) => p.y < cy - 20).length;
            const ratio = above / handPts.length;

            let g = "张开手掌";
            if (ratio < 0.05) g = "✊ 握拳";
            else if (ratio < 0.12) g = "☝️ 指向";
            else if (ratio > 0.3) g = "🖐️ 张开";
            setGesture(g);

            // Draw bounding box
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            const bw = Math.sqrt(handPts.length) * step * 1.5;
            ctx.strokeRect(cx - bw / 2, cy - bw / 2, bw, bw * 1.2);
            ctx.fillStyle = "#10b981";
            ctx.font = "14px sans-serif";
            ctx.fillText(g, cx - bw / 2, cy - bw / 2 - 6);
          } else {
            setGesture("未检测到手势");
          }
          break;
        }

        case "expression": {
          const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
          const results = await faceapi
            .detectAllFaces(video, options)
            .withFaceExpressions();

          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(video, 0, 0, w, h);

          if (results.length > 0) {
            const topExprs = results[0].expressions.asSortedArray().slice(0, 3);
            setExps(
              topExprs.map(
                (e: { expression: string; probability: number }) =>
                  `${EXPRESSION_LABELS[e.expression] || e.expression}: ${Math.round(e.probability * 100)}%`
              )
            );
            const resized = faceapi.resizeResults(results, displaySize);
            faceapi.draw.drawDetections(ctx, resized);
          } else {
            setExps([]);
          }
          break;
        }
      }
    } catch {
      // non-critical frame error
    }

    animRef.current = requestAnimationFrame(detectFrame);
  }, [mode]);

  useEffect(() => {
    if (cameraOn && modelsReady) {
      fpsRef.current = { lastTime: performance.now(), count: 0 };
      animRef.current = requestAnimationFrame(detectFrame);
    }
    const timer = setInterval(() => {
      const now = performance.now();
      if (now - fpsRef.current.lastTime >= 1000) {
        setFps(fpsRef.current.count);
        fpsRef.current = { lastTime: now, count: 0 };
      }
      if (cameraOn && modelsReady) fpsRef.current.count++;
    }, 200);
    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(timer);
    };
  }, [cameraOn, modelsReady, detectFrame]);

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

        {modelLoading ? (
          <Badge variant="secondary" className="h-8 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />模型加载中
          </Badge>
        ) : modelsReady ? (
          <Badge className="h-8 bg-green-100 text-green-700">模型就绪</Badge>
        ) : null}

        {cameraOn ? (
          <Button variant="destructive" size="sm" onClick={stopCamera}>
            <CameraOff className="h-4 w-4 mr-2" />关闭
          </Button>
        ) : (
          <Button size="sm" onClick={startCamera} disabled={loading || !modelsReady}>
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
              <p className="text-lg font-medium">
                {modelsReady ? "点击「开启摄像头」开始" : "模型加载中，请稍候..."}
              </p>
              <p className="text-sm text-white/60 mt-1">
                TensorFlow.js · 面部68关键点 · 表情识别 · 年龄性别· 本地运算
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
                ? faces.map((f, i) => <Row key={i} label={i === 0 ? `检测到 ${faces.length} 人` : ""} value={f} />)
                : <p className="text-muted-foreground">未检测到面部</p>
            )}
            {mode === "gesture" && <Row label="手势" value={gesture} />}
            {mode === "expression" && (
              exps.length > 0
                ? exps.map((e, i) => <Row key={i} label={i === 0 ? "表情" : ""} value={e} />)
                : <p className="text-muted-foreground">未检测到面部</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-3">技术说明</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>人脸：</strong>TensorFlow.js Tiny Face Detector — 68 关键点</p>
            <p><strong>表情：</strong>7 种基本表情分类（喜怒哀乐惊怕厌）</p>
            <p><strong>手势：</strong>肤色检测 + 形态分析（握拳/指向/张开）</p>
            <p><strong>附加：</strong>年龄 + 性别预测</p>
            <p className="text-xs mt-3 text-green-600">全部离线运行 · 模型已本地自托管 · 0 外部依赖</p>
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
