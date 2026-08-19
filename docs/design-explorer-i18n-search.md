# Nosmaps — explorer の UI 言語切替と検索対象（説明文の多言語化）

**設計書のみ。この文書はコードを一行も変更していない。** 実装は別途 GO を得てから。

- 対象 issue: #14「explorer: UI言語を切り替えても検索対象が変わらない（説明文の多言語化が存在しない）」
- 起点: `main = 3cecf34`（`Order by the date a record was collected, and say that it is the collection date`）
- ブランチ: `design/issue-14-i18n-search`（`docs/` のみ）
- 実測日: 2026-08-20
- 既存設計との関係: `design-relay-native-data.md`（読み取り・v1 コンテンツプロファイル）と `design-multi-signer-corrections.md`（訂正の経路）の**追補**。両者の決定は上書きしない。
- 記法: 「実測」と書いたものは、この作業中にコードを読むかコマンドを実走して確認した。確認できなかったものは **未取得** と明記する。推測で埋めた値は無い。

---

## 0. 要旨（先に結論）

issue #14 の本文が書かれた時点（2026-08-18、`0ba5ec0`）の前提は、**現在の `main` では既に成立していない**。

- issue 本文: 「日本語の `summary` を持つエントリは 0 件」「言語別の説明を持つ構造自体が無い」
- 現在の実測: `data.js` の 41 件中 **40 件が `descriptions.ja` を持つ**。構造（`descriptions: Record<language, string>`）も存在する。
- 変わった原因: `ecbb46b`（`Keep the draft when publishing fails, and carry descriptions per language`、2026-08-19 07:20:27 +0900、author kojira）が `tools/build-data.mjs` に `DESCRIPTIONS_JA` を追加した。

したがって #14 は「多言語説明が無い」問題ではなくなり、**「多言語説明が、署名済みの一次情報に無い出所から入っている」問題**に変質している。issue 本文にある「訳を持つなら provenance ごと設計する話になる」という懸念が、実際にはその設計を経ずに先に入った、という状態。

検索の挙動そのものは、実測では既に **UI 言語非依存**（issue の選択肢 1 に相当する実装が既に入っている）。壊れているのは検索ではなく、訳文の出所である。

---

## 1. 現況の実測（推測なし）

### 1.1 検索が対象にしているフィールド

実装は 2 か所にある。**両者は同じ関数ではなく、別々に書かれている**（この重複自体が未解決論点 U6）。

**(A) 実際に画面が使う実装** — `src/ui/explorer/app.ts:572-606`（`toolMatchesQuery`）。以下を空白連結して `toLowerCase().includes(query)`:

| 由来 | 項目 |
|---|---|
| レコード直値 | `tool.name`, `tool.id`, `platformText`（relay 行は `tool.platform`）, `displayLicense(tool)`, OSS なら定数 `'OSS open source オープンソース'` |
| 収集メタデータ（`metadataValues` で再帰的に平坦化） | `summary`, **`descriptions`（言語マップ全体）**, `homepage`, `sourceRepo`, `distribution`。ただし `provenance === 'relay'` の行は `summary` と `homepage` のみ |
| トピック | seed トピックは `categories.<topic>.name` / `.description` を **ja と en の両方**、free トピックは文字列そのまま |
| 機能 | 対応している機能の `name` / `scene` / `aliases` を **ja と en の両方** |
| NIP 等 | `record.key`, `NIP-<id>`, `NIP <id>`, `id`, `registryTitle`, レジストリ snapshot の `title`, `sourceText` |

**(B) domain 層の実装** — `src/domain/explorer.ts:173-192`（`toolSearchTerms`）+ `:194`（`matchesQuery`）。`grep -rn 'toolSearchTerms\|matchesQuery' src tests` の結果、**定義元以外からの参照は 0 件**（実測）。つまり現在どこからも呼ばれていない dead export。トピック・機能語を呼び出し側から受け取る設計になっており、(A) とは項目集合も微妙に異なる。

**(C) テストが持つ第三の実装** — `tests/e2e.spec.js:30-44`（`catalogueSearchTerms`）。期待値を `data.js` から独立計算するための再実装。

