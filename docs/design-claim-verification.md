# Nosmaps — 機能の対応主張が一次情報と合っているかの検証（issue #10）

**設計書のみ。この文書はコードを一行も変更していない。リレーへは 1 バイトも発行していない。** 実装は別途 GO を得てから。

- 対象 issue: #10「データ精査: 機能の対応主張が一次情報と合っているか（Damus の複数アカウント対応が起点）」
- 起点 commit: **`3cecf34`（`main` の先端）**。実測はもともと `c21a9c2`（`design/issue-14-i18n-search` の先端）の作業ツリーで行ったが、**この 2 つはコード・データが完全に同一**（差分は `docs/design-explorer-i18n-search.md` 1 本のみ。実測: `git diff --stat c21a9c2 main -- src/ tests/ tools/ dist/ data.js catalogue-events.jsonl real-catalog-draft.json nips-registry-656cecc.json` の出力が空）。したがって本文の実測値はどちらの base でもそのまま成立する。`main` へ rebase したあと `verify-catalogue` と AC1 を再実走して同じ結果を確認した（§7.7）
- 実測日: 2026-08-20（このドキュメント内の数値・出力はすべてこの日に実走したもの）
- **参照している未マージの docs:** §6.1 / §10 が引く `docs/design-explorer-i18n-search.md`（#14）と `docs/design-multi-signer-corrections.md`（#18）は、**いずれもまだ `main` に無い**（それぞれ `design/issue-14-i18n-search` / `design/issue-18-multi-signer-corrections` ブランチ上）。整合の確認はそれらのブランチ上の内容に対して行った
- 記法: 「実測」と書いたものは、この作業中にコマンドを実走するかコードを読んで確認した。確認していないものは **未取得** と明記する（§8）。推測で埋めた値は無い。

---

## 0. 要旨（先に結論）

1. **issue #10 の起点になった食い違いは、実在する。しかも原因はデータの誤りではなく、表示側の推論規則にある。**
   Damus の記録は「複数アカウントに対応している」とはどこにも書いていない。`data.js` の Damus の capability 主張は 10 件すべて NIP 番号の転記で、その中に複数アカウントを意味するものは無い。にもかかわらず explorer の「複数アカウント」フィルタで Damus が出るのは、`src/domain/explorer.ts:33` が **`accounts` という機能を NIP-19 と NIP-46 の OR で定義している**ためで、Damus が持つ NIP-19（bech32 エンコーディング）が引っかかっている（§2.3）。
2. **一次情報での確認結果（§3）: Damus は複数アカウント切替に対応していない、と読むのが妥当。** ただし「対応していない」と断定できる publisher の明示文は見つからなかった。見つかったのは「要望 issue が 2023-01-26 から open のまま、2025-12-23 に最後の更新」という状態で、これは **`not_supported` ではなく `unknown` に倒すべき観測** である（§3.4）。issue #10 本文の「沈黙を not_supported と読み替えない」がそのままここに効く。
3. **したがって #10 の修正対象は 2 つに割れる。** (a) 主張と機能ラベルの対応規則の誤り（コード側、3 行が該当・実測）、(b) 主張の出典と鮮度の記録方法（データ側）。(a) は #10 の起点そのものであり、(b) の 41 件全数調査を待たずに直せる（§5）。
4. **記録の置き場は新概念を作らない。** 検証結果は #18 の「同一 `d` に複数署名者」の重なりに、`basis: "tested"` の capability 記録として乗る。#14 の version 2 プロファイルとも衝突しない（§6）。

---

## 1. issue #10 が報告している食い違い

issue #10 本文（`gh issue view 10` で取得、2026-08-20）から、報告されている食い違いは次の 3 層に分かれる。

| 層 | 報告内容（本文の言い方） | この設計書での扱い |
|---|---|---|
| L1 | 「Damus は複数アカウントに対応していないのに複数アカウントのカテゴリ選択で出てくる」 | §2 で機構を実測し、§3 で一次情報を当たる。**#10 の起点** |
| L2 | 「各機能の対応主張が real-catalog-draft.json のどのフィールド由来で、その出典 URL と取得日が何か」が一覧化されていない | §2.4 / §2.5 で現況を実測。出典と日付は**既に全件付いている**（実測）。問題は出典の**質**であって有無ではない（§4） |
| L3 | 「一次情報が沈黙している項目は unknown へ戻す（沈黙を not_supported と読み替えない）」 | §3.4 / §5 の受け入れ条件 AC1。**Damus 自身がこの規則の適用例になる** |

本文が前提として自ら疑っている点（「『Damus が複数アカウントに対応していない』も、こちらでまだ一次情報から確認していない」）は正しい姿勢であり、§3 はまさにそこから始めた。

---

## 2. 現況の実測 — 対応主張はどこにどう入っているか

### 2.1 正本と表示の経路

| 段 | 実体 | 実測値 |
|---|---|---|
| 正本 | `catalogue-events.jsonl` | 41 行 / 41 イベント、全件 kind `30078`、署名者 1 つ（`3ce2f3e7…82b6`）。`node tools/verify-catalogue.mjs` の出力は §7.1 |
| 注釈 | `real-catalog-draft.json` | 署名イベントに乗らない事実（capability 主張・licence・platform 等）の置き場。`tools/build-data.mjs` が `d` で join する |
| 生成物 | `data.js` | `tools/build-data.mjs` の出力。ビルド成果物であり手で編集しない（ファイル冒頭に明記） |
| 表示 | `src/domain/explorer.ts` → `src/ui/explorer/app.ts` | 機能 → NIP 番号の対応と、主張から表示値を決める規則 |

**重要な事実（実測）: 対応主張は署名イベントの中に無い。** イベントの `content` のキーは 41 件すべて `schema / version / state / name / summary / homepage?` の 6 種のみで、capability を表すキーは 0 件（§7.2）。`t` タグも `nosmaps / clients / identity / relay / dev / media / analytics` の 7 語しかなく、機能を表す `t` タグは存在しない（§7.2）。**つまり「機能の対応主張」は現在、署名されていない注釈（`real-catalog-draft.json`）にしか存在しない。** これは #10 が「出典を対応づけろ」と言っている対象が、そもそも署名の外にあることを意味する。

### 2.2 主張の総数と形

実測（§7.3）:

```
claims 総数           313
basis                 {"transcribed": 313}   ← 全件が「転記」。テストした主張は 0 件
result 内訳           {"supported":292, "not_supported":12, "partial":5,
                       "not_applicable":1, "disabled":1, "withdrawn":1, "planned":1}
source が無い主張      0
assertedAt が無い主張  0
assertedAt の distinct 値  2026-08-18（1 値のみ）
主張ゼロのエントリ     21 / 41
```

