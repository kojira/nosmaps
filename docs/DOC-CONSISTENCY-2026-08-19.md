# docs の陳腐化 — 実測に基づく修正案（2026-08-19）

**この文書は修正案であり、既存ファイルの書き換えは行っていない。** 例外として「明らかな事実誤り（実装と反する断定）」に限って直したものがあれば §X に一覧するが、**今回は 0 件**（後述の理由）。

- 起点: `HEAD = 3cecf34`
- 調査日: 2026-08-19（初版）/ 2026-08-20（改訂 2 版。kojira の設計判断 4 点との関係を §D に追記し、§Y「作らないもの」と §Z「完了の判定条件」を新設した）
- 対象: `README.md`, `docs/design-relay-native-data.md`, `docs/design-relay-native-write-path.md`, `docs/design-relay-native-review-1〜5(+ -response)`, `docs/STATUS-*.md`
- 方法: 記述に対応する実装（`src/domain`, `src/data`, `src/ui`, `tools/`）を読むか、ツールを実走して突き合わせた。**推測で「古い」と判定したものは 1 件も無い。**
- 記法: コード識別子・コマンド出力・原文引用は英語のまま残してある（訳すと実物と照合できなくなるため）。地の文は日本語。

> **改訂 2 版の位置づけ。** C-01 〜 C-14 の**調査結果そのものは 1 文字も変えていない**。それらは 2026-08-19 に実測した観測記録であり、後から書き換えたら記録として成立しない（この文書自身が「観測したものを消すな」と書いている以上、自分に適用しないのは筋が通らない）。改訂で足したのは、その後 kojira が下した設計判断がこの調査結果にどう効くか（§D）と、この文書自身のスコープと完了条件（§Y / §Z）だけ。

## 検出件数

**12 件**（検査したが陳腐化していなかったものが別に 2 件）。内訳:

| 深刻度 | 件数 | 意味 |
|---|---|---|
| **A: 実装と反する断定**（読んだ人が誤った行動を取る） | 4 | C-01, C-02, C-03, C-04 |
| **B: 参照先が実在しない**（行番号・ファイル名が現存しない） | 3 | C-05, C-06, C-07（C-08 / C-09 は検査したが**一致していた**ので陳腐化ではない。記録として残す） |
| **C: 過去時点の観測値が現在の基準線として読まれうる** | 5 | C-10 〜 C-14 |

---

## なぜ既存ファイルを 1 件も書き換えなかったか

深刻度 A の 4 件はいずれも「実装と反する断定」だが、**そのうち 3 件は STATUS-*.md という『ある時点の観測記録』**である。STATUS 文書は日誌であって仕様書ではない。日誌の過去形の記述を現在に合わせて書き換えると、**その日に何が観測されたかという記録そのものが失われる**。これは「観測していないものを出すな」の裏返しで、「観測したものを消すな」でもある。

残る 1 件（C-01）は設計書側だが、修正の仕方が 2 通りあり（見出しを直すか、注記を足すか）、どちらも設計判断を含むので勝手に決めるべきではない。

**したがって推奨する直し方は「書き換え」ではなく「各ファイルの冒頭に『この文書はどの HEAD 時点の観測か』を明記するヘッダを足す」。** これなら記録を壊さずに誤読を防げる。実行の可否は kojira の判断。

---

## 深刻度 A — 実装と反する断定

### C-01. 設計書全体が `nostr-catalog.js` を現存ファイルとして参照している（合計 175 か所）