**要点: `descriptions` は言語マップ**全体**が検索語に入っている（`app.ts:598`）。**画面に出ている言語だけを検索する箇所は無い。** コメントもそう明言している（`app.ts:598-599`: "Every recorded language, not the one on screen"）。

### 1.2 UI 言語を切り替えたとき、実際に何が変わって何が変わらないか

Playwright（chromium、`http://127.0.0.1:4173/nip-explorer.html`）で言語ボタンを押して実測。使ったスクリプトと出力は §7.2 に verbatim を置いた。

| | en | ja | 変わるか |
|---|---|---|---|
| `<html lang>` | `en` | `ja` | **変わる** |
| カード枚数（クエリ空） | 41 | 41 | 変わらない |
| 1 枚目の説明文 | `A twitter-like nostr client for iPhone, iPad and MacOS.` | `iPhone・iPad・macOS向けの、Twitterに似たNostrクライアント。` | **変わる** |
| 説明が無い記録（Olas）の表示 | `No summary published` | `概要は公開されていません` | **変わる**（i18n ラベル） |
| 日本語フレーズ検索 `iPhone・iPad・macOS向けの` | `["Damus"]` | `["Damus"]` | 変わらない |
| 英語フレーズ検索 `A twitter-like nostr client` | `["Damus"]` | `["Damus"]` | 変わらない |
| free トピック検索 `commerce` | `["Shopstr"]` | `["Shopstr"]` | 変わらない |

**結論（実測）: 表示は言語で変わり、検索結果集合は変わらない。** issue のタイトル「UI言語を切り替えても検索対象が変わらない」は、**現在の実装では意図された仕様**であり、コメントで明示されている。これは「バグ」ではなく、issue が書かれた時点との前提のずれ。

### 1.3 多言語の説明文はデータとして存在するのか（41 件で実測）

`data.js` を Node で読んで数えた（コマンドと出力は §7.1）。

| 計測 | 件数 |
|---|---|
| `tools` 総数 | **41** |
| `descriptions` キーを持つ | 41 |
| `descriptions` が空でない | **40** |
| 現れる言語コード | `["en","ja"]` |
| `descriptions.ja` を持つ | **40** |
| `descriptions.en` を持つ | **40** |
| `summary` が非空 | 40 |
| `summaryAbsent: true` | **1**（`nosmaps:com.pablof7z.olas` / Olas。`summary: ""`, `descriptions: {}`） |
| `summary` にかな・漢字を含む | **0** |
| `descriptions.ja` が `summary` と異なる | **40** |
| `descriptions.ja` にかなを含む | **40** |
| `descriptions.en` が `summary` と異なる | **0**（= `en` は収集原文そのもの） |

つまり **`en` は一次情報のコピー、`ja` だけが新しく生えた文章**。

### 1.4 その日本語文はどこから来たか（これが #14 の核心）

| 計測対象 | コマンド | 結果 |
|---|---|---|
| 署名済みイベント `catalogue-events.jsonl` | 41 行を parse し `content` のキーを数える | `schema` 41 / `version` 41 / `state` 41 / `name` 41 / `summary` 41 / `homepage` 27。**`descriptions` キーは 0 件** |
| 同上、かな含有 | `content` に `[ぁ-ゟ゠-ヿ]` を含むイベント | **0 件** |
| 一次情報ドラフト `real-catalog-draft.json` | `data.js` の `ja` 文 40 本がこのファイルに現れるか | **0 / 40**（かな自体は 19 文字ヒットするが、それは README 引用と shipped label の引用であって説明文ではない） |
| `tools/build-data.mjs` | 同じ 40 本が現れるか | **40 / 40** |

**実測の結論: 41 件の日本語説明文は、署名済みイベントにも一次情報ドラフトにも存在しない。全量が `tools/build-data.mjs:293-` の `DESCRIPTIONS_JA` にハードコードされた、ビルドスクリプト起源の文章である。**

`build-data.mjs:290-292` のコメントは「Each entry below is the recorded original of that same record carried into Japanese -- the record is the source, so nothing here states a fact the catalogue does not already state」と述べる。しかし翻訳者が誰か、いつ・どの原文リビジョンから訳したかは、**データにもイベントにも記録されていない**（実測: `descriptions` キー 0 件）。`ecbb46b` のコミットメッセージ自身が `generated rather than hand written` と書いており、生成物であることは認めているが、生成器も生成日も出力側には残っていない。

