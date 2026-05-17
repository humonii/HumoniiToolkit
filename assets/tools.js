const tools = [
  {
    name: "Mosaicker",
    description: "SCRFDベースの顔検出で、動画にフェード付きモザイクを適用し処理後動画を保存できます。",
    href: "./face_mask/demo.html?mode=candidate_scrfd",
    tags: ["Video", "Privacy", "SCRFD", "Export"],
    status: "ready",
  },
  {
    name: "Image Vectorizer",
    description: "画像をSVGにベクター化し、ロゴ素材へ転用できます。",
    href: "./vectorizer/index.html",
    tags: ["Image", "SVG", "Vector"],
    status: "ready",
  },
  {
    name: "Video Cutter",
    description: "開始/終了を指定して、ffmpeg.wasmでMP4を書き出します。",
    href: "./video_cutter/index.html",
    tags: ["Video", "Trim", "MP4", "ffmpeg.wasm"],
    status: "ready",
  },
  {
    name: "Background Remover",
    description: "一般物体にも対応した背景透過を行い、透過PNG化します。",
    href: "./bg_remove/index.html",
    tags: ["Image", "AI", "Alpha PNG", "Object"],
    status: "ready",
  },
  {
    name: "Browser Transcriber",
    description: "Whisperをブラウザ内で実行し、音声/動画を文字起こししてTXT/SRT出力します。",
    href: "./transcriber/index.html",
    tags: ["Audio", "Whisper", "TXT", "SRT"],
    status: "ready",
  },
];

const grid = document.getElementById("tool-grid");
const template = document.getElementById("tool-card-template");
const count = document.getElementById("tool-count");

for (const tool of tools) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector("h3").textContent = tool.name;
  card.querySelector(".desc").textContent = tool.description;

  const tagsRoot = card.querySelector(".tags");
  for (const tag of tool.tags) {
    const el = document.createElement("span");
    el.className = "tag";
    el.textContent = tag;
    tagsRoot.appendChild(el);
  }

  const launch = card.querySelector(".launch");
  launch.href = tool.href;
  if (tool.status === "coming-soon") {
    launch.textContent = "Coming Soon";
    launch.classList.add("soon");
  }

  grid.appendChild(card);
}

const readyCount = tools.filter((t) => t.status === "ready").length;
count.textContent = `${readyCount}/${tools.length} tools live`;