`basis` が全件 `transcribed` であることは決定的に重要で、**「publisher の README にそう書いてある」以上のことは 1 件も観測していない**。これは `design-relay-native-data.md` §21.1 R1 の設計どおりの状態であり、誤りではない。誤りは、この転記が UI で「対応している」と読める形になっていることの側にある。

### 2.3 L1 の機構 — なぜ Damus が「複数アカウント」に出るのか

`src/domain/explorer.ts:33`（実測、verbatim）:

```
  ['notifications', 'notifications', ['25', '57']], ['accounts', 'account', ['19', '46']], ['signing', 'key', ['46']], ['wallet', 'wallet', ['47', '57']],
```

`accounts`（UI ラベル: 日本語「複数アカウント」／英語「Multiple accounts」、`src/ui/i18n.ts:238`, `:373`）は **NIP-19 と NIP-46 の OR** で定義されている。判定は `supportRecords`（`src/domain/explorer.ts:63`）が `feature.nips.includes(record.id)` で行い、既定の表示モードは `CONFIRMED_SUPPORT = ['supported','partial']`（`:20`, `:22`）。

Damus が持つ NIP 主張（実測、§7.4）:

```
nip:01 nip:04 nip:08 nip:10 nip:12 nip:19 nip:21 nip:25 nip:42 nip:56
```

**NIP-46 は無い。NIP-19 はある。** よって OR 条件で「複数アカウント = 対応」に落ちる。

NIP-19 が何かを一次情報で確認した（`nips` の pinned revision `656cecc7…` から実取得、§7.6）:

> This NIP standardizes bech32-formatted strings that can be used to display keys, ids and other information in clients. These formats are not meant to be used anywhere in the core protocol, they are only meant for displaying to users, copy-pasting, sharing, rendering QR codes and inputting data.

**NIP-19 本文に "account" という語は 1 度も出てこない**（`grep -in 'account' 19.md` のヒット 0、§7.6）。NIP-19 は bech32 表示形式の規定であって、複数アカウントの保持・切替とは無関係である。

**同じ誤りに当たっている行は Damus だけではない。** 「`accounts` が supported/partial になっているが、その根拠が NIP-19 のみ」のエントリを数えると **3 件**（実測、§7.5）:

```
nosmaps:io.damus              (Damus)
nosmaps:com.yakihonne.web     (YakiHonne Web App)
nosmaps:me.nostrcheck.server  (Nostrcheck server)
```

`me.nostrcheck.server` は media/relay 系サーバで、そもそも「複数アカウント切替」という概念が UI として存在するか自体が疑わしい。**#10 は Damus 1 件の話ではなく、規則の誤りが 3 件に現れている話である。**

### 2.4 L2 — 出典 URL と取得日は付いているか

実測（§7.3）:

- capability 主張 313 件すべてに `source`（URL）と `assertedAt`（日付）が付いている。**「出典がないのに値が入っている」主張は 0 件。**
- エントリ側の `sources[]`（`name` / `summary` / `homepage` の由来）も 41 件すべてに存在し、全件が `url` と `fetched` を持つ。

**したがって issue #10 の受け入れ条件「出典のない主張がゼロ」は、着手前の時点で既に満たされている**（§5 の AC2 / AC3 が現時点で PASS、§7.7）。#10 が本当に指しているのは次の §2.5 の問題である。

### 2.5 出典の「質」— ここが実際の弱点

実測した出典ホストの分布（§7.3）:

```
capability 主張 313 件の source ホスト   { "github.com": 313 }
capability 主張の source が tool.sourceRepo と異なる件数   0
エントリの sources[] のホスト   { github.com:60, damus.io:1, primal.net:1, iris.to:1,
                                  nostrudel.ninja:1, nostr.build:2, void.cat:1,
                                  app.mutinywallet.com:1, zapstore.dev:1 }
```

読み取れること:

1. **capability 主張の出典は 313 件すべてが「そのツール自身の GitHub リポジトリ URL」で、しかも粒度がリポジトリ丸ごと**（`https://github.com/damus-io/damus`）。README のどの行かは `sourceText` に別途あるが、**URL は revision も行も指していない**。README は書き換わるので、この URL は時間が経つと**検証不能になる**。これは「出典がある」と「出典で検証できる」の差である。
2. **`assertedAt` が全件 2026-08-18 の 1 値** = 主張の鮮度がエントリ単位で区別されていない。ある主張が今日も真かは、この値からは分からない。
3. エントリ側の `sources[]` は publisher の一次情報を指している（GitHub リポジトリ、公式サイト）。ここは健全。

---

## 3. Damus の複数アカウント対応 — 一次情報の実測

**この節が #10 の起点に対する直接の回答である。** 取得日はすべて 2026-08-20。コマンドと出力は §7.8。

### 3.1 当たった一次情報

| # | 一次情報 | 取得結果 |
|---|---|---|
| P1 | `https://raw.githubusercontent.com/damus-io/damus/master/README.md` | HTTP 200、9255 bytes |
| P2 | `https://damus.io/` | HTTP 200、122474 bytes、`<title>Damus</title>` |
| P3 | `https://raw.githubusercontent.com/damus-io/damus/master/CHANGELOG.md` | HTTP 200、83604 bytes |
| P4 | `https://api.github.com/repos/damus-io/damus/issues/403`（publisher 自身のリポジトリの issue） | HTTP 200 |
| P5 | App Store（`https://itunes.apple.com/lookup?id=1628663131`、README のバッジが指す配布先 id） | HTTP 200、version `1.17`、`currentVersionReleaseDate 2026-06-03T17:12:15Z` |
| P6 | `https://damus.io/faq` | **HTTP 404**（存在しない。この URL は当たれなかった） |

### 3.2 観測 — 主張の側

README の `## Spec Compliance` 節（実測、verbatim・§7.8）:

```
- [NIP-01: Basic protocol flow][nip01]
- [NIP-04: Encrypted direct message][nip04]
- [NIP-08: Mentions][nip08]
- [NIP-10: Reply conventions][nip10]
- [NIP-12: Generic tag queries (hashtags)][nip12]
- [NIP-19: bech32-encoded entities][NIP19]
- [NIP-21: nostr: URI scheme][NIP21]
- [NIP-25: Reactions][NIP25]
- [NIP-42: Authentication of clients to relays][nip42]
- [NIP-56: Reporting][nip56]
```