`data.js` の冒頭コメント（`data.js:3-9`）は「Canonical source: catalogue-events.jsonl」「Annotations with no room in the v1 content profile ... are joined on by `d` from real-catalog-draft.json」と述べる。**`descriptions.ja` はそのどちらの経路にも当てはまらない**（§6 の食い違い C1）。

### 1.5 テストの現況

`npx playwright test --project=chromium -g 'either UI language'` を実走（出力 verbatim は §7.3）。

- **結果: 1 failed。** ただし落ちている行は `tests/e2e.spec.js:249`（全カードの説明文一致）であって、検索の行（`:234`, `:241`）ではない。
- 落ちている理由: `expectedDescriptions()`（`:90-92`）が `absentLabel` を **テスト開始時の 1 言語分だけ**取得している（`:219`、その時点の言語＝ブラウザ locale 由来）。en では `No summary published` を期待して合うが、ja に切り替えた後も同じ英語ラベルを期待するため、実際の `概要は公開されていません` と食い違う。差分は Olas の 1 行のみ。
- **つまり検索の assertion は現状 pass しており、落ちているのは absent ラベルの言語追従を見ていないテスト側の欠陥。** issue 本文の「日本語の説明文クエリで0件になり失敗する」は、現時点では**再現しない**（§7.2 で ja クエリが `["Damus"]` を返すことを実測）。

---

## 2. 方針: 無い値で検索させない / 無い訳文を UI で作らない

上の実測から、この設計が守る線は次の 3 本。`design-relay-native-data.md` の **D7（Unknown is never invented, `docs/design-relay-native-data.md:70`）** と **§4.2 rule 2b（cataloguer-authored placeholder は禁止, `:272-278`）** の直接の延長である。

**P1. 出所を記録できない訳文は、データとして持たない。**
訳文は「収集した事実」ではなく「誰かが作った二次テキスト」。誰が・いつ・どの原文から作ったかを記録できないなら、`data.js` に載せない。現在の `DESCRIPTIONS_JA` はこの条件を満たしていない（§1.4 実測）。

**P2. 検索は、記録されている値だけを対象にする。UI 言語で検索対象を切り替えない。**
言語で対象を切り替えると、「ja 表示のときだけ Damus が出ない」という**言語依存の見つからなさ**が生まれる。これは検索結果の順序や一致を言語で捏造するのと同じ。現在の実装（全記録言語を対象、`app.ts:598-599`）はこの原則に既に沿っており、**変更しない**。

**P3. 観測していない言語は、その旨を言葉で出す。空文字にも `undefined` にも、原文の黙った差し替えにもしない。**
Olas（`summaryAbsent: true`）で既に実装されている扱い（`app.ts:296-301` の `toolDescription`）と同じ形を、「原文はあるがこの言語の訳が無い」場合にも適用するかは §3 の選択肢と §4 の未解決に送る。

---

## 3. 取りうる選択肢（費用と、嘘の入り込む余地）

