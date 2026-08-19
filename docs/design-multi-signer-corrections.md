# Nosmaps — 同一識別子に対する複数署名者の記録（訂正の経路）

**設計書のみ。この文書はコードを一行も変更していない。** 実装は別途 GO を得てから。

- 対象 issue: #18「同じ識別子に別の署名者が記録を出せない（訂正の経路が無い）」
- 起点: `HEAD = 3cecf34`（`Order by the date a record was collected, and say that it is the collection date`）
- 実測日: 2026-08-19（初版）/ 2026-08-20（改訂 2 版。kojira の設計判断 4 点を反映し、全文を日本語に書き直した）
- 既存設計との関係: `design-relay-native-data.md`（読み取り）と `design-relay-native-write-path.md`（書き込み）の**追補**。両者の決定を上書きするのではなく、両者が答えていない一点だけを埋める。
- 記法: この文書中で「実測」と書いたものは、作業中にコードを読むかツールを実走して確認した。確認できなかったものは **未確認** と明記する。推測で埋めた値は無い。コード識別子・コマンド出力・仕様の原文引用は英語のまま残してある（訳すと実物と照合できなくなるため）。

---

## 改訂 2 版で変わったこと（kojira の設計判断）

初版から次の 4 点が変わった。以下の本文はすべてこの 4 点に従って書き直してある。

| # | 判断 | 影響する節 |
|---|---|---|
| D1 | **既定表示は「選ばない」。** 同じ識別子の記録は上書きも既定選択もせず、カードを 3 次元的に重ねて表示する。見た目は 3 枚まで重ねて見せるが、実際は存在する分すべて辿れる。手前に来る順序はソート条件に従う | M2.1, M2.2, M0.4, M5, M6 |
| D2 | **識別子（`d` 値）は Java パッケージ風をやめ、ソースコード配布場所の URI をそのまま使う。** 扱うのは基本オープンソースのみという前提 | M1.6（新設）, M0.2, M5, M7 |
| D3 | **旧 `d`（`nosmaps:<逆ドメイン>`）は捨てて 41 件を全件出し直す**（kojira 承認済み） | M1.7（新設）, M4, M5 |
| D4 | **投稿数のスケール懸念は皮算用として設計から外す。** 当面は自分たちで整備する前提 | M2.4（縮小）, M4 |

初版にあった「既定は収集鍵」案と「常に最新」案は **どちらも採らない**。初版の M6-1（未解決論点「既定表示をどちらにするか」）は D1 によって解消したので、未解決論点から外した。§0（`design-relay-native-data.md`）が捨てた "shipped default curator" への懸念も、**そもそも既定を選ばないので発生しない**（M2.1 参照）。

---

## M0. 解こうとしている問題

### M0.1 誰が困るか

1. **記述の誤りに気づいた第三者。** カタログの `summary` が古い、`homepage` が死んでいる、名前が変わった、といった誤りを見つけても、**その人には出す先が無い**。現状の唯一の経路は「収集者に伝えて収集者が直す」で、これは中央集権の依頼窓口であって Nostr の経路ではない。
2. **記述されている側（プロジェクトの publisher）。** 自分の鍵で `d` を新規に立てて自己申告レコードを出すことはできる（write-path §W2 が実装済み）。しかし**それは別の座標**であり、収集鍵の記録と並ぶだけで「収集鍵の記述が間違っている」とは言えない。同じ識別子を指した訂正にならない。
3. **収集者（俺）自身。** 41 件すべてが 1 鍵の署名なので、収集者は「正しさの唯一の持ち主」になっている。これは `design-relay-native-data.md` §0 が明示的に否定した構造（「trusted-curator list は中央権威だから捨てた」）と、実運用上ほぼ同じ形に戻っている。設計思想と実データの状態が食い違っている。

### M0.2 今どうなっているか（すべて実測）

| 観測 | 値 | どう確認したか |
|---|---|---|
| リポジトリ内カタログの件数 | 41 行 / 41 イベント | `node tools/verify-catalogue.mjs` を実走。出力 `lines: 41 / valid signed events: 41` |
| kind | すべて `30078` | 同上（`kind: 30078`）。および `catalogue-events.jsonl` を parse して kind 集合 = `{30078}` |
| 署名者 | **1 つだけ** `3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6` | 同上（`signer: 3ce2f3e7…`）。`catalogue-events.jsonl` の pubkey 集合サイズ = 1 |
| `data.js` の座標に現れる pubkey | **1 つだけ**、同じ鍵、41 件 | `data.js` を sandbox で評価し `30078:<64hex>:` を正規表現抽出、distinct = 1 |
| `data.js` の `tools[].id` | 41 件すべて一意（= 裸の `d`） | 同上、`new Set(ids).size === 41` |
| discovery topic | `nosmaps` | `src/domain/policy.ts` `DISCOVERY_TOPICS: ['nosmaps']`、`tools/catalogue-events.mjs` `DISCOVERY_TOPIC = 'nosmaps'` |
| `d` 名前空間（**D3 で廃止予定**） | `nosmaps:` 前置必須、以降は逆ドメイン風（`nosmaps:io.damus` 等） | `src/domain/policy.ts` `SOFTWARE_D_PREFIX = 'nosmaps:'`。`catalogue-events.jsonl` の全 41 件の `d` を列挙して形式を確認 |
| イベント本体（`content`）のキー | `schema` 41 / `version` 41 / `state` 41 / `name` 41 / `summary` 41 / `homepage` **27** | `catalogue-events.jsonl` を parse してキーの出現数を数えた。**`homepage` は 27 件しか無い**（41 件ではない） |
| イベントのタグ名 | `d` 41 / `t` 88 / `state` 41 / `v` 41 | 同上 |
| 署名済みイベントに**ソース URI は入っていない** | `catalogue-events.jsonl` 中の `github.com` の出現数 = **0** | `grep -c 'github.com' catalogue-events.jsonl` → `0` |

### M0.3 「出せない」のは protocol の制約ではなく、この repo の 4 か所のゲート

**重要な発見: 読み取り経路は既に複数署名者を扱える。** 詰まっているのは repo 側のビルド／検証と、UI の見せ方だけ。

| # | 場所 | 実測した内容 | issue #18 への効き方 |
|---|---|---|---|
| G1 | `tools/verify-catalogue.mjs:38-39`（署名者チェック） | `const signers = [...new Set(events.map(event => event.pubkey))]; if (signers.length > 1) failures.push(...)` — **複数署名者は FAIL** | jsonl に第三者の訂正を入れると検証が落ちる |
| G2 | `tools/verify-catalogue.mjs:34`（重複 `d` チェック） | `if (seen.has(d)) failures.push(\`duplicate d ${d} …\`)` — **同じ `d` は 2 行目で FAIL** | 「同じ識別子に別署名者」がまさにこの形なので必ず落ちる |
| G3 | `tools/build-data.mjs:41` | `if (signers.length !== 1) throw new Error(\`expected one collector, the jsonl carries ${signers.length}\`)` | ビルドが例外で止まる |
| G4 | `src/domain/entry.ts` / `tools/build-data.mjs:367` | `data.js` の `tools[].id` は**裸の `d`**（`coordinate` は別フィールドで正しく `30078:<signer>:<d>`） | `id` が衝突する。`data.js` は同一 `d` を 2 件持てない |

一方、**読み取り側（リレー経路）にはこの制約が無い**:

- `src/domain/winners.ts` `selectSoftwareWinners` はイベントを **coordinate（= `kind:pubkey:d`）でグルーピング**している（`groups` Map のキーが coordinate）。署名者が違えば座標が違うので、**別グループ = 別 winner** になる。上書きは起きない。
- `src/domain/catalogue.ts` `buildCatalog` は winner ごとに 1 entry を作る。
- `src/ui/explorer/relay-row.ts` の `RelayRow.id` は `` `relay:${entry.coordinate}` `` なので、署名者が違えば **id も衝突しない**。

