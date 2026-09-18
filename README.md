# MURATA 調査報告書システム

現場写真と音声入力から調査報告書を自動生成するWebアプリケーション。

## 機能

- 📸 写真アップロード（カメラ撮影 / ファイル選択）
- 🎤 音声入力による所見記録（Whisper API）
- ✍️ テキストによる所見入力
- 🤖 AIによる調査報告書の自動生成（Claude API）
- 🖨️ 印刷 / PDF保存対応

## セットアップ

```bash
npm install
```

### 環境変数の設定

`.env.local` を作成:

```bash
cp .env.example .env.local
```

以下のAPIキーを設定:

- `OPENAI_API_KEY` — OpenAI API Key（Whisper音声認識用）
- `ANTHROPIC_API_KEY` — Anthropic API Key（Claude報告書生成用）

### 開発サーバー起動

```bash
npm run dev
```

### Vercelデプロイ

Vercelの環境変数に `OPENAI_API_KEY` と `ANTHROPIC_API_KEY` を設定してデプロイ。

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- OpenAI Whisper API（音声→テキスト）
- Anthropic Claude API（報告書生成）