| | 選択肢 | やること | 費用 | 嘘の入り込む余地 |
|---|---|---|---|---|
| **(a)** | **検索対象を言語非依存フィールドに揃える**（＝現状を仕様として固定する） | 検索は全記録言語を対象、と設計に明記。テストを「UI 言語を変えても結果集合が動かない」ことの固定に書き換える | 最小。`src/` の検索ロジックは変更不要（実測で既にそうなっている）。テスト 1 本の retarget のみ | **低い。** ただし (a) 単独では §1.4 の出所不明な `ja` 文が `data.js` に残り、検索対象にも表示にも入り続ける。**(a) は (d) と組でなければ嘘を消せない** |
| **(b)** | **訳文を一次情報から収集して持つ** | 各プロジェクトが自分で公開している日本語説明（README の ja 版、公式サイトの ja ページ等）を収集し、URL・取得日・原文リビジョンを provenance として記録。v1 プロファイルは `content` に未知キーを拒否する（`docs/design-relay-native-data.md:260`）ので、`descriptions` を `content` に入れるなら **`version: 1` → `2`** が要る | **最大。** 41 件分の一次情報探索（多くのプロジェクトは ja 説明を公開していない見込み。**未取得** — 今回 41 件の ja 一次情報の有無は調べていない）＋ スキーマ改版 ＋ 収集ツール ＋ 検証 | **最も低い。** 訳ではなく publisher 自身の文なので出所が一次。ただし「ja 説明が存在する記録」と「しない記録」が混在し、UI はその欠落を言葉で出す必要がある |
| **(c)** | **言語切替時に「この言語の説明は観測していません」と明示する** | 訳を持たず、ja 表示では英語原文をそのまま出す＋「これは収集した原文（英語）です」と添える | 小。i18n ラベル 1〜2 本と `toolDescription` の分岐 | **低い。** 原文を黙って出すより誠実。ただし「訳が無い」ことと「原文が英語である」ことを言い分ける文言設計が要る |
| **(d)** | **`DESCRIPTIONS_JA` を撤去して 1.3 の状態を巻き戻す** | `tools/build-data.mjs` の 40 本を削除し `data.js` を再生成。`descriptions` は `{en: summary}` だけになる（もしくはキー自体を落とす） | 小〜中。`data.js` 再生成、`tests/e2e.spec.js:74-86`（`describedEntries` が「ja と en の 2 言語がある」ことを assert している）の retarget | **ゼロにする方向。** ただし現在画面に出ている日本語説明が消えるので、**UX の後退であり kojira の判断が要る**（U1） |
| **(e)** | **訳文を残し、provenance を後付けで記録する** | `DESCRIPTIONS_JA` の 40 本について、生成者（人 or モデル名）・生成日・原文リビジョンを記録し、UI で「機械生成の訳」と明示する | 中。ただし**生成の事実を今から正確に再構成できるかが不明**（`ecbb46b` は "generated" としか書いていない。生成器名は **未取得**） | **中〜高。** 再構成できない生成メタデータを「たぶんこうだった」で埋めると、それ自体が捏造。**再構成できないなら (d) に落とすべき** |

**推奨（この設計書としての意見、決定ではない）: (a) + (d) を基線とし、UX 後退が許容できないなら (a) + (c)。(e) は生成メタデータが実測で再構成できた場合に限る。(b) は別 issue。**

issue 本文の kojira の見立て（「個人的には 1 が筋」「訳を持つなら別 issue で provenance ごと設計」）と一致する。ただし issue 執筆後に (e) 相当のものが provenance 無しで入っているので、**まずその撤去または追認の判断が要る**。

---

## 4. 未解決（kojira の判断が要る点）

ここは勝手に決めない。

- **U1. `DESCRIPTIONS_JA` の 40 本を撤去するか、残すか。** 撤去すれば §1.4 の出所不明が消えるが、日本語話者向けの表示は英語原文に戻る（UX 後退）。残すなら、何を根拠に「これは捏造ではない」と言えるかを言葉にする必要がある。
- **U2. U1 で「残す」を選ぶ場合、どの provenance を記録するか。** 生成器名・生成日・原文リビジョン。`ecbb46b` からこれらを正確に再構成できるかは **未取得**。再構成できない項目を推測で埋めることは D7 に反するので、埋められないなら「生成、詳細不明」と書くか、撤去するかの二択になる。
- **U3. 訳文をイベント側に持たせるか、注釈側に留めるか。** `content` に入れるなら `version: 1 → 2`（`docs/design-relay-native-data.md:260` の unknown-key 拒否）。`real-catalog-draft.json` 側の注釈として `d` で join するなら v1 のまま。後者は「署名されていない値が画面に出る」ことを意味する。#18（`design-multi-signer-corrections.md`）の「訂正は別署名者の記録として並べる」路線に乗せて、**訳を第三者の kind 30078 記録として扱う**選択肢もあるが、その場合 §1.2 の「言語で結果集合を動かさない」原則との整合を別途決める必要がある。
- **U4. 「この言語の説明は観測していません」を UI に出すか。** 出すなら、Olas の `summaryAbsent`（＝原文自体が無い）と、「原文はあるが ja が無い」を別の文言にするか。現在は後者が silent fallback になっている（`app.ts:299-300`）。
- **U5. `descriptions.en` は残すか。** 実測で `en` は 40/40 が `summary` と同一。冗長だが「言語マップが日本語専用の裏口でないこと」を示すために置かれている（`build-data.mjs:356-358` のコメント）。U1 で撤去する場合、`en` だけ残す意味があるか。
- **U6. `src/domain/explorer.ts:173` の `toolSearchTerms` / `:194` の `matchesQuery` を、生かすか消すか。** 実測で参照 0 件。`app.ts` の実装と項目集合がずれており、**「検索の仕様はどちらか」が二重になっている**。この issue の範囲で片付けるか、別 issue にするか。
- **U7. `tests/e2e.spec.js:74-86` の `describedEntries` が持つ前提を、どこまでテストに残すか。** 現在「カタログは ja と en の説明を記録している」を assert している（`:76`）。U1 で撤去するとこの assert 自体が落ちるので、テストが守るべき性質を書き直す必要がある。

