# ラベルメーカー（Niimbot 50×30mm）

Niimbotのラベルプリンターで印刷する、50mm×30mmのシール用PDFを作るための Web アプリ（PWA）です。

## 使い方

1. `index.html` をブラウザで開く（スマホでもPCでもOK）
2. 左のツールバーから「テキスト」「画像」「四角形」「線」「円」を追加してレイアウトを作成
3. 右のパネルでフォント・色・位置（mm単位）などを調整。「レイヤー」欄でも要素をタップ選択・並べ替えできる
4. ヘッダーの「横 50×30 / 縦 30×50」で用紙の向きを切り替え可能
5. 操作を間違えたらツールバー左上の「戻す／進む」（Undo/Redo、Ctrl+Z）で取り消せる
6. 「このラベルをPDF保存」または「Niimbotへ送る (PDF)」でPDFを書き出し
7. NiimbotアプリでそのPDFを開いて印刷

### 連続印刷（宛名・連番など）

同じレイアウトのまま、一部の文字だけを差し替えて複数枚をまとめて1つのPDFにできます。

1. テキストの中に `{{名前}}` のようにプレースホルダーを入れる
2. 右下の「連続印刷データ」欄に、1行目を列名（ヘッダー）としたデータを貼り付け（Excel/スプレッドシートからのコピペ、カンマ・タブ区切りに対応）
3. 「データを読み込む」→「全件まとめてPDF保存」で、1件1ページのPDFが作られる

## スマホでの使い方（Niimbotへの受け渡し）

- 対応ブラウザ（Android Chromeなど）では「Niimbotへ送る (PDF)」ボタンから、OSの共有シート経由でNiimbotアプリへ直接PDFを渡せます
- 「ホーム画面に追加」しておくと、アプリのように起動できます（PWA）

## フォント

日本語Webフォントを4種類同梱（すべて無料・SIL Open Font License、`fonts/`配下）:

- ゴシック体: [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)
- 明朝体: [Noto Serif JP](https://fonts.google.com/noto/specimen/Noto+Serif+JP)
- 丸ゴシック: [M PLUS Rounded 1c](https://fonts.google.com/specimen/M+PLUS+Rounded+1c)
- 手書き風: [Yusei Magic](https://fonts.google.com/specimen/Yusei+Magic)

## 技術的なメモ

- 編集画面は [Fabric.js](http://fabricjs.com/) による実寸（1mm=10px）キャンバス
- PDF書き出しは [jsPDF](https://github.com/parallax/jsPDF) を使用
  - 四角形・線・円はベクター描画
  - テキストは日本語フォントをPDFに埋め込まず、Fabric.jsで高解像度ラスター画像として書き出すことで文字化けを回避（サーマルラベル印刷では十分な解像度）
- 元に戻す/やり直すは、キャンバス全体のJSONスナップショットを操作ごとに積むシンプルな方式
- Service Workerはアプリ本体（html/css/js）をネットワーク優先でキャッシュし、更新が確実に届くようにしている（同梱ライブラリ・フォント・アイコンはキャッシュ優先）
- 依存ライブラリ・フォントは `lib/` `fonts/` 配下に同梱（CDN不要でオフラインでも動作）
- オブジェクトの回転機能は非対応（v1）

## ファイル構成

```
docs/
├── index.html
├── manifest.json          # PWAマニフェスト
├── service-worker.js      # オフラインキャッシュ
├── css/style.css
├── css/fonts.css           # 日本語Webフォントの@font-face定義
├── js/app.js                # メインロジック
├── lib/                     # 同梱ライブラリ (fabric.js, jsPDF)
├── fonts/                   # 同梱フォント (woff2)
└── icons/                   # PWAアイコン
```
