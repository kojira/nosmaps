# 設計: explorer のカテゴリ・ファセット（issue #13）

- 対象 issue: #13「explorer: カテゴリ選択の個数がテストの期待値と合わない（期待7 / 実測12）」
- 調査時 HEAD: `3cecf3483a49ad125944eaab2a6c9202f79550e0`（`main`。追跡済みファイルに変更なし＝本書のみが未追跡だった状態）
- 本書はスコープが**設計のみ**。`src/` `tests/` `tools/` `dist/` `data.js` は 1 行も変更していない。

---

## 1. 結論（先に）

**issue #13 の赤は、HEAD ではすでに存在しない。**
「期待 7」のリテラルは `0ba5ec0`「Count the categories from the catalogue instead of
remembering seven」で除去済みで、そのコミットは HEAD の祖先である。HEAD で当該テストを
実行すると **pass する**。

そして **12 が正**。カテゴリボタンは「固定リスト」ではなく「カタログから導出される値」で
あり、41 件のレコードが実際に公開している topic の集合がそれを決めている。7 は 41 件投入前
のサンプル時代の凍結値だった。

したがって本 issue で**実装もテストも直す必要はない**。必要なのは
「12 の正しさをデータ根拠つきで確定させ、issue を閉じる」ことと、
**既存 docs に残った古い記述（6カテゴリ / 単数 category 前提）の是正判断**である。

---

## 2. 問題（今どうなっているか）

### 2.1 issue 本文が報告している症状（引用）

```
Error: expect(locator).toHaveCount(expected) failed
Locator:  locator(".category-filter .category-icon")
Expected: 7
Received: 12
```

issue は「7 と 12 のどちらが正なのかは未判定」と書いている。

### 2.2 「期待 7」の出所（ファイル・行番号）

- **`tests/e2e.spec.js:83`（コミット `457d74c` 時点）** — `await expect(choices).toHaveCount(7);`

  ```
  $ git show 457d74c:tests/e2e.spec.js | grep -n 'toHaveCount(7)\|category-icon'
  82:      const choices = page.locator('.category-filter .category-icon');
  83:      await expect(choices).toHaveCount(7);
  ```

- **HEAD にはこのリテラルは存在しない。** HEAD の該当行は
  **`tests/e2e.spec.js:180`** で、期待値をカタログから導出している。

  ```
  $ grep -n 'toHaveCount' tests/e2e.spec.js | head -1
  180:      await expect(choices).toHaveCount(expectedCategoryIds.length);
  ```

- 導出関数は **`tests/e2e.spec.js:18-22`**:

  ```js
  function catalogueCategoryIds() {
    const {tools, seedTopics} = catalogueData();
    const free = [...new Set(tools.flatMap(tool => tool.topics || []).filter(topic => !seedTopics.includes(topic)))].sort();
    return ['all', ...seedTopics, ...free];
  }
  ```

### 2.3 修正済みであることの根拠

```
$ git log --oneline -8 -- tests/e2e.spec.js
ecbb46b Keep the draft when publishing fails, and carry descriptions per language
88d17ab Stop testing a switch that no longer exists
2b0c257 Search for entries that exist
0ba5ec0 Count the categories from the catalogue instead of remembering seven
457d74c Drop the preset review images, and stop the suite leaning on other people servers
...

$ git merge-base --is-ancestor 0ba5ec0 HEAD && echo YES || echo NO
YES
```

`0ba5ec0` のコミットメッセージ自身がこの判断を述べている:

> The filter offers every topic the catalogue carries, and the test held a literal seven
> from the days of the sample fixture. Real data brings twelve: the all button, the seven
> seed topics, and four more that the entries themselves introduce. Nothing was wrong on
> the page; the number had simply been frozen.

### 2.4 HEAD での実測（テスト実行結果 verbatim）

chromium:

```
$ npx playwright test tests/e2e.spec.js --project=chromium -g 'category titles and descriptions wrap' --reporter=line

Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e.spec.js:169:1 › category titles and descriptions wrap without clipping or overflow on desktop and 375x812
  1 passed (1.3s)
```