---

## 5. 受け入れ条件（#14 を close できる形）

実装 issue に落とすときの契約。**すべて break-restore で守れる形にする**（＝該当の修正を巻き戻したとき、その条件が実際に fail することを確認して初めて回帰テストと呼ぶ）。

### A. 言語非依存の固定（選択肢 (a) を採る場合）

- **A1.** UI 言語を `ja` / `en` に切り替えたとき、同一クエリの結果集合（カード名のソート済み配列）が**両言語で一致する**。クエリは最低 3 本: 記録されている説明文から取った語、free トピック、記録名。
  - break-restore: `app.ts:572` の `LANGUAGES.flatMap(...)` を `[i18n.language]` に狭めると A1 が fail すること。
- **A2.** 期待値は `data.js` から独立計算する（画面から読み戻さない）。`tests/e2e.spec.js:63` の `catalogueSearchMatches` を使う現在の形を維持。
- **A3.** 「検索は UI 言語に依存しない」ことがテスト名と設計文書の両方に明文化されている。

### B. 説明文表示の言語追従

- **B1.** クエリ空のとき、カード数は `data.tools.length`（実測 41）と一致する。
- **B2.** 各カードの説明文は `descriptions[表示言語] || (summaryAbsent ? その言語の absent ラベル : summary)` と一致する。**absent ラベルは表示言語ごとに取り直す**（現在の `:219` の 1 回取得を修正する ＝ §1.5 の実 fail 原因）。
  - break-restore: `absentLabel` を言語切替後に取り直す修正を巻き戻すと B2 が fail すること（現に今 fail している、§7.3）。
- **B3.** どのカードの説明文も、空文字でなく、文字列 `undefined` を含まない（現行 `:252-253` を維持）。

### C. 出所の健全性（U1 の決定に依存）

- **C1（(d) を採る場合）.** `data.js` に含まれる `descriptions` の値のうち、**署名済み `catalogue-events.jsonl` または `real-catalog-draft.json` に出所を辿れないものが 0 件**であることを検査するテストが存在する。
  - 判定式（実行可能）: 各 tool の各言語テキストについて、`catalogue-events.jsonl` の当該 `d` のイベント `content` 内か `real-catalog-draft.json` 内に verbatim で存在すること。
  - break-restore: `DESCRIPTIONS_JA` を 1 本でも復活させると C1 が fail すること（現状は 40 本 fail する ＝ §7.1 の実測で確認済み）。
- **C2（(e) を採る場合）.** 各訳文が `generator` / `generatedAt` / `sourceRevision` を持ち、そのいずれかが不明なら値ではなく「不明」として記録されている。UI に「機械生成の訳」と表示される。
  - break-restore: provenance フィールドを削ると C2 が fail すること。
- **C3.** `tools/verify-catalogue.mjs`（既存）または新規チェックが、C1 / C2 のいずれかを CI 可能な形で実行する。

### D. 非後退

- **D1.** `npm run typecheck`（`tsc --noEmit && node tools/check-layering.mjs`）が通る。
- **D2.** `npx playwright test`（chromium / webkit）で、この issue が触る 1 本を含め、**触っていないテストが新たに red にならない**。着手前の red の本数を記録して比較する（着手前の全体 red 本数は今回 **未取得** — 対象 1 本のみを実走した）。

---

## 6. 既存 docs / コードとの食い違い（指摘のみ。修正はしない）