**結論（実測）: 同じ `d` に別署名者が記録を出したら、今日のコードでもリレー経由では 2 行として両方表示される。** ただし

- **どちらが「同じものについて言っている」のかを示す仕組みが一切無い。** `d` でグルーピングする箇所はコード中に存在しない（`src/` 全体で `d` によるグルーピングは無く、キーは常に coordinate）。同じツールについての 2 件が、名前が同じだけの無関係な 2 行として並ぶ。
- **既定でどれを見せるかの規則が無い。** 順序は `src/domain/graph.ts` `orderEntries`（推薦数 → `createdAt` 降順 → eventId）で決まるだけ。
- **信頼リストという概念がコードに無い。** 近いものは `?curators=` クエリ（`src/ui/explorer/params.ts` の `manualCounted`）だが、これは **kind 30267 のキュレーションを数える対象**であって、レコードの署名者を選ぶものではない。しかも**クエリ文字列だけで、永続化されていない**（実測: `manualCounted` を localStorage / IndexedDB に書く箇所は無い。`localStorage` を使うのは `src/ui/explorer/draft-storage.ts` の投稿下書き 1 か所のみ）。

つまり issue #18 は **「protocol が出せない」問題ではなく、「repo のカタログ生成が 1 署名者を前提にしていて、UI が併存を併存として見せない」問題**。ここが今回の設計対象。

### M0.4 D1 が問題の形をどう変えたか

初版は「複数あるとき **どれを既定で見せるか**」を設計の中心に置いていた。D1 はその問いごと退けた。

**我々は選ばない。** 同じ識別子に N 件の記録があるなら、UI は N 件が在るという事実をそのまま見せる。1 件を代表に立てて残りを「その他」に落とす構造を作らない。したがって:

- 「収集鍵を既定にする」も「常に最新を既定にする」も採用しない。前者は §0 が捨てた shipped default curator に構造が近く、後者は新しく出しただけの記録が表示を奪える。**どちらの弱点も、既定を作らないことで消える。**
- 初版の `displayed` / `displayedBy` / `others` という型設計は、**代表 1 件を選ぶ前提そのもの**だったので破棄する（M1.4 を書き直した）。
- 代わりに設計すべきは「**重なりの見せ方と、重なりの中の順序**」になる（M2.1, M2.2）。

---

## M1. データモデル

### M1.1 訂正は「同じ `d`、自分の鍵、同じ kind」

訂正者は次を出す:

```
kind    : 30078
pubkey  : 訂正者自身の鍵
d       : 訂正対象と同一（D2 適用後の例 "nosmaps:github.com/damus-io/damus"）
t       : "nosmaps"（discovery に載せるため）
content : org.nosmaps.software v1 プロファイル（現行と同一、変更なし）
```

結果として座標は `30078:<訂正者>:<d>` になり、収集鍵の `30078:3ce2f3e7…:<d>` とは**別の addressable アドレス**になる。上書きは起きない。**併存**する。

### M1.2 置換規則が `pubkey + kind + d` 単位であることの一次情報

**一次情報で裏が取れた（primary source verified）。** `nostr-protocol/nips` の commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`（この repo が `nips-registry-656cecc.json` で pin しているのと同じ commit。`registry.revision` を実測して一致を確認）から `01.md` を取得し、以下を読んだ:

> for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value -- which means that, for each combination of `kind`, `pubkey` and the `d` tag value, only the latest event MUST be stored by relays, older versions MAY be discarded.
> — NIP-01 `01.md`（commit 656cecc、取得 2026-08-19）

「for each combination of `kind`, `pubkey` and the `d` tag value」が要点。**pubkey が違えば別の組み合わせであり、別々に保持される。** これが M1.1 の根拠。

**NIP-33 について（依頼文が「NIP-33 の置換規則」と呼んでいるもの）:** 同 commit の `33.md` 全文は次のとおりで、規則の本体は NIP-01 に移っている:

> NIP-33 / Parameterized Replaceable Events / `final` `mandatory` / Renamed to "Addressable events" and moved to [NIP-01](01.md).

したがって**この設計は NIP-33 ではなく NIP-01 を引く**。`design-relay-native-data.md` §19.1 も既に NIP-01 `01.md:96-99` を引いており、そちらが正しい。なお同文書 §21.2.3 は「nostr-rs-relay などが NIP-33 を claim している」と書いているが、それは第三者プロジェクトの自己申告の話であって、我々が依拠する規則の出典ではない。

**`a` タグの座標形式**（将来の言及で使う）も同 commit で確認:

> for an addressable event: `["a", "<kind integer>:<32-bytes lowercase hex of a pubkey>:<d tag value>", <recommended relay URL, optional>]`
> — NIP-01 `01.md`（commit 656cecc）

**同一 `created_at` のタイブレーク**も確認:

> In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained, and the other discarded.

これは `src/domain/winners.ts` `selectAddressableWinner` の実装（`created_at` 最大、同値なら `id` 最小）と一致している（実測）。

### M1.3 「同じものについて言っている」をどう識別するか — `d` 一致だけ

**規則: 同一 `d`（文字列完全一致）を持つ記録は、同じ主題についての記録として *重なり（stack）* にまとめる。それ以上の推論はしない。**

- 名前の類似、`homepage` の一致、アイコンの一致は**使わない**。`design-relay-native-data.md` §4.3 が「似た `d` を別 pubkey 下で auto-merge してはならない」と書いているのは**アイデンティティ（誰のレコードか）の話**であって、ここで導入するのは**表示上の重ね方**である。両者は別物なので §4.3 との矛盾は無い。ただし混同を避けるため、UI 上の文言は「同じ識別子 `<d>` について N 人が記録を出している」であり、「同じツール」ではない。**識別子が同じことしか観測していないので、識別子が同じとしか言わない。**
- `d` が 1 バイトでも違えば別の重なり。**ただし D2 で `d` が URI になるため、「どこまでを同じ URI とみなすか」の正規化規則が新たに必要になる。これは M1.6 で決める。** 正規化は `d` を生成する側（記録を出す前）で行い、**読み取り側は正規化しない**（署名済みイベントの `d` を後から書き換えて突き合わせる、はやらない）。

### M1.4 データ構造（追加する型の形。実装ではなく形の宣言）

D1 に合わせて初版から書き直した。読み取り経路に **1 段の集約層**を足す。`selectSoftwareWinners` の出力（coordinate ごとの winner の列）を入力に取り、`d` ごとに束ねる純関数を `src/domain/` に置く。

```
RecordStack {
  d        : string      // "nosmaps:github.com/damus-io/damus"
  records  : Winner[]    // d が一致する winner。署名者ごとに 1 件ずつ。
                         // 並びは呼び出し側が渡すソート条件で決まる（M2.1）。
                         // records[0] が「手前」だが、それは既定選択ではなく単なる並び順の先頭。
  observed : number      // records.length。観測できた数そのもの。
  complete : boolean     // リレー到達が完全だったか。既存の coverage/incomplete 診断から引く
}
```

初版にあった `displayed` / `displayedBy` / `others` は**置かない**。理由: この 3 つは「代表 1 件を選び、残りを二級市民にする」構造そのもので、D1 が退けた形だから。**`records` は 1 本のフラットな列で、優劣を型で表現しない。**

- `observed` は**観測できた数だけを言う**。`complete === false` のときは UI に「到達が不完全」を併記し、「N 人以上」とは書かない（数を盛らない）。
- `records.length === 0` の `RecordStack` は作らない（重なりは最低 1 件から）。
- **既存の型は壊さない。** `CatalogEntry` / `RelayRow` はそのまま残し、`RecordStack` はその上に乗せる。理由: `RelayRow` は `src/ui/explorer/relay-row.ts` の run 2 で「オリジナルとフィールド単位で差分 0」を取って切り出された境界であり、ここを触ると差分検証の根拠が失われる。

### M1.5 保持（キャッシュ）

`src/data/cache.ts` は IndexedDB のストアを **`keyPath: 'coordinate'`** で作っている（実測）。coordinate は pubkey を含むので、**複数署名者を入れてもキー衝突は起きない。キャッシュ層の変更は不要。**

### M1.6 識別子（`d` 値）の形式 — D2

**決定: `d` の中身は、逆ドメイン風の人為的な ID をやめ、そのソフトウェアの「ソースコードが配布されている場所の URI」を使う。** 前提は「このカタログが扱うのは基本オープンソースのみ」。

#### M1.6.1 なぜ変えるか

- 逆ドメイン風 ID（`nosmaps:io.damus`、`nosmaps:com.mikedilger.gossip`）は**我々が発明した名前**であり、誰かが同じ ID に辿り着く保証が無い。第三者が訂正を出そうにも、まず「このツールの nosmaps ID は何か」を我々に聞かないと分からない。**訂正の経路（issue #18）を作るのに、識別子が我々の私物では話にならない。**
- ソース URI なら**外部に既に存在する座標**であり、誰でも同じ値に独立に到達できる。第三者が我々に問い合わせずに訂正を出せる。
- 実測: 逆ドメイン風 ID は既に破綻の兆候が出ている。`real-catalog-draft.json` の `facts_with_no_home_in_v1_profile` には `d_choice` / `d_note` / `identifier_note` / `name_domain_mismatch` / `identity_problem` / `identity_drift` といった「ID の付け方に悩んだ」記録が各 1 件ずつ入っている（実測。キー出現数を数えた）。

#### M1.6.2 実データでソース URI が取れるか（実測）

**2 か所を実測した。結果は取得元によって違う。**

| 取得元 | フィールド | 取れた件数 | 取れなかった件 |
|---|---|---|---|
| `data.js` の `tools[].sourceRepo` | `sourceRepo` | **41 / 41** | 0 件 |
| `real-catalog-draft.json` の `entries[].facts_with_no_home_in_v1_profile.source_repo` | `source_repo` | **39 / 41** | 2 件（下記） |
| `catalogue-events.jsonl`（署名済みイベント本体） | — | **0 / 41** | 41 件全部。**署名済みイベントにソース URI は一切入っていない**（`grep -c 'github.com' catalogue-events.jsonl` = 0） |

`data.js` が 41/41 になるのは、`tools/build-data.mjs:398` が 3 つのキーからフォールバックして拾っているため（実測）:

```js
sourceRepo: facts.source_repo || facts.source_repo_mirror || facts.mirror || null,
```

**`source_repo` が無い 2 件の内訳（実測）:**

| `d`（旧） | 状況 | 実際に入っている値 |
|---|---|---|
| `nosmaps:to.iris` | `source_repo` 無し。`canonical_repo` が「Main development is on decentralized git: `htree://npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/iris-client`. GitHub is a mirror.」と述べている | `source_repo_mirror: "https://github.com/irislib/iris-client"` |
| `nosmaps:io.sourcehut.nostr-rs-relay` | `source_repo` 無し。`canonical_home` が `https://sr.ht/~gheartsfield/nostr-rs-relay/`（mirror の description 由来） | `mirror: "https://github.com/scsibug/nostr-rs-relay"` |