webkit:

```
$ npx playwright test tests/e2e.spec.js --project=webkit -g 'category titles and descriptions wrap' --reporter=line

Running 1 test using 1 worker

[1/1] [webkit] › tests/e2e.spec.js:169:1 › category titles and descriptions wrap without clipping or overflow on desktop and 375x812
  1 passed (3.0s)
```

**カテゴリ個数の赤は、chromium / webkit のどちらでも再現しない。**

なお `tests/e2e.spec.js` 全体（chromium + webkit）を流すと **15 failed / 15 passed (5.7m)** に
なるが、失敗内容はカテゴリ個数とは無関係。確認できた失敗の代表例は i18n のロケール取り違え:

```
Error: expect(locator).toHaveText(expected) failed
Locator: locator('.feature-tool-card .tool-summary')
-   "No summary published"
+   "概要は公開されていません"
```

（`test-results/e2e-explorer-search-record-ce606--tags-in-either-UI-language-chromium/error-context.md`）
`Expected: 7` を含む error-context は **1 件も存在しない**（`grep -rn 'Expected: 7' test-results/` → 0 件）。
**この 15 件は issue #13 のスコープ外**（§6 でスコープ外として明示、§7 で done 条件に含めないことを明記）。

---

## 3. カテゴリ値の実分布（verbatim）

### 3.1 `data.js`（UI とテストが読む唯一のソース）

`data.js` を sandbox 評価して `tools[].topics` を数えた出力そのまま:

```
entryCount(meta): 41
tools.length: 41
seedTopics: ["clients","relay","identity","media","analytics","dev","wallet"]
distinct topic values: 11
 16 clients
  7 relay
  5 media
  5 identity
  5 dev
  4 wallet
  1 commerce
  1 notifications
  1 spec
  1 analytics
  1 distribution
free topics: ["commerce","distribution","notifications","spec"]
expected ids: ["all","clients","relay","identity","media","analytics","dev","wallet","commerce","distribution","notifications","spec"]
expected count: 12
```

内訳: `all`(1) + seed topics(7) + free topics(4) = **12**。

### 3.2 `catalogue-events.jsonl`（署名済み 30078 の `t` タグ生値）

```
lines: 41
events: 41 distinct t-tags: 7
 41 nosmaps
 17 clients
  9 identity
  7 relay
  7 dev
  6 media
  1 analytics
```

### 3.3 3.1 と 3.2 が食い違う理由（重要）

**食い違いはバグではなく、`tools/build-data.mjs` の `TOPIC_CORRECTIONS` による意図的な補正である。**
`catalogue-events.jsonl` は収集時に「6 カテゴリのうち最も近いもの」へ寄せて記録されており、
`tools/build-data.mjs:64-73` が 8 件を訂正している（各訂正が発行者自身の文言を根拠に引用付き）:

```
'nosmaps:com.zeusln':            {topics: ['wallet'], ...}
'nosmaps:com.albyhub':           {topics: ['wallet'], ...}
'nosmaps:com.mutinywallet.app':  {topics: ['wallet'], ...}
'nosmaps:com.getalby.extension': {topics: ['identity','wallet'], ...}
'nosmaps:market.shopstr':        {topics: ['commerce'], ...}
'nosmaps:dev.zapstore':          {topics: ['distribution'], ...}
'nosmaps:me.njump.pokey':        {topics: ['notifications'], ...}
'nosmaps:com.hzrd149.blossom':   {topics: ['spec'], ...}
```

生イベントの `nosmaps` は discovery topic（全件必須の bookkeeping）で、カテゴリではない。
訂正結果は `data.js` の `topics` に入り、訂正前の値は `collectedTopics`、理由は `topicCorrection`
として各行に残る（`tools/build-data.mjs:383-385`）。**情報は捨てられていない。**

---

## 4. どちらが正か — 判定と根拠

### 判定: **12 が正。実装（12 を描画する側）が正しく、テストの旧リテラル 7 が古かった。**

