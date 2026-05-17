#!/usr/bin/env python3
"""
Face Detection Benchmark: Baseline vs SCRFD vs RetinaFace
GPU: RTX 4070 (onnxruntime-gpu)
Input : demo.mp4
Output: benchmark_results.json + summary to stdout
"""

import cv2
import json
import time
import traceback
from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np

INPUT_VIDEO = Path(__file__).parent / "demo.mp4"
OUTPUT_JSON = Path(__file__).parent / "benchmark_results.json"
SCORE_THRESHOLD = 0.45


# ---------------------------------------------------------------------------
# Detector adapters
# ---------------------------------------------------------------------------

class BaseDetector(ABC):
    name: str = "unknown"

    @abstractmethod
    def init(self) -> None: ...

    @abstractmethod
    def detect(self, bgr_frame: np.ndarray) -> list[dict]:
        """Return list of {x, y, w, h, score} in pixel coords."""
        ...

    def dispose(self) -> None:
        pass


class MediaPipeDetector(BaseDetector):
    name = "baseline_mediapipe"

    def init(self):
        # mediapipe 0.10+ moved solutions under mediapipe.python.solutions
        try:
            from mediapipe.python.solutions.face_detection import FaceDetection
        except ImportError:
            import mediapipe as mp
            FaceDetection = mp.solutions.face_detection.FaceDetection
        self._detector = FaceDetection(
            model_selection=1,          # model=1 is the full-range model
            min_detection_confidence=SCORE_THRESHOLD,
        )
        print(f"[{self.name}] initialized (CPU)")

    def detect(self, bgr_frame):
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        result = self._detector.process(rgb)
        out = []
        if not result.detections:
            return out
        h, w = bgr_frame.shape[:2]
        for det in result.detections:
            score = det.score[0] if det.score else 0.0
            if score < SCORE_THRESHOLD:
                continue
            bb = det.location_data.relative_bounding_box
            px = max(0, bb.xmin * w)
            py = max(0, bb.ymin * h)
            pw = min(bb.width * w, w - px)
            ph = min(bb.height * h, h - py)
            if pw > 0 and ph > 0:
                out.append({"x": px, "y": py, "w": pw, "h": ph, "score": float(score)})
        return out

    def dispose(self):
        if hasattr(self, "_detector"):
            self._detector.close()


