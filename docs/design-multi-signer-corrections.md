# Nosmaps — 同一識別子に対する複数署名者の記録（訂正の経路）

**設計書のみ。この文書はコードを一行も変更していない。** 実装は別途 GO を得てから。

- 対象 issue: #18「同じ識別子に別の署名者が記録を出せない（訂正の経路が無い）」
- 起点: `HEAD = 3cecf34`（`Order by the date a record was collected, and say that it is the collection date`）
- 実測日: 2026-08-19
- 既存設計との関係: `design-relay-native-data.md`（読み取り）と `design-relay-native-write-path.md`（書き込み）の**追補**。両者の決定を上書きするのではなく、両者が答えていない一点だけを埋める。
- 記法: この文書中で「実測」と書いたものは、この作業中にコードを読むかツールを実走して確認した。確認できなかったものは **未確認** と明記する。推測で埋めた値は無い。

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
| `d` 名前空間 | `nosmaps:` 前置必須 | `src/domain/policy.ts` `SOFTWARE_D_PREFIX = 'nosmaps:'` |

### M0.3 「出せない」のは protocol の制約ではなく、この repo の 4 か所のゲート

**重要な発見: 読み取り経路は既に複数署名者を扱える。** 詰まっているのは repo 側のビルド／検証と、UI の見せ方だけ。

| # | 場所 | 実測した内容 | issue #18 への効き方 |
|---|---|---|---|
| G1 | `tools/verify-catalogue.mjs`（署名者チェック） | `const signers = [...new Set(events.map(e => e.pubkey))]; if (signers.length > 1) failures.push(...)` — **複数署名者は FAIL** | jsonl に第三者の訂正を入れると検証が落ちる |
| G2 | `tools/verify-catalogue.mjs`（重複 `d` チェック） | `if (seen.has(d)) failures.push('duplicate d …')` — **同じ `d` は 2 行目で FAIL** | 「同じ識別子に別署名者」がまさにこの形なので必ず落ちる |
| G3 | `tools/build-data.mjs:41` | `if (signers.length !== 1) throw new Error('expected one collector, the jsonl carries …')` | ビルドが例外で止まる |
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

---

## M1. データモデル

### M1.1 訂正は「同じ `d`、自分の鍵、同じ kind」

訂正者は次を出す:

```
kind    : 30078
pubkey  : 訂正者自身の鍵
d       : 訂正対象と同一（例 "nosmaps:io.damus"）
t       : "nosmaps"（discovery に載せるため）
content : org.nosmaps.software v1 プロファイル（現行と同一、変更なし）
```

結果として座標は `30078:<訂正者>:nosmaps:io.damus` になり、収集鍵の `30078:3ce2f3e7…:nosmaps:io.damus` とは**別の addressable アドレス**になる。上書きは起きない。**併存**する。

### M1.2 置換規則が `pubkey + kind + d` 単位であることの一次情報