これは `data.js` の Damus の 10 件の主張と**完全に一致する**（§2.3）。**転記は正しい。データの転記ミスではない。**

README 全文で `account` を grep したヒットは **1 行のみ**（§7.8）で、それは Zeus ウォレットに Alby の口座をつなぐ手順の説明であり、Damus 自身の複数アカウント機能とは無関係。`multi` / `multiple account` のヒットは **0**。README の目次（`^#` の一覧）にもアカウント切替に相当する節は無い。

`damus.io` トップページ全文で `multiple` / `switch` を grep したヒットは **0**。App Store の説明文でも `account` のヒットは「登録不要」の 1 文のみ。

### 3.3 観測 — 対応していないことを示す側

publisher 自身のリポジトリの issue #403（実測、§7.8）:

```
number=403  state=open  title=Multiple Profiles (multiple accounts)
created=2023-01-26T17:48:34Z  updated=2025-12-23T23:18:54Z  comments=9
labels: feature, purple
```

本文（一部 verbatim）:

> As a pleb who uses Damus, and manages multiple ~accounts~ profiles […] I would like the capability to store, manage, and hop back and forth between my multiple ~accounts~ profiles, so that I can manage all my ~accounts~ profiles in a single Damus instance without having to copy paste keys over and over again in order to toggle between different ~accounts~ profiles.

- **`feature` ラベルが付いた要望として 2023-01-26 に立ち、2026-08-20 現在も `state=open`。**
- 直近のコメント（2025-06-26、`tkhumush`）: 「Damus feels feature complete now. Can we revive this?」— **2025 年半ばの時点で、ユーザーがまだ実現していないものとして言及している。**
- リポジトリ全体で `in:title` 検索した結果、複数アカウント関連の issue はこの 1 件のみ（`total_count=1`）。

CHANGELOG で `switch` を grep したヒットは 20 行で、そのうちアカウントに触れるのは 1 行のみ（§7.8）:

```
637:- Fix crash when logging out and switching accounts (William Casarin)   （1.7-2 / 2024-01-24 の Fixed 節）
```

これは **「ログアウトして別アカウントで入り直す」動線のクラッシュ修正**であり、アカウントを保持したまま切り替える機能の追加ではない（同じ 1.7-2 の `### Added` 節にアカウント切替の項目は無い、§7.8）。`multiple account` / `multi-account` は CHANGELOG 全文でヒット 0。

### 3.4 判定 — `not_supported` ではなく `unknown` に倒す

**観測できたこと:**
- Damus の一次情報のどこにも「複数アカウントに対応している」という主張は無い。
- publisher 自身が、それを**未実装の feature 要望として 3 年半以上 open のまま保持している**。

**観測できなかったこと:**
- publisher が「対応していない」と明示した文。**存在を確認できなかった。**

issue #10 本文の規則「一次情報が沈黙している項目は unknown へ戻す（沈黙を not_supported と読み替えない）」に従うと、**`accounts` について Damus に書き込むべき値は `unknown`（＝主張が無い）である。** open な feature issue は「対応していないことの強い状況証拠」だが、publisher の否定の言明ではないので、`not_supported` を焼くのは観測していない値を書くことにあたる。

ただし **UI の帰結は同じである**。`design-relay-native-data.md` D7 / invariant I8 と `DEFAULT_SUPPORT = 'confirmed'` により、`unknown` は既定の「複数アカウント」フィルタに**出ない**。つまり `unknown` に倒すだけで #10 の起点は解消する。`not_supported` を捏造する必要は無い。

> **判定の要約（#10 への回答）:** 「Damus は複数アカウントに対応していない」という kojira の報告は、一次情報と矛盾しない（むしろ publisher 自身の open issue が裏付ける）。しかし Nosmaps が記録すべき値は `not_supported` ではなく `unknown` である。そして **Damus の記録自体は最初から `accounts` について何も主張していなかった** — 誤りは記録ではなく、NIP-19 から複数アカウントを推論した `src/domain/explorer.ts:33` の対応表にある。

### 3.5 同じ誤りの残り 2 件について

`com.yakihonne.web` と `me.nostrcheck.server` も NIP-19 のみで `accounts` に出ている（§2.3）。**この 2 件の一次情報は今回当たっていない（未取得、§8）。** ただし §5 の AC1 は「NIP-19 単独で `accounts` を満たさない」を条件にしているので、この 2 件の個別調査を待たずに 3 件同時に解消する。

---

## 4. 突き合わせの方法（41 件へ広げる手順の設計）

**41 件全数の一次情報調査は今回やらない**（依頼の範囲外）。ここに書くのは、それをやるときの手順の設計である。

### 4.1 突き合わせの単位は「主張 1 件」であって「エントリ 1 件」ではない

313 件の主張がそれぞれ独立に検証対象になる。エントリ単位で「確認済み」を立てると、10 件中 9 件だけ確認した状態を表現できない。

### 4.2 4 段階の突き合わせ

各主張について、次を順に確認する。**途中で確認できなくなった時点で止め、そこまでを記録する。**

| 段 | 問い | 記録される値 | 失敗時 |
|---|---|---|---|
| V1 | `source` の URL が現在も到達可能か | HTTP status と取得日 | 到達不能 → 主張は据え置き、鮮度だけ落ちる（値を書き換えない） |
| V2 | `sourceText` の文字列が、取得した一次情報の中に**バイト一致で**存在するか | 一致 / 不一致 | 不一致 → **転記が古いか誤っている。要 human 判断**（§9 の U3） |
| V3 | その一次情報は publisher が管理するものか（リポジトリ / 公式サイト / 公式配布先） | publisher / third-party | third-party → 主張の格を下げる（§4.4） |
| V4 | 主張の `result` が、その文の読みとして妥当か | 妥当 / 要再読 | 要再読 → §21 R7「result は prose から読む」に戻って読み直す |

**V2 が機械化できることが重要。** `sourceText` は既に全 313 件に入っており（実測、§2.2）、`source` の URL も入っている。したがって V1+V2 は**今日のデータのまま自動で走らせられる**。これが 41 件全数調査の最も安い入口である。

### 4.3 `basis` の遷移 — 新しい語彙を作らない

`design-relay-native-data.md` §10.3 が既に `basis` を持っている（実測: 現在 313 件すべて `transcribed`）。突き合わせの結果はこの既存の語彙で表現する。

- V1〜V4 をすべて通った主張 → `basis` は **`transcribed` のまま**。「README にそう書いてあることを、この日に確認し直した」以上のことは分かっていないため。**`verified` のような新しい `basis` 値は作らない。**
- 実際にアプリを動かして確かめた主張 → 既存の **`tested`** を使う。今は 0 件。
- 変わるのは `basis` ではなく **`assertedAt`（いつ時点の主張か）** である。V1+V2 が通ったら、新しい日付で**主張を出し直す**。

