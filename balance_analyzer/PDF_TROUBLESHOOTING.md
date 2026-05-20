# PDF出力のトラブルシューティング手順

## 1. ブラウザのコンソールを開く
- **Mac**: `Cmd + Option + J`
- **Windows**: `Ctrl + Shift + J`

## 2. 実施した修正

### 主な改善点：
- **Promise チェーンの修正** - html2pdf の非同期処理を正しく実装
- **明示的な色指定** - 背景色（白）と文字色（黒）を完全に指定
- **Plotly.toImage の活用** - グラフ画像化の改善
- **コンソールログの追加** - 各ステップでのデバッグ情報

### 追加したコンソール出力：
- "Starting PDF test..." - PDF生成開始
- "Capturing trajectory plot..." - 軌跡グラフ取得中
- "Capturing timeseries plot..." - 時系列グラフ取得中
- "Capturing comparison plots..." - 比較グラフ取得中
- "Generating PDF with html2pdf..." - PDF生成中
- "Plot image captured successfully" - グラフ画像取得成功
- "PDF saved successfully" - PDF生成成功

## 3. テストファイル
- `/balance_analyzer/test_pdf.html` - シンプルなPDF出力テスト

## 4. テスト手順
1. http://localhost:8766/balance_analyzer/index.html を開く
2. サンプルCSVを読み込む（「サンプルCSVを読み込む」ボタン）
3. 「📄 PDFに出力」ボタンをクリック
4. ブラウザコンソールでログメッセージを確認
5. エラーがあれば報告してください

## 5. テストPDFの確認
1. http://localhost:8766/balance_analyzer/test_pdf.html を開く
2. 「Test PDF Export」ボタンをクリック
3. test.pdf がダウンロードされるか確認

## 6. 期待される動作
- コンソールに複数のログが表示される
- ステータスメッセージが「PDF生成中...」から「PDFエクスポート完了しました。」に変わる
- PDFファイル（balance_analysis_YYYY-MM-DD.pdf）がダウンロードされる
- PDFに以下の内容が含まれる：
  - タイトルと生成日時
  - ファイル一覧
  - 指標テーブル（ページ1）
  - COP軌跡プロット（ページ2）
  - 時系列プロット（ページ3）
  - 比較プロット（ページ4）

## 7. 問題が発生した場合
コンソールのエラーメッセージを共有してください。以下の情報があると修正しやすいです：
- 表示されたエラーメッセージ全文
- ブラウザとOS
- JavaScriptコンソール内のエラースタック