**つまり「URI が取れない件は 0 件、しかし『どの URI が正か』が確定していない件が 2 件ある。」** この 2 件は「mirror の URI を `d` にするのか、canonical の URI を `d` にするのか」を人が決める必要がある。自動では決められない。→ M6-1（未解決）。

#### M1.6.3 41 件の URI の実測プロファイル

`data.js` の `sourceRepo` 41 件を実測した:

| 観測 | 値 |
|---|---|
| ホスト | **`github.com` が 41 / 41**（他ホストは 0） |
| スキーム | **`https://` が 41 / 41**（`http://` や他スキームは 0） |
| 末尾スラッシュあり | **0 件** |
| 大文字を含む URI | **9 件**（`PrimalHQ/primal-web-app`, `SnowCait/nostter`, `YakiHonne/web-app`, `greenart7c3/Amber`, `getAlby/lightning-browser-extension`, `KoalaSat/pokey`, `ZeusLN/zeus`, `getAlby/hub`, `MutinyWallet/mutiny-web`） |
| 一意性（生の文字列） | **41 / 41 が一意**（重複 0） |
| 一意性（スキーム除去・末尾スラッシュ除去・全小文字化後） | **41 / 41 が一意**（重複 0） |
| バイト長（生） | 最小 28 / 最大 54 |
| バイト長（`https://` 除去後） | 最小 20 / 最大 46 |
| printable ASCII（`D_ASCII_RE = /^[\x21-\x7e]+$/`）に収まるか | **41 / 41 が収まる** |

**サイズの結論（実測）:** `nosmaps:` 前置（8 バイト）を残して生の URI をそのまま入れても、最長で **62 バイト**。`D_MAX_BYTES = 192` に対して十分な余裕がある。**バイト長は制約にならない。**

#### M1.6.4 `d` の具体形式（設計としての決定）

**決定した形式:**

```
d = "nosmaps:" + <正規化済みソース URI>
例: d = "nosmaps:github.com/damus-io/damus"
```

**正規化規則（何を落とすか）:**

| # | 落とすもの | 理由 | 実データでの影響（実測） |
|---|---|---|---|
| N1 | **スキーム**（`https://` / `http://`） | `https` と `http` は同じリソースを指す。スキームを残すと「同じ repo なのに `d` が 2 種類」が起こりうる | 41 件すべてが `https://` なので、今の 41 件では衝突は生じない。将来の第三者投稿への予防 |
| N2 | **末尾スラッシュ**（1 個以上をすべて除去） | `…/damus` と `…/damus/` は同じ | 現データに末尾スラッシュは **0 件**。予防のみ |
| N3 | **ホスト部の大文字小文字**（ホスト部のみ小文字化） | ホスト名は大文字小文字を区別しないという扱いが一般的 | 41 件すべてホスト部は既に `github.com`（小文字）。影響 0 |
| N4 | **パス部の大文字小文字は落とさない（保持する）** | ホストによってはパスが大文字小文字を区別する。一律小文字化すると、区別するホストで別リソースを同一視してしまう | 大文字を含む 9 件はパス部の大文字がそのまま `d` に入る |

**落とさないもの（明示）:** パスの大文字小文字（N4）、`www.` の有無、ポート番号、末尾の `.git`、クエリ文字列とフラグメント（そもそも入っていない。**入ってきた場合の扱いは未確認 → M6-2**）。

**N3 と N4 が食い違う点についての判断:** GitHub は実際にはパスの大文字小文字を区別しない（`/DAMUS-IO/DAMUS` でも到達する）ので、N4 を守ると「同じ repo に大文字違いの `d` が 2 つ」が理論上ありうる。それでも N4 を採る理由は、**「GitHub がそう振る舞う」を全ホストに一般化する根拠が無い**から。ホスト個別の特例（github.com だけ小文字化）は入れない。**同一 repo に大文字違いの `d` が並んだら、それは 2 つの別の重なりとして表示される。これは意図した挙動であり、バグではない。** 現データではこの状況は 1 件も発生しない（正規化後も 41/41 一意、実測）。

**なぜ `nosmaps:` 前置を残すか:** 前置は `d` の名前空間マーカーであり、URI 形式への移行とは独立した話。実測で `SOFTWARE_D_PREFIX` / `D_PREFIX` は `src/domain/policy.ts:54`、`tools/catalogue-events.mjs:13`、`tools/verify-catalogue.mjs`、`tools/sign-catalogue.mjs` の 4 か所でゲートとして効いている。前置を外すと `d` が「ただの URI」になり、他アプリの kind 30078 と混ざる可能性が出る（kind 30078 は NIP-78 の汎用 application-specific data であり、名前空間の分離は我々の責任）。**したがって前置は残す。**