根拠は 4 つ。

1. **UI はカテゴリを「持って」いない。カタログから導出している。**
   `src/ui/explorer/app.ts:213-215`:
   ```ts
   const categories = seedTopics;
   const freeTopics = [...new Set(tools.flatMap(tool => tool.topics).filter(topic => !categories.includes(topic)))].sort();
   const allTopics = [...categories, ...freeTopics];
   ```
   描画は `src/ui/explorer/app.ts:685` で `all` ボタン + `allTopics.map(...)`。
   つまり 12 は「実装が生やした数」ではなく「41 件のデータが持っている数」。
   **カテゴリを過剰生成している事実はない**（distinct 11 + `all` = 12 で一致、重複なし）。

2. **7 は設計上「seed の個数」であってボタンの個数ではない。**
   `docs/design-relay-native-data.md:2258`（§21.6 R6 見出し）と `:2260`（Decision 本文）は
   「seed of seven」＝ seed 語彙が 7 語と定めている。ボタンは seed 7 に
   `all` と free topics を足したものなので、7 と一致しないのが正常。
   `src/ui/explorer/app.ts:211-212` のコメントも同じことを言っている。

3. **free topic を潰すと設計違反になる。**
   §21.6（`design-relay-native-data.md:2281-2302`）は、free topic を
   verbatim で描画せよ、`unknown` に落とすな、と明示している。Shopstr が
   `t=clients` に押し込まれて「偽を主張するレコード」になった件がその根拠として
   挙げられている。7 に戻す＝ commerce / distribution / notifications / spec を
   消す＝この決定を破ることになる。

4. **HEAD のテストは既にこの導出を採用し、pass している**（§2.4）。

### 12 を「固定値として書く」のも不可

12 は今日の 41 件が偶然作る数であって、レコードが 1 件増えれば変わる。
テストは `catalogueCategoryIds()` で導出し続けるべきで、
**個数ではなく id の並び（`toEqual(expectedCategoryIds)`、`tests/e2e.spec.js:187`）を守るのが本体**。

---

## 5. 直す対象と直し方

### 5.1 コード（`src/`）— **変更なし**

実装は正しい。触らない。

### 5.2 テスト（`tests/`）— **変更なし**

`tests/e2e.spec.js:18-22, 180, 187` はすでに導出式。追加の変更は不要。

### 5.3 issue #13 — **「修正済み（既に `0ba5ec0` で解決）」としてクローズ**

クローズコメントに載せるべき事実は 3 つ:
- 「期待 7」は `457d74c:tests/e2e.spec.js:83` にあり、`0ba5ec0` で除去済み・HEAD の祖先
- 12 の内訳（`all` + seed 7 + free 4）と §3.1 の分布
- HEAD でカテゴリテストが pass する実行結果

### 5.4 docs — **§7 の「既存docsとの差分」の是正は別 PR で判断**

本書は現状を記録するだけ。既存ファイルは書き換えていない。

---

## 6. 作らないもの（スコープ外の明示）

- **カテゴリ語彙の変更**（seed への昇格 / 削除 / リネーム）。
  §21.6 は「収集エントリがその語にクラスタしたときのみ昇格」と定めている。
  1 件しかない `commerce` / `distribution` / `notifications` / `spec` を seed に上げない。
- **free topic のラベル・アイコンの追加**。現状は `icon: 'tag'` +
  `explorer.freeTopic` の汎用説明（`src/ui/explorer/app.ts:259`、`src/ui/i18n.ts:112,397`）。
  これは §21.6 が要求する「この端末はこの語のラベルを持たない」という正直な表示であり、
  埋めるのはラベルの捏造になる。
- **カテゴリボタンの UI 再設計**（折りたたみ、階層化、多選択、件数バッジ）。
  12 個が並びとして読みにくいかは別問題（§7 OPEN-2）。
- **`catalogue-events.jsonl` の再署名 / topic 訂正の巻き戻し**。
  訂正は `tools/build-data.mjs` にあり、根拠と訂正前値が保存されている。イベント本体は触らない。
