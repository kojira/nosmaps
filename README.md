# nosmaps

Nostr周辺ツールを機能から探し、最大3件を比較できる純粋な静的サイトです。

- `index.html`: トップページ。見出し、`data.js` の収集済み記録を自動送りするカルーセル、機能探索への導線
- `nip-explorer.html`: 機能探索。複数機能のAND条件とNIPの根拠から探し、比較する

ビルドなしで静的配信できます。

## UXとi18n

- 機能選択とカテゴリ選択のアイコンはローカルのMaterial Design系SVGで統一。カテゴリは可視タイトル・短い説明も表示し、どちらも `aria-label` と `title` を提供
- 日本語と英語を `i18n.js` の辞書に集約
- 初回はブラウザ言語を検出し、未対応言語は日本語へフォールバック
- 言語選択は `sessionStorage` の `nosmaps.language` にだけ保持
- 言語変更時も検索条件、機能選択、比較、開いているダイアログを維持
- カードのレビュー画像は4:3、最大3枚と残数表示。ギャラリー、拡大、元レビューへの導線を維持
- 全ページ共通のフッターからGitHubのソース（新しいタブ）へ移動できます
- トップページのカルーセルは自動送りし、ホバー・フォーカスで停止、`prefers-reduced-motion` では自動送りしません

## 機能探索の主な操作

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

機能探索の loading / empty / error / partial / offline は通常画面に専用操作を置かず、次のURLで確認できます。

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

`nip-explorer.html?relay=1` のときだけ、リレーから署名済みNostrイベントを取得します（`nip-explorer.js` の `params.get('relay') === '1'`）。付けなければネットワークアクセスは一切発生せず、リポジトリ内の `data.js`（収集済み記録の派生ビルド）だけを表示します。

カタログのイベントは既定リレーへ投入済みです。2026-08-19 にこのリポジトリから `wss://x.kojira.io` と `wss://nos.lol` へそれぞれ `kinds:[30078] / authors:[収集者pubkey] / #t:[nosmaps]` でREQを投げ、両リレーとも41件をEOSEまで返しました（`catalogue-events.jsonl` の行数と一致）。既定を `relay=1` 側へ入れ替えるかどうかは未変更で、現在も既定は無効です。

- 既定リレーは `wss://x.kojira.io` と `wss://nos.lol`。`?relays=` と `?curators=` で上書きできます
- kind `30078`（NIP-78 application-specific data）の**レコード本体そのもの**が正本です。ポインタも別置きのカタログ本体もありません（`nostr-catalog.js` 冒頭 D2: 「no pointer, no manifest, no blob, no mirror, ... and no HTTP anywhere in this file」）。取得は `#d` 完全一致または `#t=nosmaps`、採用はNIP-01のaddressable勝者選択（`created_at` 最大、同値ならイベントid最小）です
- 署名・`d` 名前空間・content の v1 プロファイル（`schema` = `org.nosmaps.software`）の検証を通らないイベントは表示に使わず、理由付きで隔離します
- 検証済みカタログはIndexedDB（`nosmaps-catalog`）に派生キャッシュとして保存します。これは再構築可能な高速化用で、真実の源ではありません。全消去してもリレーから再構築できます
- 実データが無い・検証できない・リレー到達が不完全な場合は `stale` / `incomplete` / `unavailable` を明示します。**データが無いことを成功として表示しません**
- 一覧カードの見出しにはレコード状態バッジ（公開中 / 取り下げ済み）を出します（issue #15）。出所バッジ（一次情報から収集 / リレー検証済み）は詳細ダイアログ側にあります。座標は読者向けの画面には出しません
- リレー診断（リレー別カバレッジ、ソーシャルグラフ、キュレーター、ラウンド、as-of、REQ数、隔離、推薦されたが観測できなかった座標）は `#relay-diagnostics` で確認できます

kind `30078` は NIP-78 の application-specific data で、すべてのアプリが共用します。一意性は整数kindではなく `d` タグの名前空間（`nosmaps:` 前置）で確保します。2026-08-17 時点の実測では、実リレー上の `30078` に `ditto/metadata` / `AmethystSettings` / `seen_notifications_at` など無関係なアプリのレコードが多数同居しています（サンプル300件あたり distinct `d` は 22〜227）。したがって取得は `#d` 完全一致、discovery は `t` タグ（`nosmaps`）で行い、`d` が `nosmaps:` 前置でないもの、および content が `schema` = `org.nosmaps.software` の v1 プロファイル（`nostr-catalog.js` の `SOFTWARE_SCHEMA`）として通らないイベントはすべて破棄します。

当初は未割当の独自kind（`30367`–`30372`）を使う設計でしたが、`30367` には無関係の第三者アプリが実際に稼働しており、「registry未割当＝空き番号」が成立しないことを実測で確認したため、番号の奪い合いが原理的に発生しない `30078` + `d` 名前空間へ移行しました。

## ローカル確認

```sh
python3 -m http.server 4173 --bind 127.0.0.1
npx playwright test
```

Playwright設定はChromiumとWebKitを対象にし、デスクトップと375×812のシナリオを含みます。ビルド工程はありません。