> **未解決（M6-3）:** kojira の指示は「ソースコード配布場所の URI を*そのまま*使う」だった。上の決定は「`nosmaps:` 前置 + 正規化済み URI」なので、厳密には「そのまま」ではない。「本当に `d = "https://github.com/damus-io/damus"` と生で入れる（前置なし・正規化なし）」が意図なら、この節の N1–N4 と前置の決定を差し替える必要がある。**どちらかの確認がいる。**

### M1.7 旧 `d` の廃棄と 41 件の再発行 — D3

**決定（kojira 承認済み）: 旧 `d`（`nosmaps:io.damus` 等の逆ドメイン風）は捨てる。互換性は取らない。41 件を新しい `d` で全件署名し直す。**

#### M1.7.1 何を再署名するか

41 件すべて。`d` タグ以外（`kind` / `t` / `state` / `v` / `content`）は変更しない。ただし `d` が変わると `id` と `sig` は必然的に全件変わる。

再署名の実行経路は既存の `tools/sign-catalogue.mjs` をそのまま使う（実測: このツールは `real-catalog-draft.json` の `entries[].event_skeleton` を読み、`d` の前置を検証してから `@rx-nostr/crypto` で署名する）。したがって:

1. `real-catalog-draft.json` の各 `entries[].event_skeleton.tags` の `d` を新形式に書き換える（**これは `docs/` の外なので今回はやらない。実装フェーズの作業**）。
2. 同ファイルの `entries[].coordinate_template`（現在 `30078:<publisher-hex>:nosmaps:io.damus` 形式）も追随して書き換える。
3. `NOSMAPS_COLLECTOR_KEY_FILE` を設定し、`node tools/sign-catalogue.mjs --force` を実行する。**`--force` は必須**（実測: `catalogue-events.jsonl` が既存だと `--force` 無しでは exit 2 で止まる）。
4. `node tools/build-data.mjs` で `data.js` を再生成する。
5. `node tools/verify-catalogue.mjs` が exit 0 になることを確認する。

#### M1.7.2 旧イベントをどう扱うか

**方針: kind:5（削除要求）を出す。放置しない。**

理由: 旧 `d` の 41 件はリレー上に残り続ける。放置すると、**同じソフトウェアについて「旧 ID の記録」と「新 ID の記録」が別の重なりとして 2 つ並ぶ**。D1 は「重なりは実在するものだけ見せる」設計なので、我々自身が作った幽霊で重なりを 2 本にするのは設計と矛盾する。

ただし次を明記する:

- **削除要求はリレーへの「お願い」であって保証ではない。** リレーが従う義務があるか、addressable event に対する削除がどう扱われるかは、今回 NIP-09 の原文を取得して確認していない。**未確認**（M8 に記載）。
- したがって設計としては「**kind:5 を出す。そのうえで、旧 `d` がリレーに残っていても壊れないこと**」を要求する。具体的には、旧 `d` は新形式の正規化規則（M1.6.4）に合致しないので、`d` が URI 形式であることを要求する検証を入れれば**旧 `d` は自動的に別物として扱われる**。UI 上は「旧 ID の記録」として単に別の重なりに見える（実害はあるが破壊ではない）。
- **旧イベントを「削除できたこと」を UI に表示しない。** read-back で消えたことを確認していない限り、消えたとは言わない（write-path §W4.3 の read-back 規約と同じ姿勢）。

#### M1.7.3 直す必要があるファイル（実測に基づく見取り図）

**この節は移行計画であり、今回はコードを一切変更していない。**

| ファイル | 何をするか | 実測した根拠 |
|---|---|---|
| `real-catalog-draft.json` | 41 件の `event_skeleton.tags` の `d` と `coordinate_template` を新形式に。2 件（M1.6.2）は `source_repo` が無いので人が決める | `entries` = 41、`event_skeleton.tags[0]` が `["d", …]` であることを実測 |
| `catalogue-events.jsonl` | `sign-catalogue.mjs --force` で全件再生成（41 行すべて `id` / `sig` / `d` が変わる） | 現在 41 行 / 署名者 1 / kind 30078 を実測 |
| `data.js` | `build-data.mjs` で再生成。`tools[].id` と `tools[].coordinate` が全件変わる | `id` は裸の `d`（G4）であることを実測 |
| `tools/catalogue-events.mjs` | `D_PREFIX` のチェック（`:58-59`）に加えて、**`d` の前置以降が URI 形式であること**の検証を足す。現在は「前置があり、前置だけではない」しか見ていない | `:58-59` を実測 |
| `tools/verify-catalogue.mjs` | `d` の形式検証を上に追随させる。**G1（複数署名者 FAIL, `:38-39`）と G2（重複 `d` FAIL, `:34`）をどうするかは M4-7 の判断次第で、D3 の移行そのものには不要** | `:34`, `:38-39` を実測 |
| `tools/build-data.mjs` | **最大の作業。旧 `d` をキーにしたリテラルが 91 か所ある**（`grep -c "'nosmaps:" tools/build-data.mjs` = 91）。アイコン URL の表（`:191` 付近）と日本語説明の表（`:310` 付近）が旧 `d` をキーにしているので、全部張り替えないと 41 件の説明とアイコンが落ちる | 91 という件数を実測。`:191` / `:310` / `:312` の実物を確認 |
| `src/domain/policy.ts` | `SOFTWARE_D_PREFIX`（`:54`）は据え置き。ただし `D_RE`（`:62` 付近で前置 + 任意文字列を組む正規表現）を URI 形式に締めるかは判断がいる | `:54-70` を実測 |
| テストと UI の固定文字列 | `nosmaps:` リテラルを含むファイルが `src/` に 6 本（`i18n.ts`, `explorer/dom.ts`, `explorer/app.ts`, `data/catalogue-data.ts`, `domain/entry.ts`, `domain/policy.ts`）、`tools/` に 4 本、`tests/` に **7 本**（`coordinate-hidden-and-liveness`, `sort-order`, `relay-render`, `write-path`, `reactions`, `relay-unit`, `collapsed-card-and-carousel-entry`）。旧 `d` を期待値に焼いているものは張り替えが要る | `grep -rln "nosmaps:" src tools tests` で実測 |

**このファイル一覧は「触る必要がある場所の見取り図」であって、実際の変更量は測っていない（未確認）。** 特に `tools/build-data.mjs` の 91 か所については、そのうち何件が旧 `d` をキーにした表で、何件が別用途かを 1 件ずつ分類していない。

---

## M2. 読み取り側

### M2.1 既定表示は作らない — D1

**規則: 同じ `d` に複数の記録があるとき、我々はどれも「既定」に選ばない。全部見せる。**

初版の「信頼リスト → 収集鍵 → 最新」という優先順位規則は**丸ごと破棄**した。代わりに置くのはこれだけ:

1. **重なりの中の順序は、ユーザーが選んでいるソート条件に従う。** `src/domain/sorting.ts` の `SORT_KEYS` は実測で 7 つ: `'default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc', 'collected-desc', 'collected-asc'`。重なりの中も**同じキーで並べる**。一覧の並びと重なりの中の並びで別のルールを使わない。
2. **「手前に来る」は選択ではなく順序である。** `records[0]` が手前に描かれるが、それは「我々がこれを正しいと判断した」ではなく「あなたが選んだ並び順で先頭に来た」でしかない。UI の文言もそう書く。
3. **収集鍵をコードに焼き込まない。** 初版は収集鍵を既定に据える案を出し、それが §0 の "shipped default curator" に近いことを自己弁護していた。D1 でその必要が消えた。**`src/domain/policy.ts` に収集鍵の定数を足さない。**
4. **信頼リストは D1 の下では「順序を変える道具」であって「表示を決める道具」ではない。** 信頼している署名者の記録を手前に寄せることはできてよいが、それは既定ではなくユーザー操作の結果。信頼リストが空でも全記録が見える。