**一次情報で裏が取れた（primary source verified）。** `nostr-protocol/nips` の commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`（この repo が `nips-registry-656cecc.json` で pin しているのと同じ commit。`registry.revision` を実測して一致を確認）から `01.md` を取得し、以下を読んだ:

> for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value -- which means that, for each combination of `kind`, `pubkey` and the `d` tag value, only the latest event MUST be stored by relays, older versions MAY be discarded.
> — NIP-01 `01.md`（commit 656cecc、取得 2026-08-19）

「for each combination of `kind`, `pubkey` and the `d` tag value」が要点。**pubkey が違えば別の組み合わせであり、別々に保持される。** これが M1.1 の根拠。

**NIP-33 について（依頼文が「NIP-33 の置換規則」と呼んでいるもの）:** 同 commit の `33.md` 全文は次のとおりで、規則の本体は NIP-01 に移っている:

> NIP-33 / Parameterized Replaceable Events / `final` `mandatory` / Renamed to "Addressable events" and moved to [NIP-01](01.md).

したがって**この設計は NIP-33 ではなく NIP-01 を引く**。`design-relay-native-data.md` §19.1 も既に NIP-01 `01.md:96-99` を引いており、そちらが正しい。なお同文書 §21.2.3 は「nostr-rs-relay などが NIP-33 を claim している」と書いているが、それは第三者プロジェクトの自己申告の話であって、我々が依拠する規則の出典ではない。

**`a` タグの座標形式**（信頼リストや将来の言及で使う）も同 commit で確認:

> for an addressable event: `["a", "<kind integer>:<32-bytes lowercase hex of a pubkey>:<d tag value>", <recommended relay URL, optional>]`
> — NIP-01 `01.md`（commit 656cecc）

**同一 `created_at` のタイブレーク**も確認:

> In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained, and the other discarded.

これは `src/domain/winners.ts` `selectAddressableWinner` の実装（`created_at` 最大、同値なら `id` 最小）と一致している（実測）。

### M1.3 「同じものについて言っている」をどう識別するか — `d` 一致だけ

**規則: 同一 `d`（`nosmaps:` 名前空間を含む文字列完全一致）を持つ記録は、同じ主題についての記録として *グループ* にまとめる。それ以上の推論はしない。**

- 名前の類似、homepage の一致、アイコンの一致は**使わない**。`design-relay-native-data.md` §4.3 が「似た `d` を別 pubkey 下で auto-merge してはならない」と書いているのは**アイデンティティ（誰のレコードか）の話**であって、ここで導入するのは**表示上のグルーピング**である。両者は別物なので、§4.3 との矛盾は無い。ただし混同を避けるため、UI 上の文言は「同じ識別子 `nosmaps:io.damus` について N 人が記録を出している」であり、「同じツール」ではない。**識別子が同じことしか観測していないので、識別子が同じとしか言わない。**
- `d` が 1 バイトでも違えば別グループ。正規化・fold は行わない（`d` は `src/domain/policy.ts` `D_ASCII_RE = /^[\x21-\x7e]+$/`、`D_MAX_BYTES = 192` の printable ASCII なので、そもそも fold の余地を作らない）。

### M1.4 データ構造（追加する型の形。実装ではなく形の宣言）

読み取り経路に **1 段の集約層**を足す。`selectSoftwareWinners` の出力（coordinate ごとの winner の列）を入力に取り、`d` ごとに束ねる純関数を `src/domain/` に置く。

```
SignedRecordGroup {
  d          : string                  // "nosmaps:io.damus"
  records    : Winner[]                // d が一致する winner を、署名者ごとに 1 件ずつ
  displayed  : Winner                  // M2.1 の規則で選んだ 1 件（必ず records の要素）
  displayedBy: 'collector' | 'trusted' | 'only-one'   // なぜそれが選ばれたか。UI はこれを言う
  others     : Winner[]                // displayed 以外。空配列は「他に無い」を意味する（不明ではない）
}
```

- `others` は**必ず配列として存在する**。空配列は「観測した範囲で他に無い」であり、「不明」ではない。不明（リレー到達が不完全）は既存の `coverage` / `incomplete` 診断が持っており、そちらを再利用する（`design-relay-native-data.md` §3 の `incomplete` の定義に従う）。
- **既存の型は壊さない。** `CatalogEntry` / `RelayRow` はそのまま残し、グループはその上に乗せる。理由: `RelayRow` は `src/ui/explorer/relay-row.ts` の run 2 で「オリジナルとフィールド単位で差分 0」を取って切り出された境界であり、ここを触ると差分検証の根拠が失われる。

### M1.5 保持（キャッシュ）

`src/data/cache.ts` は IndexedDB のストアを **`keyPath: 'coordinate'`** で作っている（実測）。coordinate は pubkey を含むので、**複数署名者を入れてもキー衝突は起きない。キャッシュ層の変更は不要。**

---

## M2. 読み取り側

### M2.1 既定でどれを表示するか

**規則（優先順、上から評価して最初に当たったものを採る）:**

1. **ユーザーの信頼リストに載っている署名者の記録**があれば、その中で `created_at` が最大のもの。同値なら eventId 最小（NIP-01 のタイブレークに揃える）。信頼リスト内の順位付けはしない（= 「誰がより信頼できるか」を我々は決めない）。
2. なければ **収集鍵（`3ce2f3e7…`）の記録**。
3. なければ（グループに収集鍵の記録が無い場合）**グループ内で `created_at` 最大**。同値なら eventId 最小。

`displayedBy` はそれぞれ `'trusted'` / `'collector'` / `'only-one'`（3 の場合、1 件しか無ければ `'only-one'`、複数あって時刻で選んだなら **`'newest-unattested'`** とし、UI は「誰も信頼指定していないので新しい方を出している」と明言する）。

**収集鍵をコードに焼き込むことについて。** これは `design-relay-native-data.md` §0 が捨てた「shipped default curator」に見た目が近い。違いを設計として明記する:

- 収集鍵は **listability に一切関与しない**。§5.4「listable の唯一の条件は valid な active winner が在ること」は不変で、収集鍵を信頼しなくても全行が出る。invariant I7（G を変えても listable 行集合は変わらない）は維持される。
- 収集鍵は **「複数ある時にどれを最初に開いて見せるか」だけ**を決める。他の記録は常に 1 操作で到達でき、隠されない（M2.2）。
- ユーザーは信頼リストで**上書きできる**し、収集鍵を**外すこともできる**（M2.3）。
- UI は既定表示のとき必ず「この記述は収集鍵 `npub18n3…` のもの」と**名前を出す**。無署名の「事実」として出さない。

> **未解決（M6-1）**: 収集鍵をコード定数として持つか、`data.js` の meta 由来にするか、そもそも既定を「収集鍵」ではなく「最新」にするか。kojira の判断がいる。

### M2.2 複数存在するときの見せ方

**原則: 上書きしない。隠さない。数を捏造しない。**

1. **一覧（カード）では 1 グループ 1 行。** `displayed` の内容で描く。ここで N 行に増やすと、同じ識別子が並んで「別々のツールが N 個ある」に読める。それは事実に反する。
2. その行に **バッジ**を出す: 「この識別子には **N 人**の記録がある」。N は `records.length`。**観測できた数だけを言う**（リレー到達が `incomplete` のときはバッジに `incomplete` 表示を併記し、「N 人以上」ではなく「観測できたのは N 人分、到達は不完全」と書く）。
3. N = 1 のときは**バッジを出さない**（「1 人しか居ない」を毎行に書くのはノイズ）。ただし詳細ダイアログには常に署名者を出す。
4. **詳細ダイアログに「この識別子の記録」セクション**を新設。`records` を `created_at` 降順で全件、それぞれ次を出す:
   - 署名者（npub 短縮 + 全文コピー可能。`src/ui/explorer/relay-row.ts` の `shortKey` を再利用）
   - `created_at`（既に issue #21 で「収集された日付」として出している軸に揃える）
   - `name` / `summary` / `homepage` の**実際の差分**（同じ値なら「同じ」と書き、違う値は両方見せる。どちらが正しいとは書かない）
   - eventId
   - どのリレーで観測したか（`buildCatalog` の `sources` を既に持っている）
5. **「訂正」という語を UI で使うか。** 使わない方に倒す。我々が観測しているのは「同じ識別子に別の鍵が別のことを書いた」だけで、どちらが訂正でどちらが誤りかは観測していない。文言は「別の署名者による記録」。
6. **差分の見せ方で断定しない。** 「A が B を訂正した」ではなく「A と B は `summary` が違う」。

### M2.3 信頼リストの持ち方（永続先）

3 案。**推奨は案 B、ただし A を先に入れて B に上げる。**

| 案 | 置き場所 | 良い点 | 悪い点 |
|---|---|---|---|
| A | `localStorage`（デバイスローカル） | 署名不要・オフライン可・実装が小さい。既に `draft-storage.ts` で localStorage を 1 か所使っている前例がある | デバイス間で共有されない。別ブラウザでは既定に戻る |
| B | NIP-51 の set として自分の鍵で署名し、リレーに置く | Nostr らしい。デバイス間で共有される。「誰を信頼するか」がユーザー所有のデータになる | 署名者（NIP-07）が必要。書き込み経路が増える |
| C | クエリ文字列（`?signers=`）のみ | 実装ゼロに近い。テストから駆動しやすい | 永続しない。ユーザー設定として成立しない |

**案 B に使う kind について（一次情報で確認済み）。** NIP-51（commit 656cecc、`51.md`）は:

> | Follow sets | 30000 | categorized groups of users a client may choose to check out in different circumstances | `"p"` (pubkeys) |

および

> Sets are lists with well-defined meaning that can enhance the functionality and the UI of clients that rely on them. Unlike standard lists, users are expected to have more than one set of each kind, therefore each of them must be assigned a different `"d"` identifier.

したがって **kind 30000（Follow sets）に `d = "nosmaps:signers"`、`p` タグで署名者を列挙**する形が、既存の NIP に収まる。新 kind も新 NIP も作らない（`design-relay-native-data.md` §2「No new NIP, BUD, or HTTP API」を守る）。

**未確認:** 「nosmaps 用の信頼署名者リスト」に相当する**専用の**登録済み kind が NIP-51 に在るかは調べ切れていない。上記は「汎用の Follow set を `d` で名前空間して使う」提案であって、「専用 kind が無いことを確認した」ではない。**未確認**。

**段階案（推奨）:**
- **Phase 1**: 案 C（`?signers=<npub,npub>`）+ 案 A（localStorage `nosmaps.trusted.signers`）。署名不要で、issue #18 の「訂正が届く経路」を成立させるのに十分。
- **Phase 2**: 案 B。NIP-07 でサインイン済みのときだけ、kind 30000 / `d="nosmaps:signers"` を読み、localStorage より優先する。書き込み（リストの編集）は write-path の read-back 規約（§W4.3「published は read-back の主張であって OK の主張ではない」）をそのまま適用する。

**空のときの扱い（不変）:** 信頼リストが空であることは「0 人を信頼している」であって「不明」ではない。既定（収集鍵）にフォールバックし、UI は「既定表示」と言う。invariant I8（unknown ≠ 0）に違反しない。

### M2.4 リレー問い合わせは増えるか

**増えない（設計上の要求）。** discovery は既に `{"kinds":[30078],"#t":["nosmaps"],"limit":500}` の `t` 全走査（`src/data/load.ts` R1、実測）なので、**別署名者の記録は既に同じ REQ で降ってくる**。`#t` を付けた訂正なら追加ラウンド 0。