- **`tests/e2e.spec.js` の残り 15 failed の修正**（i18n ロケール等）。別 issue。
- **`dist/` の再ビルド**。

---

## 7. 完了の判定条件（done の定義）

issue #13 は以下が全て真なら done。

1. **`tests/e2e.spec.js:169` "category titles and descriptions wrap without clipping or
   overflow on desktop and 375x812" が chromium / webkit 両方で green。**
   （**chromium / webkit とも §2.4 で実測済み・どちらも 1 passed**）

2. **導出が壊れたら赤くなることを確認する（回帰テストとして機能しているか）。**
   `0ba5ec0` のメッセージは「Dropping one category from the derived set fails it; so does
   removing a single Japanese label.」と主張している。**この主張は本調査では未検証。**
   done にするなら、一時的に `data.js` から free topic を 1 つ落とすか、
   `src/ui/explorer/app.ts:215` の `freeTopics` を空にして
   **実際に fail することを目視してから巻き戻す**。落ちないテストは何も守っていない。

3. **個数のリテラルが再混入していない。**
   テスト名案: `category filter offers exactly the ids the catalogue carries`
   （既存テストで満たされているので新規作成は不要。増やすなら
   `grep -n 'toHaveCount([0-9]' tests/e2e.spec.js` をレビュー観点として運用する方が安い）

4. issue #13 に §4 の判定と §3.1 の分布を貼ってクローズ。

**注意: 「`tests/e2e.spec.js` が全部 green」を done 条件にしてはいけない。**
残り 15 failed は #13 とは無関係で、それを条件に含めると #13 が永遠に閉じられない。

---

## 8. 未解決の論点（判断を仰ぐべき点）

- **OPEN-1: 解消済み。** webkit 単独でも該当テストを実行し `1 passed (3.0s)` を確認した（§2.4）。
  chromium / webkit いずれも green で、論点として残らない。

- **OPEN-2: 12 個のカテゴリボタンを並べる UI がこのまま妥当か。**
  現在のテストは「はみ出さない」ことしか見ていない。1 件しかない free topic 4 つが
  seed と同じ重みで並ぶのが読み手にとって正しいかは、テストでは決められない設計判断。
  件数バッジや seed / free の視覚的区別を入れるかは kojira の判断。

- **OPEN-3: free topic の並び順が `.sort()` 依存で、ロケールを見ていない。**
  現状 ASCII 昇順（`commerce, distribution, notifications, spec`）。
  日本語 UI でもこの順。意図通りか未確認。

- **OPEN-4: `docs/real-catalog-draft-report.md` の「六 shipped categories」等、
  古い前提が残る記述を是正するか、当時の記録として凍結するか。**
  §9 参照。設計文書は「その時点の記録」でもあるので、機械的に書き換えるべきではないと
  考えるが、判断を仰ぎたい。

---

## 9. 既存docsとの差分（既存ファイルは書き換えていない）

`README.md` にはカテゴリ／トピックへの言及が **1 件も無い**
（`grep -n 'categor\|topic' README.md` → 0 件）。以下は `docs/` 配下のみ。

