const METRIC_DEFS = [
  ["total_path_length", "total_path_length"],
  ["mean_velocity", "mean_velocity"],
  ["max_velocity", "max_velocity"],
  ["range_x", "range_x"],
  ["range_y", "range_y"],
  ["rms_x", "rms_x"],
  ["rms_y", "rms_y"],
  ["rectangle_area", "rectangle_area"],
  ["ellipse_area_95", "ellipse_area_95"],
  ["mean_x", "mean_x"],
  ["mean_y", "mean_y"],
];

const COMPARISON_METRIC_DEFS = [
  ["total_path_length", "total_path_length"],
  ["ellipse_area_95", "ellipse_area_95"],
];

const METADATA_FIELDS = [
  "試験名称",
  "ステップNo.",
  "試験開始日時",
  "記録周波数(Hz)",
  "身長(cm)",
  "体重(kg)",
  "性別",
  "実験の種類",
  "開眼/閉眼",
  "ハイパスフィルタ(Hz)",
  "ローパスフィルタ(Hz)",
  "sample_count",
  "duration",
];

const DISPLAY_NAMES = {
  time: "Time / 時刻",
  xp: "COP X / 圧中心 X",
  yp: "COP Y / 圧中心 Y",
  xb: "Estimated COM X / 推定重心候補 X",
  yb: "Estimated COM Y / 推定重心候補 Y",
  Fz: "Vertical Force / 垂直床反力",
};

const state = {
  trials: [],
  pyodideReady: false,
  pyodideFailed: false,
  pyodide: null,
};

const PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
  }

  body {
    font-family: "Space Grotesk", "Hiragino Kaku Gothic ProN", sans-serif;
  }

  #print-root {
    width: 100%;
  }

  .print-page {
    width: 194mm;
    min-height: 281mm;
    margin: 0 auto;
    background: #ffffff;
    color: #111111;
    box-sizing: border-box;
    font-family: "Space Grotesk", "Hiragino Kaku Gothic ProN", sans-serif;
  }

  .print-header {
    border-bottom: 0.5mm solid #d9d9d9;
    padding-bottom: 2mm;
    margin-bottom: 2mm;
  }

  .print-title {
    margin: 0;
    font-family: "Syne", "Hiragino Kaku Gothic ProN", sans-serif;
    font-size: 16pt;
    font-weight: 700;
  }

  .print-meta {
    margin: 1mm 0 0;
    font-size: 8.8pt;
    color: #333333;
  }

  .print-section-title {
    margin: 0 0 1.2mm;
    font-size: 10pt;
    font-weight: 700;
  }

  .print-top-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2mm;
    margin-bottom: 2.2mm;
  }

  .print-file-list {
    margin: 0;
    padding-left: 4.5mm;
    font-size: 8.2pt;
  }

  .print-file-list li {
    margin: 0.4mm 0;
    line-height: 1.25;
  }

  .print-table-wrap {
    border: 0.3mm solid #dedede;
    border-radius: 1mm;
    overflow: hidden;
  }

  .print-metrics-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 6.8pt;
  }

  .print-metrics-table th,
  .print-metrics-table td {
    border: 0.2mm solid #ececec;
    padding: 0.7mm 1.1mm;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  .print-metrics-table th {
    background: #fafafa;
    font-weight: 700;
  }

  .print-plot-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2.2mm;
  }

  .print-plot-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.2mm;
  }

  .print-plot-card {
    border: 0.3mm solid #d8d8d8;
    border-radius: 1mm;
    padding: 1.2mm;
    background: #ffffff;
    min-height: 84mm;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 1mm;
  }

  .print-plot-caption {
    margin: 0;
    font-size: 8pt;
    font-weight: 700;
    color: #222222;
  }

  .print-plot-body {
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .print-plot-body svg,
  .print-plot-body img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 78mm;
    object-fit: contain;
  }

  .print-empty {
    font-size: 8pt;
    color: #666666;
  }
`;

const PLOT_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["toImage"],
  scrollZoom: true,
  doubleClick: "reset+autosize",
};

const dom = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("file-input"),
  pickFiles: document.getElementById("pick-files"),
  loadSample: document.getElementById("load-sample"),
  resetFiles: document.getElementById("reset-files"),
  status: document.getElementById("status"),
  runtimeStatus: document.getElementById("runtime-status"),
  errorBanner: document.getElementById("error-banner"),
  fileList: document.getElementById("file-list"),
  metricsTable: document.getElementById("metrics-table"),
  trajectoryPlot: document.getElementById("trajectory-plot"),
  timeseriesPlot: document.getElementById("timeseries-plot"),
  compareTotalPathPlot: document.getElementById("compare-total-path-plot"),
  compareEllipsePlot: document.getElementById("compare-ellipse-plot"),
  exportPdf: document.getElementById("export-pdf"),
  printRoot: document.getElementById("print-root"),
};

let isPrintHookInstalled = false;

init();

function init() {
  dom.dropzone.addEventListener("click", () => dom.fileInput.click());
  dom.pickFiles.addEventListener("click", () => dom.fileInput.click());
  dom.loadSample.addEventListener("click", () => loadSampleCsv());
  dom.resetFiles.addEventListener("click", () => resetLoadedFiles());
  dom.fileInput.addEventListener("change", (event) => handleSelectedFiles(event.target.files));
  dom.dropzone.addEventListener("dragover", onDragOver);
  dom.dropzone.addEventListener("dragleave", onDragLeave);
  dom.dropzone.addEventListener("drop", onDrop);
  dom.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dom.fileInput.click();
    }
  });

  dom.exportPdf.addEventListener("click", () => exportPdf());

  renderAll();
  loadPyodideRuntime();
}

function onDragOver(event) {
  event.preventDefault();
  dom.dropzone.classList.add("is-dragover");
}

function onDragLeave() {
  dom.dropzone.classList.remove("is-dragover");
}

function onDrop(event) {
  event.preventDefault();
  dom.dropzone.classList.remove("is-dragover");
  handleSelectedFiles(event.dataTransfer.files);
}

async function loadSampleCsv() {
  try {
    setStatus("サンプルCSVを読み込み中...");
    const response = await fetch("./sample/sample_force_plate.csv");
    if (!response.ok) {
      throw new Error(`sample fetch failed: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await ingestFiles([
      {
        name: "sample_force_plate.csv",
        arrayBuffer: async () => buffer,
      },
    ]);
  } catch (error) {
    showError(`サンプルCSVの読み込みに失敗しました: ${error.message}`);
  }
}