- 信頼リスト（Phase 2）の kind 30000 取得は、R1 に既に居る viewer の kind 3 フィルタと**同じラウンドに相乗り**させる（`r1Filters` に 1 フィルタ足すだけ。ラウンド数は増えない）。§9.2 の REQ 予算表に行を足す必要は無い、という主張は**未検証**（実際にフィルタ数上限 `MAX_FILTERS_PER_REQ = 8` に当たらないかを実装時に測ること）。
- `t` を付けていない訂正は discovery に載らない。**これは仕様どおりの可視性の穴**として、`design-relay-native-data.md` §16.2 の「labelled visibility gap」と同じ扱いで明記する。座標が既に分かっている場合だけ R3 の gap-fill で拾える。

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
2. **署名者が自分であることの明示。** 「あなたは `npub1…` として、識別子 `nosmaps:io.damus` に**あなた自身の記録**を出します。収集者の記録は書き換わりません。両方が並びます。」— これは `design-relay-native-write-path.md` §W6.4 の「protocol 上、他人の座標には絶対に書けない」を、ユーザーに見える言葉にしたもの。
3. **既に自分の記録がある場合。** それは更新（同じ座標の新しい `created_at`）であり、§W6.2 の Update そのもの。「新しい記録を作る」ではなく「あなたの記録を更新する」と言い分ける。
4. **`t` タグ。** 訂正にも `t=nosmaps` を必ず付ける（付けないと discovery に載らず、誰にも届かない）。これは既に `buildSoftwareDraft` の挙動である想定だが、**未確認**（`src/data/publish.ts` の tag 構築を今回は読み切っていない。実装前に確認すること）。

