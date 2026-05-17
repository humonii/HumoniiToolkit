# Face Detection A/B Plan (GPU: RTX 4070)

## Goal
- Primary objective: minimize missed detections (false negatives).
- Secondary objective: keep practical throughput for offline or near-real-time processing.

## Environment Baseline
- GPU: NVIDIA GeForce RTX 4070 (12GB VRAM)
- Current app: browser-based demo using MediaPipe Face Detection
- Input for benchmark: demo.mp4

## Model Candidates

### Candidate A (recommended first)
- Family: SCRFD (medium-to-large)
- Runtime target: ONNX Runtime Web with WebGPU
- Why:
  - Strong recall on pose variation and smaller faces
  - Stable engineering path for browser deployment

### Candidate B (accuracy-oriented comparator)
- Family: RetinaFace (ResNet50)
- Runtime target: ONNX Runtime Web with WebGPU
- Why:
  - High recall/robustness in difficult scenes
  - Good reference point for "best possible recall"

### Baseline (for comparison only)
- MediaPipe Face Detection (current)

## Selection Policy
- Priority 1: Recall on face-present frames
- Priority 2: Max consecutive missed frames
- Priority 3: Throughput (FPS)
- Choose the model that best minimizes misses, unless throughput becomes operationally unacceptable.

## Metrics
- Frame Recall: detected_face_frames / face_present_frames
- Miss Rate: 1 - Frame Recall
- Max Consecutive Misses: max streak of misses while face is present
- IoU Median: median IoU against labeled bbox on sampled frames
- P95 Inference Latency (ms)
- Effective FPS

## Acceptance Targets (initial)
- Frame Recall >= 0.95
- Max Consecutive Misses <= 5 frames
- Effective FPS >= 8 (offline-friendly lower bound)

## Implementation Plan

### Phase 0: Evaluation Harness (Day 1)
1. Add detector adapter interface in demo pipeline:
   - init()
   - detect(image)
   - dispose()
2. Add metric logger per frame:
   - frame_id, has_gt, has_detection, detection_count, latency_ms
3. Add run mode switch:
   - baseline_mediapipe
   - candidate_scrfd
   - candidate_retinaface
4. Export result JSON at end of video.

Deliverable:
- Reproducible benchmark JSON from demo.mp4

### Phase 1: Candidate A Integration (SCRFD) (Day 1-2)
1. Integrate ONNX Runtime Web (WebGPU provider first).
2. Load SCRFD ONNX model and implement preprocessing/postprocessing.
3. Add NMS + score threshold controls.
4. Add simple temporal smoothing:
   - Keep recent tracks for 3-5 frames
   - Fill short detection gaps

Deliverable:
- SCRFD benchmark report against baseline

### Phase 2: Candidate B Integration (RetinaFace) (Day 2-3)
1. Integrate RetinaFace ONNX pipeline with same adapter API.
2. Match evaluation settings (same video, same metric logic).
3. Tune only minimal thresholds for fair comparison.

Deliverable:
- RetinaFace benchmark report + side-by-side table

### Phase 3: Final Selection and Hardening (Day 3)
1. Select winner by recall-first policy.
2. Add fallback mode if WebGPU unavailable:
   - reduced model or MediaPipe fallback
3. Finalize runtime knobs:
   - input size
   - score threshold
   - NMS threshold
   - temporal gap length

Deliverable:
- Production-ready default configuration

## A/B Comparison Template
- Baseline (MediaPipe): recall=?, max_miss_streak=?, p95_latency=?, fps=?
- Candidate A (SCRFD): recall=?, max_miss_streak=?, p95_latency=?, fps=?
- Candidate B (RetinaFace): recall=?, max_miss_streak=?, p95_latency=?, fps=?
- Decision: selected model = ?

## Risk and Mitigation
- Risk: WebGPU not available in some browsers
  - Mitigation: adapter-level fallback path
- Risk: higher latency from large model
  - Mitigation: lower input resolution + temporal compensation
- Risk: model download size
  - Mitigation: local hosting + cache headers

## Next Action
- Implement Phase 0 immediately in demo.html to start collecting comparable metrics.