async function handleSelectedFiles(fileList) {
  if (!fileList || fileList.length === 0) {
    return;
  }
  await ingestFiles(Array.from(fileList));
  dom.fileInput.value = "";
}

function resetLoadedFiles() {
  state.trials = [];
  dom.fileInput.value = "";
  clearError();
  setStatus("読み込み済みファイルをリセットしました。");
  renderAll();
}

async function ingestFiles(files) {
  clearError();
  setStatus(`${files.length} 件のCSVを解析中...`);

  const newTrials = [];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const analysis = await analyzeBytes(bytes);
      const defaultMapping = analysis.default_mapping || {};
      const trial = {
        id: createId(),
        fileName: file.name,
        sourceFormat: analysis.format || "unknown",
        analysisSource: analysis.analysis_source || "javascript",
        visible: true,
        subject: "",
        condition: analysis.metadata?.["実験の種類"] || "",
        trialLabel: String(analysis.metadata?.["ステップNo."] || state.trials.length + newTrials.length + 1),
        memo: "",
        manualX: defaultMapping.cop_x || analysis.columns?.[1] || "",
        manualY: defaultMapping.cop_y || analysis.columns?.[2] || "",
        analysis,
      };
      newTrials.push(trial);
    } catch (error) {
      showError(`${file.name}: ${error.message}`);
    }
  }

  state.trials.push(...newTrials);
  if (newTrials.length > 0) {
    setStatus(`${newTrials.length} 件のCSVを読み込みました。`);
  }
  renderAll();
}

async function analyzeBytes(bytes) {
  if (state.pyodideReady && state.pyodide) {
    try {
      const analysis = await analyzeWithPyodide(bytes);
      analysis.analysis_source = "python";
      return analysis;
    } catch (error) {
      console.warn("Pyodide analysis failed, falling back to JavaScript", error);
      setRuntimeStatus("Python解析に失敗したため JavaScript へフォールバックしました。", "warn");
    }
  }

  const analysis = analyzeTrialJs(bytes);
  analysis.analysis_source = "javascript";
  return analysis;
}

async function loadPyodideRuntime() {
  if (typeof window.loadPyodide !== "function") {
    state.pyodideFailed = true;
    setRuntimeStatus("Pyodide を読み込めなかったため JavaScript 解析を使用します。", "warn");
    return;
  }

  try {
    setRuntimeStatus("Python runtime loading...", "");
    const pyodide = await window.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
    });
    const analysisSource = await fetch("./analysis.py").then((response) => response.text());
    pyodide.globals.set("analysis_source_text", analysisSource);
    await pyodide.runPythonAsync(`
import types
analysis_module = types.ModuleType("balance_analysis")
analysis_module.__dict__["__name__"] = "balance_analysis"
exec(analysis_source_text, analysis_module.__dict__)
globals().update(analysis_module.__dict__)
    `);
    pyodide.globals.delete("analysis_source_text");
    state.pyodide = pyodide;
    state.pyodideReady = true;
    setRuntimeStatus("Python runtime ready. 解析時は Python を優先します。", "ok");
  } catch (error) {
    console.warn("Failed to initialize Pyodide", error);
    state.pyodideFailed = true;
    setRuntimeStatus("Pyodide 初期化に失敗したため JavaScript 解析を使用します。", "warn");
  }
}

async function analyzeWithPyodide(bytes) {
  const base64 = uint8ArrayToBase64(bytes);
  state.pyodide.globals.set("js_input_b64", base64);
  const resultJson = await state.pyodide.runPythonAsync(`
import base64, json
result = analyze_trial(base64.b64decode(js_input_b64))
json.dumps(result, ensure_ascii=False, allow_nan=True)
  `);
  state.pyodide.globals.delete("js_input_b64");
  return JSON.parse(resultJson);
}

function renderAll() {
  renderFileList();
  renderMetricsTable();
  renderTrajectoryPlot();
  renderTimeSeriesPlot();
  renderComparisonPlot();
  updatePdfExportAvailability();
}

