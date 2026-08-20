# Nosmaps — explorer の UI 言語切替と検索対象（説明文の多言語化）

**設計書のみ。この文書はコードを一行も変更していない。** 実装は別途 GO を得てから。

- 対象 issue: #14「explorer: UI言語を切り替えても検索対象が変わらない（説明文の多言語化が存在しない）」
- 起点: `main = 3cecf34`（`Order by the date a record was collected, and say that it is the collection date`）
- ブランチ: `design/issue-14-i18n-search`（`docs/` のみ）
- 実測日: 2026-08-20（初版）／ 2026-08-20（kojira 決定を受けた改訂 2 版。§3 と §7.5 が新規実測）
- 既存設計との関係: `design-relay-native-data.md`（読み取り・v1 コンテンツプロファイル）と `design-multi-signer-corrections.md`（同一 `d` に複数署名者 = #18）の**追補**。両者の決定は上書きしない。§3.2.3 / D14-5 は #18 の `stackRecords`（`src/domain/stacks.ts`）にそのまま乗る形を選んでおり、**新しい概念を足していない**。
- 記法: 「実測」と書いたものは、この作業中にコードを読むかコマンドを実走して確認した。確認できなかったものは **未取得** と明記する。推測で埋めた値は無い。
- **改訂 2 版で変わったこと:** kojira の決定（§3 冒頭に verbatim）により、旧版の選択肢 (a)〜(e) と旧 U1 / U2 / U3 / U5 は解消され、**第三の道 —「説明文は最初から署名されたイベントとして持つ」— に確定した**。旧 §3（選択肢の比較）は §3（決定表と形式）に置き換えた。§1・§2・§6・§7.1〜7.4 の実測は初版のまま有効（値は再確認済み）。

---

## 0. 要旨（先に結論）

issue #14 の本文が書かれた時点（2026-08-18、`0ba5ec0`）の前提は、**現在の `main` では既に成立していない**。

- issue 本文: 「日本語の `summary` を持つエントリは 0 件」「言語別の説明を持つ構造自体が無い」
- 現在の実測: `data.js` の 41 件中 **40 件が `descriptions.ja` を持つ**。構造（`descriptions: Record<language, string>`）も存在する。
- 変わった原因: `ecbb46b`（`Keep the draft when publishing fails, and carry descriptions per language`、2026-08-19 07:20:27 +0900、author kojira）が `tools/build-data.mjs` に `DESCRIPTIONS_JA` を追加した。

したがって #14 は「多言語説明が無い」問題ではなくなり、**「多言語説明が、署名済みの一次情報に無い出所から入っている」問題**に変質している。issue 本文にある「訳を持つなら provenance ごと設計する話になる」という懸念が、実際にはその設計を経ずに先に入った、という状態。

検索の挙動そのものは、実測では既に **UI 言語非依存**（issue の選択肢 1 に相当する実装が既に入っている）。壊れているのは検索ではなく、訳文の出所である。

**そして kojira の決定（§3）で、その出所の直し方が決まった:**

1. **説明文は、言語を明示した上で、署名されたイベントの中に持つ**（D14-1）。ビルドスクリプトのハードコードは経路として廃止する。
2. **`DESCRIPTIONS_JA` の 40 本は捨てない。同じ文章を日本語イベントとして実発行し直す**（D14-2）。撤去でも追認でもなく、**正しい入口から入れ直す**。
3. **訳者フィールドは作らない。署名者の pubkey が訳者そのもの**（D14-3）。書けば二重管理になり食い違いうる。
4. 形式は **1 イベントに複数言語（`content` の言語マップ）＋ `version` を 1 → 2**（§3.2.3 / §3.2.4）。**これは実測に強制された結論であり、好みの問題ではない**（NIP-01 の置き換えキーは `kind`+`pubkey`+`d` のみ、かつ 41 件は単一鍵・単一秒）。
5. **「言語ごとに任意の署名者が書ける」は #18 が既に解いている**（同一 `d` に複数署名者 = 別座標 = 誰も置き換えない）。この issue で新しく作るものは無い（D14-5）。

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
訳文は「収集した事実」ではなく「誰かが作った二次テキスト」。誰が書いたかを記録できないなら、`data.js` に載せない。現在の `DESCRIPTIONS_JA` はこの条件を満たしていない（§1.4 実測）。
**§3 の決定はこの P1 を、撤去ではなく「入口を正す」方向で満たす:** 訳文を最初から署名イベントとして持てば、**誰が書いたかは pubkey として自動的に確定する**。別途 provenance フィールドを作る必要は無い（D14-3）。

**P2. 検索は、記録されている値だけを対象にする。UI 言語で検索対象を切り替えない。**
言語で対象を切り替えると、「ja 表示のときだけ Damus が出ない」という**言語依存の見つからなさ**が生まれる。これは検索結果の順序や一致を言語で捏造するのと同じ。現在の実装（全記録言語を対象、`app.ts:598-599`）はこの原則に既に沿っており、**変更しない**。

**P3. 観測していない言語は、その旨を言葉で出す。空文字にも `undefined` にも、原文の黙った差し替えにもしない。**
Olas（`summaryAbsent: true`）で既に実装されている扱い（`app.ts:296-301` の `toolDescription`）と同じ形を、「原文はあるがこの言語の記述が無い」場合にも適用するかは §4 の U1 に送る（文言の判断が残っているだけで、データ側は §3 で決まった）。

---

## 3. 決定（kojira、2026-08-20 Nostr リプライ）

kojira の決定を verbatim で引く。

> 言語フィールドをイベントに追加したら？ そしたら表示に合わせられる。言語毎に書きたい人が書くといい。初期のやつは日本語のイベントも発行して。

> 訳者はイベント発行者だからわざわざ書かなくていい