| # | 場所 | 記述 | 現在の実装・データ | 種別 |
|---|---|---|---|---|
| D1 | `docs/real-catalog-draft-report.md:34-35` | 「Topic (`t`) distribution against the six shipped categories: clients 17, identity 9, relay 7, dev 7, media 6, analytics 1」 | 現在は seed 7 語（`wallet` 追加済み）。`data.js` の分布は clients 16 / relay 7 / dev 5 / identity 5 / media 5 / wallet 4 / analytics 1 + free 4（§3.1）。報告書の数字は `catalogue-events.jsonl` の訂正前値（§3.2）に対応 | **収集当時の記録として正しい**。訂正前の値であることが本文から読み取りにくい |
| D2 | `docs/real-catalog-draft-report.md:280-286` FINDING 27 | 「`data.js` ships `clients / relay / identity / media / analytics / dev`」「Eight entries fit none of the six shipped categories」 | `data.js` の `seedTopics` は 7 語（`wallet` を含む）。8 件は `TOPIC_CORRECTIONS` で解決済み（`tools/build-data.mjs:64-73`） | **解決済みの FINDING**。解決済みマークが本文に無い |
| D3 | `docs/real-catalog-draft-report.md:295-298` FINDING 25b | 「the shipped UI's `category`/`categoryLabel` pair is single-valued, so multi-topic records cannot round-trip into it」 | `data.js` の `tools[].topics` は配列。`src/ui/explorer/app.ts:213-215` も配列前提。**多値化済み** | **解決済み**。ただし relay 由来行だけは単数 `category` が残る（`src/ui/explorer/relay-row.ts:61-77`）ので完全な解消ではない |
| D4 | `docs/design-relay-native-data.md:2296-2298` §21.6 | 「The single-valued `tool.category` / `categoryLabel` pair in `data.js` and the `categories` array in `nip-explorer.js:9` cannot round-trip a multi-topic record. That is a code amendment (§21.10 item 1)」 | §21.10 item 1 は**実施済み**（多値化 + `wallet` 追加 + free topic verbatim 描画）。参照先の `nip-explorer.js` は **もう存在しない**（TypeScript 化で `src/ui/explorer/app.ts` へ移行、`20cdb9e`） | **未実施として書かれた項目が実施済み**。ファイルパス参照も古い |
| D5 | `docs/design-relay-native-data.md:2431-2440` §21.10 item 1 | 「Code amendments required (none made here)」の 1 番として同上 | 同上、実施済み | 同上 |
| D6 | `docs/design-relay-native-write-path.md:1320` | 「the explorer derives its rendered category from `t` topics ... `nip-explorer.js:9`, `:292`, `:300`, `:206` / read at `HEAD = 822f56f`」 | `nip-explorer.js` は存在しない。現在の対応箇所は `src/ui/explorer/app.ts:213-215, 685` | **ファイル・行番号が現存しない**。ただし「`HEAD = 822f56f` 時点で読んだ」と明記されているので、記録としては嘘ではない |
| D7 | `docs/design-relay-native-write-path.md:226-230` | 「A free topic is not an uncategorised record」「Shopstr ... filed `t=clients`, and that record asserts something false」 | 実装と**一致**。Shopstr は `commerce` に訂正済み | 差分なし（確認のみ） |
| D8 | `docs/STATUS-typescript-rewrite.md:145` | `categoryFromTopics` の移植を「0 differing fields」と報告 | `src/ui/explorer/relay-row.ts:61-66` に存在、seed に一致する最初の topic を返す単数関数 | 差分なし。ただし D3 の「relay 行だけ単数」の出どころはここ |

**差分の性質について:** D1〜D6 はいずれも「当時は正しく、その後コードが先に進んだ」もので、
**実装が間違っている箇所は一つも見つからなかった**。設計文書を現在形に書き換えるか、
「§21.10 item 1 は実施済み（実施コミット: 未特定）」の一行を追記するに留めるかは OPEN-4。

---

## 10. 本調査で未確認のまま残した項目

- **`0ba5ec0` が主張する「1 カテゴリ落とすと fail する」の実地検証**（§7-2）。
  コードを触らない制約のため実行していない。
- **§21.10 item 1 を実際に実施したコミット**。`20cdb9e`（TS 書き換え）以前の
  どこかだが特定していない。
- **`tests/e2e.spec.js` の残り 15 failed の原因**。i18n のロケール適用タイミングと
  推測できるが、**推測であり調査していない**。
- **`docs/design-relay-native-data.md` 全 167KB の通読**。カテゴリ／トピック関連の
  grep ヒット箇所のみ読んだ。他節に矛盾がある可能性は排除できていない。
- **free topic の並び順の意図**（OPEN-3）。設計文書に順序の規定を見つけられなかった。

---

*作成: のすたろう / 調査 HEAD `3cecf34` / 本書はコードを一切変更していない*