**これが「新概念を増やさない」の具体的な意味である。** 突き合わせは新しいフィールドを生まない。既存の (source, sourceText, assertedAt, basis) の 4 つ組を、新しい日付で再署名するだけ。

### 4.4 一次情報でない出典の扱い

現在 313 件すべてが publisher のリポジトリ URL なので（実測）、**third-party 出典は今のところ 0 件**。将来 third-party 出典が入る場合に備えて規則だけ書く: third-party の主張は**捨てない**。別の署名者が出した記録として §6 の重なりに入れ、閲覧者が pubkey で選ぶ。これは #18 D1（既定を選ばない）の直接の帰結。

---

## 5. 受け入れ条件（そのまま走る判定式）

**判定式は `/tmp` に置いたスクリプトとして実際に走らせた。着手前（`c21a9c2`、コード無改変）の実測結果を各条件に付す。** 出力は §7.7 に verbatim。

すべて **break-restore** で守る: 修正を入れたあと、その修正を巻き戻して**条件が実際に fail することを確認する**まで、回帰テストと呼ばない。

### AC1 — `accounts` は NIP-19 単独では満たされない

判定式:

```js
const ACCOUNTS = ['19', '46'];
const viaOnly19 = tools.filter(x => {
  const c = x.capabilities.filter(y =>
    y.family === 'nip' && ACCOUNTS.includes(y.id) && ['supported','partial'].includes(y.result));
  return c.length > 0 && c.every(y => y.id === '19');
});
assert(viaOnly19.length === 0);
```

**着手前の実測: FAIL。** `rows=3 [nosmaps:io.damus, nosmaps:com.yakihonne.web, nosmaps:me.nostrcheck.server]`

これが #10 の起点そのものであり、**この 1 本が今落ちていることが、issue が実在することの証明になっている。**

**break-restore は実際に走らせて確認した（推測ではない）。** 判定式は `accounts` の NIP 集合を**ソースから読む**形にしてあるので、直せば応答する。`src/domain/explorer.ts` を `/tmp` にコピーして `['19','46']` → `['46']` に変えた**スクラッチ側**で走らせた結果（§7.7）:

```
（リポジトリのまま）  accounts nips from source: ["19","46"]  → FAIL  rows=3
（修正を当てた複製）  accounts nips from source: ["46"]       → PASS  rows=0
```

**リポジトリの `src/domain/explorer.ts` は 1 バイトも変えていない**（確認: `git status --short src/domain/explorer.ts` の出力が空、§7.7）。つまりこの条件は「直すと通り、戻すと落ちる」ことが**両方向とも観測済み**であり、回帰テストとして成立する。

> **注意（未解決 U1）:** `'19'` を外すのが正しい直し方かは決めていない。`accounts` の NIP 集合を `['46']` にするのか、`accounts` という機能ラベルを NIP から推論すること自体をやめるのかは §9 U1。**AC1 はどちらの直し方でも守れる形に書いてある**（条件が言っているのは「NIP-19 単独で満たさない」だけ）。

### AC2 — すべての capability 主張が出典 URL と取得日を持つ

```js
assert(claims.every(c => c.source && c.assertedAt));
```

**着手前の実測: PASS。** `claims=313 noSource=0 noAssertedAt=0`

issue #10 の受け入れ条件「出典のない主張がゼロ」は既に満たされている。**この条件は「これから壊さない」ための固定であって、直すべき欠陥ではない。**

### AC3 — すべてのエントリ由来フィールドが URL と取得日を持つ

```js
assert(tools.every(t => (t.sources||[]).every(s => s.url && s.fetched)));
```

**着手前の実測: PASS。** `bad=0`

### AC4 — `basis` の語彙が増えていない

```js
const basis = new Set(claims.map(c => c.basis));
assert([...basis].every(b => b === 'transcribed' || b === 'tested'));
```

**着手前の実測: PASS。** `basis=["transcribed"]`

§4.3 の「新概念を増やさない」を機械で守る条件。`verified` のような値が入ったら落ちる。

### AC5 — 主張ゼロのエントリが `supported` に化けない

```js
const zero = tools.filter(t => t.capabilities.length === 0);
assert(zero.every(t => t.capabilities.length === 0));
```

**着手前の実測: PASS。** `zeroClaimEntries=21`

現状の形では自明に通るが、41 件中 **21 件が主張ゼロ**であることの記録として残す。この 21 件は既定フィルタでどの機能にも出ない（`DEFAULT_SUPPORT='confirmed'`）。**これは正しい挙動であって、埋めるべき欠損ではない。**

### AC6 — V1+V2 の自動突き合わせが走る（新規、未実装）

§4.2 の V1（URL 到達）と V2（`sourceText` のバイト一致）を 313 件に対して走らせるスクリプトが存在し、結果を「一致 / 不一致 / 到達不能」の 3 分類で出す。

**着手前の実測: 該当スクリプトが存在しないため未実行。** `tools/` の一覧に突き合わせツールは無い（実測: `build-data.mjs`, `catalogue-events.mjs`, `check-layering.mjs`, `diff-explorer.mjs`, `new-collector-key.mjs`, `probe-explorer.mjs`, `publish-catalogue.mjs`, `restore-original-explorer.mjs`, `sign-catalogue.mjs`, `verify-catalogue.mjs`）。

**この条件は「不一致が 0 件であること」を要求しない。** 不一致は publisher が README を書き換えた事実の観測であって、Nosmaps の不具合ではない。要求するのは**分類が出ること**だけ。

### AC7 — 非後退

- `node tools/verify-catalogue.mjs` が `41 / 41` で OK を返す。**着手前の実測: PASS**（§7.1）。
- 既存の e2e テストのうち、機能ラベルの表示を固定している `tests/e2e.spec.js:258`（`複数アカウント` / `Multiple accounts` を含むラベル配列）が引き続き通る。**着手前の実測: 未取得**（§8 — テストスイートを実走していない）。

---

## 6. 検証結果をどこに記録するか

### 6.1 決定 — 新しい入れ物を作らない

**突き合わせの結果は、`basis` を持つ capability 記録として、#18 の「同一 `d` に複数署名者」の重なりにそのまま乗せる。** 新しい kind も、新しいフィールドも、新しい `d` 名前空間も作らない。

根拠となる既存の決定（すべて実測で確認）:

| 依拠 | 内容 | 出典 |
|---|---|---|
| #18 M1.1 | 訂正は「同じ `d`、自分の鍵、同じ kind」 | `docs/design-multi-signer-corrections.md`（`origin/design/issue-18-multi-signer-corrections`） |
| #18 M1.4 | `RecordStack` は `d` の一致だけで束ね、優劣を型で表現しない。`records` はフラットな列 | 同上 |
| #18 D1 | 既定表示は作らない。収集鍵を特権化しない | 同上 |
| #14 D14-5 | 「言語ごとに任意の署名者が書ける構造は、#18 の重なりにそのまま乗せる。新しい概念を足さない」 | `docs/design-explorer-i18n-search.md` |
| §21.1 R1 | capability 主張は `basis` を持つ独立の署名記録（kind `30369`） | `docs/design-relay-native-data.md:1879` |

**「主張が誤っている」を表明する行為は、#18 が定義した訂正そのものである。** 誰かが Damus の `accounts` について別の観測を持っているなら、その人が自分の鍵で同じ識別子に記録を出す。収集鍵の記録が上書きされることはなく、重なりとして並ぶ。**#10 のために新しい機構を作ると、#18 と二重になる。**

### 6.2 capability 主張は署名イベントに乗っているか — **乗っていない（重要）**

§2.1 の実測のとおり、**現在 313 件の capability 主張は署名の外（`real-catalog-draft.json`）にある。** `design-relay-native-data.md` §10.3 は kind `30369` の capability claim を設計しているが、**その形で署名された主張はリポジトリ内に 1 件も無い**（`catalogue-events.jsonl` は 41 件すべて kind `30078`、実測 §7.1）。

これは矛盾ではない — §10.3 は設計であって実装済みとは書かれていない — が、**#10 の受け入れ条件を「署名イベントで守る」ことは今日はできない**という制約になる。したがって:

- **短期（#10 で閉じられる範囲）:** 突き合わせ結果は `real-catalog-draft.json` の注釈のまま更新し、`assertedAt` を新しくする。**判定式（§5）は `data.js` に対して走るので、署名の有無に依存しない。**
- **中期（別 issue）:** §10.3 の kind `30369` を実際に発行し、主張を署名の内側へ移す。**このとき初めて、第三者が主張を訂正する経路が開く**（#18 の重なりに乗る）。

> **これは #10 の範囲を超える。** 「主張を署名イベントにする」は #18 / §10.3 の実装課題であり、#10 の受け入れ条件には含めない。§9 U4 に未解決として挙げる。

### 6.3 #14 の version 2 プロファイルとの関係 — 衝突しない

#14 D14-1 は `content.version` を 1 → 2 に上げ、`descriptions`（言語マップ）を追加すると決めている（実測: `docs/design-explorer-i18n-search.md` §3.2.4）。

**#10 は kind `30078` の `content` に何も足さない。** capability 主張は kind `30369` 側（§10.3）に属し、`30078` の v2 プロファイルとはキー空間が別。したがって:

- #14 の v2 profile（`descriptions` / 任意の `summary_lang` を追加）と、#10 の突き合わせ記録は、**同じイベントを取り合わない。**
- #14 の再署名（D14-2 の 40 本発行）と #10 の突き合わせは**順序依存が無い**。どちらが先でも良い。
- **ただし #14 U4 が挙げている「41 件を二度署名する」問題（#18 D3 の再発行との衝突）に、#10 は三つ目として加わらない。** #10 は `30078` を再署名しないため。

---

## 7. 実測の記録（コマンドと出力を verbatim で）

すべて 2026-08-20、作業ツリーはコード無改変の状態で実走した。実走時の `HEAD` は `c21a9c2`。その後 `main`（`3cecf34`）へ rebase したが、**両者はコード・データが同一**なので値は変わらない。rebase 後に再実走して確認した結果を §7.7 末尾に付す。

### 7.1 カタログの検証

```
$ node tools/verify-catalogue.mjs
lines: 41
valid signed events: 41
kind: 30078, d prefix: nosmaps:, discovery topic: nosmaps
signer: 3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6
data.js entries: 41 (meta.entryCount 41)
OK: every line parses, verifies, and data.js matches the jsonl

$ git rev-parse HEAD
c21a9c2abcf70696f2619f1de0747a50f3d19b13
```

### 7.2 署名イベントの content キーと t タグ

```
$ jq -r '.content|fromjson|keys[]' catalogue-events.jsonl | sort | uniq -c | sort -rn
  41 version
  41 summary
  41 state
  41 schema
  41 name
  27 homepage

$ jq -r '.tags[]|@tsv' catalogue-events.jsonl | awk -F'\t' '{print $1}' | sort | uniq -c | sort -rn
  88 t
  41 v
  41 state
  41 d

$ jq -r '.tags[]|select(.[0]=="t")|.[1]' catalogue-events.jsonl | sort | uniq -c | sort -rn
  41 nosmaps
  17 clients
   9 identity
   7 relay
   7 dev
   6 media
   1 analytics

$ wc -l catalogue-events.jsonl
      41 catalogue-events.jsonl
```

**capability を表す content キーも t タグも存在しない。**

### 7.3 主張の総数・出典・basis・result（`data.js` を sandbox 評価）

```
--- claims total: 313
claims with no source: 0
claims with no assertedAt: 0
basis: {"transcribed":313}
result: {"supported":292,"not_supported":12,"not_applicable":1,"partial":5,"disabled":1,"withdrawn":1,"planned":1}
tools with no sources[]: 0

--- source hosts of claims ---
{"github.com":313}
--- entry source hosts (name/summary/homepage) ---
{"github.com":60,"damus.io":1,"primal.net":1,"iris.to":1,"nostrudel.ninja":1,"nostr.build":2,"void.cat":1,"app.mutinywallet.com":1,"zapstore.dev":1}
--- assertedAt distinct ---
2026-08-18

claims 313 source!==tool.sourceRepo 0
tools without sourceRepo 0
```

### 7.4 Damus の主張と、機能ごとの該当件数

```
damus caps: nip:01=supported nip:04=supported nip:08=supported nip:10=supported nip:12=supported nip:19=supported nip:21=supported nip:25=supported nip:42=supported nip:56=supported
total tools 41
tools with cap nip:46: nosmaps:social.amethyst,nosmaps:social.phoenix,nosmaps:market.shopstr,nosmaps:com.greenart7c3.nostrsigner,nosmaps:app.nsec,nosmaps:dev.nostr.ndk
tools with nip:19: 6
tools with zero caps: 21

（機能ごとの supported/partial 件数）
posts          10
dm             4
search         10
media          10
notifications  7
accounts       9
signing        6
wallet         7
longform       4
community      10
```