**§0（`design-relay-native-data.md`）の shipped default curator 懸念について。** §0 は「trusted-curator list を同梱すると中央権威になる」という理由でそれを捨てた。初版の M2.1 は収集鍵を既定表示に据えることでこの構造を実質的に復活させかけており、初版自身が M6-1 でそれを未解決として残していた。**D1 はこの懸念を、妥協ではなく除去で解決する。** 既定として同梱される curator が存在しないので、権威の座そのものが無い。invariant I7（信頼リストを変えても listable な行集合は変わらない）は自動的に維持される — 信頼リストは表示内容に一切関与しないため。

### M2.2 複数存在するときの見せ方 — 3 次元的な重ね（D1）

**原則: 上書きしない。隠さない。数を捏造しない。代表を立てない。**

1. **一覧では 1 つの識別子 = 1 つの重なり。** N 行に増やさない（同じ識別子が並ぶと「別々のツールが N 個ある」に読めるが、それは事実に反する）。代わりに **カードを 3 次元的に重ねて描く**。奥にカードが控えていることが見た目で分かる。
2. **重ねて見せるのは最大 3 枚まで。** 4 枚目以降は視覚的に描かない（重ねすぎると読めない）。**ただし辿れる件数は制限しない。** 存在する分はすべて操作で到達できる。**「3 枚しか無い」とは絶対に書かない。**
3. **枚数は必ず数字で出す。** 「N 件の記録」と表示する。N は `records.length`（= `observed`）。**見えている 3 枚と実際の N が食い違うことを、数字が担保する。** リレー到達が不完全なときは「観測できたのは N 件、到達は不完全」と併記し、「N 件以上」とは書かない。
4. **N = 1 のときは重ねない。** 平らな 1 枚のカードで、枚数バッジも出さない（「1 件しか無い」を毎行に書くのはノイズ）。ただし詳細ダイアログには常に署名者を出す。
5. **手前・奥の入れ替えは 1 操作で。** カードの重なりをクリック / タップすると次の記録が手前に来る。奥のカードに到達するのに詳細ダイアログを開く必要が無いようにする（ダイアログは全件一覧のためのもので、めくるための唯一の手段にしない）。
6. **詳細ダイアログに「この識別子の記録」セクション**を置く。`records` を現在のソート順で**全件**、それぞれ次を出す:
   - 署名者（npub 短縮 + 全文コピー可能。`src/ui/explorer/relay-row.ts` の `shortKey` を再利用）
   - `created_at`（issue #21 で「収集された日付」として出している軸に揃える）
   - `name` / `summary` / `homepage` の**実際の差分**（同じ値なら「同じ」と書き、違う値は両方見せる。どちらが正しいとは書かない）
   - eventId
   - どのリレーで観測したか（`buildCatalog` の `sources` を既に持っている）
7. **「訂正」という語を UI で使わない。** 我々が観測しているのは「同じ識別子に別の鍵が別のことを書いた」だけで、どちらが訂正でどちらが誤りかは観測していない。文言は「別の署名者による記録」。
8. **差分の見せ方で断定しない。** 「A が B を訂正した」ではなく「A と B は `summary` が違う」。

### M2.3 信頼リストの持ち方（永続先）

**D1 により、信頼リストの位置づけが初版から下がった。** 初版では信頼リストが「何を表示するか」を決める中核だった。D1 の下では**表示内容には一切関与せず、重なりの中の順序に効くだけ**。したがって Phase 1 で issue #18 は成立し、信頼リストは無くても訂正は読める。

3 案。**推奨は案 A（Phase 1）、必要になったら案 B。**

| 案 | 置き場所 | 良い点 | 悪い点 |
|---|---|---|---|
| A | `localStorage`（デバイスローカル） | 署名不要・オフライン可・実装が小さい。既に `draft-storage.ts` で localStorage を 1 か所使っている前例がある | デバイス間で共有されない |
| B | NIP-51 の set として自分の鍵で署名し、リレーに置く | Nostr らしい。デバイス間で共有される。「誰を信頼するか」がユーザー所有のデータになる | 署名者（NIP-07）が必要。書き込み経路が増える |
| C | クエリ文字列（`?signers=`）のみ | 実装ゼロに近い。テストから駆動しやすい | 永続しない |

**案 B に使う kind について（一次情報で確認済み）。** NIP-51（commit 656cecc、`51.md`）は:

> | Follow sets | 30000 | categorized groups of users a client may choose to check out in different circumstances | `"p"` (pubkeys) |

および

> Sets are lists with well-defined meaning that can enhance the functionality and the UI of clients that rely on them. Unlike standard lists, users are expected to have more than one set of each kind, therefore each of them must be assigned a different `"d"` identifier.

したがって **kind 30000（Follow sets）に `d = "nosmaps:signers"`、`p` タグで署名者を列挙**する形が、既存の NIP に収まる。新 kind も新 NIP も作らない（`design-relay-native-data.md` §2「No new NIP, BUD, or HTTP API」を守る）。

**未確認:** 「nosmaps 用の信頼署名者リスト」に相当する**専用の**登録済み kind が NIP-51 に在るかは調べ切れていない。上記は「汎用の Follow set を `d` で名前空間して使う」提案であって、「専用 kind が無いことを確認した」ではない。**未確認**。

**空のときの扱い（不変）:** 信頼リストが空であることは「0 人を信頼している」であって「不明」ではない。D1 の下では空でも全記録が見えるので、フォールバック先という概念自体が無い。invariant I8（unknown ≠ 0）に違反しない。

### M2.4 リレー問い合わせは増えるか

**増えない。** discovery は既に `{"kinds":[30078],"#t":["nosmaps"],"limit":500}` の `t` 全走査（`src/data/load.ts` R1、実測）なので、**別署名者の記録は既に同じ REQ で降ってくる**。`#t` を付けた訂正なら追加ラウンド 0。

- 信頼リスト（案 B を入れる場合）の kind 30000 取得は、R1 に既に居る viewer の kind 3 フィルタと**同じラウンドに相乗り**させる。§9.2 の REQ 予算表に行を足す必要は無い、という主張は**未検証**（`MAX_FILTERS_PER_REQ = 8` に当たらないかを実装時に測ること）。
- `t` を付けていない訂正は discovery に載らない。**これは仕様どおりの可視性の穴**として、`design-relay-native-data.md` §16.2 の「labelled visibility gap」と同じ扱いで明記する。座標が既に分かっている場合だけ R3 の gap-fill で拾える。

**投稿数が増えたときの負荷について — D4。** 初版はここで `limit: 500` の頭打ちや、記録が大量に増えたときの REQ 予算を論じかけていた。**その議論はこの設計から外した。** 当面このカタログは自分たちで整備する前提であり、第三者投稿が `limit` を溢れさせる規模になるという前提は観測に基づいていない（**現在の総件数は 41、署名者は 1**）。**観測していない将来の規模を根拠に設計を曲げない。** 実際に件数が増えて `limit` に当たったら、そのとき実測して設計し直す。

---

## M3. 書き込み側

### M3.1 誰がどう訂正を出すか

**訂正を出す人 = 自分の鍵で `d` を指定して publish する人。** 既存の write-path をほぼそのまま使える。

現状の投稿フォーム（`src/ui/explorer/app.ts` の publish フォーム、実測）は:

- `publish-d` に**ローカル部分だけ**を入力させ、`SOFTWARE_D_PREFIX` を前置してバイト数を数えている（`app.ts` の `publishDBytes`）
- 署名は NIP-07、`buildSoftwareDraft` → `validateSoftwareEvent`（読み取りと**同じ関数**）→ `signEvent` → `sendEvent` → read-back（`src/data/publish.ts`）

つまり **今日でも、既存の `d` を手で打ち込めば訂正は出せる。** 足りないのは導線と警告だけ。

**足すもの（UI のみ、プロトコルは不変）:**

1. **「この識別子について記録を出す」導線。** 詳細ダイアログから publish フォームを開き、`d` を**その識別子で pre-fill**する。`d` は read-only にしない（別のものを書きたい人を止めない）が、変更したら 3 の警告に切り替える。
2. **D2 に伴う入力の変更。** `d` のローカル部分がソース URI になるので、フォームは「ソースコードの配布場所（URL）」を尋ねる形にし、入力を M1.6.4 の N1–N4 で**正規化してから** `d` を組み立てる。**正規化後の `d` を必ずユーザーに見せる**（「あなたが入力した URL はこの識別子になります」）。黙って書き換えると、別の記録と重ならなかったときに理由が分からない。
3. **署名者が自分であることの明示。** 「あなたは `npub1…` として、識別子 `<d>` に**あなた自身の記録**を出します。既存の記録は書き換わりません。両方が重なって表示されます。」— これは `design-relay-native-write-path.md` §W6.4 の「protocol 上、他人の座標には絶対に書けない」を、ユーザーに見える言葉にしたもの。
4. **既に自分の記録がある場合。** それは更新（同じ座標の新しい `created_at`）であり、§W6.2 の Update そのもの。「新しい記録を作る」ではなく「あなたの記録を更新する」と言い分ける。
5. **`t` タグ。** 訂正にも `t=nosmaps` を必ず付ける（付けないと discovery に載らず、誰にも届かない）。これは既に `buildSoftwareDraft` の挙動である想定だが、**未確認**（`src/data/publish.ts` の tag 構築を今回は読み切っていない。実装前に確認すること）。

### M3.2 既存 write-path 設計との関係 — 矛盾は無い

`design-relay-native-write-path.md` を読み直した結果、**この設計と矛盾する記述は見つからなかった。**

- **§W6.4「Who may, and how that is enforced」** は「座標の pubkey だけが書ける（I2）」と書いており、これは本設計の前提そのもの。むしろ本設計は §W6.4 の帰結を UI に出すだけ。
- **§W6.2「`d` is immutable in the edit form」** は「`d` を変えると別の無関係なレコードになる」と書いている。本設計は**逆向き**に「`d` を同じにすると同じ識別子についての別署名者の記録になる」を使う。同じ規則の裏表であり、矛盾しない。
- **§W7「Scope boundary」** はレビュー等を範囲外にしているが、複数署名者の併存については何も述べていない（禁止も許可もしていない）。

**ただし write-path.md 側に 2 か所、追記が必要**（誤りではなく欠落）:

1. **§W6.1 への追記。** 現行の §W6.1 は「自分のレコードを探す」ために `[{"kinds":[30078],"authors":["<self>"],"limit":64}]` を投げると書き、「これは自分の鍵の exact match なので §13.1 の arbitrary author discovery ではない」と正当化している。本設計を入れると、**publish フォームを「他人が既に記録を持っている `d`」に対して開く**ケースが生じる。§W6.1 の自己クエリはそのままでよいが、「このフォームで作る記録が、既存の他署名者の記録を**置き換えない**」ことを §W6.1 か §W6.2 の表に 1 行として明記すべき。追記であって修正ではない。
2. **D2 に伴う追記。** §W6.2 が `d` を「不変」と書いている前提は変わらないが、`d` の**中身の作り方**（URI の正規化）が新しく決まったので、フォームの入力仕様として 1 行足す必要がある。

`design-relay-native-data.md` 側は **§4.3 に注記 1 つ**。§4.3 は「似た `d` を別 pubkey 下で auto-merge するな」と書いているので、M1.3 の「表示上の重ねは merge ではない」を明記しないと、後から読んだ人が §4.3 違反と誤読する。

---

## M4. 作らないもの（スコープ外）

明示的に**作らない**。「後のフェーズ」ではなく「この設計の外」。

1. **代表レコードの自動選択。** D1 のとおり。同じ識別子の複数記録から「これが正しい 1 件」をアプリが選ぶ機能を作らない。既定の curator も、既定の「最新優先」も置かない。
2. **評判システム。** 署名者にスコア・ランク・星を付けない。信頼リストは in / out の 2 値のみで、リスト内に順位を作らない。
3. **多数決 / 合議。** 「3 人が同じことを書いているからそれが正しい」をやらない。件数は表示するが、件数で表示内容を決めない。
4. **モデレーション / 通報 / ブロック。** 気に入らない署名者を「消す」機能を作らない。信頼リストから外すのは自分の並び順の話であって、他人の記録の可視性ではない。
5. **署名者の身元確認。** NIP-05 の照合をこの経路に持ち込まない（§4.3 の `nip05_linked` は既存の別軸で、所有権の証明ではないと既に書かれている）。
6. **自動マージ / フィールド単位の採用。** 「name は A から、homepage は B から」をやらない。表示するのは常に**1 つの署名済みレコードの中身をそのまま**。`design-relay-native-data.md` が revision 1 の field provenance マージを削除した理由（§「conflict was an artifact of the mechanism」）をそのまま継承する。
7. **旧 `d` との互換レイヤ。** D3 で旧 `d` は捨てる。旧 ID と新 ID を対応づけて「同じもの」として重ねる表を持たない。旧 ID の記録がリレーに残っていたら、それは単に別の識別子として別の重なりに見える。
8. **スケールを見越した最適化。** D4 のとおり。ページング、シャーディング、`limit` の分割、投稿レート制限、スパム対策のいずれも設計に入れない。**41 件・署名者 1 という観測値が現実であり、そこから先は観測してから考える。**
9. **収集鍵の記述を第三者が書き換える経路。** 存在しないし、作れない（protocol 上不可能）。
10. **リポジトリ内 `catalogue-events.jsonl` の複数署名者化。** M6-4 参照。今回は **repo の正本は収集鍵 1 つのまま**とし、訂正は**リレー上にのみ**存在する、を既定案とする。

---

## M5. 完了の判定条件

新規 `tests/multi-signer.spec.js`（既存の Playwright 構成に合わせる）。**テスト名は案。** D1 / D2 / D3 に合わせて初版から作り直した。

### M5.1 ドメイン層（純関数、fixture で駆動）

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T1 | `two signers at the same d produce two winners, and neither is discarded` | M1.1。同一 `d` × 2 pubkey の署名済みイベントを `selectSoftwareWinners` に食わせ、winner が 2 件、座標が別、どちらも quarantine されないこと |
| T2 | `records sharing a d are stacked, and a differing d is never stacked` | M1.3。1 バイト違いの `d` が別の重なりになること |
| T3 | `a stack never designates a default record` | **D1 の番人。** `RecordStack` に `displayed` / `default` / `primary` に相当するフィールドが無いこと。代表を再導入したらここで落ちる |
| T4 | `the stack order follows the active sort key, and nothing else` | M2.1-1。`likes-desc` と `collected-desc` で `records` の並びが変わり、かつ一覧の並び規則と一致すること |
| T5 | `the collector key has no special standing in the stack order` | M2.1-3。収集鍵の記録を混ぜても、ソート条件が同じなら並び順が変わらないこと |
| T6 | `the stack is order-independent` | invariant I4。入力イベントの順列を変えても、同じソート条件なら `records` の並びが同一 |
| T7 | `observed equals the number of records, and complete is false only when coverage says so` | 数の捏造禁止 + invariant I8（unknown ≠ 0） |
| T8 | `I7 still holds: the listable row set does not change with the trust list` | **最重要の回帰。** 信頼リストを空 / 1 人 / 3 人と変えて、識別子の集合が完全一致すること |

