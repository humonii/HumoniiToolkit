# Humonii Toolkit

Humonii の制作ワークフロー向けツール集です。

## GitHub Pages

公開先: [https://humonii.github.io/HumoniiToolkit/](https://humonii.github.io/HumoniiToolkit/)

## Tools

- [Balance Analyzer](https://humonii.github.io/HumoniiToolkit/balance_analyzer/)
- [Mosaicker](https://humonii.github.io/HumoniiToolkit/face_mask/demo.html?mode=candidate_scrfd)
- [Image Vectorizer](https://humonii.github.io/HumoniiToolkit/vectorizer/index.html)
- [Video Cutter](https://humonii.github.io/HumoniiToolkit/video_cutter/index.html)
- [Background Remover](https://humonii.github.io/HumoniiToolkit/bg_remove/index.html)
- [Browser Transcriber](https://humonii.github.io/HumoniiToolkit/transcriber/index.html)

## Browser Transcriber — Streamlit 連携

Browser Transcriber は起動中の Streamlit 文字起こしWebページへ遷移します。

### ローカル起動時（推奨）

```bash
./open_atelier_chrome.sh
```

Tailscale 接続済みなら自動検出、またはコンテナが起動中なら `http://127.0.0.1:8501` でアクセスします。

### GitHub Pages 経由でのアクセス時

明示的にリンク先を指定：

```
https://humonii.github.io/HumoniiToolkit/?streamlit_url=https://<streamlit-url>/streamlit
```

例：
- `https://humonii.github.io/HumoniiToolkit/?streamlit_url=https://example.ts.net/streamlit`
- `https://humonii.github.io/HumoniiToolkit/?streamlit_url=http://192.168.1.100:8501`

### Tailscale 固定URL でのアクセス（初期セットアップ）

**以下の手順は最初に一度だけ必要です**

1. **オペレーター権限を設定**
   ```bash
   sudo tailscale set --operator=hmpc2024a
   ```

2. **コンテナを起動**
   ```bash
   cd transcription_server/docker
   ./run_streamlit.sh
   ```

3. **ログで確認**
   ```
   [run] Tailscale: https://example.ts.net/streamlit
   ```

以降はコンテナ再起動時に自動的にルートが設定されます。

### トラブルシューティング

#### オペレーター権限エラーが出た場合

```
[info] 初回セットアップが必要です。以下を実行してください:
[info]   sudo tailscale set --operator=hmpc2024a
```

→ 上記コマンドを実行（パスワード入力が必要）

#### アクセス不可時の確認

```bash
# コンテナ起動確認
docker ps | grep transcription_streamlit

# Tailscale 接続確認
tailscale status

# Tailscale serve 設定確認
tailscale serve status

# ローカルでアクセス確認
curl http://127.0.0.1:8501
```

#### 手動でルート設定（トラブル時）

```bash
tailscale serve --bg --set-path /streamlit http://127.0.0.1:8501
```

## Local Preview

ローカル開発時は下記で起動：

```bash
./open_atelier_chrome.sh
```

`http://localhost:8766/index.html` を開きます。