### M3.2 既存 write-path 設計との関係 — 矛盾は無い

`design-relay-native-write-path.md` を読み直した結果、**この設計と矛盾する記述は見つからなかった。**

- **§W6.4「Who may, and how that is enforced」** は「座標の pubkey だけが書ける（I2）」と書いており、これは本設計の前提そのもの。むしろ本設計は §W6.4 の帰結を UI に出すだけ。
- **§W6.2「`d` is immutable in the edit form」** は「`d` を変えると別の無関係なレコードになる」と書いている。本設計は**逆向き**に「`d` を同じにすると同じ識別子についての別署名者の記録になる」を使う。同じ規則の裏表であり、矛盾しない。
- **§W7「Scope boundary」** はレビュー等を範囲外にしているが、複数署名者の併存については何も述べていない（禁止も許可もしていない）。

**ただし write-path.md 側に 1 か所、追記が必要**（誤りではなく欠落）:

> **write-path.md §W6.1 への追記案。** 現行の §W6.1 は「自分のレコードを探す」ために `[{"kinds":[30078],"authors":["<self>"],"limit":64}]` を投げると書き、「これは自分の鍵の exact match なので §13.1 の arbitrary author discovery ではない」と正当化している。本設計を入れると、**publish フォームを「他人が既に記録を持っている `d`」に対して開く**ケースが生じる。§W6.1 の自己クエリはそのままでよいが、「このフォームで作る記録が、既存の他署名者の記録を**置き換えない**」ことを §W6.1 か §W6.2 の表に 1 行として明記すべき。追記であって修正ではない。