### M5.2 識別子（D2）

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T9 | `d normalization drops the scheme, trailing slashes, and host case` | M1.6.4 N1–N3。`https://GitHub.com/a/b/` と `http://github.com/a/b` が同じ `d` になること |
| T10 | `d normalization preserves path case` | M1.6.4 N4。`github.com/A/b` と `github.com/a/b` が**別の** `d` のままであること。**一律小文字化を入れたらここで落ちる** |
| T11 | `every one of the 41 catalogue entries produces a d within D_MAX_BYTES` | M1.6.3。実測では最長 62 バイト（上限 192）だが、テストで固定する |
| T12 | `a d that is not a source URI is rejected by the catalogue tools` | M1.7.3。旧形式（`nosmaps:io.damus`）が新しい検証で落ちること |

### M5.3 UI 層

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T13 | `a card is stacked only when more than one signer is observed` | M2.2-4 |
| T14 | `at most three cards are drawn, and the count label states the real total` | **D1 の中核。** 記録 5 件で、描画されるカードは 3 枚、ラベルは「5 件」。**ラベルが 3 と表示されたら落ちる** |
| T15 | `every record in a stack is reachable, including the ones not drawn` | M2.2-2。5 件のうち 4 件目・5 件目に到達できること |
| T16 | `clicking the stack brings the next record to the front without opening the dialog` | M2.2-5 |
| T17 | `the detail dialog lists every signer with its created_at and event id` | M2.2-6 |
| T18 | `the dialog shows both values for a differing field and asserts neither is correct` | M2.2-8 |
| T19 | `publishing from the dialog pre-fills d and states that the existing record is not replaced` | M3.1-1, M3.1-3 |
| T20 | `the publish form shows the normalized d before signing` | M3.1-2 |

### M5.4 repo ツール層（M6-4 の判断が「複数署名者を jsonl に入れる」になった場合のみ）

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T21 | `verify-catalogue accepts two signers at the same d and reports both` | G1 / G2 の緩和 |
| T22 | `build-data emits distinct ids for two signers at the same d` | G4（`id` 衝突） |

### M5.5 「done」と言える条件

1. T1–T20 が全部通る（T21/T22 は M6-4 次第）。
2. **T3・T10・T14 は、修正を巻き戻したら実際に fail することを確認済み。** 通ることを確認しただけのテストは何も守っていない。この 3 本はそれぞれ D1（代表を立てない）、D2（パスの大文字を潰さない）、D1（見えている枚数と実数の乖離）の番人なので、fail する姿を見ていないなら回帰テストではない。
3. D3 の移行後、`node tools/verify-catalogue.mjs` が exit 0（現状は HEAD 3cecf34 で exit 0 を実測済み）。
4. D3 の移行後、`data.js` の `tools` が **41 件のまま**で、`id` が 41 件すべて一意、かつ**全件が新形式**。件数が 41 から動いたら移行に取りこぼしがある。
5. D3 の移行後、41 件すべてに**アイコンと日本語説明が残っている**こと。`tools/build-data.mjs` の 91 か所のリテラルキー（M1.7.3）を張り替え損ねると、ここが静かに欠ける。**欠けたことに気づけるテストが要る。**
6. `npm run typecheck`（`tsc --noEmit` + `tools/check-layering.mjs`）が通る。**HEAD 3cecf34 時点での成否は今回再実行していない。未確認。**
7. 既存テストスイートの失敗件数が増えていない。**現時点の失敗件数は今回測っていない。未確認**（`DOC-CONSISTENCY-2026-08-19.md` C-13 のとおり、既存 STATUS 文書に 2 つの異なる基準線があり、どちらも現 HEAD の値ではない）。

---

## M6. 残る未解決の論点（kojira の判断がいる）

初版の 7 点のうち、D1〜D4 で解消したものは落とした。**解消した論点:** 初版 M6-1（既定表示を収集鍵にするか最新にするか → D1 でどちらも採らない）、初版 M6-5（「訂正」という語を UI に出すか → M2.2-7 で出さないに確定）。

1. **`source_repo` が確定していない 2 件をどうするか。** `nosmaps:to.iris` は canonical が `htree://npub1xdhnr9…/iris-client`（GitHub は mirror と明記）、`nosmaps:io.sourcehut.nostr-rs-relay` は canonical が `https://sr.ht/~gheartsfield/nostr-rs-relay/`（GitHub は mirror）。**mirror の URI を `d` にするか、canonical の URI を `d` にするか。** canonical を採ると、`htree://` スキームの正規化規則（M1.6.4 は `https`/`http` しか想定していない）を決める必要が出る。
2. **URI にクエリ文字列・フラグメント・ポート・`.git` が付いてきた場合の正規化。** 現データには 1 件も無いので実測できていない（**未確認**）。第三者投稿では起こりうる。落とすか残すかを決める必要がある。
3. **`d` は「`nosmaps:` 前置 + 正規化済み URI」でよいか、それとも生の URI そのままか。** M1.6.4 の注記のとおり、指示の「そのまま使う」の解釈が 2 通りある。前置を外す場合、`SOFTWARE_D_PREFIX` を使っている 4 か所（`policy.ts:54`, `catalogue-events.mjs:13`, `verify-catalogue.mjs`, `sign-catalogue.mjs`）の扱いも決まる。
4. **`catalogue-events.jsonl` を複数署名者化するか。** M4-10 では「しない（repo の正本は収集鍵のみ、訂正はリレー上）」を既定案にした。しかしそうすると **`data.js` にしか繋がっていない環境（`?relay=1` 無しの既定表示）では訂正が一切見えない**。実測: `src/ui/explorer/app.ts` はリレー読み取りを `explorerParams.relayRequested`（`?relay=1`）でしか有効化していない。つまり**既定の閲覧体験に重なりは届かない**。これは issue #18 を半分しか解いていないとも言える。
5. **旧イベントに kind:5 を出すか、放置か。** M1.7.2 は「出す」を既定案にしたが、addressable event に対する削除がリレーでどう扱われるかは**未確認**。効果が保証できないものを出す価値があるかは判断がいる。
6. **信頼リストの kind。** M2.3 案 B は NIP-51 の kind 30000 Follow set を `d="nosmaps:signers"` で流用する提案。専用 kind の有無は**未確認**。汎用 set を流用してよいか。
7. **`t` タグを持たない訂正の扱い。** discovery に載らないので届かない。「`t` が無い訂正は無いのと同じ」と割り切るか、座標既知のものだけ R3 で拾う現行挙動に任せるか。
8. **重ねて見せる枚数を 3 に固定するか。** M2.2-2 は 3 枚とした（指示どおり）。画面幅やカードサイズによっては 2 枚が限界のこともありうる。3 固定か、レイアウト依存で可変か。**可変にする場合も「ラベルの数字は必ず実数」は不変**（T14）。
9. **バイリンガル。** UI 文言は `src/ui/i18n.ts` の ja/en 両方に足す必要がある。文言案は本設計に含めていない。

---

## M7. この設計が触るファイル（実装時の見取り図。今回は触っていない）

