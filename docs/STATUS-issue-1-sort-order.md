# issue #1 — カタログ一覧の並び順

**Tree state:** base HEAD `a10c35b`（作業ツリーは未コミット、commit していない）
**Typecheck:** `npm run typecheck` → tsc 0 error / layering OK（relative imports checked: 100）
**Tests:** `npx playwright test --project=chromium --reporter=line` → **8 failed / 132 passed (4.5m)**。
失敗集合はベースライン（8 failed / 127 passed）と**同一**：e2e.spec.js 214 / 365 / 533 / 563 / 578 / 643 / 669、landing.spec.js:40。新規失敗ゼロ。増えた 5 passed は本 issue の新規 spec。
**Catalogue:** `node tools/verify-catalogue.mjs` → lines 41 / valid signed events 41 / data.js entries 41 — OK
**Explorer probe:** `node tools/probe-explorer.mjs` → dist-only、cards 41、consoleErrors []、pageErrors []、i18n missing 0

## 入ったもの

| 何 | どこ |
|---|---|
| 並び順の純関数 `sortRows` / `SORT_KEYS` / `isSortKey` | `src/domain/sorting.ts`（新規） |
| 一覧上の並び順セレクト（`#sort-order`）と未観測群の提示 | `src/ui/explorer/app.ts`（`renderSortBar` / `sortedList` / `unrankedMarkup`）、`nip-explorer.html` |
| ja / en のラベル `explorer.sort.*` | `src/ui/i18n.ts` |
| 375 幅の収まり（wrap + `min-width: 0`） | `nip-explorer.css`（`.sort-bar` / `.sort-unranked`） |
| spec 5 件 | `tests/sort-order.spec.js`（新規） |

採用したキーは 5 つだけ： `default` / `name-asc` / `name-desc` / `likes-desc` / `likes-asc`。

## findings（issue のクローズコメント用）

### 1. 「新着順／古い順」は実装していない。実装できる材料が無い。

カタログは kind 30078 の署名済み 41 件で、**エントリ側に日付フィールドが無い**。
v1 content が持つのは `schema` / `version` / `state` / `name` / `summary` / `homepage` で、公開日も更新日も述べていない。

残っている唯一の時刻は署名イベントの `created_at` だが、これは**収集側が署名した時刻**であって、そのツールが世に出た時刻でも更新された時刻でもない。実際 41 件すべてが同じ収集日に潰れている。これで並べると、画面に出るのは「収集した順」なのにラベルは「新着順」になる。つまり**存在しない事実（新しさ）を、存在する値（収集時刻）で偽装する**ことになる。観測していない値を出さないという原則に真っ向から反するので、実装しなかった。

`created_at` で代用もしていない。代用は捏造を一段隠すだけで、捏造であることは変わらない。

**この並び順が実装可能になる条件:** レコード自身が自分の日付を述べること（v2 content に発行日/更新日フィールドが入り、発行者が署名する）。それが入るまで、並べられる日付はどこにも無い。

### 2. いいね数順は #20 の観測値をそのまま使い、unknown は順位に入れない。

いいね数は「観測できた live な kind 7 の件数」（#20, `a10c35b`）。この値は 2 状態ではなく 3 状態ある：

- 数（観測した）
- **0**（観測して、1 件も無かった）
- **unknown**（誰も見に行っていない）

`0` と `unknown` は別の事実で、これは既に不変条件 I8（`tests/relay-unit.spec.js:817` "G. I8: an unknown count is excluded from the ordering key, a real zero is not"）として確立している。既存の `orderEntries`（`src/domain/graph.ts`）はグラフが `none` のとき件数成分を**キーから丸ごと落とす**ことでこれを守っている。新しい流儀は作らず、行レベルで同じ規則を適用した：

- 観測済みの行だけが順位を持つ（`ranked`）
- 未観測の行は**比較に一切参加しない**（`unranked`）。0 として混ぜない。
- `unranked` は暗黙に末尾へ落とすのではなく、「いいね数：未観測 / Likes: not observed」の見出しと件数付きで別に提示する。黙って最下位に並べると読者には「0 件と同じ」に見えるので、それは I8 が禁じていることと同じになる。

並び替えで行が消えることはない。`ranked ∪ unranked` は常に元の一覧と同じ集合で、件数表示は並び替え前の値のまま。

### 3. 並び順は絞り込みではないので、条件ピル（activeConditions）には入れていない。

外すべきものが無い（何も除外していない）。URL への永続化は今回入れていない — issue の「4. 並び順の永続化」は既存フィルタも URL に持っていないので、揃えて session 内のみとした。

## break-restore の実証（1 件につき 1 回）

| 壊した箇所 | 落ちた spec |
|---|---|
| `sorting.ts` 名前キーの `sort` 呼び出しを削除 | `sort-order.spec.js:234`（1. name ascending…）— 昇順が符号位置順になっていないと verbatim で失敗、他 4 件は通過 |
| `sorting.ts` いいね比較の direction を反転 | `sort-order.spec.js:260`（2. the likes order…）— `['Bravo','Alpha']` 期待に対し `['Alpha','Bravo']` |
| `sorting.ts` unknown を 0 に丸めて ranked に混ぜる | `sort-order.spec.js:283`（3. an unobserved count is not ranked as a zero…）— 未観測の告知が消え `noticeAt = -1` |
| `i18n.ts` en の likes ラベル 2 件を削除 | `sort-order.spec.js:323`（4. every sort option is labelled…）— en で ja のラベルにフォールバックしたことを検出 |

いずれも戻して再実行し、当該 spec が通ることを確認済み。

## commit していない

`git status --short` / `git diff --stat` は報告に添付。検証は kojira 側で。