これで**第三の道が確定した**。旧版が並べていた選択肢 (a)〜(e) — 「訳を捨てるか、出所不明のまま残すか」の二択 — は前提ごと外れる。**説明文は最初から署名されたイベントとして持つ。** ビルドスクリプトに文字列を埋めておいて後から出所を付ける、という順序をやめる。

### 3.1 決定表

| # | 決定 | 根拠 | 旧論点 |
|---|---|---|---|
| **D14-1** | **説明文は、言語を明示した上で、署名されたイベントの中に持つ。** ビルドスクリプトのハードコードは経路として廃止する | kojira 決定 1。`design-relay-native-data.md` D7（Unknown is never invented）と §4.2 rule 2b（cataloguer-authored placeholder 禁止）に、訳文も同じ扱いで乗る | 旧 U1 / 旧選択肢 (a)(d)(e) |
| **D14-2** | **`tools/build-data.mjs` の `DESCRIPTIONS_JA`（40 本、`:293-334`、CJK 1105 文字 / 40 行を実測）は撤去する。同じ 40 本の文章は捨てず、日本語イベントとして実発行し直す。** `data.js` はそのイベントから組み立てる | kojira 決定 1（「初期のやつは日本語のイベントも発行して」）。文章を捨てるのではなく、出所を後から付けるのでもなく、**正しい入口から入れ直す** | 旧 U1 |
| **D14-3** | **訳者フィールドは作らない。** `translator` / `translatedBy` / `generator` / `translatedFrom` に相当するフィールドをイベントにも `data.js` にも置かない | kojira 決定 2。**署名者の pubkey が訳者そのもの。**フィールドに書けば、署名と本文の 2 か所が同じ事実を持つことになり、**食い違いうる**（署名を差し替えれば pubkey は変わるがフィールドは変わらない）。`tools/sign-catalogue.mjs:20-21` の既存方針「Attribution is the pubkey. There is no collector field」と同じ規則を、訳にも適用するだけ。新しい規則ではない | 旧 U2 |
| **D14-4** | **初期 40 本は、既存 41 件と同じ収集鍵で発行する**（pubkey `3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6`、実測で 41/41 が単一鍵） | kojira 確認済み。訳の出所は「この収集者が訳した」であり、それは事実。別鍵を立てると、実在しない第三の主体を作ることになる | 新規（旧 U2 の裏） |
| **D14-5** | **言語ごとに任意の署名者が書ける構造は、#18 の「同一 `d` に複数署名者」にそのまま乗せる。新しい概念を足さない** | `src/domain/stacks.ts`（`feat/issue-18-multi-signer-write`、`20f2150`）の `stackRecords` は `d` のバイト一致だけで束ねる。別の署名者が同じ `d` に自分の言語で書けば、それは既に「重なり」であり、#18 が既に解いた問題。**この issue で `d` の意味・stack の作り方・座標の形は一切変えない** | 新規 |
| **D14-6** | **`descriptions.en`（実測 40/40 が `summary` と完全一致）は作らない。** 原文は `summary` にあり、言語マップにコピーを置かない | D14-3 と同じ理由。同じ文字列を 2 か所に置けば食い違いうる。`summary` を直したのに `descriptions.en` を直し忘れる、が起きる | 旧 U5 |

### 3.2 形式の決定 — 実測に基づく

**この節の判断はすべて、この作業中に実際に走らせた計測に基づく。計測コマンドと出力は §7.5 に verbatim で置いた。推測で決めた点は無い。**

#### 3.2.1 実測した現況

```
events = 41
kinds = { '30078': 41 }
pubkeys = { '3ce2f3e7…82b6': 41 }          ← 単一署名者
created_at distinct = 1 [ '1787011200' ]   ← 41 件が同一秒
tag names = { d: 41, t: 88, state: 41, v: 41 }
tag shapes = { 'd,t,t,state,v': 36, 'd,t,t,t,state,v': 4, 'd,t,t,t,t,state,v': 1 }
content keys = { schema:41, version:41, state:41, name:41, summary:41, homepage:27 }
content version values = [ 1 ]
v tag values = [ '1' ]
distinct d = 41
any lang-ish tag (L / l / lang / language) = 0
```

**読み取れること:**

1. **言語を表す tag は 1 件も無い**（`L` / `l` / `lang` / `language` すべて 0）。言語は今どこにも記録されていない。「`summary` が英語である」ことすら、データのどこにも書かれていない。
2. **`content` のキー集合は 6 種で固定**され、`src/domain/records.ts:169-179` が exact key set として強制している（`required = [schema, version, state, name, summary]`、`optional = [homepage, superseded_by]`、それ以外は `fail('unknown-field')`、さらに `version !== 1` は `fail('bad-version')`）。**`content` に `descriptions` を足すには version を上げるしかない**（§3.2.4）。
3. **`d` は 41 件すべて distinct**、`:` を 1 個だけ含む（`nosmaps:` 前置の分）。最大 35 バイト、上限 192 バイト（`D_MAX_BYTES`）なので余裕は 157 バイト。
4. `v` タグは全件 `"1"` だが、**`src/` にも `tools/` にも `v` タグを読むコードは 1 行も無い**（実測: grep ヒット 0）。走査補助であって拘束力を持っていない。

#### 3.2.2 言語は tag か、content の中か → **content が正。tag は走査補助**

**決定: 言語別テキストは `content` の中に言語コードをキーとするマップとして持つ。`content` が唯一の正である。**

理由:

- **既存の 41 件は、記録の本体をすべて `content` に置いている**（tag 側にあるのは `d` / `t` / `state` / `v` の 4 種だけで、`state` は `content.state` の写しにすぎず、`src/domain/records.ts:205-207` が**不一致なら invalid** にしている）。テキストは 1 件も tag に無い。訳文だけを tag に置くのは、この repo の既存の形からの逸脱になる。
- tag 値は**平坦な文字列配列**なので、「言語 → テキスト」の対応を tag だけで表そうとすると `["description","ja","…"]` のような自前の並びを発明することになる。これは `content` に構造を持たせるより弱く、しかも新概念。
- **`content` に置くと NIP-01 の indexable tag では引けない**（`01.md:84` 実測: 単一英字 tag のみ indexed）。ただし現在の読み取りは `t` タグ（`nosmaps`）で discovery し、`content` を parse して選別する形（`records.ts`）なので、**言語で relay 側フィルタする経路は今も無く、必要にもなっていない**。

**走査補助としての言語タグ（推奨・任意）:** NIP-32（`32.md`、commit 656cecc から実取得）が言語ラベルの既存表現を定めている。実例が仕様本文にある:

```yaml
{ "kind": 1, "tags": [ ["L","ISO-639-1"], ["l","en","ISO-639-1"] ], "content": "English text" }
```

これを `state` タグと**まったく同じ扱い**で足す — すなわち **`content` が正、tag は走査補助、不一致ならイベントごと invalid**（`records.ts:205-207` と同じ規則をもう 1 本適用するだけで、新しい規則ではない）。`l` は単一英字なので relay 側で `#l` フィルタが効き、将来「ja の説明を持つ記録だけ引く」が protocol の既存機能でできる。**付けるかどうかは U6 に残す**（付けなくても D14-1〜D14-6 は成立する）。

#### 3.2.3 1 イベント 1 言語か、1 イベント複数言語か → **1 イベント複数言語。これは実測に強制された結論**

**ここが設計の芯なので、机上の断定ではなく、置き換え規則の一次情報と実データの両方を突き合わせた。**

NIP-01（`nostr-protocol/nips` commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`、この repo が `nips-registry-656cecc.json` で pin しているのと同じ commit。今回 `curl` で実取得、`01.md:99`）:

> for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value -- which means that, for each combination of `kind`, `pubkey` and the `d` tag value, only the latest event MUST be stored by relays, older versions MAY be discarded.

**置き換えのキーは `kind` + `pubkey` + `d` の 3 つだけ。tag も content も入らない。**

したがって、実データ（kind 30078 固定 / 単一 pubkey / `d` は記録ごとに 1 つ）に対して:

| 形 | 同一署名者が 2 言語書けるか | 判定 |
|---|---|---|
| **F1. 1 イベントに複数言語**（`content` に言語マップ） | **書ける。**1 つの `d` にイベントは 1 つのまま。置き換えは起きない | **採用** |
| **F2. 1 言語 1 イベント、`d` は同じ** | **書けない。**同じ鍵・同じ `d` の 2 通目は 1 通目を**置き換える**（`01.md:99`）。しかも 41 件は `created_at` が全件同一秒（1787011200、実測）なので、同秒衝突時は `01.md:101` の「lowest id が残る」に落ち、**どちらが残るかが id のハッシュ次第**という最悪の形になる | **不採用** |
| **F3. 1 言語 1 イベント、`d` に言語を足す**（`nosmaps:io.damus:ja` 等） | 書けるが、**#18 を壊す。** `src/domain/stacks.ts` は「`d` のバイト一致だけが 2 件を同じ重なりに入れる」（M1.3）。`…:ja` と `…` は別の `d` なので**別の重なりになり、説明文が本体と別のカードとして並ぶ**。直すには「`d` の言語サフィックスを剥がして束ねる」という新概念を stack 層に足すことになり、これは D14-5 の禁止事項そのもの。加えて #18 D2 で `d` は canonical URI（`nosmaps:https://github.com/damus-io/damus`）になるため、末尾に `:ja` を足すと URI のポート/パスと衝突する | **不採用** |

**F1 を採ると、kojira の「言語毎に書きたい人が書くといい」はどう成立するか:**

**別の署名者が、同じ `d` に、自分の書いた言語だけを載せたイベントを出す。** pubkey が違うので座標が違い、誰も置き換えない（NIP-01 の同じ一文がそれを保証する）。それを束ねるのが `stackRecords`（`d` のバイト一致）で、**#18 phase 1 で既に実装済み・relay 上で実測済み**（`20f2150` のコミットメッセージ: `d nosmaps:io.damus held one record, then two, by two distinct pubkeys, and stackRecords made one stack of observed=2`）。

**つまり「言語ごとに任意の署名者が書ける」は、この issue で新しく作るものが何も無い。** #18 が既に置いた構造の上で、`content` に言語マップが載るだけ。

#### 3.2.4 `content.version` は上げる必要があるか → **必要。1 → 2**

実測:

- 41 件すべて `content.version === 1`（§3.2.1）。
- `src/domain/records.ts:170-179`:
  ```
  const required = ['schema', 'version', 'state', 'name', 'summary'];
  const optional = ['homepage', 'superseded_by'];
  … if (required.indexOf(key) === -1 && optional.indexOf(key) === -1) return fail('unknown-field');
  if (prop(c, 'version') !== 1) return fail('bad-version');
  ```

**`descriptions` を `content` に足したイベントは、現在の読み取り経路では `unknown-field` で確実に落ちる。** これは仮定ではなく、コードに書かれた exact key set の帰結。したがって **v2 プロファイルの制定が必須**。

**v2 プロファイル（この設計としての提案）:**