| 項目 | 内容 |
|---|---|
| ファイル / 箇所 | `docs/design-relay-native-write-path.md`（**53 か所**）, `docs/STATUS-revision2.md`（**68 か所**）, `docs/design-relay-native-data.md`（**35 か所**）, `docs/STATUS-typescript-rewrite.md`（15 か所）, `README.md`（**4 か所**: 59, 66, 107, 111 行） |
| 記述の例 | write-path.md:46 「`window.NOSMAPS_CATALOG.validateSoftwareEvent` (`nostr-catalog.js:254`, exported `:1771`) — the *same function object* the read path calls」 |
| 記述の例 | README.md:111 「投稿結果を「公開できた」と表示するのはリレーから読み戻せたときだけです（`nostr-catalog.js` の `publishSoftwareRecord`）」 |
| **実測** | **`nostr-catalog.js` はリポジトリに存在しない。** `ls nostr-catalog.js` → `No such file or directory`。ルート直下の `.js` は `data.js` と `playwright.config.js` の 2 つだけ（`ls *.js` で実測） |
| 実際の所在 | `validateSoftwareEvent` は `src/domain/records.ts`、`publishSoftwareRecord` は `src/data/publish.ts:328`、`POLICY` は `src/domain/policy.ts`、`selectSoftwareWinners` は `src/domain/winners.ts`、`loadCatalog` は `src/data/load.ts`（すべて grep で実測） |
| 影響 | 設計書を読んで実装を探す人が、存在しないファイルを探す。行番号（`:254` 等）は当然どこにも対応しない |
| 修正案 | 一括置換は危険（行番号が全部無効なので、ファイル名だけ直すと「TS ファイルの 254 行目」という新しい嘘が生まれる）。**ファイル名 + 行番号のペアを「シンボル名 + 現在のファイル」に置き換える**のが正しい。例: `` `nostr-catalog.js:254` `` → `` `validateSoftwareEvent`（`src/domain/records.ts`） ``。175 か所あるので機械置換ではなく段階的に |

### C-02. README.md:107 「`nostr-catalog.js` から動的 `import()` で遅延ロードします」

| 項目 | 内容 |
|---|---|
| ファイル / 行 | `README.md:107` |
| 記述 | 「生成物は import 文を持たない自己完結ESMで、`nostr-catalog.js` から動的 `import()` で遅延ロードします」 |
| **実測** | 動的 import は **`src/data/relay.ts:94-95`** にある（`import('../../dist/rx-nostr.js')` / `import('../../dist/rx-nostr-crypto.js')`）。`nostr-catalog.js` は存在しない |
| 修正案 | 「`src/data/relay.ts` から動的 `import()` で」に置換。これは事実誤りが 1 対 1 で対応する数少ないケースなので、**書き換えても記録は失われない**。ただし C-01 の一部として一括で扱うのが筋 |

### C-03. `docs/STATUS-typescript-rewrite.md` が「nip-explorer.html は dist-only ではない」と断定している

| 項目 | 内容 |
|---|---|
| ファイル / 行 | `docs/STATUS-typescript-rewrite.md:60-62`, `:66-68`, `:110-111`, `:188-189` |
| 記述 | `:110` 「**The headline: `nip-explorer.html` is NOT dist-only yet. It still loads the six root-level classic scripts.**」 / `:189` 「scripts still loaded: data.js, i18n.js, icons.js, nostr-canonical.js, nostr-catalog.js, nip-explorer.js, site-footer.js — i.e. NOT dist-only.」 |
| **実測** | `grep -n '<script' nip-explorer.html` の出力は **2 行だけ**: `data.js?v=20260818124500` と `type="module" src="dist/nip-explorer.js?v=20260818124500"`。**dist-only になっている。** `:66` が「still present」と書く 6 ファイル（`nostr-catalog.js`, `nostr-canonical.js`, `i18n.js`, `icons.js`, `landing.js`, `site-footer.js`）はいずれも存在しない |
| 影響 | この文書の「Next run: do this」節が丸ごと完了済みのタスクを指示している。次にこれを読んだ人が済んだ作業をやり直す |
| 修正案 | **書き換えない**（過去の観測記録として正しい）。冒頭に「この文書は 2 回のランの日誌であり、記述は当時の HEAD の観測。§C-03（DOC-CONSISTENCY-2026-08-19）のとおり、nip-explorer.html は現在 dist-only」というヘッダを足す |

### C-04. `docs/STATUS-issue-1-sort-order.md:20` 「採用したキーは 5 つだけ」

