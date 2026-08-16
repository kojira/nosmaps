# nosmaps

Nostr周辺ツールを4つの入口から探し、最大3件を比較できる純粋な静的サイトです。

- A: 目的から探す
- B: 一覧を絞り込んで比較する
- C: カテゴリを辿る
- D: 複数機能のAND条件とNIPの根拠から探す

`index.html` がA/B/Cと4案トップ、`nip-explorer.html` がDです。既存URLのまま、ビルドなしで静的配信できます。

## UXとi18n

- 機能選択はアイコン表示、カテゴリ選択はアイコン・可視タイトル・短い説明を表示し、どちらも `aria-label` と `title` を提供
- 日本語と英語を `i18n.js` の辞書に集約
- 初回はブラウザ言語を検出し、未対応言語は日本語へフォールバック
- 言語選択は `sessionStorage` の `nosmaps.language` にだけ保持
- 言語変更時も検索条件、機能選択、比較、開いているダイアログを維持
- カードのレビュー画像は4:3、最大3枚と残数表示。ギャラリー、拡大、元レビューへの導線を維持

## Dの主な操作

- 名称、概要、カテゴリ、OS、提供形態、機能、OSS、NIPを全文検索
- 複数機能、OS、カテゴリ、更新状態、対応状態、提供形態、OSSをANDで絞り込み
- Android / iOS、ゼロ件時の条件緩和、終了／到達不能の明示選択
- 最大3件の比較と、比較内での削除・追加・入れ替え
- 比較位置を保ったNIP根拠ダイアログ
- 事実・観測と利用者評価の分離
- いいね、ブックマーク、レビュー、プロフィール、レビュー履歴、画像ギャラリー
- 本文だけ、画像だけ、本文と画像のレビュー入力
- キーボード操作、ダイアログのフォーカストラップと呼び出し元への復帰

いいね、ブックマーク、レビュー等の変更は実行中のJavaScript状態だけに反映されます。公式サイト、配布、Docs、ソースの各ボタンはページ内で情報を開きます。

## 状態確認

Dの loading / empty / error / partial / offline は通常画面に専用操作を置かず、次のURLで確認できます。

```text
nip-explorer.html?state=loading
nip-explorer.html?state=empty
nip-explorer.html?state=error
nip-explorer.html?state=partial
nip-explorer.html?state=offline
```

E2Eからは `window.__NOSMAPS_SET_STATE__(state)` も利用できます。

## ローカル確認

```sh
python3 -m http.server 4173 --bind 127.0.0.1
npx playwright test
```

Playwright設定はChromiumとWebKitを対象にし、デスクトップと375×812のシナリオを含みます。アプリ本体の依存追加やビルド工程はありません。

## データと構成

`data.js` の36件を全案で共有します。NIPの番号・英語見出し・一次資料URLは `nostr-protocol/nips` の固定commitを参照し、ツール名と観測記録は画面設計用のデータです。

このリポジトリは静的ファイルだけで構成し、バックエンド、専用API、永続DB、中央インデクサは追加しません。Nostr接続、署名、イベント送信、外部画像アップロードも実装しません。