class InsightFaceDetector(BaseDetector):
    """Wraps insightface detection models (SCRFD or RetinaFace)."""

    def __init__(self, model_pack: str, display_name: str):
        self._pack = model_pack
        self.name = display_name
        self._app = None

    def init(self):
        import insightface
        from insightface.app import FaceAnalysis

        # ctx_id=0 → GPU 0 ; ctx_id=-1 → CPU
        self._app = FaceAnalysis(
            name=self._pack,
            allowed_modules=["detection"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        print(f"[{self.name}] initialized (GPU via {self._pack})")

    def detect(self, bgr_frame):
        faces = self._app.get(bgr_frame)
        out = []
        for face in faces:
            score = float(face.det_score)
            if score < SCORE_THRESHOLD:
                continue
            x1, y1, x2, y2 = face.bbox.astype(int)
            out.append({
                "x": float(max(0, x1)),
                "y": float(max(0, y1)),
                "w": float(max(0, x2 - x1)),
                "h": float(max(0, y2 - y1)),
                "score": score,
            })
        return out


class SCRFDLightDetector(InsightFaceDetector):
    """SCRFD-500m via buffalo_sc (lightweight model for comparison)."""

    def __init__(self):
        super().__init__(model_pack="buffalo_sc", display_name="candidate_scrfd_500m")


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

def consecutive_miss_streak(records: list[dict]) -> int:
    """Return the maximum consecutive frames where has_detection is False."""
    max_streak = cur = 0
    for r in records:
        if not r["has_detection"]:
            cur += 1
            max_streak = max(max_streak, cur)
        else:
            cur = 0
    return max_streak


def run_benchmark(detector: BaseDetector, video_path: Path) -> dict:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_source = cap.get(cv2.CAP_PROP_FPS) or 30.0
    records = []

    print(f"\n{'='*60}")
    print(f"  Detector : {detector.name}")
    print(f"  Video    : {video_path.name}  ({total_frames} frames @ {fps_source:.1f} fps)")
    print(f"{'='*60}")

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t0 = time.perf_counter()
        detections = detector.detect(frame)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        records.append({
            "frame_index": frame_idx,
            "detection_count": len(detections),
            "has_detection": len(detections) > 0,
            "latency_ms": round(latency_ms, 3),
        })

        if frame_idx % 100 == 0:
            print(f"  frame {frame_idx:5d}/{total_frames}  "
                  f"dets={len(detections)}  latency={latency_ms:.1f}ms")

        frame_idx += 1

    cap.release()

    # --- Summary metrics ---
    n = len(records)
    detected = sum(1 for r in records if r["has_detection"])
    detection_frame_rate = detected / n if n > 0 else 0.0

    latencies = sorted(r["latency_ms"] for r in records)
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    p95_idx = min(len(latencies) - 1, int(len(latencies) * 0.95))
    p95_latency = latencies[p95_idx] if latencies else 0.0
    effective_fps = 1000.0 / avg_latency if avg_latency > 0 else 0.0
    max_miss_streak = consecutive_miss_streak(records)

    summary = {
        "detector": detector.name,
        "total_frames": n,
        "detected_frames": detected,
        "detection_frame_rate": round(detection_frame_rate, 4),
        "miss_rate": round(1.0 - detection_frame_rate, 4),
        "max_consecutive_misses": max_miss_streak,
        "avg_latency_ms": round(avg_latency, 2),
        "p95_latency_ms": round(p95_latency, 2),
        "effective_fps": round(effective_fps, 2),
        "records": records,
    }

    print(f"\n  >> Detection frame rate : {detection_frame_rate*100:.1f}%")
    print(f"  >> Miss rate            : {(1-detection_frame_rate)*100:.1f}%")
    print(f"  >> Max consecutive miss : {max_miss_streak}")
    print(f"  >> Avg latency          : {avg_latency:.1f} ms")
    print(f"  >> P95 latency          : {p95_latency:.1f} ms")
    print(f"  >> Effective FPS        : {effective_fps:.1f}")

    return summary


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    detectors = [
        MediaPipeDetector(),
        InsightFaceDetector(model_pack="buffalo_l", display_name="candidate_scrfd_10g"),
        SCRFDLightDetector(),
    ]

    all_results = []
    failed = []

    for det in detectors:
        try:
            det.init()
            result = run_benchmark(det, INPUT_VIDEO)
            all_results.append(result)
        except Exception:
            msg = traceback.format_exc()
            print(f"[ERROR] {det.name} failed:\n{msg}")
            failed.append({"detector": det.name, "error": msg})
        finally:
            try:
                det.dispose()
            except Exception:
                pass

    # --- Side-by-side comparison table ---
    print(f"\n{'='*70}")
    print("  COMPARISON TABLE")
    print(f"{'='*70}")
    header = f"  {'Model':<30} {'DetRate%':>8} {'MaxMiss':>8} {'P95(ms)':>9} {'FPS':>7}"
    print(header)
    print(f"  {'-'*30} {'-'*8} {'-'*8} {'-'*9} {'-'*7}")
    for r in all_results:
        print(f"  {r['detector']:<30} "
              f"{r['detection_frame_rate']*100:>7.1f}% "
              f"{r['max_consecutive_misses']:>8d} "
              f"{r['p95_latency_ms']:>9.1f} "
              f"{r['effective_fps']:>7.1f}")

    # --- Selection recommendation ---
    if all_results:
        best = max(all_results, key=lambda r: (
            r["detection_frame_rate"],
            -r["max_consecutive_misses"],
        ))
        print(f"\n  RECOMMENDED: {best['detector']}")
        print(f"  Reason: highest detection frame rate ({best['detection_frame_rate']*100:.1f}%)"
              f" with max consecutive miss = {best['max_consecutive_misses']}")

    print(f"{'='*70}\n")

    # --- Persist results ---
    output = {
        "input_video": str(INPUT_VIDEO),
        "score_threshold": SCORE_THRESHOLD,
        "results": all_results,
        "failed": failed,
    }
    # Drop per-frame records from JSON to keep it readable; keep summary only
    for r in output["results"]:
        r.pop("records", None)

    OUTPUT_JSON.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"Results saved → {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