| 項目 | 内容 |
|---|---|
| ファイル / 行 | `docs/STATUS-issue-1-sort-order.md:20` |
| 記述 | 「採用したキーは 5 つだけ： `default` / `name-asc` / `name-desc` / `likes-desc` / `likes-asc`」。さらに `:24` 「**「新着順／古い順」は実装していない。実装できる材料が無い。**」 |
| **実測** | `src/domain/sorting.ts:36-38` の `SORT_KEYS` は **7 つ**: `'default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc', 'collected-desc', 'collected-asc'`。`collected-*` が実装されている |
| 経緯（実測） | `git log --oneline -3` が示すとおり、この文書が書かれた後の commit `3cecf34` が「Order by the date a record was collected, and say that it is the collection date」。つまり**この文書の findings §1（「実装できる材料が無い」）は、その後の commit で解決された**。`sorting.ts:9-14` のコメントが「`collected-desc` / `collected-asc` order by exactly that, and they are labelled as exactly that ("collected")」と書いており、findings §1 の懸念（「収集時刻を新しさと偽装する」）を「収集日だと明言する」で回避した形になっている |
| 影響 | 深刻度は中。この文書だけ読むと「日付ソートは不可能」と結論してしまう |
| 修正案 | 書き換えない。ヘッダで「base HEAD `a10c35b` 時点の記録。findings §1 は後続 commit `3cecf34` で解決済み」と追記 |

---

## 深刻度 B — 参照先が実在しない

### C-05. `docs/design-relay-native-data.md:1433-1436` — 消えたファイル 3 つを現在形で説明

| 項目 | 内容 |
|---|---|
| 記述 | 「`nostr-catalog.js` is a single IIFE with no ES module exports; its whole public surface is the object assigned to `window.NOSMAPS_CATALOG` at `nostr-catalog.js:1131`. Its only first-party consumer is `nip-explorer.js:315` … `app.js` and `data.js` are entirely uninvolved — `index.html` does not load the catalog at all, and `app.js:4` reads a static list from `data.js`.」 |
| **実測** | `nostr-catalog.js` / `nip-explorer.js` / `app.js` はいずれも存在しない。`window.NOSMAPS_CATALOG` は現在 **`src/entry/nip-explorer.ts:108`** で代入されている。`index.html` は `data.js` + `dist/landing.js` を読む（実測） |
| 注 | この節（§17）は自ら「verified against `HEAD = 70e12a0` on 2026-08-17」と冒頭に書いているので、**過去時点の記録であることは明示されている**。深刻度を A ではなく B にしたのはそのため |

### C-06. `docs/design-relay-native-data.md:1546` — 現存しないコード片を引用

| 項目 | 内容 |
|---|---|
| 記述 | §17.4 に `// nostr-catalog.js:205-208` として `const trusted = opts.trustedCurators; if (Array.isArray(trusted) && trusted.length > 0) { … }` を引用 |
| **実測** | `grep -rn 'trustedCurators' src tools tests` → **0 件**。この識別子はコードのどこにも存在しない |
| 注 | §17.4 の主張自体（「revision 2 ではこの問題は moot になる」）は現在の実装と整合している。無いのは引用元 |

### C-07. `docs/design-relay-native-data.md:1442-1448` — 削除済みシンボルの表

| 項目 | 内容 |
|---|---|
| 記述 | §17.1 の表が `validatePointerEvent`（`nostr-catalog.js:195-327`）, `validateManifestValue`, `validateEntry`, `validateFields`, `validatePrevious`, `verifyManifestBytes`, `fetchVerifiedManifest` を「今日存在し、削除される」ものとして列挙 |
| **実測** | これらのシンボルは `src/` に 1 つも存在しない（grep 済み）。**削除は既に完了している** |
| 修正案 | §17 全体に「この節は完了済み。記録として残す」の 1 行を足す |

### C-08. `docs/design-relay-native-data.md:1631-1645` の行番号引用（NIP 側）