| ファイル | 変更の種類 | 備考 |
|---|---|---|
| `src/domain/` に新規 1 ファイル | 新規 | `d` による重ねと、ソート条件に従う順序付けの純関数。DOM/network/window を持たない（layering チェックに通す） |
| `src/domain/` に新規 1 ファイル（または既存に追加） | 新規 | URI 正規化（M1.6.4 の N1–N4）。書き込み側と検証側の**両方から同じ関数**を呼ぶ |
| `src/ui/explorer/app.ts` | 追加 | カードの 3 次元的な重ね、枚数ラベル、めくり操作、ダイアログの署名者セクション、publish 導線 |
| explorer の CSS（`nip-explorer.css`） | 追加 | 重なりの見た目（最大 3 枚） |
| `src/ui/i18n.ts` | 追加 | ja/en の文言 |
| `src/ui/explorer/params.ts` | 追加 | `?signers=`（順序用） |
| `src/domain/policy.ts` | 変更 | `d` の形式検証を URI 形式に。**収集鍵の定数は足さない**（D1） |
| 新規 `tests/multi-signer.spec.js` | 新規 | M5 |
| **D3 の移行**（`real-catalog-draft.json` / `catalogue-events.jsonl` / `data.js` / `tools/*.mjs` / `tests/*.spec.js`） | 変更 | M1.7.3 の表を参照。**`tools/build-data.mjs` の旧 `d` リテラル 91 か所が最大の作業** |
| `docs/design-relay-native-data.md` §4.3 | 注記 1 行 | 「表示上の重ねは merge ではない」 |
| `docs/design-relay-native-write-path.md` §W6.1/§W6.2 | 注記 2 行 | 「他署名者の記録を置き換えない」「`d` は正規化済み URI」 |
| `tools/verify-catalogue.mjs` / `tools/build-data.mjs` の G1–G4 | M6-4 が「する」なら変更 | D3 の移行そのものには不要 |

---

## M8. 一次情報 / 未確認の切り分け

### 一次情報で裏が取れたもの

| 主張 | 出典 | 取得方法 |
|---|---|---|
| addressable の置換単位は `kind` + `pubkey` + `d` の組み合わせ | NIP-01 `01.md`（commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`） | `raw.githubusercontent.com` から当該 commit の `01.md` を取得して読んだ（2026-08-19） |
| NIP-33 は NIP-01 に統合済みで、規則本体は NIP-01 側にある | NIP-33 `33.md`（同 commit） | 同上。全文が「Renamed to "Addressable events" and moved to NIP-01」 |
| 同一 `created_at` のタイブレークは eventId の辞書順最小 | NIP-01 `01.md`（同 commit） | 同上 |
| `a` タグの座標形式 `<kind>:<pubkey hex>:<d>` | NIP-01 `01.md`（同 commit） | 同上 |
| NIP-51 の set は `d` で識別され、kind 30000 は Follow sets（`p` タグ） | NIP-51 `51.md`（同 commit） | 同上 |
| この repo が pin している NIPs commit は `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` | `nips-registry-656cecc.json` の `revision` | ファイルを parse して実測 |
| repo 内カタログ = 41 件 / kind 30078 / 署名者 1 つ | `catalogue-events.jsonl`、`node tools/verify-catalogue.mjs` | ツールを実走（exit 0） |
| `content` のキー内訳（`homepage` は 41 件中 **27 件**のみ） | `catalogue-events.jsonl` | 全 41 行を parse してキー出現数を数えた |
| 署名済みイベントにソース URI は入っていない | `catalogue-events.jsonl` | `grep -c 'github.com'` = 0 |
| `data.js` の `tools[].sourceRepo` は 41/41 で取得可、全件 `https://github.com/…` | `data.js` | sandbox で評価して全件列挙 |
| `real-catalog-draft.json` の `source_repo` は 39/41、残り 2 件は `source_repo_mirror` / `mirror` | `real-catalog-draft.json` | 全 41 entry を parse してキー出現数を数え、欠けている 2 件を特定 |
| URI の実測プロファイル（ホスト 41/41 github.com、大文字含む 9 件、末尾スラッシュ 0 件、生バイト長 28–54、正規化後も 41/41 一意、全件 printable ASCII） | `data.js` | 全 41 件を走査して計測 |
| `data.js` の座標の pubkey は 1 種類、`id` は 41 件一意 | `data.js` | sandbox で評価して実測 |
| G1–G4 のゲート | `tools/verify-catalogue.mjs:34,38-39`、`tools/build-data.mjs:41`、`tools/build-data.mjs:367` | ソースを読んだ |
| `tools/build-data.mjs` に旧 `d` リテラルが 91 か所 | `tools/build-data.mjs` | `grep -c "'nosmaps:"` = 91 |
| `nosmaps:` リテラルを含むファイルは `src/` 6 本 / `tools/` 4 本 / `tests/` 7 本 | `src`, `tools`, `tests` | `grep -rln "nosmaps:"` |
| `sign-catalogue.mjs` は `real-catalog-draft.json` の `event_skeleton` を読み、既存 jsonl があると `--force` 無しで exit 2 | `tools/sign-catalogue.mjs` | ソースを読んだ |
| `SORT_KEYS` は 7 つ（`collected-desc` / `collected-asc` を含む） | `src/domain/sorting.ts:36-38` | ソースを読んだ |
| `selectSoftwareWinners` は coordinate 単位でグルーピングし、pubkey 違いは別 winner | `src/domain/winners.ts` | ソースを読んだ |
| `RelayRow.id` は `relay:<coordinate>` なので pubkey 違いで衝突しない | `src/ui/explorer/relay-row.ts` | ソースを読んだ |
| IndexedDB は `keyPath: 'coordinate'` | `src/data/cache.ts` | ソースを読んだ |
| `manualCounted`（`?curators=`）は永続化されていない | `src/ui/explorer/params.ts`、`src` 全体の localStorage 検索 | grep で localStorage 利用箇所が `draft-storage.ts` のみであることを確認 |
| リレー読み取りは `?relay=1` でのみ有効化される | `src/ui/explorer/app.ts` の `relayRequested` | ソースを読んだ |

### 裏が取れず「未確認」にしたもの

| 主張 | なぜ未確認か |
|---|---|
| ホスト名が大文字小文字を区別しないこと（M1.6.4 N3 の根拠） | RFC 3986 の原文を今回取得していない。一般的な扱いとして書いたが、一次情報で裏を取っていない |
| クエリ文字列・フラグメント・ポート・`.git` 付き URI の正規化 | 現データに 1 件も無いので実測できていない（M6-2） |
| addressable event に対する kind:5 削除をリレーがどう扱うか | NIP-09 の原文を取得していない。M1.7.2 の「削除要求を出す」は設計意図であって、効果の保証ではない |
| `tools/build-data.mjs` の旧 `d` リテラル 91 か所の内訳 | 件数は測ったが、1 件ずつ用途を分類していない。実際の作業量は不明 |
| GitHub がパスの大文字小文字を区別しないこと | 実際に大文字違いの URL を叩いて確認していない。M1.6.4 の注記はその想定に触れているが、確認していない |
| 「nosmaps 用の信頼署名者リスト」に相当する専用の NIP-51 kind が無いこと | NIP-51 の全 kind 表を突き合わせていない。kind 30000 の流用**案**を出しただけ |
| `buildSoftwareDraft` が `t=nosmaps` を必ず付けること | `src/data/publish.ts` の tag 構築部分を読み切っていない |
| 信頼リストのフィルタを R1 に相乗りさせても `MAX_FILTERS_PER_REQ = 8` に当たらないこと | 実測していない。定数は 8 と確認したが、実際のフィルタ数を数えていない |
| HEAD 3cecf34 での `npm run typecheck` の成否 | 実行していない |
| HEAD 3cecf34 での Playwright スイートの pass/fail 件数 | 実行していない |
| 実リレー上に収集鍵以外の `nosmaps:` 記録が実在するか | リレーに問い合わせていない |
| 各リレーが第三者 pubkey からの kind 30078 書き込みを受けるか | 未検証（`design-relay-native-write-path.md` §W10 item 2 が preflight として要求しているが、未実施のまま） |
| カードを 3 次元的に重ねる表現が、現行の CSS レイアウトで実現可能か | UI を実装も試作もしていない。M2.2 は見せ方の要求であって、実現可能性の検証ではない |