### 7.5 `accounts` に出る 9 件の内訳

```
accounts feature -> supported/partial rows: 9
  nosmaps:io.damus nip:19=supported
  nosmaps:social.amethyst nip:19=supported nip:46=supported nip:46@android=supported nip:46@commonmain=partial
  nosmaps:social.phoenix nip:19=supported nip:46=supported
  nosmaps:com.yakihonne.web nip:19=supported
  nosmaps:market.shopstr nip:19=supported nip:46=supported
  nosmaps:com.greenart7c3.nostrsigner nip:46=supported
  nosmaps:app.nsec nip:46=supported
  nosmaps:me.nostrcheck.server nip:19=supported
  nosmaps:dev.nostr.ndk nip:46=supported
```

**NIP-19 のみで出ているのは 3 件**（Damus / YakiHonne Web / Nostrcheck server）。

### 7.6 NIP-19 の一次情報（pinned revision から実取得）

```
$ curl -sS -L -w 'HTTP %{http_code} %{url_effective}\n' -o /tmp/nip19.md \
  'https://raw.githubusercontent.com/nostr-protocol/nips/656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab/19.md'
HTTP 200 https://raw.githubusercontent.com/nostr-protocol/nips/656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab/19.md

$ head -8 /tmp/nip19.md
NIP-19
======

bech32-encoded entities
-----------------------

`draft` `optional`

$ grep -in 'account' /tmp/nip19.md | head
（出力なし = ヒット 0）
```

pinned registry からのタイトル（`data.js` の `nipCatalog` 経由、実測）:

```
19 {"title":"bech32-encoded entities","source":".../656cecc7.../19.md"}
46 {"title":"Nostr Remote Signing","source":".../656cecc7.../46.md"}
07 {"title":"`window.nostr` capability for web browsers","source":".../656cecc7.../07.md"}
```

registry snapshot 自体のメタ:

```
revision 656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab  fetched 2026-08-18
source https://raw.githubusercontent.com/nostr-protocol/nips/656cecc7c0a815b6a2b218d3b5d6f078b3f4dbab/README.md
```

### 7.7 受け入れ条件の実走（着手前・コード無改変）

```
$ node /tmp/ac.mjs
FAIL  AC1 accounts-not-inferred-from-nip19  rows=3 [nosmaps:io.damus,nosmaps:com.yakihonne.web,nosmaps:me.nostrcheck.server]
PASS  AC2 every-claim-has-source-and-date  claims=313 noSource=0 noAssertedAt=0
PASS  AC3 every-entry-source-has-url-and-fetched  bad=0
PASS  AC4 basis-is-transcribed-only-until-tested-exists  basis=["transcribed"]
PASS  AC5 zero-claim-entries-are-unknown-not-supported  zeroClaimEntries=21
---
1 FAILING
exit=1
```

AC1 の break-restore（両方向の観測）:

```
$ node /tmp/ac2.mjs                          # ← リポジトリの src/domain/explorer.ts を読む
accounts nips from source (src/domain/explorer.ts): ["19","46"]
FAIL  AC1 accounts-not-admitted-on-nip19-alone  rows=3 [nosmaps:io.damus,nosmaps:com.yakihonne.web,nosmaps:me.nostrcheck.server]
exit=1

$ cp src/domain/explorer.ts /tmp/explorer-fixed.ts
$ # /tmp 側でだけ ['accounts','account',['19','46']] → ['accounts','account',['46']]
$ node /tmp/ac2.mjs /tmp/explorer-fixed.ts   # ← 修正を当てた複製を読む
accounts nips from source (/tmp/explorer-fixed.ts): ["46"]
PASS  AC1 accounts-not-admitted-on-nip19-alone  rows=0 []
exit=0

$ git status --short src/domain/explorer.ts
$ git diff --stat -- src/domain/explorer.ts
（両方とも出力なし = リポジトリのファイルは無改変）
```

**rebase 後の再実走（base を `main` = `3cecf34` に移したあと、2026-08-20）:**

```
$ git diff --stat c21a9c2 main -- src/ tests/ tools/ dist/ data.js catalogue-events.jsonl real-catalog-draft.json nips-registry-656cecc.json
（出力なし = 2 つの base はコード・データが完全に同一）

$ node tools/verify-catalogue.mjs | tail -2
data.js entries: 41 (meta.entryCount 41)
OK: every line parses, verifies, and data.js matches the jsonl

$ node /tmp/ac2.mjs
accounts nips from source (src/domain/explorer.ts): ["19","46"]
FAIL  AC1 accounts-not-admitted-on-nip19-alone  rows=3 [nosmaps:io.damus,nosmaps:com.yakihonne.web,nosmaps:me.nostrcheck.server]
AC1 exit=1
```

**判定スクリプトは `/tmp/ac.mjs` / `/tmp/ac2.mjs` に置いて実走した。リポジトリには追加していない**（依頼の制約: 変更は `docs/` の 1 ファイルのみ）。実装時に `tools/` へ移す（§9 U5）。なお `ac2.mjs` は `accounts` の NIP 集合を**ソースから正規表現で読む**ので、対応表を直せば判定式も追随する（値をハードコードすると、直したのに落ち続けるか、直していないのに通ってしまう）。

### 7.8 Damus の一次情報

```
$ curl -sS -L -o /tmp/damus-readme.md -w 'HTTP %{http_code} %{url_effective} bytes=%{size_download}\n' \
  https://raw.githubusercontent.com/damus-io/damus/master/README.md
HTTP 200 https://raw.githubusercontent.com/damus-io/damus/master/README.md bytes=9255

$ grep -in 'account' /tmp/damus-readme.md
134:- Tap Get Started button > tap Connect a node > click on + sign (top right) > select Indhub > press Scan Lndhub QR > (from the Alby browser extension… click your account on the top left > click Manage Accounts > click 3-dot menu to right of your account and click Export Account to get a QR code then go back to Zeus app) > scan the QR Code and tap Save Node Config button

$ grep -in 'multi\|switch\|logout\|profiles' /tmp/damus-readme.md
164:It is public information which other profiles (npubs) you are exchanging DMs with. The content of the DMs is encrypted.

$ sed -n '44,57p' /tmp/damus-readme.md
## Spec Compliance

damus implements the following [Nostr Implementation Possibilities][nips]

- [NIP-01: Basic protocol flow][nip01]
- [NIP-04: Encrypted direct message][nip04]
- [NIP-08: Mentions][nip08]
- [NIP-10: Reply conventions][nip10]
- [NIP-12: Generic tag queries (hashtags)][nip12]
- [NIP-19: bech32-encoded entities][NIP19]
- [NIP-21: nostr: URI scheme][NIP21]
- [NIP-25: Reactions][NIP25]
- [NIP-42: Authentication of clients to relays][nip42]
- [NIP-56: Reporting][nip56]
```