| 項目 | 内容 |
|---|---|
| 記述 | §19.1 が NIP-01 の主張を `01.md:84`, `:81`, `:96-99`, `:97`, `:101`, `:103`, `:149` として引用 |
| **実測** | commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` の `01.md` を `raw.githubusercontent.com` から取得（180 行）。addressable の定義は **99 行目**、タイブレークは **101 行目**、「relay SHOULD return just the latest one」は **103 行目**、`a` タグ形式は **81 行目**、単一文字タグの索引は **80 行目付近**。**引用内容はすべて一致しており、行番号もほぼ一致している。** 少なくとも `:81`, `:96-99`, `:101`, `:103` は正しい |
| 判定 | **これは陳腐化していない。** 検査した結果「合っていた」ので、B の中でも「確認済み・問題なし」として記録する。ここを疑って書き換えるのは誤り |

### C-09. `docs/design-relay-native-data.md:1637` の `01.md:149` — 確認済み・一致

| 項目 | 内容 |
|---|---|
| 記述 | 「`limit` applies only to the initial query \| NIP-01 `01.md:149`」 |
| **実測** | commit `656cecc` の `01.md` **149 行目**は「The `limit` property of a filter is only valid for the initial query and MUST be ignored afterwards. …」。**行番号も引用文も一致**。あわせて `:80`（`a` タグ）と `:84`（単一文字タグの索引）も確認し、一致した |
| 判定 | 陳腐化していない。C-08 と同じく「検査して問題が無かった」記録として残す |

---

## 深刻度 C — 過去時点の観測値が現在の基準線に見える

### C-10. `docs/STATUS-revision2.md:3` — 別 HEAD の tree state

| 記述 | 「**Tree state observed:** HEAD `70e12a0`; working tree dirty — 7 modified files (`design-relay-native-data.md`, `i18n.js`, `nip-explorer.css`, `nip-explorer.js`, `nostr-catalog.js`, …)」 |
|---|---|
| **実測** | 現 HEAD は `3cecf34`。列挙されたファイルのうち `i18n.js` / `nip-explorer.js` / `nostr-catalog.js` は存在しない |

### C-11. `docs/STATUS-revision2.md` 全体が canonical kind を **32267** として書いている（9 か所）

| 記述 | `:12` 「D2 \| 32267 is the only canonical record」、`:102` 「No code anywhere constructs a kind 32267 or 30267 event」、`:105` 「a 32267 v1 event builder emitting `d:"nosmaps:…"`」 |
|---|---|
| **実測** | 現在の canonical kind は **30078**（`src/domain/policy.ts` `SOFTWARE_KIND: 30078`、`tools/catalogue-events.mjs` `KIND = 30078`、`catalogue-events.jsonl` の全 41 件が kind 30078）。`policy.ts` のコメントが「Kind 32267 ("Software Application") was considered and rejected」と、**却下したこと**を明記している |
| 影響 | この STATUS だけ読むと kind を取り違える。ただし `README.md` と `design-relay-native-data.md` §4.2 は 30078 で正しい |
| 修正案 | 書き換えない（32267 時代の記録として正しい）。ヘッダで「本文中の 32267 は後に 30078 へ移行済み」と明示 |

### C-12. `docs/STATUS-revision2.md:105` 「the app is a **read-only client for a corpus that does not exist**」

| 記述 | 「Event building for publishing: zero. No code anywhere constructs a kind 32267 or 30267 event.」「To show real content end to end, minimally: (1) a NIP-07 `signEvent` path, (2) a … v1 event builder …, (3) an `EVENT` publish with read-back …」 |
|---|---|
| **実測** | (1)(2)(3) はすべて実装済み。`src/data/publish.ts` に `buildSoftwareDraft`（:95）, `checkSignedEvent`（:144）, `sendEvent`（:185）, `publishSoftwareRecord`（:328）が在り、NIP-07 署名 → read-back まで通っている。`tests/write-path.spec.js` と `tests/publish-failure-and-draft.spec.js` も存在する |

### C-13. `docs/STATUS-typescript-rewrite.md:185-186` 「117 passed, 13 failed」

| 記述 | 「chromium, full suite: 117 passed, 13 failed (5.2m) — the same 13 as the handoff (7 e2e + 5 relay-render + landing:40)」 |
|---|---|
| **実測** | 一方 `docs/STATUS-issue-1-sort-order.md:4`（より新しい）は「**8 failed / 132 passed**、ベースラインは 8 failed / 127 passed」と書いている。**2 つの STATUS が異なる基準線を主張している。** どちらが現 HEAD の値かは**今回測っていない（未確認）** |
| 影響 | 「新規失敗ゼロ」を判定する基準線が 2 つあり、どちらを使うか決まらない |
| 修正案 | **測る。** 現 HEAD で 1 回フルスイートを回して、その値を単一の基準線として `docs/` のどこか 1 か所に置く（STATUS ごとに散らさない）。これは書き換えではなく新規測定なので、GO をもらってから |

### C-14. `docs/design-relay-native-data.md:267` / `docs/design-relay-native-write-path.md` §W10.1 — homepage の UTF-8 バイト数問題

| 記述 | data.md:267 「`validateSoftwareEvent` currently applies `c.homepage.length > 2048` (`nostr-catalog.js:326`), i.e. UTF-16 code units, and therefore diverges from this rule for non-ASCII IRIs」/ write-path.md §W10.1 が「required, not applied」として同じことを書く |
|---|---|
| **実測** | **この乖離は現在も残っている。** `src/domain/records.ts:190-191`: `const value = prop(c, 'homepage'); if (typeof value !== 'string' \|\| value.length > 2048) return fail('bad-schema');` — `.length`（UTF-16 コード単位）のまま。`utf8ByteLength` は同ファイルで import 済みで `d`（`utf8ByteLength(d) > D_MAX_BYTES`）と `t`（`utf8ByteLength(topic) > 128`）には使われている |
| 判定 | **記述は現在も正しい。** ファイル名と行番号だけが古い（`nostr-catalog.js:326` → `src/domain/records.ts:191`）。指摘されている未適用の code amendment は依然として未適用 |

---

## 代表 3 件（要約）

| # | ファイル | 記述 | 実測との差 |
|---|---|---|---|
| 1 | `docs/design-relay-native-write-path.md`（53 か所）ほか計 175 か所 | `nostr-catalog.js:<行番号>` を実装の所在として参照 | **`nostr-catalog.js` は存在しない**（`ls` で確認）。実体は `src/domain/records.ts` / `src/data/publish.ts` などに分割済み。行番号は全部無効 |
| 2 | `docs/STATUS-typescript-rewrite.md:110` | 「**nip-explorer.html is NOT dist-only yet. It still loads the six root-level classic scripts.**」 | `nip-explorer.html` の `<script>` は `data.js` と `dist/nip-explorer.js` の **2 本だけ**。**既に dist-only**。指摘された 6 ファイルは全部存在しない |
| 3 | `docs/STATUS-issue-1-sort-order.md:20,24` | 「採用したキーは 5 つだけ」「新着順／古い順は実装していない。実装できる材料が無い」 | `src/domain/sorting.ts:36` の `SORT_KEYS` は **7 つ**で `collected-desc` / `collected-asc` を含む。HEAD の commit メッセージ `3cecf34` がまさにその実装 |

---

## §X. 実際に書き換えた既存ファイル

**0 件。** 理由は上の「なぜ既存ファイルを 1 件も書き換えなかったか」のとおり。

書き換え候補として最も安全なのは **C-02**（`README.md:107` の「`nostr-catalog.js` から動的 import」→「`src/data/relay.ts` から」）で、これは 1 対 1 対応の単純な事実誤りであり記録の破壊にならない。ただし C-01 の 175 か所の一部なので、単独で直すと README だけ新しくなって設計書と食い違う。**まとめて直すか、まとめて残すか**の判断が要る。

---

## §D. kojira の設計判断 4 点が、この調査結果にどう効くか

2026-08-20 に次の 4 点が決まった（詳細は `docs/design-multi-signer-corrections.md` の「改訂 2 版で変わったこと」）。この文書の findings のうち、影響を受けるものだけを挙げる。**C-01 〜 C-14 の本文は書き換えていない。**

| # | 判断 | この文書への効き方 |
|---|---|---|
| D1 | **既定表示は「選ばない」。** 同じ識別子の記録は上書きも既定選択もせず、カードを 3 次元的に重ねて表示する。見た目は最大 3 枚、辿れる件数は制限しない。手前に来る順序はソート条件（いいね数の多い順・新しい順など）に従う | **C-06 の重みが変わる。** C-06 は「`trustedCurators` を引用しているが、この識別子はコードに 1 件も無い（grep 0 件、実測）」という指摘だった。D1 により、**この識別子は今後も実装されない**（既定 curator を置かないので、コードに焼く鍵が存在しない）。したがって §17.4 の引用は「古い」ではなく「**永久に実装されない設計案の引用**」として整理するのが正しい |
| D2 | **識別子（`d` 値）は Java パッケージ風をやめ、ソースコード配布場所の URI をそのまま使う** | **新しい陳腐化を生む（C-15、下記）。** 既存 docs に散らばる旧形式の `d`（`nosmaps:io.damus` 等）がすべて古い例示になる |
| D3 | **旧 `d` は捨てて 41 件を全件出し直す**（承認済み） | 同上。加えて、C-13 のテスト基準線を測るタイミングに影響する（下記「判断を仰ぎたい点」3） |
| D4 | **投稿数のスケール懸念は皮算用として設計から外す。** 当面は自分たちで整備する前提 | この文書には該当記述が無い（スケールを論じている findings は 0 件）。**削除もスコープ外への移動も不要**。実測: `docs/DOC-CONSISTENCY-2026-08-19.md` 内に投稿数・負荷・スパムに関する記述は存在しない |

### C-15. D2 / D3 により、docs 中の旧形式 `d` の例示がすべて陳腐化する（**将来の陳腐化。今日はまだ正しい**）

| 項目 | 内容 |
|---|---|
| 深刻度 | **将来の C**（今日時点では実装と一致しているので陳腐化ではない。D3 の移行を実行した瞬間に深刻度 A に変わる） |
| **実測**（git 追跡下の `docs/*.md` と `README.md` のみ。2026-08-20、`grep -c 'nosmaps:[a-z]*\.[a-z]'`） | `docs/icons-probe.md` **71 か所**、`docs/design-multi-signer-corrections.md` 11 か所（改訂 2 版で移行前後の対比として意図的に残している箇所を含む）、`docs/design-relay-native-data.md` 2 か所、`docs/design-relay-native-write-path.md` 1 か所、`docs/real-catalog-draft-report.md` 1 か所、この文書自身 1 か所（すぐ上の行の例示）。`README.md` は 0 か所 |
| 注 | 上の件数は **git の追跡下にあるファイルのみ**を数えた。未追跡の作業中ファイルは対象外。また `docs/` 以外（`src/` / `tools/` / `tests/`）の旧形式リテラルは `design-multi-signer-corrections.md` M1.7.3 が別途実測している |
| 影響 | `docs/icons-probe.md` が突出している（71 か所）。これはアイコン取得の実測記録であり、**日誌**にあたる。C-03 / C-04 と同じ理由で**書き換えるべきではない** |
| 修正案 | この文書の一貫した方針どおり「書き換えない、ヘッダで無害化」。D3 の移行を実行したら、`docs/icons-probe.md` の冒頭に「本文中の `nosmaps:<逆ドメイン>` は旧形式の識別子。D3（2026-08-20 承認）で URI 形式へ移行済み」と 1 行足す。設計書 2 本（data / write-path、計 3 か所）は例示なので、そちらは差し替えてよい |
| **未確認** | `docs/icons-probe.md` の 71 か所が全部「識別子としての例示」なのか、一部が別用途なのかは 1 件ずつ分類していない |

---

## §Y. この文書が作らないもの（スコープ外）

D1 〜 D4 に合わせて明示する。**「後でやる」ではなく「この文書の仕事ではない」。**

1. **既存ファイルの一括書き換え。** C-01 の 175 か所を機械置換しない。行番号は復元不能なので、ファイル名だけ直すと「TS ファイルの 254 行目」という**新しい嘘**が生まれる。
2. **STATUS-*.md の本文修正。** STATUS 文書は日誌であって仕様書ではない。過去形の記述を現在に合わせると、その日に何が観測されたかという記録そのものが消える。足すのはヘッダだけ。
3. **この文書自身の findings の遡及修正。** §D のとおり、C-01 〜 C-14 は 2026-08-19 の観測。後の設計判断で「間違いになった」ものがあっても書き換えず、§D に差分として書く。
4. **docs の網羅的な棚卸し。** 対象は冒頭に列挙したファイルのみ。全 docs を全数検査していない（**未確認**）。
5. **コードの修正。** C-14（`homepage` の UTF-8 バイト数）は 1 行で直せるが、この文書は `docs/` の外を触らない。issue に切るかは判断待ち（下記 4）。
6. **投稿数・負荷・スパムに関する記述の追加。** D4 のとおり、皮算用は書かない。

## §Z. 完了の判定条件

この文書は調査報告なので、テストではなく**観測で判定する**。

1. **列挙した各 finding に、実測の方法が書いてあること。** 「grep した」「ツールを実走した」「ファイルを parse した」のいずれか。**推測で「古い」と判定した項目が 0 件であること**（現状 0 件）。
2. **検査して問題が無かったものが、findings に残っていること。** C-08 / C-09 がそれ。「陳腐化していないと確認した」も観測結果であり、消すと同じ場所が何度も再検査される。
3. **書き換えた既存ファイルが 0 件であること**（§X。現状 0 件）。書き換えるなら §X に列挙し、なぜ記録を壊さないかを 1 件ずつ書く。
4. **D1 〜 D4 のそれぞれについて、この文書に該当があるか無いかが明記されていること**（§D。D4 は「該当 0 件」と実測して書いた）。
5. **「判断を仰ぎたい点」が、判断の得られた順に減っていること。** 増えたまま減らないなら、この文書は報告ではなく溜まり場になっている。

---

## 判断を仰ぎたい点

1. **C-01（175 か所の `nostr-catalog.js` 参照）をどうするか。** (a) 全部直す（作業量大、行番号は復元不能なのでシンボル名に置換） (b) 各設計書の冒頭に「本文中の `nostr-catalog.js` は TS 移行前のファイル名。現在の所在は §X 参照」の対応表を 1 つ置く (c) 放置。**(b) を推す。**
2. **STATUS-*.md にヘッダを足してよいか。** 本文は触らず、冒頭に「どの HEAD 時点の観測か / 現在との差」を 3 行足すだけ。C-03, C-04, C-10, C-11, C-12 が一気に無害化する。
3. **C-13 のテスト基準線を測り直してよいか。** 現 HEAD でフルスイートを 1 回回して、pass/fail を単一の基準線として記録したい。時間がかかる（前回記録で 5.2 分 / 4.5 分）のと、これは「docs を触る」を超えるので GO が要る。
4. **C-14 の code amendment（`homepage` を UTF-8 バイトで数える）を issue に切るか。** 設計書 2 か所が「required, not applied」と書き続けている未適用事項で、実装は 1 行（`.length` → `utf8ByteLength(...)`）。ただし ceiling を厳しくすると既存レコードが新たに quarantine されうるので、設計書自身が「quarantine 件数チェックと一緒に入れろ」と言っている。
5. **C-15（D3 移行後に旧形式 `d` の例示が一斉に陳腐化する）のヘッダを、移行の前に足すか後に足すか。** 前に足すと「まだ移行していないのに移行済みと書く」ことになり、この文書の原則（観測していないことを書かない）に反する。**移行を実行した直後に足す**のが筋だと考えているが、その時に忘れないための置き場所が要る。移行作業のチェックリストに 1 項目として入れるのでよいか。