| キー | 必須 | v1 からの変更 | 備考 |
|---|---|---|---|
| `schema` | 必須 | 変更なし | `org.nosmaps.software` |
| `version` | 必須 | **`1` → `2`** | v1 のイベントは v1 のまま有効。読み手は両方を受け入れる（v1 は `descriptions` を持たない、それだけ） |
| `state` / `name` / `summary` | 必須 | 変更なし | `summary` は**原文のまま**。訳で上書きしない |
| `homepage` / `superseded_by` | 任意 | 変更なし | |
| **`descriptions`** | **任意** | **新規** | `{ "<言語コード>": "<テキスト>" }`。値は非空文字列。**`summary` と同一の文字列を入れてはならない**（D14-6）。**空マップは書かない**（`descriptions: {}` ではなくキーごと省く。Olas の「原文が無い」は `summary: ""` が既に表しており、二重に表さない） |

**`v` タグの扱い:** 41 件は `["v","1"]` を持つが、**このタグを読むコードは実測でゼロ**。v2 のイベントには `["v","2"]` を付ける（既存の形に揃えるため）が、**これは走査補助であって拘束力は無い**、と明記する。`content.version` が正。

**`summary` の言語をどう記録するか — 書けない値は書かない:**
`descriptions.ja` があっても、`summary` が**何語なのか**はどこにも記録されていない（§3.2.1 の実測: 言語タグ 0 件）。`summary_lang: "en"` を足したくなるが、**41 件の原文が英語であることを今回逐一検証していない（未取得）**。実測できたのは「41 件中 38 件が純 ASCII、残り 3 件は絵文字・em dash・全角ではない記号を含むのみ」というところまでで、これは言語の証明ではない。**したがって `summary_lang` を 41 件に一括で焼くことは、観測していない値を書くことにあたり、D7 違反。** v2 では `summary_lang` を**任意**とし、**署名者が自分の書いた文の言語を知っている場合にだけ書く**。書かないときは「原文（言語は未記録）」として扱い、UI もそう言う（U1）。

#### 3.2.5 既存 `descriptions.en` をどうするか → **撤去**（D14-6）

実測: `descriptions.en` は 40/40 が `summary` と**完全一致**（`en が summary と異なる = 0`）。`tools/build-data.mjs:356-358` のコメントは「言語マップが日本語専用の裏口でないことを示すため」に置いたと述べているが、**それは同じ文字列の 2 個目のコピーを維持する理由にはならない**。

- 撤去後の表示規則: `descriptions[表示言語] ?? summary`（`summary` が原文。`summaryAbsent` なら absent ラベル）。**現在の `src/ui/explorer/app.ts:296-301` の分岐がそのまま使える**（`descriptions.en` が消えても en 表示は `summary` に落ちるだけで同じ文字列になる）。
- 検索は変わらない（§2 の P2、`app.ts:594` は言語マップ全体 + `summary` の両方を語に入れている）。
- 影響を受けるテスト: `tests/e2e.spec.js:76`（`languages` が `['en','ja']` と等しいことを assert）と `tests/collapsed-card-and-carousel-entry.spec.js:122`（`descriptions.en && descriptions.ja && en !== ja`）。**両方が落ちる。**書き換えが要る（U3）。

#### 3.2.6 実際に relay で確かめる手順（この設計では実行しない）

**§3.2.3 の結論は NIP-01 の文面とコードの実測から出しているが、「relay が本当にそう振る舞うか」は文面ではなく観測で決まる。**発行前に、以下を**捨て `d` で**実走して確かめる。**この設計書の作業では 1 バイトも発行していない。**

前提: #18 phase 2 が `tools/publish-correction.mjs`（発行 + 読み戻し + kind:5 での撤回）と `tools/stack-relay-records.mjs`（relay の返答に `stackRecords` を当てる）で**まったく同じ形の実測を既に済ませている**（`20f2150`）。手順はそれを流用する。新しいツールは要らない。

| 手順 | やること | 何が分かれば OK か |
|---|---|---|
| V1 | 捨て `d`（例 `nosmaps:test.i18n-replacement`、実在するツールを指さない値）で、**収集鍵と同じ鍵**から v2 content（`descriptions: {ja: "…"}` 入り）を 1 通発行し、`wss://x.kojira.io` から REQ で読み戻す | relay が v2 content を受理するか。**content を parse しない relay なら受理されるはずだが、それは観測して確かめる** |
| V2 | **同じ鍵・同じ `d`** で、`descriptions` を `{en: "…"}` に差し替えた 2 通目を発行し、再度 REQ | **1 通目が返らなくなれば、F2（1 言語 1 イベント・同一鍵）が成立しないことの実測になる。**返り続けるなら relay が置き換えを実装していないだけなので、他 relay でも確認する |
| V3 | **別鍵**から同じ `d` に 3 通目を発行し、REQ で 2 件返ることと `stackRecords` が `observed: 2` の重なりを作ることを確認 | F1 + D14-5（言語ごとに別署名者が書ける）が protocol と実装の両方で成立することの実測。#18 が既に同型を確認済みなので、確認であって発見ではない |
| V4 | V1〜V3 で出した全イベントを kind:5 で撤回し、REQ で返らなくなることを確認 | 検証用のゴミを relay に残さない。**既存 41 件には一切触らない** |

**V2 の結果が「置き換えられなかった」だった場合でも F2 は採らない。** relay の実装差に依存する形は、別の relay で壊れる。NIP-01 が MUST で置き換えを要求している以上、置き換えられない relay の方が例外。

### 3.3 移行の手順（実装 issue に落とすときの順序。今回は実行しない）