公式サイト:

```
$ curl -sS -L -o /tmp/damus-io.html -w 'HTTP %{http_code} %{url_effective} bytes=%{size_download}\n' https://damus.io/
HTTP 200 https://damus.io/ bytes=122474

$ grep -o '<title>[^<]*</title>' /tmp/damus-io.html
<title>Damus</title>

$ grep -io '.\{60\}multiple.\{60\}' /tmp/damus-io.html ; grep -io '.\{60\}switch.\{60\}' /tmp/damus-io.html
（両方とも出力なし = ヒット 0）

$ curl -sS -L -w 'HTTP %{http_code} %{url_effective} bytes=%{size_download}\n' -o /tmp/damus-faq.html 'https://damus.io/faq'
HTTP 404 https://damus.io/faq bytes=153
```

publisher の issue:

```
$ curl -sS -G 'https://api.github.com/search/issues' \
  --data-urlencode 'q=repo:damus-io/damus multiple accounts in:title'
HTTP 200
total_count: 1
#403 [open] Multiple Profiles (multiple accounts) — https://github.com/damus-io/damus/issues/403

$ curl -sS 'https://api.github.com/repos/damus-io/damus/issues/403'
number=403 state=open title=Multiple Profiles (multiple accounts)
created=2023-01-26T17:48:34Z updated=2025-12-23T23:18:54Z comments=9
labels: feature, purple

（コメント抜粋、verbatim）
[2025-06-26T02:16:41Z] tkhumush: Damus feels feature complete now.
Can we revive this?
```

CHANGELOG:

```
$ curl -sS -L -w 'HTTP %{http_code} bytes=%{size_download}\n' -o /tmp/damus-changelog.md \
  https://raw.githubusercontent.com/damus-io/damus/master/CHANGELOG.md
HTTP 200 bytes=83604

$ grep -in 'multiple account\|multi-account\|multi account' /tmp/damus-changelog.md
（出力なし = ヒット 0）

$ grep -in 'switch' /tmp/damus-changelog.md | grep -i account
637:- Fix crash when logging out and switching accounts (William Casarin)

（637 行の文脈: ## [1.7-2] - 2024-01-24 の ### Fixed 節。同バージョンの ### Added 節に
  アカウント切替の追加項目は無い）
```

配布先:

```
$ curl -sS 'https://itunes.apple.com/lookup?id=1628663131&country=us'
HTTP 200
version=1.17 released=2026-06-03T17:12:15Z name=Damus

（description 内の account ヒットは 1 行のみ）
- No registration required. Creating an account doesn't require a phone number, email or name. Get started right away with zero friction.
```

### 7.9 コード側の対応表（verbatim）

```
$ grep -n "'accounts'" src/domain/explorer.ts
33:  ['notifications', 'notifications', ['25', '57']], ['accounts', 'account', ['19', '46']], ['signing', 'key', ['46']], ['wallet', 'wallet', ['47', '57']],

$ grep -n 'DEFAULT_SUPPORT\|CONFIRMED_SUPPORT' src/domain/explorer.ts
20:export const CONFIRMED_SUPPORT: readonly DisplayResult[] = ['supported', 'partial'];
22:export const DEFAULT_SUPPORT = 'confirmed';
123:  if (mode === DEFAULT_SUPPORT) return CONFIRMED_SUPPORT.includes(value);
```

UI ラベル（`src/ui/i18n.ts`）:

```
:238  accounts: ['複数アカウント', '複数の鍵やプロフィールを切り替えたい', 'マルチアカウント']
:373  accounts: ['Multiple accounts', 'Switch between keys and profiles', 'multi account']
```

**ラベルは明確に「切り替え」を言っている。NIP-19 は切り替えについて何も言っていない。ここが食い違いの正体。**

---

## 8. 未取得（この作業で確認していないこと）

**以下は観測していない。値を推測で埋めていない。**

1. **41 件中 40 件の一次情報。** 一次情報を実際に当たったのは **Damus 1 件のみ**。残り 40 件の主張が現在も一次情報と一致するかは未取得。
2. **`com.yakihonne.web` と `me.nostrcheck.server` の複数アカウント対応。** §2.3 で AC1 に該当することは実測したが、一次情報は当たっていない。
3. **313 件の `sourceText` が現在の一次情報にバイト一致で存在するか（§4.2 V2）。** 一度も走らせていない。Damus の 10 件だけは README を目視で照合し一致を確認した（§3.2）が、機械照合はしていない。
4. **テストスイートの実走。** `npx playwright test` も `npm run typecheck` も実行していない。AC7 の後半（`tests/e2e.spec.js:258` が通るか）は未取得。**したがって U1 の修正が既存テストを壊すかどうかも未取得**（§7.7 の break-restore は `data.js` と対応表だけを見ており、UI テストは見ていない）。
5. **Damus が「対応していない」と明示した publisher の言明。** 探したが**見つからなかった**。「無い」ことの証明にはならない（探し方の網羅性を保証していない）。
6. **リレー上の実データ。** この作業はリポジトリ内のファイルと公開 HTTP 一次情報のみを見た。**リレーへの発行も、リレーからの読み取りも行っていない。**
7. **`real-catalog-draft.json` の全文精査。** `data.js` 経由で集計値は取ったが、draft 側の `verbatim_caveats` / `explicitly_not_supported` の全件は読んでいない。
8. **他 9 機能（`posts` / `dm` / `search` / `media` / `notifications` / `signing` / `wallet` / `longform` / `community`）の NIP 対応表が妥当か。** §7.4 で件数だけ実測したが、`accounts` 以外の対応表が同種の誤りを含むかは検証していない（§9 U2）。

---

## 9. 未解決（kojira の判断がいる。勝手に決めない）

