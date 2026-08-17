# nosmaps

Nostr周辺ツールを4つの入口から探し、最大3件を比較できる純粋な静的サイトです。

- A: 目的から探す
- B: 一覧を絞り込んで比較する
- C: カテゴリを辿る
- D: 複数機能のAND条件とNIPの根拠から探す

`index.html` がA/B/Cと4案トップ、`nip-explorer.html` がDです。既存URLのまま、ビルドなしで静的配信できます。

## UXとi18n

- 機能選択とカテゴリ選択のアイコンはローカルのMaterial Design系SVGで統一。カテゴリは可視タイトル・短い説明も表示し、どちらも `aria-label` と `title` を提供
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
nip-explorer.html?state=stale
nip-explorer.html?state=incomplete
nip-explorer.html?state=unavailable
```

E2Eからは `window.__NOSMAPS_SET_STATE__(state)` も利用できます。

## リレー実データ（Phase 1、既定で無効）

`nip-explorer.html?relay=1` のときだけ、署名済みNostrイベントを一次情報として実データを取得します。付けなければネットワークアクセスは一切発生せず、従来どおり `data.js` のサンプルだけを表示します。

- 既定リレーは `wss://x.kojira.io` と `wss://nos.lol`。`?relays=` と `?curators=` で上書きできます
- kind `30078`（NIP-78 application-specific data）のカタログポインタを `#d` 完全一致で取得し、NIP-01のaddressable勝者選択（`created_at` 最大、同値ならイベントid最小）を適用します
- ポインタが指すカタログ本体はBlossomの匿名 `GET /<sha256>` で取得し、**バイト数・SHA-256・RFC 8785正規形・スキーマ・件数のすべてが一致した場合にのみ**採用します。1つでも失敗したバイト列は決して表示に使いません。ミラー再試行は上限つきです
- 検証済みカタログはIndexedDB（`nosmaps-catalog`）に派生キャッシュとして保存します。これは再構築可能な高速化用で、真実の源ではありません。全消去してもリレーとBlossomから再構築できます
- 実データが無い・検証できない・リレー到達が不完全な場合は `stale` / `incomplete` / `unavailable` を明示します。**データが無いことを成功として表示しません**
- 各カードには出所バッジ（サンプル / リレー検証済み）を表示し、実データとサンプルを混同しません
- リレー診断（リレー別カバレッジ、キュレーター、ポインタid、generation、blobハッシュ、as-of、REQ数）は `#relay-diagnostics` で確認できます

kind `30078` は NIP-78 の application-specific data で、すべてのアプリが共用します。一意性は整数kindではなく `d` タグの名前空間（`nosmaps:` 前置）で確保します。2026-08-17 時点の実測では、実リレー上の `30078` に `ditto/metadata` / `AmethystSettings` / `seen_notifications_at` など無関係なアプリのレコードが多数同居しています（サンプル300件あたり distinct `d` は 22〜227）。したがって取得は `#d` 完全一致、discovery は `t` タグ（`nosmaps`）で行い、`d` が `nosmaps:` 前置でないもの、および `L`/`l` スキーマタグ・正規形JSON・ハッシュ検証を通らないイベントはすべて破棄します。

当初は未割当の独自kind（`30367`–`30372`）を使う設計でしたが、`30367` には無関係の第三者アプリが実際に稼働しており、「registry未割当＝空き番号」が成立しないことを実測で確認したため、番号の奪い合いが原理的に発生しない `30078` + `d` 名前空間へ移行しました。

## ローカル確認

```sh
python3 -m http.server 4173 --bind 127.0.0.1
npx playwright test
```

Playwright設定はChromiumとWebKitを対象にし、デスクトップと375×812のシナリオを含みます。ビルド工程はありません。

## データと構成

`data.js` の36件を全案で共有します。NIPの番号・英語見出し・一次資料URLは `nostr-protocol/nips` の固定commitを参照し、ツール名と観測記録は画面設計用のデータです。

このリポジトリは静的ファイルだけで構成し、バックエンド、専用API、サーバ側DB、中央インデクサは追加しません。真実の源は署名済みNostrイベントであり、IndexedDBは再構築可能な派生キャッシュにすぎません。

リレー通信には `rx-nostr@3.7.5` と `@rx-nostr/crypto@3.1.6` を使います。依存は `package.json` + `pnpm-lock.yaml` で固定し、`pnpm install` 後に `pnpm run build`（esbuild）で `dist/rx-nostr.js` / `dist/rx-nostr-crypto.js` を生成します。生成物は import 文を持たない自己完結ESMで、`nostr-catalog.js` から動的 `import()` で遅延ロードします。

供給網攻撃対策として `pnpm-workspace.yaml` に `minimumReleaseAge: 10080`（7日）を明示設定しています。pnpm 10系の既定は 0 なので、この設定が無いと保護されません。除外リスト（`minimumReleaseAgeExclude`）は使いません。

リレー通信は読み取り専用（REQ）のみで、署名、イベント送信、外部画像アップロードは実装しません。