| # | やること | 触るもの | 検証 |
|---|---|---|---|
| M1 | v2 プロファイルを `design-relay-native-data.md` §4.2 に追記（v1 は失効させない） | `docs/` | — |
| M2 | `src/domain/records.ts` を v1 / v2 の両方受理に。v2 でだけ `descriptions` / `summary_lang` を許す | `src/` | v1 の 41 件が引き続き valid（既存テスト） |
| M3 | `real-catalog-draft.json` の 40 件に、`DESCRIPTIONS_JA` の文章を**そのまま**移す（**書き直さない**。移動であって新しい訳ではない） | 一次情報ドラフト | 40/40 が build-data.mjs のリテラルと verbatim 一致すること |
| M4 | `tools/sign-catalogue.mjs` で v2 として再署名し、`catalogue-events.jsonl` を作り直す | 署名 | `tools/verify-catalogue.mjs` が 41/41 通る |
| M5 | `tools/build-data.mjs` から `DESCRIPTIONS_JA`（`:293-334`）を削除し、`descriptions` はイベント由来のみに | `tools/` | §5 の AC-C1 / AC-C2 |
| M6 | relay へ発行（§3.2.6 の V1〜V4 を先に済ませてから） | relay | 読み戻しで 41/41 |

**M4 の副作用（未解決 U4）:** 再署名すると `created_at` が変わる。現在 41 件は `1787011200`（収集日 2026-08-18 00:00:00 UTC）で、`src/domain/sorting.ts` の `collected-desc` / `collected-asc` はこれを「収集日」として表示している（issue #21）。**訳を足した日を収集日として出すのは、収集していない日付を収集日と呼ぶことになる。** さらに #18 D3 が「41 件を新 `d` で再発行する」と決めており、**この issue の再署名と #18 の再発行は同じ 41 件を二度署名する**。順序と `created_at` の扱いを決める必要がある（U4）。

---

## 4. 残る未解決（番号を振り直した）

旧 U1（撤去 or 追認）と旧 U2（provenance に何を書くか）は **§3 の決定表で解消**したので、ここから外した。旧 U3（イベント側か注釈側か）も D14-1 で解消。旧 U4 は U1 に、旧 U5 は D14-6 で解消、旧 U6 は U2 に、旧 U7 は U3 に移した。

| # | 未解決 | 旧番号 | なぜ今決められないか |
|---|---|---|---|
| **U1** | **「この言語の説明は観測していません」を UI に出すか。** 出すなら、Olas の `summaryAbsent`（原文自体が無い）と、「原文はあるがこの言語が無い」を別の文言にするか。現在は後者が silent fallback（`src/ui/explorer/app.ts:299-300`）。§3.2.4 で `summary_lang` を任意にしたため、「原文が何語か分からないまま表示している」ケースも生じる | 旧 U4 | 文言の設計判断。データ側は決まっているので実装を止めない |
| **U2** | **`src/domain/explorer.ts:173` の `toolSearchTerms` / `:194` の `matchesQuery` を生かすか消すか。** 実測で参照 0 件（定義元以外のヒットなし）。`app.ts:572-606` と項目集合がずれており、**「検索の仕様はどちらか」が二重定義**。この issue で片付けるか別 issue か | 旧 U6 | #14 の範囲外だが、`descriptions` を両方が読んでいるので触ると必ず当たる |
| **U3** | **テストが守るべき性質の書き直し。** D14-6 で `descriptions.en` が消えると `tests/e2e.spec.js:76`（`languages === ['en','ja']`）と `tests/collapsed-card-and-carousel-entry.spec.js:122`（`en && ja && en !== ja`）が**両方落ちる**。落ちるべくして落ちるので、何を守るテストに書き換えるかを決める | 旧 U7 | §5 の受け入れ条件が確定すれば機械的に決まる。ただし 2 ファイルにまたがる |
| **U4** | **再署名で `created_at` が変わることの扱い、および #18 D3 との順序。** 現在 41 件は `1787011200`（収集日）で、`src/domain/sorting.ts` がそれを「収集日」として表示している。訳を足した日を収集日と呼べない。#18 D3 も同じ 41 件を新 `d` で再発行すると決めており、**二度署名になる** | 新規（M4 由来） | #18 の実装順序に依存する。#14 単独では決められない |
| **U5** | **`summary_lang` を書けるのはどの記録か。** §3.2.4 のとおり 41 件の原文が英語であることは**未取得**。逐一確認して書くのか、確認できたものだけ書くのか、そもそも書かないのか | 新規 | 41 件分の一次情報確認が要る。作業量の判断 |
| **U6** | **NIP-32 の `L` / `l` 言語タグを付けるか。** 付ければ relay 側 `#l` フィルタが効く（`01.md:84` 実測: 単一英字 tag のみ indexed）。付けなくても D14-1〜D14-6 は成立する。付けるなら `state` タグと同じく「content が正、不一致なら invalid」 | 新規 | 今すぐ必要な機能が無い。将来の走査のためだけ |

**この 6 つは、いずれも「訳文をイベントとして持つ」という決定を止めない。** U4 だけは #18 との順序調整が要るので、実装着手前に片付ける必要がある。

---

## 5. 受け入れ条件（#14 を close できる形）

**すべて break-restore で守る。**＝ その修正を巻き戻したとき、条件が**実際に fail することを確認して**初めて回帰テストと呼ぶ。判定式は実行可能な形で書く。

### A. 言語非依存の検索（現状の仕様の固定）

- **A1.** UI 言語を `ja` / `en` に切り替えたとき、同一クエリの結果集合（カード名のソート済み配列）が**両言語で一致する**。クエリは最低 3 本: 記録されている説明文から取った語、free トピック、記録名。
  - break-restore: `src/ui/explorer/app.ts:594` の `metadataValues(tool.descriptions)` を `metadataValues(tool.descriptions[i18n.language])` に狭めると A1 が fail すること。
- **A2.** 期待値は `data.js` から独立計算する（画面から読み戻さない）。`tests/e2e.spec.js:63` の `catalogueSearchMatches` を使う現在の形を維持。
- **A3.** 「検索は UI 言語に依存しない」ことがテスト名と設計文書の両方に明文化されている。

### B. 説明文表示の言語追従