`design-relay-native-data.md` 側は **§4.3 に注記 1 つ**。§4.3 は「似た `d` を別 pubkey 下で auto-merge するな」と書いているので、M1.3 の「表示上のグルーピングは merge ではない」を明記しないと、後から読んだ人が §4.3 違反と誤読する。

---

## M4. 作らないもの（スコープ外）

明示的に**作らない**。「後のフェーズ」ではなく「この設計の外」。

1. **評判システム。** 署名者にスコア・ランク・星を付けない。信頼リストは in / out の 2 値のみで、リスト内に順位を作らない。
2. **多数決 / 合議。** 「3 人が同じことを書いているからそれが正しい」をやらない。件数は表示するが、件数で表示内容を決めない（M2.1 の規則に件数は入っていない）。
3. **モデレーション / 通報 / ブロック。** 気に入らない署名者を「消す」機能を作らない。信頼リストから外すのは自分の表示の話であって、他人の記録の可視性ではない。
4. **署名者の身元確認。** NIP-05 の照合をこの経路に持ち込まない（§4.3 の `nip05_linked` は既存の別軸で、所有権の証明ではないと既に書かれている）。
5. **自動マージ / フィールド単位の採用。** 「name は A から、homepage は B から」をやらない。表示するのは常に**1 つの署名済みレコードの中身をそのまま**。`design-relay-native-data.md` が revision 1 の field provenance マージを削除した理由（§「conflict was an artifact of the mechanism」）をそのまま継承する。
6. **収集鍵の記述を第三者が書き換える経路。** 存在しないし、作れない（protocol 上不可能）。
7. **リポジトリ内 `catalogue-events.jsonl` の複数署名者化。** M6-2 参照。今回は **repo の正本は収集鍵 1 つのまま**とし、訂正は**リレー上にのみ**存在する、を既定案とする。

---

## M5. 完了の判定条件（テスト）

新規 `tests/multi-signer.spec.js`（既存の Playwright 構成に合わせる）。**テスト名は案。**

### M5.1 ドメイン層（純関数、fixture で駆動）

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T1 | `two signers at the same d produce two winners, and neither is discarded` | M1.1。同一 `d` × 2 pubkey の署名済みイベントを `selectSoftwareWinners` に食わせ、winner が 2 件、座標が別、どちらも quarantine されないこと |
| T2 | `records sharing a d are grouped, and a differing d is never grouped` | M1.3。1 バイト違いの `d` が別グループになること |
| T3 | `the default display is the collector record when the trust list is empty` | M2.1 規則 2 |
| T4 | `a trusted signer's record replaces the displayed one, and the others stay reachable` | M2.1 規則 1 + M2.2。`others` が空にならないこと |
| T5 | `with no collector record and no trust list, the newest wins and says so` | M2.1 規則 3。`displayedBy === 'newest-unattested'` |
| T6 | `the group is order-independent` | invariant I4。入力イベントの順列を変えても `displayed` と `others` の並びが同一 |
| T7 | `an empty others list means observed-none, never unknown` | invariant I8。`others: []` と「リレー未到達」が別物として出ること |
| T8 | `I7 still holds: the listable row set does not change with the trust list` | **最重要の回帰**。信頼リストを空 / 1 人 / 3 人と変えて、行の集合（識別子の集合）が完全一致すること。信頼リストが listability に効いたらここで落ちる |