function updatePdfExportAvailability() {
  const hasVisibleTrials = state.trials.some((trial) => trial.visible);
  dom.exportPdf.disabled = !hasVisibleTrials;
}

function renderFileList() {
  if (state.trials.length === 0) {
    dom.fileList.className = "file-list empty-state";
    dom.fileList.innerHTML = "<p>まだCSVが読み込まれていません。</p>";
    return;
  }

  dom.fileList.className = "file-list";
  dom.fileList.innerHTML = state.trials.map(renderTrialCard).join("");
}

function renderTrialCard(trial) {
  const metadata = buildMetadataSummary(trial);
  const mapping = resolveActiveMapping(trial);

  return `
    <article class="trial-card" data-id="${escapeHtml(trial.id)}">
      <div class="trial-top">
        <div>
          <h3 class="trial-title">${escapeHtml(trial.fileName)}</h3>
          <p class="trial-sub">
            <span class="pill-inline">${escapeHtml(trial.sourceFormat)}</span>
            <span class="pill-inline">${escapeHtml(trial.analysisSource)}</span>
            <span class="pill-inline">${escapeHtml(`${mapping.x} / ${mapping.y}`)}</span>
          </p>
        </div>
      </div>

      <div class="trial-facts">
        <span>condition: ${escapeHtml(trial.condition || "-")}</span>
        <span>trial: ${escapeHtml(trial.trialLabel || "-")}</span>
        <span>subject: ${escapeHtml(trial.subject || "-")}</span>
      </div>

      <dl class="meta-grid">
        ${metadata}
      </dl>
    </article>
  `;
}