- **B1.** クエリ空のとき、カード数は `data.tools.length`（実測 41）と一致する。
- **B2.** 各カードの説明文は `descriptions[表示言語] ?? (summaryAbsent ? その言語の absent ラベル : summary)` と一致する。**absent ラベルは表示言語ごとに取り直す**（現在の `tests/e2e.spec.js:219` の 1 回取得が §1.5 の実 fail 原因）。
  - break-restore: `absentLabel` を言語切替後に取り直す修正を巻き戻すと B2 が fail すること（**現に今 fail している**、§7.3）。
- **B3.** どのカードの説明文も、空文字でなく、文字列 `undefined` を含まない（現行 `:252-253` を維持）。

### C. 出所の健全性（D14-1 / D14-2 の契約）— **実行可能な判定式**

**AC-C1. `tools/build-data.mjs` に訳文リテラルが 0 件。**

判定式（そのまま走る）:

```
node -e 'const s=require("fs").readFileSync("tools/build-data.mjs","utf8");
const n=(s.match(/[\u3041-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g)||[]).length;
process.stdout.write("cjk chars in build-data.mjs = "+n+"\n");
process.exit(n===0?0:1);'
```

- **合格条件: 終了コード 0（CJK 文字 0 個）。**
- **着手前の実測値: `cjk chars = 1105` / `cjk lines = 40`（すべて `DESCRIPTIONS_JA`、`:294-333` に収まることを実測。範囲外の CJK 行は 0 行）。したがって現在この判定式は fail する。**
- break-restore: `DESCRIPTIONS_JA` を **1 本でも**戻すと fail する（1 本でも CJK が 1 個以上入るため）。
- **この判定式は `tools/` 全体に広げてはいけない。** 実測で `tools/diff-explorer.mjs` が CJK を 4 行持つ（`:11`, `:102`, `:149` は日本語ではなく em dash `—`、`:205` は検索語 `'オープンソース'` で、これは**訳文ではなくテスト入力**）。広げると訳文と無関係な行で落ちる。**対象は `tools/build-data.mjs` のみ。**

**AC-C2. 表示された説明文がすべて署名済みイベントに遡れる。**

判定式（そのまま走る）:

```
node -e '
const fs=require("fs");
const evs=fs.readFileSync("catalogue-events.jsonl","utf8").trim().split("\n").map(JSON.parse);
const byD=new Map(evs.map(e=>[e.tags.find(t=>t[0]==="d")[1], JSON.parse(e.content)]));
const win={}; (new Function("window", fs.readFileSync("data.js","utf8")))(win);
const tools=(win.NOSMAPS_DATA||Object.values(win)[0]).tools;
let ok=0,bad=0;
for(const t of tools){
  const c=byD.get(t.id);
  for(const [lang,text] of Object.entries(t.descriptions||{})){
    const signed = c && (c.summary===text || (c.descriptions && c.descriptions[lang]===text));
    if(signed) ok++; else { bad++; console.log("untraceable:", t.id, lang); }
  }
}
console.log("traceable =",ok," untraceable =",bad);
process.exit(bad===0?0:1);'
```

- **合格条件: 終了コード 0（`untraceable = 0`）。**
- **着手前の実測値: `traceable = 40 / untraceable = 40`。** 遡れている 40 は `descriptions.en`（＝ `summary` のコピー）、遡れない 40 が `descriptions.ja`。**したがって現在この判定式は fail する。**
- break-restore: イベント側の `descriptions` を 1 件でも消す、または `build-data.mjs` が署名外の文字列を 1 本でも混ぜると fail する。
- **この判定式が D14-3（訳者フィールドを作らない）も同時に守る:** 遡り先が「その `d` の署名イベント」なので、**誰が書いたかは pubkey として自動的に確定する。**照合すべきフィールドがそもそも無い。

**AC-C3.** AC-C1 / AC-C2 が `tools/verify-catalogue.mjs` か新規チェックから CI 可能な形で実行される。

**AC-C4.** `data.js` のどの `descriptions` にも、`summary` と**完全一致する値が存在しない**（D14-6）。
判定式: `descriptions` の全値のうち同レコードの `summary` と `===` になるものを数え、0 であること。**着手前の実測値: 40 件（`en` が全件一致）。したがって現在 fail する。**

**AC-C5.** `data.js` にも `catalogue-events.jsonl` にも、訳者を表すフィールドが存在しない（D14-3）。
判定式: 両ファイルに `translator` / `translatedBy` / `translated_by` / `generator` の文字列が 0 件。**着手前の実測値: 0 件（既に合格）。**これは「今後も入れない」を守るための回帰テストであり、break-restore は「フィールドを 1 本足すと fail する」で確認する。

### D. 非後退

- **D1.** `npm run typecheck`（`tsc --noEmit && node tools/check-layering.mjs`）が通る。
- **D2.** `npx playwright test`（chromium / webkit）で、**この issue が触っていないテストが新たに red にならない**。着手前の red 本数を記録して比較する（**着手前の全体 red 本数は未取得** — 対象 1 本のみ実走した）。
- **D3.** 既存 41 件の v1 イベントが、v2 導入後も valid のまま読める（`tools/verify-catalogue.mjs` が 41/41）。
  - break-restore: `records.ts` の v1 受理を外すと 41 件全部が落ちること。

---

## 6. 既存 docs / コードとの食い違い（指摘のみ。修正はしない）