### M5.2 UI 層

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T9 | `a card shows the signer-count badge only when more than one signer is observed` | M2.2 規則 2, 3 |
| T10 | `the badge count equals the number of observed records, and never exceeds it` | 数の捏造禁止 |
| T11 | `the detail dialog lists every signer with its created_at and event id` | M2.2 規則 4 |
| T12 | `the dialog shows both values for a differing field and asserts neither is correct` | M2.2 規則 6 |
| T13 | `the trust list survives a reload` | M2.3 Phase 1（localStorage） |
| T14 | `clearing the trust list returns the display to the collector record` | M2.3 |
| T15 | `publishing from the dialog pre-fills d and states that the existing record is not replaced` | M3.1 |

### M5.3 repo ツール層（M6-2 の判断が「複数署名者を jsonl に入れる」になった場合のみ）

| # | テスト名（案） | 何を守るか |
|---|---|---|
| T16 | `verify-catalogue accepts two signers at the same d and reports both` | G1 / G2 の緩和 |
| T17 | `build-data emits distinct ids for two signers at the same d` | G4（`id` 衝突） |

### M5.4 「done」と言える条件

1. T1–T15 が全部通る。
2. **T8 と T10 は、修正を巻き戻したら実際に fail することを確認済み。**（通ることを確認しただけのテストは何も守っていない。特に T8 は invariant I7 の番人なので、fail する姿を見ていないなら回帰テストではない。）
3. `npm run typecheck`（`tsc --noEmit` + `tools/check-layering.mjs`）が通る。**実測: HEAD 3cecf34 時点での typecheck の成否は今回は再実行していない。未確認。**
4. `node tools/verify-catalogue.mjs` が引き続き exit 0（**実測: HEAD 3cecf34 で exit 0 を確認済み**）。
5. 既存テストスイートの失敗件数が増えていない。**実測: 現時点の失敗件数は今回測っていない。未確認**（`docs/STATUS-typescript-rewrite.md` は「117 passed, 13 failed」と書いているが、それは過去の別 HEAD での記録であり、この設計の基準線には使えない）。

---

## M6. 未解決の論点（kojira の判断がいる）

1. **既定表示を「収集鍵」にするか「最新」にするか。** 収集鍵をコードに焼き込むのは、§0 で捨てた「shipped default curator」に構造が近い。M2.1 では「listability に関与しない・上書き可能・名前を必ず出す」で正当化したが、思想的にそれで良いかは俺が決めることではない。代案は「常に最新（`created_at` 最大）」で、これなら固定鍵をコードに持たなくて済むが、**新しく出しただけの記録が既定表示を奪える**（荒らし耐性が下がる）。
2. **`catalogue-events.jsonl` を複数署名者化するか。** M4-7 では「しない（repo の正本は収集鍵のみ、訂正はリレー上）」を既定案にした。しかしそうすると **`data.js` にしか繋がっていない環境（`?relay=1` 無しの既定表示）では訂正が一切見えない**。実測: `src/ui/explorer/app.ts` はリレー読み取りを `explorerParams.relayRequested`（`?relay=1`）でしか有効化していない。つまり**既定の閲覧体験に訂正は届かない**。これは issue #18 を半分しか解いていないとも言える。判断がいる。
3. **信頼リストの kind。** M2.3 案 B は NIP-51 の kind 30000 Follow set を `d="nosmaps:signers"` で流用する提案。専用 kind の有無は**未確認**。汎用 set を流用してよいか。
4. **`t` タグを持たない訂正の扱い。** discovery に載らないので届かない。「`t` が無い訂正は無いのと同じ」と割り切るか、座標既知のものだけ R3 で拾う現行挙動に任せるか。
5. **「訂正」という語を UI に出すか。** M2.2 規則 5 では出さない案にした（観測しているのは差異だけで、どちらが誤りかは観測していない）が、ユーザーに意図が伝わりにくくなる。
6. **バイリンガル。** UI 文言は `src/ui/i18n.ts` の ja/en 両方に足す必要がある。文言案は本設計に含めていない。
7. **Phase 1 だけで issue #18 を close するか。** 「第三者が訂正を出せて、他のユーザーがそれを選んで読める」が成立するのは Phase 1（localStorage + クエリ）まで。Phase 2（署名付き信頼リスト）は別 issue に切ってよいか。