- **C1. `data.js:3-9`（生成ヘッダ）** — 「Canonical source: catalogue-events.jsonl」「Annotations ... are joined on by `d` from real-catalog-draft.json」と述べるが、`descriptions.ja`（40 件）は**そのどちらにも存在しない**（§1.4 実測）。ヘッダは第三の出所（`tools/build-data.mjs` のハードコード）に触れていない。
- **C2. `tools/build-data.mjs:290-292`** — 「the record is the source, so nothing here states a fact the catalogue does not already state」。訳文が原文と同義であることは自明ではなく、それを検証した記録も無い。少なくとも「誰がその同義性を確認したか」は記録されていない。
- **C3. `docs/design-relay-native-data.md:272-278`（§4.2 rule 2b）** — cataloguer-authored placeholder を「monolingual であること」を理由の一つとして禁じている。`descriptions.ja` は cataloguer-authored かつ bilingual なので rule 2b の文面には直接抵触しないが、**「収集者が書いた文章がレコードに載る」という点は同じ**。rule 2b がそこまで及ぶのかは文面から読み取れない（U2 に関係）。
- **C4. `docs/design-relay-native-data.md:260`（§4.2 rule 2）** — `content` は `{schema, version, state, name, summary, homepage?, superseded_by?}` の 7 キーのみで unknown key は拒否。`descriptions` をイベントに載せる将来案は必ず version bump を要する。現在の実装はイベントに載せていないので**今は矛盾していない**が、`data.js` の消費側（`src/domain/entry.ts:157`）は `descriptions` を Entry の必須フィールドとして型定義しており、**イベント由来でない値が Entry 型に入っている**。
- **C5. `docs/design-relay-native-data.md:2242-2243`（§21.5）** — 「it is not translatable by the i18n layer」を `"Unknown"` 禁止の理由に挙げている。この論法は「レコードの本文は i18n レイヤの管轄外」を前提にしており、`descriptions` の導入はその前提と緊張する。どちらが正かは決めていない。
- **C6. `docs/design-multi-signer-corrections.md:49`, `:309`（`design/issue-18-multi-signer-corrections` ブランチ）** — イベント `content` のキーを `schema/version/state/name/summary/homepage` の 6 つと実測している。**今回の再実測（41 件、§7.1）と完全に一致**（`homepage` 27 件も一致）。食い違いなし。整合を確認したという記録として残す。
- **C7. `src/domain/explorer.ts:173-192` と `src/ui/explorer/app.ts:572-606`** — 検索語の集合が二重定義で、内容がずれている（domain 側はトピック・機能語を引数で受け取り、`displayLicense` ではなく `tool.license` を使う）。domain 側は参照 0 件（実測）。どちらが仕様かを述べた文書は無い（U6）。
- **C8. `tests/e2e.spec.js:219`** — `absentLabel` を言語切替の前に 1 回だけ取得し、両言語のループで使い回している。これが現在の唯一の fail 原因（§1.5）。

---

## 7. 実測の記録（コマンドと出力）

### 7.1 データ側

```
$ node -e "…data.js を window に評価して数える…"
tools total = 41
has descriptions key = 41
descriptions non-empty object = 40
languages seen = ["en","ja"]
descriptions.ja present = 40
descriptions.en present = 40
summary present (non-empty) = 40
summaryAbsent true = 1
summary containing kana/kanji = 0
top-level keys of first tool = ["id","coordinate","name","summary","summaryAbsent","descriptions","homepage","icon","recordState","topics","collectedTopics","topicCorrection","provenance","collectedAt","observed","sources","license","platformText","distribution","sourceRepo","capabilities","claim","liveness","findings"]
data top-level keys = ["meta","seedTopics","resultPrecedence","registry","nipCatalog","tools"]

ja differs from summary = 40
ja equals summary = 0
en differs from summary = 0
ja contains kana = 40
en contains kana = 0
--- no-descriptions entry ---
{"id":"nosmaps:com.pablof7z.olas","name":"Olas","summary":"","summaryAbsent":true,"descriptions":{}}

$ node -e "…catalogue-events.jsonl を parse…"
events = 41
events whose content contains kana = 0
events whose content has a descriptions key = 0
content key counts = {"schema":41,"version":41,"state":41,"name":41,"summary":41,"homepage":27}

$ node -e "…出所の突き合わせ…"
ja texts found in real-catalog-draft.json = 0 /40
ja texts that appear verbatim in tools/build-data.mjs = 40 / 40

$ grep -rn 'toolSearchTerms\|matchesQuery\|searchTerms' src tests --include=*.ts --include=*.js
src/domain/explorer.ts:173:export function toolSearchTerms(
src/domain/explorer.ts:194:export function matchesQuery(query: string, terms: readonly string[]): boolean {
```