function buildMetadataSummary(trial) {
  const metadata = { ...trial.analysis.metadata };
  const metrics = computeMetricsForTrial(trial);
  metadata.sample_count = formatMetricValue(metrics.sample_count);
  metadata.duration = formatMetricValue(metrics.duration);

  return METADATA_FIELDS.map((key) => {
    const value = metadata[key] ?? "-";
    return `<div class="meta-item"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
  }).join("");
}

function computeMetricsForTrial(trial) {
  const mapping = resolveActiveMapping(trial);
  return computeSwayMetricsJs(trial.analysis.data, mapping.time, mapping.x, mapping.y);
}

function resolveActiveMapping(trial) {
  const mapping = trial.analysis.default_mapping || {};
  const columns = new Set(trial.analysis.columns || []);

  return {
    time: mapping.time || "time",
    x: columns.has(mapping.cop_x) ? mapping.cop_x : trial.manualX,
    y: columns.has(mapping.cop_y) ? mapping.cop_y : trial.manualY,
    label: "COP",
  };
}

function renderMetricsTable() {
  const activeTrials = state.trials.filter((trial) => trial.visible);
  if (activeTrials.length === 0) {
    dom.metricsTable.innerHTML = "";
    return;
  }

  const headers = ["metric", ...activeTrials.map((_, index) => `file_${index + 1}`)];
  const headHtml = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;

  const bodyRows = METRIC_DEFS.map(([metricKey]) => {
    const cells = [metricKey, ...activeTrials.map((trial) => {
      const metrics = computeMetricsForTrial(trial);
      return formatMetricValue(metrics[metricKey]);
    })];
    return `<tr>${cells.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`;
  });

  const bodyHtml = bodyRows.join("");
  dom.metricsTable.innerHTML = `${headHtml}<tbody>${bodyHtml}</tbody>`;
}

function renderTrajectoryPlot() {
  if (!window.Plotly) {
    return;
  }

  const traces = [];
  const visibleTrials = state.trials.filter((item) => item.visible);
  let allXValues = [];
  let allYValues = [];

  visibleTrials.forEach((trial, index) => {
    const mapping = resolveActiveMapping(trial);
    const points = collectValidPoints(trial.analysis.data, mapping.time, mapping.x, mapping.y);
    if (points.length === 0) {
      return;
    }
    
    allXValues.push(...points.map((p) => p.x));
    allYValues.push(...points.map((p) => p.y));
    
    const label = `file_${index + 1}`;
    traces.push({
      type: "scatter",
      mode: "lines+markers",
      name: label,
      x: points.map((point) => point.x),
      y: points.map((point) => point.y),
      text: points.map((point) => `time=${point.time.toFixed(3)}<br>x=${point.x.toFixed(3)}<br>y=${point.y.toFixed(3)}`),
      hovertemplate: "%{text}<extra>%{fullData.name}</extra>",
      marker: { size: 3 },
      line: { width: 1 },
    });
    traces.push({
      type: "scatter",
      mode: "markers+text",
      name: `${label} start`,
      x: [points[0].x],
      y: [points[0].y],
      text: ["Start"],
      textfont: { size: 12 },
      textposition: "top center",
      marker: { size: 10, symbol: "circle", color: "#147565" },
      hoverinfo: "skip",
      showlegend: false,
    });
    traces.push({
      type: "scatter",
      mode: "markers+text",
      name: `${label} end`,
      x: [points[points.length - 1].x],
      y: [points[points.length - 1].y],
      text: ["End"],
      textfont: { size: 12 },
      textposition: "bottom center",
      marker: { size: 10, symbol: "diamond", color: "#e6844a" },
      hoverinfo: "skip",
      showlegend: false,
    });
  });

  let xRange = [0, 1];
  let yRange = [0, 1];
  if (allXValues.length > 0 && allYValues.length > 0) {
    const minX = Math.min(...allXValues);
    const maxX = Math.max(...allXValues);
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);
    
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const maxRange = Math.max(rangeX, rangeY);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const padding = maxRange * 0.1;
    
    xRange = [centerX - (maxRange + padding * 2) / 2, centerX + (maxRange + padding * 2) / 2];
    yRange = [centerY - (maxRange + padding * 2) / 2, centerY + (maxRange + padding * 2) / 2];
  }

  const layout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    margin: { t: 20, r: 20, b: 60, l: 60 },
    dragmode: "pan",
    autosize: true,
    font: { size: 12 },
    xaxis: { title: { text: "X (mm)", font: { size: 14 } }, tickfont: { size: 11 }, zeroline: true, constrain: "domain", range: xRange },
    yaxis: { title: { text: "Y (mm)", font: { size: 14 } }, tickfont: { size: 11 }, scaleanchor: "x", scaleratio: 1, zeroline: true, constrain: "domain", range: yRange },
    legend: { orientation: "h", font: { size: 11 } },
  };
  Plotly.react(dom.trajectoryPlot, traces, layout, PLOT_CONFIG);
}

function renderTimeSeriesPlot() {
  if (!window.Plotly) {
    return;
  }

  const traces = [];
  for (const trial of state.trials.filter((item) => item.visible)) {
    const mapping = resolveActiveMapping(trial);
    const points = collectValidPoints(trial.analysis.data, mapping.time, mapping.x, mapping.y);
    if (points.length === 0) {
      continue;
    }
    const label = buildLegendLabel(trial);
    traces.push({
      type: "scatter",
      mode: "lines",
      name: `${label} X`,
      x: points.map((point) => point.time),
      y: points.map((point) => point.x),
      xaxis: "x",
      yaxis: "y",
    });
    traces.push({
      type: "scatter",
      mode: "lines",
      name: `${label} Y`,
      x: points.map((point) => point.time),
      y: points.map((point) => point.y),
      xaxis: "x2",
      yaxis: "y2",
    });

    const velocity = computeVelocitySeries(points);
    if (velocity.length > 0) {
      traces.push({
        type: "scatter",
        mode: "lines",
        name: `${label} Velocity`,
        x: velocity.map((item) => item.time),
        y: velocity.map((item) => item.velocity),
        xaxis: "x3",
        yaxis: "y3",
      });
    }
  }

  const layout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    grid: { rows: 3, columns: 1, pattern: "independent" },
    margin: { t: 20, r: 20, b: 45, l: 55 },
    dragmode: "pan",
    font: { size: 11 },
    legend: { orientation: "h", font: { size: 10 } },
    xaxis: { title: { text: "Time (s)", font: { size: 13 } }, tickfont: { size: 10 } },
    yaxis: { title: { text: "X (mm)", font: { size: 13 } }, tickfont: { size: 10 } },
    xaxis2: { title: { text: "Time (s)", font: { size: 13 } }, tickfont: { size: 10 } },
    yaxis2: { title: { text: "Y (mm)", font: { size: 13 } }, tickfont: { size: 10 } },
    xaxis3: { title: { text: "Time (s)", font: { size: 13 } }, tickfont: { size: 10 } },
    yaxis3: { title: { text: "Velocity (mm/s)", font: { size: 13 } }, tickfont: { size: 10 } },
  };
  Plotly.react(dom.timeseriesPlot, traces, layout, PLOT_CONFIG);
}

function renderComparisonPlot() {
  if (!window.Plotly) {
    return;
  }

  const visibleTrials = state.trials.filter((item) => item.visible);
  const labels = visibleTrials.map((trial) => buildLegendLabel(trial));
  const fileIndexes = visibleTrials.map((_, index) => index + 1);
  renderSingleComparisonPlot(dom.compareTotalPathPlot, visibleTrials, fileIndexes, labels, "total_path_length", "total_path_length", "#147565");
  renderSingleComparisonPlot(dom.compareEllipsePlot, visibleTrials, fileIndexes, labels, "ellipse_area_95", "ellipse_area_95", "#e6844a");
}

function renderSingleComparisonPlot(element, visibleTrials, fileIndexes, labels, metricKey, label, color) {
  if (!element) {
    return;
  }

  const traces = [{
    type: "scatter",
    mode: "lines+markers",
    name: label,
    x: fileIndexes,
    y: visibleTrials.map((trial) => computeMetricsForTrial(trial)[metricKey]),
    customdata: labels,
    line: {
      color,
      width: 2,
    },
    marker: {
      color,
      size: 8,
    },
    hovertemplate: `file_index: %{x}<br>file: %{customdata}<br>${label}: %{y}<extra></extra>`,
  }];

  Plotly.react(element, traces, {
    title: { text: label, font: { size: 14 } },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    margin: { t: 44, r: 20, b: 80, l: 55 },
    font: { size: 11 },
    dragmode: "pan",
    showlegend: false,
    xaxis: {
      title: { text: "file index", font: { size: 12 } },
      tickfont: { size: 10 },
      tickmode: "array",
      tickvals: fileIndexes,
      ticktext: fileIndexes.map(String),
    },
    yaxis: { title: { text: label, font: { size: 12 } }, tickfont: { size: 10 } },
  }, PLOT_CONFIG);
}

function buildLegendLabel(trial) {
  return trial.condition || trial.subject || trial.fileName;
}

function collectValidPoints(data, timeKey, xKey, yKey) {
  return data.map((row) => ({
    time: Number(row[timeKey]),
    x: Number(row[xKey]),
    y: Number(row[yKey]),
  })).filter((point) => Number.isFinite(point.time) && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function computeVelocitySeries(points) {
  const velocities = [];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const curr = points[index];
    const dt = curr.time - prev.time;
    if (!(dt > 0)) {
      continue;
    }
    const distance = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    velocities.push({ time: curr.time, velocity: distance / dt });
  }
  return velocities;
}

function setStatus(message) {
  dom.status.textContent = message;
}

function setRuntimeStatus(message, variant) {
  dom.runtimeStatus.textContent = message;
  dom.runtimeStatus.className = `hint runtime-text ${variant || ""}`.trim();
}

function showError(message) {
  dom.errorBanner.hidden = false;
  dom.errorBanner.textContent = message;
}

function clearError() {
  dom.errorBanner.hidden = true;
  dom.errorBanner.textContent = "";
}

function createId() {
  return `trial-${Math.random().toString(36).slice(2, 10)}`;
}

function formatMetricValue(value) {
  if (!Number.isFinite(value)) {
    return "NaN";
  }
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toExponential(4);
  }
  return value.toFixed(4);
}

function median(values) {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function computeSwayMetricsJs(data, timeCol = "time", xCol = "xp", yCol = "yp") {
  const points = collectValidPoints(data, timeCol, xCol, yCol);
  const sampleCount = points.length;

  if (sampleCount === 0) {
    return emptyMetrics();
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const times = points.map((point) => point.time);
  const meanX = mean(xs);
  const meanY = mean(ys);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);
  const duration = Math.max(...times) - Math.min(...times);
  const rmsX = Math.sqrt(mean(xs.map((value) => (value - meanX) ** 2)));
  const rmsY = Math.sqrt(mean(ys.map((value) => (value - meanY) ** 2)));

  let totalPathLength = NaN;
  let meanVelocity = NaN;
  let maxVelocity = NaN;
  let samplingRateEstimated = NaN;
  const positiveDt = [];
  const segmentDistances = [];
  const segmentVelocities = [];

  if (sampleCount >= 2) {
    for (let index = 1; index < points.length; index += 1) {
      const prev = points[index - 1];
      const curr = points[index];
      const dt = curr.time - prev.time;
      if (!(dt > 0)) {
        continue;
      }
      const distance = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      positiveDt.push(dt);
      segmentDistances.push(distance);
      segmentVelocities.push(distance / dt);
    }
    if (segmentDistances.length > 0) {
      totalPathLength = segmentDistances.reduce((sum, value) => sum + value, 0);
      maxVelocity = Math.max(...segmentVelocities);
      samplingRateEstimated = 1 / median(positiveDt);
      if (duration > 0) {
        meanVelocity = totalPathLength / duration;
      }
    }
  }

  const ellipseArea95 = computeEllipseArea95(xs, ys, meanX, meanY);

  return {
    sample_count: sampleCount,
    duration,
    sampling_rate_estimated: samplingRateEstimated,
    total_path_length: totalPathLength,
    mean_velocity: meanVelocity,
    max_velocity: maxVelocity,
    range_x: rangeX,
    range_y: rangeY,
    rms_x: rmsX,
    rms_y: rmsY,
    rectangle_area: rangeX * rangeY,
    ellipse_area_95: ellipseArea95,
    mean_x: meanX,
    mean_y: meanY,
  };
}

function emptyMetrics() {
  return Object.fromEntries([...METRIC_DEFS, ...COMPARISON_METRIC_DEFS].map(([key]) => [key, NaN]));
}

function mean(values) {
  if (values.length === 0) {
    return NaN;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeEllipseArea95(xs, ys, meanX, meanY) {
  if (xs.length < 2 || ys.length < 2) {
    return NaN;
  }
  let varX = 0;
  let varY = 0;
  let cov = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    varX += dx * dx;
    varY += dy * dy;
    cov += dx * dy;
  }
  const divisor = xs.length - 1;
  if (divisor <= 0) {
    return NaN;
  }
  varX /= divisor;
  varY /= divisor;
  cov /= divisor;
  const determinant = (varX * varY) - (cov * cov);
  if (!(determinant >= 0)) {
    return NaN;
  }
  return Math.PI * 5.991 * Math.sqrt(determinant);
}

function analyzeTrialJs(fileBytes) {
  const parsed = parseAnyCsvJs(fileBytes);
  const defaultMapping = parsed.default_mapping || {};
  const copMetrics = computeSwayMetricsJs(parsed.data, defaultMapping.time || "time", defaultMapping.cop_x || "xp", defaultMapping.cop_y || "yp");
  let comMetrics = null;
  if (defaultMapping.com_x && defaultMapping.com_y) {
    const columns = new Set(parsed.data_columns || parsed.columns || []);
    if (columns.has(defaultMapping.com_x) && columns.has(defaultMapping.com_y)) {
      comMetrics = computeSwayMetricsJs(parsed.data, defaultMapping.time || "time", defaultMapping.com_x, defaultMapping.com_y);
    }
  }
  return {
    format: parsed.format,
    metadata: parsed.metadata,
    builtin_metrics: parsed.builtin_metrics,
    builtin_metric_units: parsed.builtin_metric_units,
    columns: parsed.data_columns,
    units: parsed.units,
    stats: parsed.stats,
    default_mapping: parsed.default_mapping,
    cop_metrics: copMetrics,
    com_metrics: comMetrics,
    data_preview: parsed.data.slice(0, 10),
    data: parsed.data,
  };
}

function parseAnyCsvJs(fileBytes) {
  try {
    const forcePlate = parseForcePlateCsvJs(fileBytes);
    if (forcePlate) {
      return forcePlate;
    }
  } catch (error) {
    console.warn("Force plate parser failed", error);
  }
  return parseSimpleCsvJs(fileBytes);
}

function parseForcePlateCsvJs(fileBytes) {
  const text = decodeCsvBytes(fileBytes);
  const rows = parseCsvText(text);
  const balanceIndex = rows.findIndex((row) => normalizeCell(row[0]) === "バランス評価結果");
  const headerIndices = [];

  rows.forEach((row, index) => {
    if ((normalizeCell(row[0]) === "" || normalizeCell(row[0]) === "time") && row.includes("xp") && row.includes("yp")) {
      headerIndices.push(index);
    }
  });

  if (balanceIndex < 0 || headerIndices.length < 2) {
    return null;
  }

  const metadata = {};
  for (let index = 0; index < balanceIndex; index += 1) {
    const row = rows[index];
    if (!row || row.length < 2) {
      continue;
    }
    const key = normalizeCell(row[0]);
    if (!key) {
      continue;
    }
    metadata[key] = normalizeCell(row[1]);
  }

  const metricNames = rows[balanceIndex + 1] || [];
  const metricUnits = rows[balanceIndex + 2] || [];
  const metricValues = rows[balanceIndex + 3] || [];
  const builtinMetrics = {};
  const builtinMetricUnits = {};
  for (let index = 1; index < metricNames.length; index += 1) {
    const item = normalizeCell(metricNames[index]);
    if (!item) {
      continue;
    }
    builtinMetrics[item] = coerceCell(metricValues[index]);
    builtinMetricUnits[item] = normalizeCell(metricUnits[index]);
  }

  const statsHeader = rows[headerIndices[0]];
  const statsColumns = statsHeader.map((column, index) => (index === 0 ? "time" : normalizeCell(column)));
  const unitsRow = rows[headerIndices[0] + 1] || [];
  const minRow = rows[headerIndices[0] + 2] || [];
  const maxRow = rows[headerIndices[0] + 3] || [];
  const countRow = rows[headerIndices[0] + 4] || [];
  const units = {};
  const stats = { min: {}, max: {}, count: {} };
  statsColumns.forEach((column, index) => {
    units[column] = normalizeCell(unitsRow[index]);
    stats.min[column] = coerceCell(minRow[index]);
    stats.max[column] = coerceCell(maxRow[index]);
    stats.count[column] = coerceCell(countRow[index]);
  });

  const dataColumns = (rows[headerIndices[1]] || []).map((column, index) => (index === 0 ? "time" : normalizeCell(column)));
  const data = [];
  for (let index = headerIndices[1] + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.every((cell) => normalizeCell(cell) === "")) {
      continue;
    }
    const firstCell = normalizeCell(row[0]);
    if (firstCell === "単位" || firstCell === "MIN" || firstCell === "MAX" || firstCell === "データ数") {
      continue;
    }
    const item = {};
    dataColumns.forEach((column, columnIndex) => {
      item[column] = coerceCell(row[columnIndex]);
    });
    data.push(item);
  }

  return {
    format: "force_plate_export",
    metadata,
    builtin_metrics: builtinMetrics,
    builtin_metric_units: builtinMetricUnits,
    data_columns: dataColumns,
    units,
    stats,
    data,
    default_mapping: {
      time: "time",
      cop_x: dataColumns.includes("xp") ? "xp" : autoDetectColumn(dataColumns, ["cop_x", "COPx", "COP_X", "x", "X", "xp"]),
      cop_y: dataColumns.includes("yp") ? "yp" : autoDetectColumn(dataColumns, ["cop_y", "COPy", "COP_Y", "y", "Y", "yp"]),
      com_x: dataColumns.includes("xb") ? "xb" : "",
      com_y: dataColumns.includes("yb") ? "yb" : "",
    },
  };
}

function parseSimpleCsvJs(fileBytes) {
  const text = decodeCsvBytes(fileBytes);
  const rows = parseCsvText(text).filter((row) => row.some((cell) => normalizeCell(cell) !== ""));
  if (rows.length === 0) {
    throw new Error("CSVにデータがありません。");
  }
  const header = rows[0].map((column, index) => {
    const value = normalizeCell(column);
    return index === 0 && !value ? "time" : value;
  });
  const data = rows.slice(1).map((row) => {
    const item = {};
    header.forEach((column, index) => {
      item[column] = coerceCell(row[index]);
    });
    return item;
  });
  const mapping = {
    time: autoDetectColumn(header, ["time", "Time", "timestamp", "Timestamp", "t"]),
    cop_x: autoDetectColumn(header, ["cop_x", "COPx", "COP_X", "x", "X", "xp"]),
    cop_y: autoDetectColumn(header, ["cop_y", "COPy", "COP_Y", "y", "Y", "yp"]),
    com_x: header.includes("xb") ? "xb" : "",
    com_y: header.includes("yb") ? "yb" : "",
  };
  return {
    format: "simple_csv",
    metadata: {},
    builtin_metrics: {},
    builtin_metric_units: {},
    data_columns: header,
    units: {},
    stats: { min: {}, max: {}, count: {} },
    data,
    default_mapping: mapping,
  };
}

function autoDetectColumn(columns, candidates) {
  for (const candidate of candidates) {
    const found = columns.find((column) => column === candidate);
    if (found) {
      return found;
    }
  }
  const lowerColumns = new Map(columns.map((column) => [String(column).toLowerCase(), column]));
  for (const candidate of candidates) {
    const found = lowerColumns.get(String(candidate).toLowerCase());
    if (found) {
      return found;
    }
  }
  return "";
}

function decodeCsvBytes(fileBytes) {
  const encodings = ["utf-8", "shift_jis", "windows-31j"];
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      const text = decoder.decode(fileBytes);
      if (looksLikeExpectedCsv(text)) {
        return text;
      }
    } catch (error) {
      continue;
    }
  }
  return new TextDecoder().decode(fileBytes);
}

function looksLikeExpectedCsv(text) {
  if (!text) {
    return false;
  }
  const markers = ["バランス評価結果", "試験名称", "項目", "time", "cop_x", "xp", "yp"];
  return markers.some((marker) => text.includes(marker));
}

function parseCsvText(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(parseCsvLine);
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function coerceCell(value) {
  const text = normalizeCell(value);
  if (text === "") {
    return NaN;
  }
  const normalized = text.replace(/，/g, ",");
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return text;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

async function exportPdf() {
  const hasVisibleTrials = state.trials.some((trial) => trial.visible);
  if (!hasVisibleTrials) {
    alert("表示されているデータがありません。");
    return;
  }

  dom.exportPdf.disabled = true;
  setStatus("印刷用レイアウトを生成中...");

  try {
    await buildPrintLayout();
    setStatus("印刷ダイアログを開きます。保存先でPDFを選択してください。");
    const visibleTrials = state.trials.filter((trial) => trial.visible);
    const fileNames = visibleTrials.map((trial) => trial.fileName.replace(/\.csv$/i, "")).join("_");
    const titleText = fileNames || "Balance Analyzer";
    await printStandaloneDocument(titleText);
  } catch (error) {
    console.error("PDF export error:", error);
    setStatus(`PDF出力に失敗しました: ${error.message}`);
    alert(`エラー: ${error.message}`);
    cleanupPrintLayout();
  } finally {
    dom.exportPdf.disabled = false;
  }
}

async function buildPrintLayout() {
  if (!dom.printRoot) {
    throw new Error("印刷コンテナが見つかりません。");
  }

  dom.printRoot.innerHTML = "";

  const page = document.createElement("article");
  page.className = "print-page";

  const header = document.createElement("header");
  header.className = "print-header";
  header.innerHTML = `
    <h1 class="print-title">Balance Analyzer 解析結果</h1>
    <p class="print-meta">生成日時: ${escapeHtml(new Date().toLocaleString("ja-JP"))}</p>
  `;
  page.appendChild(header);

  const topGrid = document.createElement("section");
  topGrid.className = "print-top-grid";

  const fileBlock = document.createElement("div");
  fileBlock.innerHTML = "<h2 class=\"print-section-title\">読み込みファイル</h2>";
  const fileList = document.createElement("ul");
  fileList.className = "print-file-list";
  const visibleTrials = state.trials.filter((trial) => trial.visible);
  for (const trial of visibleTrials) {
    const item = document.createElement("li");
    item.textContent = `${trial.fileName} (${trial.condition || trial.subject || "N/A"})`;
    fileList.appendChild(item);
  }
  fileBlock.appendChild(fileList);
  topGrid.appendChild(fileBlock);

  const metricsBlock = document.createElement("div");
  metricsBlock.innerHTML = "<h2 class=\"print-section-title\">重心動揺指標</h2>";
  const metricsWrap = document.createElement("div");
  metricsWrap.className = "print-table-wrap";
  const metricsClone = dom.metricsTable.cloneNode(true);
  metricsClone.className = "print-metrics-table";
  metricsWrap.appendChild(metricsClone);
  metricsBlock.appendChild(metricsWrap);
  topGrid.appendChild(metricsBlock);

  page.appendChild(topGrid);

  const plotGrid = document.createElement("section");
  plotGrid.className = "print-plot-grid";
  plotGrid.appendChild(await createPlotPairNode("COP軌跡プロット", dom.trajectoryPlot, "時系列プロット", dom.timeseriesPlot));
  plotGrid.appendChild(await createPlotPairNode("指標比較: total_path_length", dom.compareTotalPathPlot, "指標比較: ellipse_area_95", dom.compareEllipsePlot));
  page.appendChild(plotGrid);

  dom.printRoot.appendChild(page);
}

async function createPlotPairNode(leftTitle, leftElement, rightTitle, rightElement) {
  const pair = document.createElement("div");
  pair.className = "print-plot-pair";
  
  const leftCard = await createPrintablePlotCard(leftTitle, leftElement);
  if (leftTitle.includes("COP軌跡")) {
    leftCard.classList.add("square-plot");
  }
  pair.appendChild(leftCard);
  
  pair.appendChild(await createPrintablePlotCard(rightTitle, rightElement));
  return pair;
}

async function createPrintablePlotCard(title, plotElement) {
  const card = document.createElement("article");
  card.className = "print-plot-card";
  const caption = document.createElement("h3");
  caption.className = "print-plot-caption";
  caption.textContent = title;
  card.appendChild(caption);

  const body = document.createElement("div");
  body.className = "print-plot-body";
  const svgMarkup = await capturePlotAsSvg(plotElement);
  if (svgMarkup) {
    body.innerHTML = svgMarkup;
    const svgNode = body.querySelector("svg");
    if (svgNode) {
      svgNode.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  } else {
    const fallback = await capturePlotAsPng(plotElement);
    if (fallback) {
      const image = document.createElement("img");
      image.src = fallback;
      image.alt = title;
      body.appendChild(image);
    } else {
      const empty = document.createElement("p");
      empty.className = "print-empty";
      empty.textContent = "図を取得できませんでした。";
      body.appendChild(empty);
    }
  }

  card.appendChild(body);
  return card;
}

function installAfterPrintCleanup() {
  if (isPrintHookInstalled) {
    return;
  }
  isPrintHookInstalled = true;
  window.addEventListener("afterprint", () => {
    cleanupPrintLayout();
    setStatus("PDF出力を完了しました。A4印刷レイアウトで保存されています。");
  });
}

function cleanupPrintLayout() {
  if (dom.printRoot) {
    dom.printRoot.innerHTML = "";
  }
}

function buildStandalonePrintHtml(titleText = "Balance Analyzer") {
  const printContent = dom.printRoot ? dom.printRoot.innerHTML : "";
  const pageTitle = escapeHtml(titleText);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <section id="print-root">${printContent}</section>
</body>
</html>`;
}

function printStandaloneDocument(titleText = "Balance Analyzer") {
  return new Promise((resolve, reject) => {
    const printWindow = window.open("", "_blank", "width=1200,height=1600");
    if (!printWindow) {
      reject(new Error("印刷用ウィンドウを開けませんでした。ポップアップを許可してください。"));
      return;
    }

    const html = buildStandalonePrintHtml(titleText);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const finalize = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        reject(error);
        return;
      }

      const closeAndResolve = () => {
        try {
          printWindow.close();
        } catch (error) {
          console.warn("Failed to close print window", error);
        }
        cleanupPrintLayout();
        resolve();
      };

      printWindow.addEventListener("afterprint", closeAndResolve, { once: true });
      setTimeout(closeAndResolve, 3000);
    };

    printWindow.addEventListener("load", () => {
      setTimeout(finalize, 150);
    }, { once: true });
  });
}

function capturePlotAsPng(plotElement) {
  return new Promise((resolve) => {
    if (!plotElement || !window.Plotly) {
      resolve(null);
      return;
    }

    try {
      const sourceWidth = Math.max(600, Math.floor(plotElement.clientWidth || 1000));
      const sourceHeight = Math.max(320, Math.floor(plotElement.clientHeight || 560));
      const aspect = sourceHeight / sourceWidth;
      const width = Math.max(3800, sourceWidth * 3);
      const height = Math.round(width * aspect);
      Plotly.toImage(plotElement, { format: "png", width, height, scale: 1 })
        .then((dataUrl) => fillTransparentBackgroundWithWhite(dataUrl))
        .then((pngDataUrl) => {
          resolve(pngDataUrl);
        })
        .catch((error) => {
          console.warn("Plotly toImage failed:", error);
          resolve(null);
        });
    } catch (error) {
      console.error("Error capturing plot:", error);
      resolve(null);
    }
  });
}

function capturePlotAsSvg(plotElement) {
  return new Promise((resolve) => {
    if (!plotElement || !window.Plotly) {
      resolve(null);
      return;
    }

    try {
      const sourceWidth = Math.max(900, Math.floor(plotElement.clientWidth || 1200));
      const sourceHeight = Math.max(500, Math.floor(plotElement.clientHeight || 700));
      Plotly.toImage(plotElement, {
        format: "svg",
        width: sourceWidth,
        height: sourceHeight,
        scale: 1,
      })
        .then((dataUrl) => resolve(dataUrlToSvgMarkup(dataUrl)))
        .catch((error) => {
          console.warn("Plotly SVG capture failed:", error);
          resolve(null);
        });
    } catch (error) {
      console.warn("SVG capture threw error:", error);
      resolve(null);
    }
  });
}

function dataUrlToSvgMarkup(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg+xml")) {
    return null;
  }

  const splitIndex = dataUrl.indexOf(",");
  if (splitIndex < 0) {
    return null;
  }

  const meta = dataUrl.slice(0, splitIndex);
  const body = dataUrl.slice(splitIndex + 1);
  try {
    if (meta.includes(";base64")) {
      return atob(body);
    }
    return decodeURIComponent(body);
  } catch (error) {
    console.warn("Failed to decode SVG data URL", error);
    return null;
  }
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = dataUrl;
  });
}

function fillTransparentBackgroundWithWhite(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("プロット画像の生成に失敗しました。"));
    image.src = imageDataUrl;
  });
}