---

## M7. この設計が触るファイル（実装時の見取り図。今回は触っていない）

| ファイル | 変更の種類 | 備考 |
|---|---|---|
| `src/domain/` に新規 1 ファイル | 新規 | `d` グルーピングと `displayed` 選択の純関数。DOM/network/window を持たない（layering チェックに通す） |
| `src/ui/explorer/app.ts` | 追加 | バッジ、ダイアログの署名者セクション、publish 導線 |
| `src/ui/i18n.ts` | 追加 | ja/en の文言 |
| `src/domain/policy.ts` | 追加 | 収集鍵定数（M6-1 の判断次第） |
| `src/ui/explorer/params.ts` | 追加 | `?signers=` |
| 新規 `tests/multi-signer.spec.js` | 新規 | M5 |
| `docs/design-relay-native-data.md` §4.3 | 注記 1 行 | 「表示グルーピングは merge ではない」 |
| `docs/design-relay-native-write-path.md` §W6.1/§W6.2 | 注記 1 行 | 「他署名者の記録を置き換えない」 |
| `tools/verify-catalogue.mjs` / `tools/build-data.mjs` | M6-2 が「する」なら変更 | G1–G4 |

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
| `data.js` の座標の pubkey は 1 種類、`id` は 41 件一意 | `data.js` | sandbox で評価して実測 |
| G1–G4 のゲート | `tools/verify-catalogue.mjs`、`tools/build-data.mjs:41`、`tools/build-data.mjs:367` | ソースを読んだ |
| `selectSoftwareWinners` は coordinate 単位でグルーピングし、pubkey 違いは別 winner | `src/domain/winners.ts` | ソースを読んだ |
| `RelayRow.id` は `relay:<coordinate>` なので pubkey 違いで衝突しない | `src/ui/explorer/relay-row.ts` | ソースを読んだ |
| IndexedDB は `keyPath: 'coordinate'` | `src/data/cache.ts` | ソースを読んだ |
| `manualCounted`（`?curators=`）は永続化されていない | `src/ui/explorer/params.ts`、`src` 全体の localStorage 検索 | grep で localStorage 利用箇所が `draft-storage.ts` のみであることを確認 |
| リレー読み取りは `?relay=1` でのみ有効化される | `src/ui/explorer/app.ts` の `relayRequested` | ソースを読んだ |

### 裏が取れず「未確認」にしたもの

| 主張 | なぜ未確認か |
|---|---|
| 「nosmaps 用の信頼署名者リスト」に相当する専用の NIP-51 kind が無いこと | NIP-51 の全 kind 表を突き合わせていない。kind 30000 の流用**案**を出しただけで、専用 kind の不在を確認したわけではない |
| `buildSoftwareDraft` が `t=nosmaps` を必ず付けること | `src/data/publish.ts` の tag 構築部分を読み切っていない |
| 信頼リストのフィルタを R1 に相乗りさせても `MAX_FILTERS_PER_REQ = 8` に当たらないこと | 実測していない。定数は 8 と確認したが、実際のフィルタ数を数えていない |
| HEAD 3cecf34 での `npm run typecheck` の成否 | 実行していない |
| HEAD 3cecf34 での Playwright スイートの pass/fail 件数 | 実行していない（`STATUS-typescript-rewrite.md` の「117 passed, 13 failed」は別 HEAD の記録） |
| 実リレー上に収集鍵以外の `nosmaps:` 記録が実在するか | リレーに問い合わせていない |
| 各リレーが第三者 pubkey からの kind 30078 書き込みを受けるか | 未検証（`design-relay-native-write-path.md` §W10 item 2 が preflight として要求しているが、未実施のまま） |