### 7.2 ブラウザでの言語切替（Playwright、chromium）

```
{
 "en": {
  "htmlLang": "en",
  "absent": "No summary published",
  "counts": {"ja": 1, "en": 1, "tag": 1},
  "matches": {"ja": ["Damus"], "en": ["Damus"], "tag": ["Shopstr"]},
  "firstSummary": "A twitter-like nostr client for iPhone, iPad and MacOS.",
  "olas": ["No summary published"],
  "cards": 41
 },
 "ja": {
  "htmlLang": "ja",
  "absent": "概要は公開されていません",
  "counts": {"ja": 1, "en": 1, "tag": 1},
  "matches": {"ja": ["Damus"], "en": ["Damus"], "tag": ["Shopstr"]},
  "firstSummary": "iPhone・iPad・macOS向けの、Twitterに似たNostrクライアント。",
  "olas": ["概要は公開されていません"],
  "cards": 41
 }
}
SEARCH RESULT SETS IDENTICAL ACROSS UI LANGUAGES = true
CARD SUMMARY DIFFERS ACROSS LANGUAGES = true
```

クエリは `ja = "iPhone・iPad・macOS向けの"` / `en = "A twitter-like nostr client"` / `tag = "commerce"`。使ったスクリプトはリポジトリ外（`/tmp`）に置き、実行後に削除した（`src/` `tests/` `tools/` を汚さないため）。

### 7.3 既存 e2e の実走

```
$ npx playwright test --project=chromium -g 'either UI language' --reporter=line
Running 1 test using 1 worker
  1) [chromium] › tests/e2e.spec.js:214:1 › explorer search records descriptions and tags in either UI language
    Error: expect(locator).toHaveText(expected) failed
    Locator: locator('.feature-tool-card .tool-summary')
    - Expected  - 1
    + Received  + 1
    -   "No summary published"
    +   "概要は公開されていません"
      247 |     await page.locator('#feature-query').fill('');
      248 |     await expect(page.locator('.feature-tool-card')).toHaveCount(data.tools.length);
    > 249 |     await expect(page.locator('.feature-tool-card .tool-summary')).toHaveText(expectedDescriptions(data, language, absentLabel));
  1 failed
```

差分は Olas の 1 行のみ。検索の assertion（`:234`, `:241`）には到達しており fail していない。

### 7.4 変更の出自

```
$ git log --oneline -S'"descriptions"' -- data.js
ecbb46b Keep the draft when publishing fails, and carry descriptions per language

$ git log -1 --format='%H %ad %s' ecbb46b
ecbb46baaad8b591491299327392bd4f3f7bd594 Wed Aug 19 07:20:27 2026 +0900 Keep the draft when publishing fails, and carry descriptions per language
```

コミットメッセージ本文より: `Descriptions can also hold text per language, generated rather than hand written, falling back to the collected original where nothing is recorded. The searches that lean on that are not retargeted yet and stay red.`

### 7.5 未取得（この作業で確認していないこと）

- 41 件のプロジェクトが**自分で日本語説明を公開しているか**（選択肢 (b) の実現可能性）。一件も調べていない。
- `DESCRIPTIONS_JA` の**生成器名・生成日時・原文リビジョン**。`ecbb46b` は "generated" としか述べていない。
- テストスイート**全体**の red 本数（対象 1 本のみ実走）。webkit プロジェクトは一度も走らせていない。
- `en` 以外・`ja` 以外の言語を UI が扱えるか（`src/ui/i18n.ts:4` は「two languages」と述べるが、3 言語目を足したときの検索挙動は確認していない）。

---

## 8. この設計書が変更しないもの

`src/` `tests/` `tools/` `dist/` `data.js` は一行も触っていない。この文書は `docs/` の追加 1 ファイルのみ。実装は U1〜U7 の判断を得てから、別ブランチで行う。