- **C1. `data.js:3-9`（生成ヘッダ）** — 「Canonical source: catalogue-events.jsonl」「Annotations ... are joined on by `d` from real-catalog-draft.json」と述べるが、`descriptions.ja`（40 件）は**そのどちらにも存在しない**（§1.4 実測）。ヘッダは第三の出所（`tools/build-data.mjs` のハードコード）に触れていない。
- **C2. `tools/build-data.mjs:290-292`** — 「the record is the source, so nothing here states a fact the catalogue does not already state」。訳文が原文と同義であることは自明ではなく、それを検証した記録も無い。少なくとも「誰がその同義性を確認したか」は記録されていない。
- **C3. `docs/design-relay-native-data.md:272-278`（§4.2 rule 2b）** — cataloguer-authored placeholder を「monolingual であること」を理由の一つとして禁じている。`descriptions.ja` は cataloguer-authored かつ bilingual なので rule 2b の文面には直接抵触しないが、**「収集者が書いた文章がレコードに載る」という点は同じ**。rule 2b がそこまで及ぶのかは文面から読み取れない。**D14-1 / D14-4 でこの緊張は解ける:** 収集者が書いた文章であることを隠さず、**収集者の鍵で署名して載せる**なら、それは「誰が書いたか不明の文章がレコードに紛れ込む」ではなく「この署名者がそう書いた」という記録になる。rule 2b が禁じているのは前者である。
- **C4. `docs/design-relay-native-data.md:260`（§4.2 rule 2）** — `content` は `{schema, version, state, name, summary, homepage?, superseded_by?}` の 7 キーのみで unknown key は拒否。`descriptions` をイベントに載せる案は必ず version bump を要する。**D14-1 でイベントに載せると決めたので、§3.2.4 の v2 プロファイル（`version: 1 → 2`）がこの帰結を引き受ける。**なお現在の実装はイベントに載せていないので**今は矛盾していない**が、`data.js` の消費側（`src/domain/entry.ts:157`）は `descriptions` を Entry の必須フィールドとして型定義しており、**イベント由来でない値が Entry 型に入っている**。
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

### 7.5 決定を受けての再実測（2026-08-20、形式の判断根拠）

**§3.2 の形式判断はすべてこの節の出力に基づく。推測で決めた点は無い。**

**(1) 既存 41 件の tag / content 構成（§3.2.1 / §3.2.2 の根拠）**

```
$ node -e '…catalogue-events.jsonl を parse して tag 名・tag 並び・content キーを数える…'
events = 41
kinds = { '30078': 41 }
pubkeys = {
  '3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6': 41
}
created_at distinct = 1 [ '1787011200' ]
tag names = { d: 41, t: 88, state: 41, v: 41 }
tag shapes = { 'd,t,t,state,v': 36, 'd,t,t,t,state,v': 4, 'd,t,t,t,t,state,v': 1 }
content keys = {
  schema: 41,
  version: 41,
  state: 41,
  name: 41,
  summary: 41,
  homepage: 27
}
content version values = [ 1 ]
v tag values = [ '1' ]
d values sample = [
  'nosmaps:io.damus',
  'nosmaps:social.amethyst',
  'nosmaps:net.primal.web'
]
distinct d = 41
any lang-ish tag = 0
```

（`any lang-ish tag` は `L` / `l` / `lang` / `language` のいずれかの tag 名を持つイベント数。**0 件** = 言語はどこにも記録されていない。）

**(2) `d` の余白（§3.2.3 F3 の検討根拠）**

```
$ node -e '…d のバイト長と構文…'
d byte length min/max = 15 35
longest d = nosmaps:com.greenart7c3.nostrsigner
all d ascii printable no space = true
d containing # or ? = 0
summary char length max = 245
empty summary count = 1

$ node -e '…コロン数と上限までの余白…'
d colon counts = [ 1 ]
current max d bytes = 35 cap = 192
headroom if a 4-byte lang segment is added = 153
```

（バイト数だけ見れば `:ja` は入る。**F3 を捨てた理由はバイト長ではなく #18 の stack が壊れることである**、§3.2.3。）

**(3) `v` タグを読むコードは存在しない（§3.2.4 の根拠）**

```
$ grep -rn "'v'" src --include=*.ts | head -10
（出力なし）
$ grep -rn "'v'" tools/*.mjs | head -10
（出力なし）
```

**(4) v1 content の exact key set 強制（§3.2.4 の根拠。`src/domain/records.ts:168-179` を読んだ）**

```
  // §4.2 rule 2: exact content key set for the v1 profile.
  const required = ['schema', 'version', 'state', 'name', 'summary'];
  const optional = ['homepage', 'superseded_by'];
  for (const key of Object.keys(c)) {
    if (required.indexOf(key) === -1 && optional.indexOf(key) === -1) {
      return fail('unknown-field');
    }
  }
  for (const key of required) {
    if (!(key in c)) return fail('bad-schema');
  }
  if (prop(c, 'version') !== 1) return fail('bad-version');
```

**(5) NIP-01 の置き換え規則（§3.2.3 の一次情報。今回 `curl` で実取得）**

```
$ curl -sS https://raw.githubusercontent.com/nostr-protocol/nips/656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab/01.md | grep -n 'addressable\|replaceable\|lowest id'
80:- The `a` tag, used to refer to an addressable or replaceable event
81:    - for an addressable event: `["a", "<kind integer>:<32-bytes lowercase hex of a pubkey>:<d tag value>", <recommended relay URL, optional>]`
97:- for kind `n` such that `10000 <= n < 20000 || n == 0 || n == 3`, events are **replaceable**, …
99:- for kind `n` such that `30000 <= n < 40000`, events are **addressable** by their `kind`, `pubkey` and `d` tag value -- which means that, for each combination of `kind`, `pubkey` and the `d` tag value, only the latest event MUST be stored by relays, older versions MAY be discarded.
101:In case of replaceable events with the same timestamp, the event with the lowest id (first in lexical order) should be retained, and the other discarded.
```