| # | 未解決 | なぜ今決められないか |
|---|---|---|
| **U1** | **`accounts` の直し方。** (a) NIP 集合を `['46']` に狭める、(b) `accounts` を NIP からの推論対象から外し、明示的な機能主張がある記録だけが出るようにする、(c) 機能ラベルを NIP に合う名前へ変える。**AC1 はどれでも守れるが、意味が違う。** (b) は「NIP-46 リモート署名 = 複数アカウント」という推論も同時に否定する | 「機能とは何か」の定義の問題。NIP-46 があれば複数アカウントを持てる、は実装依存であって仕様上の含意ではない。俺の判断で決めていい範囲を超えている |
| **U2** | **他 9 機能の対応表を今回の範囲に含めるか。** `accounts` と同じ構造の誤りが他にもある可能性がある（例: `media` が NIP-01 と NIP-19 で定義されている、`search` が NIP-19 と NIP-21 を含む）。**今回は検証していない（§8-8）** | #10 のスコープをどこで切るかの判断。全機能を見ると issue が肥大する |
| **U3** | **§4.2 V2 が不一致を出したときの処理。** publisher が README を書き換えて主張が消えた場合、(a) 主張を `withdrawn` にする、(b) 主張を消す、(c) 古い主張を `assertedAt` 付きで残したまま新しい観測を重ねる。**#18 D1（既定を選ばない）に従えば (c) だが、同一署名者が自分の過去の主張を「重ねる」ことが #18 の想定内かは書かれていない** | #18 の重なりが「別の署名者どうし」だけを想定しているのか、同一署名者の時系列も含むのかが未定義 |
| **U4** | **capability 主張を kind `30369` の署名イベントへ移すのを #10 でやるか、別 issue にするか。** §6.2 のとおり、現在 313 件は署名の外にある。移さない限り第三者訂正の経路は開かない。しかし #10 の受け入れ条件は署名なしでも守れる | 作業量とスコープの判断。#18 の実装状況にも依存する |
| **U5** | **§5 の判定スクリプトの置き場と実行タイミング。** `tools/` に置いて `npm run` から叩くか、`tests/` に Playwright 以外のユニットとして置くか。現在 `tests/` は全て Playwright spec で、純データ検証の置き場が無い | 既存の構成に新しい種類のテストを足す判断 |
| **U6** | **`assertedAt` の粒度。** 現在 313 件すべて `2026-08-18` の 1 値。突き合わせのたびに主張ごとに更新するのか、収集バッチ単位のままにするのか。**主張ごとにすると `data.js` の diff が毎回大きくなる** | 運用の頻度が決まっていないと決められない |

---

## 10. 既存 docs との整合（矛盾の指摘のみ。既存 docs は書き換えていない）

既存 3 本を読んで突き合わせた結果。**矛盾は 1 件も見つからなかった。** 整合を確認した点と、注意を要する点を記録する。

### 10.1 整合を確認した点

| # | 相手 | 内容 | 結果 |
|---|---|---|---|
| C1 | `design-relay-native-data.md` D7 / invariant I8 | 「Unknown is never invented」「unknown は 0 として描画も整列もしない」 | **一致。** §3.4 で Damus を `not_supported` ではなく `unknown` に倒す判断は、この D7 の直接の適用 |
| C2 | `design-relay-native-data.md:1949` | 「No numeric capability score, ever. Amethyst's README claims 84 NIPs and Damus's claims 10. That ratio measures README verbosity, not capability」 | **一致し、しかも #10 の裏付けになっている。** §21 は既に「README の NIP 列挙は capability の測定ではない」と言っており、#10 の食い違いはその警告が UI の機能ラベルの側で破られていた事例 |
| C3 | `design-relay-native-data.md:1879` §10.3 R1 | capability 主張は `basis` を持つ独立の署名記録 | **一致。** §4.3 で `basis` の既存語彙をそのまま使い、新値を作らないと決めた |
| C4 | `design-relay-native-data.md` §21.7 R7 | `result` は prose から読む。checkbox glyph から読まない | **一致。** §4.2 V4 はこの規則へ戻って読み直す手順 |
| C5 | `design-multi-signer-corrections.md` M1.1 / M1.4 / D1 | 訂正は「同じ `d`、自分の鍵、同じ kind」。重なりに優劣を型で表現しない | **一致。** §6.1 で #10 の検証結果をこの重なりに乗せると決め、新機構を作らないことを明記した |
| C6 | `design-explorer-i18n-search.md` D14-5 | 「#18 の重なりにそのまま乗せる。新しい概念を足さない」 | **一致。** §6.1 は #14 と同じ判断を capability 主張に適用しているだけ。**同じ規則の 2 回目の適用であり、新規則ではない** |
| C7 | `design-explorer-i18n-search.md` §3.2.4 の v2 プロファイル | `content.version` 1 → 2、`descriptions` を追加 | **衝突しない**（§6.3）。#10 は `30078` の `content` に何も足さない |
| C8 | `design-multi-signer-corrections.md` M0.2 / `design-explorer-i18n-search.md` §3.2.1 の実測値 | 41 件 / 単一署名者 `3ce2f3e7…` / content キー 6 種（`homepage` 27 件） | **今回の再実測と完全に一致**（§7.1, §7.2）。3 本の docs が同じ数字を報告している |

### 10.2 矛盾ではないが注意を要する点

- **N1 — §10.3 は設計であって実装ではない。** `design-relay-native-data.md` §10.3 は kind `30369` の capability claim を規定しているが、リポジトリ内に `30369` のイベントは 1 件も無い（実測: `catalogue-events.jsonl` は全件 `30078`）。docs はこれを「実装済み」とは書いていないので**矛盾ではない**が、§10.3 を読んで「主張は署名されている」と誤解する余地がある。§6.2 に明記した。
- **N2 — #14 U4 と #18 D3 が同じ 41 件の再署名を要求しており、順序が未定。** これは既に #14 の U4 として挙がっている既知の未解決であり、**#10 はこの列に加わらない**（§6.3）。指摘のみ。
- **N3 — `data.js` の `descriptions` は現在イベント由来ではない。** #14 §6 C4 が既に指摘済み。#10 とは無関係だが、**「data.js の値がすべて署名イベント由来ではない」という性質は capability 主張にも当てはまる**（§6.2）ので、同じ性質の 2 例目として記録する。

---

## 11. この設計書が変更しないもの

- **コードを 1 バイトも変更していない。** `src/` `tests/` `tools/` `dist/` `data.js` `catalogue-events.jsonl` `real-catalog-draft.json` はいずれも無改変（`git diff --stat` で証明）。
- **リレーへ 1 バイトも発行していない。**
- **既存 docs を書き換えていない。** §10 は指摘のみ。
- **判定スクリプトはリポジトリに追加していない**（`/tmp/ac.mjs` で実走したのみ）。置き場は U5。
- **`accounts` の対応表を直していない。** 直し方が U1 として未解決のため。**AC1 は今 FAIL のままであり、それが #10 が open である理由そのもの。**