## カタログの正本（catalogue-events.jsonl）

リポジトリ内カタログの正本は `catalogue-events.jsonl` です。1行が1件の**署名済み生Nostrイベント**（kind `30078`、`d` は `nosmaps:` 前置、`t=nosmaps`）で、リレーから流れてくる形とまったく同じです。誰が収集したかは `pubkey` が示すので、収集者名のフィールドは持ちません（署名で分かることを二重に書かない）。

現在の収集分を署名した収集者の公開鍵は次のとおりです（件数は `node tools/verify-catalogue.mjs` が表示します。2026-08-19 の実行では 41 行 / 41 件）。

```
pubkey 3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6
npub   npub18n308e7urh78e2e83etaw5uycl70dttk3mgcnt968wq0uj48s2mqkdmj4u
```

秘密鍵はこのリポジトリには存在しません。`tools/new-collector-key.mjs` は作業ツリー内へは書き込みを拒否し、署名時は環境変数 `NOSMAPS_COLLECTOR_KEY_FILE` が指すリポジトリ外のファイルから読みます。検証と `data.js` の再生成に秘密鍵は不要です。

```sh
node tools/new-collector-key.mjs <リポジトリ外のパス>                       # 鍵生成（初回のみ）
NOSMAPS_COLLECTOR_KEY_FILE=<そのパス> node tools/sign-catalogue.mjs        # 収集結果に署名して jsonl を書く
node tools/build-data.mjs                                                 # jsonl から data.js を生成
node tools/verify-catalogue.mjs                                           # 全行の署名・kind・d・t と data.js との一致を検証
node tools/check-descriptions.mjs                                         # 画面に出る各言語の説明文がすべて署名に遡れることを検証
```

`data.js` は `catalogue-events.jsonl` からの**派生ビルド成果物**です。手で編集しません。`tools/build-data.mjs` は署名が通らない行があればビルドを中断するので、未署名や改竄された記述から `data.js` が生成されることはありません。contentプロファイルに入らない注記（provenance、NIPクレーム、ライセンス等）は `real-catalog-draft.json` から `d` で突き合わせて付けています。

### 説明文の多言語化（v2 プロファイル、#14）

各言語の説明文は `content.descriptions`（言語コード→文章）として**署名の中**にあります。訳者フィールドはありません。**署名した鍵がそのまま「誰が書いたか」**だからです（同じ事実を2か所に書けば食い違いうる）。収集した原文は `summary` のままで、訳に上書きされることはなく、記録の無い言語は原文にフォールバックします。原文と同じ文字列を言語コード付きでもう一度置くことはしません。

別の言語を書きたい人は、**同じ `d` に自分の鍵で**イベントを出します。座標は `kind`+`pubkey`+`d` なので互いを置き換えず、両方が読まれます（#18 の重なりと同じ仕組み）。1つの鍵で2言語書く場合は1つの `descriptions` にまとめます（同じ鍵・同じ `d` の2通目は1通目を置き換えるため）。

`version: 1` のイベントも有効なまま読めます。v1 は「各言語の説明文を持たない記録」という意味であって、古い記録という意味ではありません。

## データと構成

`data.js` をトップページのカルーセルと機能探索で共有します。中身は架空のサンプルではなく、一次情報から収集した記録です（`meta.collected` = 2026-08-18、`meta.collector` = `primary sources only; see real-catalog-draft-report.md`、全件 `provenance` = `collected`。`node -e` で `window.NOSMAPS_DATA` を読んで実測）。NIPの番号・英語見出し・一次資料URLは `nips-registry-656cecc.json`（`nostr-protocol/nips` の固定commitのスナップショット）を参照します。一次情報が何も述べていない欄は埋めず、不在のまま表示します。

このリポジトリは静的ファイルだけで構成し、バックエンド、専用API、サーバ側DB、中央インデクサは追加しません。真実の源は署名済みNostrイベントであり、IndexedDBは再構築可能な派生キャッシュにすぎません。

リレー通信には `rx-nostr@3.7.5` と `@rx-nostr/crypto@3.1.6` を使います。依存は `package.json` + `pnpm-lock.yaml` で固定し、`pnpm install` 後に `pnpm run build`（esbuild）で `dist/rx-nostr.js` / `dist/rx-nostr-crypto.js` を生成します。生成物は import 文を持たない自己完結ESMで、`nostr-catalog.js` から動的 `import()` で遅延ロードします。

供給網攻撃対策として `pnpm-workspace.yaml` に `minimumReleaseAge: 10080`（7日）を明示設定しています。pnpm 10系の既定は 0 なので、この設定が無いと保護されません。除外リスト（`minimumReleaseAgeExclude`）は使いません。

閲覧はリレー読み取り（REQ）のみです。投稿はNIP-07拡張でのサインインが前提で（issue #9）、署名は拡張が行い、ページは秘密鍵に触れません。投稿結果を「公開できた」と表示するのはリレーから読み戻せたときだけです（`nostr-catalog.js` の `publishSoftwareRecord`）。外部画像アップロードは実装しません。