commit `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab` は、この repo が `nips-registry-656cecc.json` で pin しているのと同じ commit（`jq -r '.revision' nips-registry-656cecc.json` = `656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab`、`.fetched` = `2026-08-18`）。#18 設計書 M1.2 が引いているのと同一の出典で、**引用文も一致する**（相互参照の整合を確認した）。

**(6) indexable tag は単一英字のみ（§3.2.2 の根拠）**

```
$ curl -sS …/01.md | grep -n 'single-letter'
84:As a convention, all single-letter (only english alphabet letters: a-z, A-Z) key tags are expected to be indexed by relays, … Only the first value in any given tag is indexed.
```

**(7) NIP-32 の言語ラベル表現（§3.2.2 の走査補助案の根拠。同 commit から実取得）**

```
$ curl -sS …/32.md
NIP-32 / Labeling / draft optional
- `L` denotes a label namespace
- `l` denotes a label
…
Author is labeling their note language as English using ISO-639-1.
{ "kind": 1, "tags": [ ["L","ISO-639-1"], ["l","en","ISO-639-1"] ], "content": "English text" }
```

**(8) 受け入れ条件 AC-C1 の着手前実測（§5）**

```
$ node -e '…build-data.mjs の CJK 文字数と行数、DESCRIPTIONS_JA 範囲外の CJK 行…'
lines with kana/kanji in build-data.mjs = 40
line range = 294-333
kana lines OUTSIDE 293-352 = 0 []

$ node -e '…CJK 文字数…'
cjk chars = 1105
cjk lines = 40

$ for f in tools/*.mjs; do …CJK を含むファイルだけ表示…; done
tools/build-data.mjs 1105
tools/diff-explorer.mjs 7

$ grep -n '[かな漢字]' tools/diff-explorer.mjs
11:   — a measurement that returns the same number for every input is a broken
102:     navigation — the scripts do NOT run again, so the page still shows the
149:   than typed in here — a hard-coded id would silently stop exercising the
205:for (const term of ['relay', 'damus', 'nip-44', 'オープンソース', 'zzzznomatch']) {
```

（`diff-explorer.mjs` の 3 行は em dash `—` であって日本語ではない。日本語は `:205` の検索語 1 個だけで、これは訳文ではなくテスト入力。**だから AC-C1 の対象は `tools/build-data.mjs` 単独に限る**、§5。）

**(9) 受け入れ条件 AC-C2 / AC-C4 の着手前実測（§5）**

```
$ node -e '…各 descriptions テキストが署名イベントに遡れるか…'
  untraceable: nosmaps:io.damus ja "iPhone・iPad・macOS向けの、Twitterに似たNostrクライアント。"
  untraceable: nosmaps:social.amethyst ja "Android向けのNostrクライアント。"
traceable = 40  untraceable = 40

$ node -e '…data.js の descriptions と summary の一致…'
tools = 41
ja present = 40
en === summary count = 40
en present = 40
ja char length max = 119
```

**(10) 訳者フィールドは現状どこにも無い（AC-C5 の着手前実測）**

```
$ grep -rn 'translator\|translatedBy\|訳者' src tools tests data.js | wc -l
0
```

**(11) 収集鍵と署名の既存方針（D14-3 / D14-4 の根拠。`tools/sign-catalogue.mjs:20-21` を読んだ）**

```
   Attribution is the pubkey. There is no collector field: whoever signed is who says so (#15,
   and issue #17's "signature tells you, do not write it twice").
```

**D14-3（訳者フィールドを作らない）は、この既存方針を訳文に適用しただけであり、新しい規則ではない。**

**(12) #18 phase 2 が同型の relay 実測を済ませていること（§3.2.6 / D14-5 の根拠）**

```
$ git log -1 --format=%B 20f2150
Let a second signer write an identifier, and prove it on a relay
…
NIP-01 does the hard part: replacement is keyed on kind:pubkey:d, so signing the same d with
another key creates a second coordinate and overwrites nobody. …
Observed on wss://x.kojira.io: d nosmaps:io.damus held one record, then two, by two distinct
pubkeys, and stackRecords made one stack of observed=2 whose only fields are
d/records/observed/complete. The verification record (7c86cf2a...) was retracted with kind:5
(ceabaf9e...) and the relay then returned it no longer; the original 41 were never touched,
re-signed, or deleted.
```

**§3.2.6 の V1〜V4 は、この手順をそのまま流用する。新しいツールは要らない。**

### 7.6 未取得（この作業で確認していないこと）

- **41 件の原文（`summary`）が実際に何語か。**純 ASCII が 38/41 であることは実測したが、それは言語の証明ではない（U5、§3.2.4）。
- **relay が v2 content（`descriptions` 入り）を受理するか。**§3.2.6 の V1 は**実行していない**。この設計書はリレーへ 1 バイトも発行していない。
- **同一鍵・同一 `d` の 2 通目が実際に 1 通目を置き換えるか。**NIP-01 の MUST は読んだが（§7.5-(5)）、`wss://x.kojira.io` での観測は**していない**（V2 未実行）。
- 41 件のプロジェクトが**自分で日本語説明を公開しているか**（＝訳ではなく一次情報として ja を収集できるか）。一件も調べていない。
- `DESCRIPTIONS_JA` の**生成器名・生成日時**。`ecbb46b` は "generated" としか述べていない。**D14-2 でこの文章は「収集鍵の署名者が訳した」として発行し直すため、生成器の再構成は不要になった。**
- テストスイート**全体**の red 本数（対象 1 本のみ実走）。webkit プロジェクトは一度も走らせていない。

---

## 8. この設計書が変更しないもの

`src/` `tests/` `tools/` `dist/` `data.js` は一行も触っていない。この文書は `docs/` の追加 1 ファイルのみ。実装は §4 の U1〜U6 の判断を得てから、別ブランチで行う。

