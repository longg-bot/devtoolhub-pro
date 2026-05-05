"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, ScanFace, Hand, Smile, Gauge } from "lucide-react";

type Mode = "face" | "gesture" | "expression";

const GESTURE_LABELS: Record<string, string> = {
  None: "无手势",
  Closed_Fist: "✊ 握拳",
  Open_Palm: "🖐️ 张开手掌",
  Pointing_Up: "☝️ 食指朝上",
  Thumb_Down: "👎 拇指向下",
  Thumb_Up: "👍 点赞",
  Victory: "✌️ 胜利",
  ILoveYou: "🤟 我爱你",
};

const EXPRESSION_LABELS: Record<string, string> = {
  neutral: "😐 平静",
  happiness: "😊 开心",
  sadness: "😢 悲伤",
  anger: "😠 生气",
  surprise: "😲 惊讶",
};

let mediaPipePromise: Promise<any> | null = null;

function loadMediaPipeScripts(): Promise<any> {
  if (mediaPipePromise) return mediaPipePromise;

  mediaPipePromise = (async () => {
    // Load WASM internals as regular script
    await loadScript(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_internal.js"
    );

    // Load ESM bundle via inline module script to avoid webpack bundling
    await new Promise<void>((resolve, reject) => {
      const id = `mediapipe-module-${Date.now()}`;
      const s = document.createElement("script");
      s.type = "module";
      s.id = id;
      s.textContent = `
        import * as mp from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
        window.__mediaPipeModule = mp;
      `;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("ESM 模块加载失败"));
      document.head.appendChild(s);
    });

    const mp = (window as any).__mediaPipeModule;
    if (!mp || !mp.FilesetResolver) {
      throw new Error("FilesetResolver 不可用");
    }

    const { FilesetResolver, FaceLandmarker, HandLandmarker, GestureRecognizer } = mp;

    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
    );

    return { FaceLandmarker, HandLandmarker, GestureRecognizer };
  })();

  return mediaPipePromise;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`WASM 加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

export function VisionTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const faceLandmarkerRef = useRef<any>(null);
  const handLandmarkerRef = useRef<any>(null);
  const gestureRecognizerRef = useRef<any>(null);
  const lastVideoTime = useRef(-1);
  const initAttempted = useRef(false);

  const [mode, setMode] = useState<Mode>("face");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState("");
  const [faces, setFaces] = useState<string[]>([]);
  const [gesture, setGesture] = useState("无手势");
  const [exps, setExps] = useState<string[]>([]);
  const [fps, setFps] = useState(0);
  const [step, setStep] = useState<string>("初始化...");

  const fpsRef = useRef({ lastTime: 0, count: 0 });

  // Initialize MediaPipe via CDN scripts
  const initMediaPipe = useCallback(async () => {
    if (initAttempted.current) return;
    initAttempted.current = true;
    setModelLoading(true);
    setStep("加载 WASM 运行时...");

    try {
      const { FaceLandmarker, HandLandmarker, GestureRecognizer } = await loadMediaPipeScripts();

      setStep("加载面部模型...");
      const fl = await FaceLandmarker.createFromOptions({
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 5,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
      });

      setStep("加载手势模型...");
      const hl = await HandLandmarker.createFromOptions({
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      setStep("加载手势识别模型...");
      const gr = await GestureRecognizer.createFromOptions({
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceLandmarkerRef.current = fl;
      handLandmarkerRef.current = hl;
      gestureRecognizerRef.current = gr;
      setModelsReady(true);
      setStep("就绪");
    } catch (e) {
      console.error("MediaPipe init error:", e);
      setError(`模型加载失败：${(e as Error).message}`);
      setStep("失败");
    }
    setModelLoading(false);
  }, []);

  // Auto-init on mount
  useEffect(() => {
    initMediaPipe();
  }, [initMediaPipe]);

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
      lastVideoTime.current = -1;
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
    setGesture("无手势");
    setExps([]);
  }, []);

  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !modelsReady) {
      animRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const now = video.currentTime;
    if (now === lastVideoTime.current) {
      animRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastVideoTime.current = now;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    const timestamp = performance.now();

    try {
      switch (mode) {
        case "face": {
          const fl = faceLandmarkerRef.current;
          if (!fl) break;
          const results = fl.detectForVideo(video, timestamp);
          const faceList: string[] = [];
          if (results.faceLandmarks) {
            for (let i = 0; i < results.faceLandmarks.length; i++) {
              faceList.push(`面部 ${i + 1}: ${results.faceLandmarks[i].length} 个关键点`);
              drawFaceMesh(ctx, results.faceLandmarks[i], w, h);
            }
          }
          setFaces(faceList.length > 0 ? faceList : []);

          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const bs = results.faceBlendshapes[0];
            const top = bs.categories
              .filter((c: any) =>
                ["happiness", "sadness", "anger", "surprise", "neutral"].includes(c.categoryName)
              )
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 2);
            setExps(top.map((e: any) => `${EXPRESSION_LABELS[e.categoryName] || e.categoryName}: ${Math.round(e.score * 100)}%`));
          }
          break;
        }

        case "gesture": {
          const gr = gestureRecognizerRef.current;
          if (!gr) break;
          const results = gr.recognizeForVideo(video, timestamp);
          if (results.gestures && results.gestures.length > 0 && results.gestures[0].length > 0) {
            const g = results.gestures[0][0];
            setGesture(GESTURE_LABELS[g.categoryName] || g.categoryName);
            if (results.landmarks) {
              for (const lm of results.landmarks) {
                drawHandLandmarks(ctx, lm, w, h);
              }
            }
          } else {
            setGesture("未检测到手势");
          }
          break;
        }

        case "expression": {
          const fl = faceLandmarkerRef.current;
          if (!fl) break;
          const results = fl.detectForVideo(video, timestamp);
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const bs = results.faceBlendshapes[0];
            const top = bs.categories
              .filter((c: any) =>
                ["happiness", "sadness", "anger", "surprise", "neutral"].includes(c.categoryName)
              )
              .sort((a: any, b: any) => b.score - a.score);
            setExps(top.map((e: any) => `${EXPRESSION_LABELS[e.categoryName] || e.categoryName}: ${Math.round(e.score * 100)}%`));
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
  }, [mode, modelsReady]);

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
          <Badge variant="secondary" className="h-8">{step}</Badge>
        ) : modelsReady ? (
          <Badge className="h-8 bg-green-100 text-green-700">MediaPipe 就绪</Badge>
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
                {modelsReady ? "点击「开启摄像头」开始" : `正在加载模型... ${step}`}
              </p>
              <p className="text-sm text-white/60 mt-1">
                基于 Google MediaPipe · 468 面部关键点 + 21 手部关键点
              </p>
            </div>
          </div>
        )}
      </div>

      <ResultCards mode={mode} faces={faces} gesture={gesture} exps={exps} />
    </div>
  );
}

function ResultCards({ mode, faces, gesture, exps }: {
  mode: Mode; faces: string[]; gesture: string; exps: string[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">检测结果</h3>
        <div className="space-y-2 text-sm">
          {mode === "face" && (
            faces.length > 0 ? faces.map((f, i) => <Row key={i} label={i === 0 ? "面部检测" : ""} value={f} />)
              : <p className="text-muted-foreground">未检测到面部</p>
          )}
          {mode === "gesture" && <Row label="当前手势" value={gesture} />}
          {mode === "expression" && (
            exps.length > 0 ? exps.map((e, i) => <Row key={i} label={i === 0 ? "表情" : ""} value={e} />)
              : <p className="text-muted-foreground">未检测到面部</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-3">技术说明</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>人脸：</strong>MediaPipe Face Landmarker — 468 关键点 + 虹膜追踪</p>
          <p><strong>手势：</strong>MediaPipe Gesture Recognizer — 21 关键点 + 7 种手势</p>
          <p><strong>表情：</strong>52 blendshape 系数 — 喜怒哀乐精准识别</p>
          <p className="text-xs mt-3 text-green-600 dark:text-green-400">100% 本地运算 · 不采集数据</p>
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

function drawFaceMesh(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
  const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  drawContour(ctx, lm, faceOval, w, h, "#3b82f6", 1.5);
  const leftBrow = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
  const rightBrow = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
  drawContour(ctx, lm, leftBrow, w, h, "#10b981", 1.5);
  drawContour(ctx, lm, rightBrow, w, h, "#10b981", 1.5);
  const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
  drawContour(ctx, lm, leftEye, w, h, "#f59e0b", 1.5);
  drawContour(ctx, lm, rightEye, w, h, "#f59e0b", 1.5);
  const lips = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  drawContour(ctx, lm, lips, w, h, "#ec4899", 1.5);
  for (const idx of [1, 33, 263, 61, 291, 199]) {
    if (lm[idx]) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(lm[idx].x * w, lm[idx].y * h, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawContour(ctx: CanvasRenderingContext2D, lm: any[], indices: number[], w: number, h: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let started = false;
  for (const idx of indices) {
    if (lm[idx]) {
      const x = lm[idx].x * w, y = lm[idx].y * h;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawHandLandmarks(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
  const conn = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];
  for (const [a, b] of conn) {
    if (lm[a] && lm[b]) {
      ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
  }
  for (const pt of lm) {
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
