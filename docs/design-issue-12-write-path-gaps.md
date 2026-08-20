# issue #12 — 書き込み経路の骨に残した穴（設計）

対象: `docs/design-relay-native-write-path.md`（以下「書き込み設計」）が定めていて、
現在の `src/` に無い、あるいは設計と食い違っている箇所。

この文書は**設計だけ**で、コードは1行も変えていない。
書いてある行番号・件数・grep 結果は、すべて下記の時点の実測値。観測していない値は「未確認」と書く。

| 項目 | 値 |
|---|---|
| 基点ブランチ | `main` = `3cecf34` |
| 作業ブランチ | `design/issue-12-write-path-gaps` |
| 書き込み設計 | `docs/design-relay-native-write-path.md`（1327 行） |
| 実測日 | このブランチを切った時点（`git log -1 main` = `3cecf34`） |

---

## 0. 最初に — issue #12 の本文と現在のコードが食い違っている

issue #12 は `bed7e9d`（"Connect the write path end to end"）の直後に書かれたスナップショットで、
そのあと `ecbb46b` と `20cdb9e` が入っている。実測した結果、**9 項目中 3 項目は既に閉じている**。

| issue #12 の項目 | 現況 | 根拠（実測） |
|---|---|---|
| 4. §W1.4 下書き保持が無い | **解消済み** | `src/ui/explorer/draft-storage.ts`（65 行、全体がこの機能）。`app.ts:1197-1198` で束ね、`app.ts:1896` で入力ごとに保存、`app.ts:1953` で起動時に復元、`app.ts:1338` で「公開を観測できたときだけ」破棄 |
| ＋ テストの穴（全リレー拒否） | **解消済み** | `tests/publish-failure-and-draft.spec.js`（209 行）。`:137` が拒否ケース、`:178` が下書き保持ケース。冒頭コメント `:3-5` が「issue #12 の恒久ガード」と明記 |
| ＋ 型の負債（2691 → 2805） | **解消済み** | `npx tsc --noEmit` → exit 0、`grep -c 'error TS'` → **0**。`tools/check-layering.mjs` も OK（relative imports 100 本）。`src/` 内の `: any` = 0 件、`as any` = 0 件、`@ts-ignore`/`@ts-expect-error` = 0 件。なお 2691/2805 という数は `bed7e9d` のコミットメッセージ 15 行目にある当時の値で、`20cdb9e` の TypeScript 書き直しで前提（`allowJs`+`checkJs` で素の .js を検査）ごと消えている。**今のリポジトリで同じ数え方は再現できない** |

したがって以下で扱う「本当に残っている穴」は **6 件**（issue の 1, 2, 3, 5, 6, 7）。
issue 本文の項目 3 の記述にも一箇所ずれがあり、それは G5 に書いた。

---

## 1. 優先度（利用者に実害が届く順）

並べ替えの基準は一つだけ ——「**その穴のせいで、利用者が画面の外の世界に対して何もできなくなるか**」。
表示のウソ（失敗を成功と読ませる）は `W-I3` として既に守られていて、`tests/publish-failure-and-draft.spec.js:137`
と `tests/write-path.spec.js:234` が恒久ガードになっている。だから残りの穴の実害は「ウソをつく」ではなく
「**できない**」の側にある。できないことの重さで並べる。

| 順 | 穴 | 実害 | 根拠 |
|---|---|---|---|
| **P1** | G1: §W6 update / withdraw が無い | **出したレコードを取り下げられない。** 誤った内容・死んだプロジェクトを公開したら、他人のカタログに出続ける。しかも `content.state` は `publish.ts:102` で `active` に固定されており、`withdrawn` を作る呼び出し元が `src/` に 0 件（`grep "state: 'withdrawn'" src/` → 0）なので、UI からは**構造的に到達できない** | 実害が自分ではなく他の閲覧者に届く。かつ回避手段が無い |
| **P2** | G2: §W3.4 `created_at` の tie-break と `clock-conflict` が無い | **更新が黙って負ける。** 同じ `d` でもう一度 Publish したとき、同一秒なら §5.3 の tie-break（id の小さい方）で旧イベントが勝つ確率がある。表示は `superseded-during-publish` になるので**ウソは出ない**が、利用者は「直したのに直らない」を繰り返す | P1 の唯一の回避路（同じ `d` で再投稿して内容を上書き）を壊すので、P1 とセットで痛い |
| **P3** | G3: §W4.5 手動リトライが無い | `unconfirmed` / `failed` で行き止まり。下書きは残る（上記の通り解消済み）ので打ち直しは不要だが、再度 Publish すると**新しい署名・新しい `created_at`・新しい id** になる。§W4.5 が「同じ署名バイトを再送する」と定めた理由（読み戻しの対象 id が一意でなくなる）が、そのまま実害として出る | 頻度は「リレーが落ちているとき」だけだが、そのとき利用者にできることが何も無くなる |
| **P4** | G4: `#t` probe の結果が UI に出ていない | 自分のレコードが discovery（`#t` 検索）に出ないリレーがあっても気づけない。§W5.2 の caveat が誰にも届かない。ただし**値そのものは計算済み**なので、実装は表示だけ | 「気づけない」実害。P1〜P3 と違って、間違った行動を誘発はしない |
| **P5** | G5: `auth-required` の NIP-42 検出が無い | NIP-42 を要求するリレーが `rejected` として表示される。ただし relay の `notice` は `app.ts:1248` で**逐語表示**されるので、`auth-required: …` という文字列自体は利用者に届く。既定リレー（`wss://x.kojira.io`, `wss://nos.lol`）が実際に NIP-42 を要求するかは**未確認**（§20.3 の preflight probe が未実施） | 誰が困るか分からない。困る相手が観測されるまでは**後回し** |
| **P6** | G6: signer モデルが §W1.1 の `identitySource` × `signerState` 分割になっていない | 現状 `Viewer` は `signedIn`/`signedOut` の 2 値（`app.ts:399-407`）だが、**ランキング用の身元は別変数 `relayViewer`（`app.ts:1112`）に分かれていて、`load.ts:23` の `ViewerSource = 'none' | 'pasted' | 'nip07'` が §W1.1 の `identitySource` の役目を実際に果たしている**。Publish の可否は `signerCanSign()`（`app.ts:1214`）と `viewer.status`（`app.ts:1268`）の 2 段で判定されていて、利用者から見た振る舞いは設計どおり | **利用者に届く実害が観測できない。後回し。** 名前と型の整理であって、直す価値は「次に §W6 を足すときの見通し」にしかない |

**P5 と P6 は正直に後回し。** 誰も困っていないところに時間をかけない、という方針をそのまま適用する。
P5 は「既定リレーが NIP-42 を要求する」という観測が出たら即座に P2 相当へ繰り上げる。

---

## 2. 各穴の実測・実害・直し方・受け入れ条件

### G1（P1）§W6 update / withdraw が未実装

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:665` `## W6. Update, withdrawal, and reactivation`
- `:667` §W6.1 自分のレコードを見つける（`{"kinds":[30078],"authors":["<self>"],"limit":64}` の 1 論理 REQ）
- `:690` §W6.2 update / withdraw / reactivate の表（`d` は不変、`content.state` だけが違う）
- `:710` §W6.3 `superseded_by` は withdraw フローでのみ提供
- `:722` §W6.4 UI ゲート + 署名直前の `getPublicKey()` 再取得
- `:737` §W6.5 読み戻し確認まで「取り下げ済み」と書かない
- `:753` §W6.6 kind 5 は出さない
- `:79` `MANAGE_LIMIT = 64`

**現状の実測**
| 事実 | 実測 |
|---|---|
| `content.state` は常に `active` | `src/data/publish.ts:102` — `const state = input?.state === 'withdrawn' ? 'withdrawn' : 'active';` |
| `state: 'withdrawn'` を渡す呼び出し元 | `grep -rn "state: 'withdrawn'" src/` → **0 件** |
| `buildSoftwareDraft` の呼び出し元 | `app.ts:1218`（Publish フォーム）と `publish.ts:371`（内部）のみ。`app.ts:1218-1222` は `state` を渡していない |
| 管理画面 / 自分のレコード一覧 | `MANAGE_LIMIT` の grep → `src/` に **0 件**。`{"authors":["<self>"]}` 単独の REQ を出す箇所も無い（`readBackOnce`（`publish.ts:279-282`）は publish 直後の確認専用） |
| `superseded_by` | `validateSoftwareEvent` 側の**受け入れ**は実装済み（`records.ts:198-203`、自己ループ拒否 `:201`）。**書き込み側は 0 件** — `buildSoftwareDraft` の `content` 組み立て（`publish.ts:124-127`）に `superseded_by` が無い |
| `d` の編集可否 | `app.ts:1276` — `<input id="publish-d" type="text" …>`。読み取り専用ではなく、ただの自由入力欄 |
| kind 5 | `reactions.ts` が「いいね取り消し」用に kind 5 を出すが（`policy.ts:17` `DELETION_KIND: 5`）、レコードの取り下げには使われていない。§W6.6 の方針とは一致 |

**何が壊れるか（利用者に届く実害）**
1. 誤った内容・URL 切れ・終了したプロジェクトのレコードを、**publisher 本人が取り下げられない**。カタログを見る第三者に出続ける。
2. `d` が自由入力なので、「名前を直そう」として `d` を打ち替えると、§4.2 の意味では**別のレコードが増えるだけで元は残る**。設計の `:701-704` はまさにこれを禁じているが、UI に警告が無い。
3. §W6.5 の「1/2 のリレーにしか取り下げが届いていない」という帰結を伝える経路が丸ごと無い。

**直し方の案**
- **段階 A（`d` の凍結だけ）** — 既存の Publish フォームに「これは新規レコードの作成であり、`d` を変えると別レコードになる」旨を出し、既存レコードから開いたときは `d` を `readonly` にする。§W6.2 の `:701` をそのまま実装する最小手。管理画面は不要。
- **段階 B（自分のレコード一覧）** — §W6.1 の単一著者 REQ を 1 本足す。`fetchRound`（`relay.ts`）をそのまま使える。返ってきた `30078` は `validateSoftwareEvent` に通し、`foreign-d` は落として**表示も件数もしない**（§W6.1 の `:685-688`）。
- **段階 C（withdraw / reactivate）** — `SoftwareDraftInput` に既に `state` があるので、データ層は `publish.ts:102` の分岐がそのまま使える。UI 側で「取り下げ」アクションから `state: 'withdrawn'` を渡す経路を作る。`superseded_by` は withdraw のときだけ `content` に足す（`publish.ts:124-127` の組み立てに 1 分岐）。
- **G2 との依存**: 段階 C は「同じ座標に新しいイベントを出す」ので、G2（`created_at` の tie-break）が無いと**取り下げが同一秒で負ける**。**G2 を先に直す。**

**受け入れ条件（テスト可能な形）**
- AC-G1-1: 既存レコードの編集フローで `d` の入力欄が `readonly` であり、いかなる操作でも値が変わらない（設計 `:979` W-T37 に対応）。
- AC-G1-2: 自分の `30078` に `AmethystSettings` 形式の他アプリレコードを混ぜたモックリレーを立てたとき、管理一覧の行数はそれを**含まない**。除外理由 `foreign-d` が診断に出る。編集を提案する UI が DOM に無い（W-T36）。
- AC-G1-3: 取り下げを実行すると `content.state === "withdrawn"` かつ `name` と `summary` が残ったイベントが送られ、`validateSoftwareEvent` が `ok` を返す（W-T38）。
- AC-G1-4: 取り下げが読み戻しで確認されるまで、画面に「取り下げ済み」と読める文字列が現れない。確認前は §W6.5 の「まだ active に見えるクライアントがある」旨が出る。
- AC-G1-5: 2 台中 1 台だけが取り下げを受理したとき、見出しは「1/2」を含み、もう一方のリレーを読むクライアントには依然 active に見える旨が出る（W-T40）。
- AC-G1-6: 取り下げ確認後にその座標が一覧に出ず、後から `active` を出し直すと再び出る（W-T39）。
- AC-G1-7: 取り下げフローが kind 5 を送らない。リレーモックが記録した EVENT の kind に 5 が無い（§W6.6）。

---

### G2（P2）§W3.4 `created_at` が常に now / `clock-conflict` が無い

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:388` `### W3.4 created_at — the one place a timestamp could be fabricated`
- `:390-399` 擬似コード（`prior.created_at + 1`、`futureCheck()` を超えるなら `clock-conflict` で拒否）
- `:417-419` `clock-conflict` の文言と「イベントは署名されない」
- `:850` 失敗マトリクス 13 行目
- `:937-939` W-T22（`T` で `T+1`、`T-1` で `T+1`、`T+700` で実時刻、`now+1200` で `clock-conflict` かつ署名要求なし）
- `:874` 不変条件 W-I4

**現状の実測**
| 事実 | 実測 |
|---|---|
| `created_at` の決定 | `src/data/publish.ts:371` — `buildSoftwareDraft({...opts?.draft, pubkey, createdAt: nowSec})`。`nowSec` は `:343-344` で `Math.floor(Date.now()/1000)` |
| フォールバック | `publish.ts:132-134` — `Number.isSafeInteger(input?.createdAt) ? … : Math.floor(Date.now()/1000)` |
| 既存 winner の参照 | `publishSoftwareRecord`（`publish.ts:328-480`）に**署名前の読み取りが一切無い**。`readBackOnce` は `:430` のループ内、つまり**送信後**にしか走らない |
| `clock-conflict` | `grep -rn 'clock-conflict' src/` → **0 件**。i18n（`src/ui/i18n.ts`）にも **0 件** — 文言すら無い |
| `MAX_FUTURE_SKEW_SEC` | `policy.ts:24` に定数 `600` はある。使用箇所は `event.ts:128`（読み取り側の `futureCheck`）**のみ** |
| tie-break の存在 | `selectSoftwareWinners`（`src/domain/winners.ts`）は読み戻し（`publish.ts:311`）で使われている＝負けたことは**検出できる**（`:315` `superseded-during-publish`） |

**何が壊れるか**
- 同じ `d` に 1 秒以内で 2 回 Publish すると、§5.3 の tie-break は `created_at` が同値なので id の小さい方を選ぶ。**新しく出した方が負けうる。**
- 負けたこと自体は `superseded-during-publish` として正直に表示される（`publish.ts:315`、`app.ts:1256` の `other` 見出し経由）。**ウソは出ない。** 実害は「直せない」であって「騙される」ではない。
- 端末の時計が既存レコードより大きく遅れている場合、出す `created_at` が常に既存より小さくなり、**何度やっても更新できない**。原因（時計のずれ）を伝える文言が無いので、利用者は理由を知る手段がない。

**直し方の案**
1. 署名の前に「その座標の現在の winner」を得る必要がある。**署名前に読み取り REQ を 1 往復増やして取る**（§5 U1 で決定。キャッシュは使わない）。
2. 得られたら `publish.ts:371` の直前で `created_at` を決める。設計 `:390-400` の擬似コードそのまま:
   `now > prior.created_at` → `now` / それ以外 → `prior.created_at + 1`、ただし `now + MAX_FUTURE_SKEW_SEC` を超えるなら `clock-conflict` で**署名前に中断**。
3. `clock-conflict` を `PublishState` の `blocked` の reason スラグとして足し、`i18n.ts` の `explorer.publish.reasons` に ja/en 両方を足す（既存の reason スラグ群は `i18n.ts:169-201`（ja）/ `:326-` （en））。
4. `+1` を出したときは**それを隠さない**（W-I4「disclosed」）。「同一秒の衝突を避けるため 1 秒進めた」旨を診断に出す。

**受け入れ条件**
- AC-G2-1: 観測 winner の `created_at = T`、壁時計 `T` → 署名対象の `created_at` が `T+1`。壁時計 `T-1` → `T+1`。壁時計 `T+700` → `T+700`（W-T22）。
- AC-G2-2: winner の `created_at = now + 1200` → 状態は `clock-conflict`、**署名器の `signEvent` が呼ばれた回数が 0**、リレーモックの EVENT 受信数が 0。
- AC-G2-3: `signEvent` に渡す引数に `created_at` プロパティが存在する（W-T23。ライブラリ既定へ退行したらここで落ちる）。
- AC-G2-4: `+1` に落ちたとき、その旨の文字列が画面に出る（隠して出さないことを禁じる）。
- AC-G2-5: 回帰の確認 — 上記テストを入れてから修正を巻き戻し、AC-G2-1 と AC-G2-2 が**実際に fail する**ことを確認する。落ちないテストは何も守っていない。

---

### G3（P3）§W4.5 手動リトライが無い（背景の自動リトライも無い）

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:545` `### W4.5 Retry`（同じ署名バイトを、accepted でないリレーにだけ再送。再署名も再スタンプもしない）
- `:552` `PUBLISH_MANUAL_RETRIES = 2`、「silent background retry は無い」
- `:73` 定数定義
- `:642` §W5.5 の **Check again** ボタン（読み戻しを 1 回だけ追加で走らせる）
- `:951-954` W-T27 / W-T28

**現状の実測**
| 事実 | 実測 |
|---|---|
| `PUBLISH_MANUAL_RETRIES` | `grep -rn 'MANUAL_RETRIES' src/ tests/` → **0 件**。`policy.ts` の `WRITE`（`:75-80`）にも無い（あるのは `PUBLISH_TIMEOUT_MS` / `READBACK_ATTEMPTS` / `READBACK_BACKOFF_MS` / `SIGNER_TIMEOUT_MS` の 4 つだけ） |
| リトライ UI | `grep -rn 'publish-retry\|publishRetry' src/` → **0 件**。`data-publish-*` 属性は `app.ts` に `-state` `-headline` `-reason` `-event-id` `-bytes` `-hint` `-submit` `-unavailable` のみ |
| Check again | `grep -rn 'checkAgain' src/` → **0 件** |
| 背景リトライ | **無い（設計どおり）**。`publish.ts:430-438` の読み戻しループは `attempts`（既定 3、`policy.ts:77`）で閉じており、そのあと `setInterval`/`setTimeout` を仕掛ける箇所は無い |
| 署名済みイベントの保持 | `publishSoftwareRecord` はローカル変数 `signedEvent`（`publish.ts:389`）で持つだけで、戻り値の `PublishResult.event`（`publish.ts:65`）に入れて返している。**再送に必要なバイトは呼び出し元まで返ってきている** |
| 呼び出し元での保持 | `app.ts:1335` — `publish.result = result;` として `PublishForm.result`（`app.ts:1188`）に入る。つまり**署名済みイベントは既にメモリ上にある** |

**何が壊れるか**
- `unconfirmed` / `failed` の画面で利用者にできることが**何も無い**。もう一度 Publish は押せるが、それは §W4.5 が禁じた「再署名」であり、`created_at` も id も変わる。
- 結果として、読み戻しの対象 id が 2 つになり、G2 の tie-break 問題を自分で作る。
- 背景リトライが無いのは設計どおりで、**これは穴ではない**（`:552-555`「静かに成功するのは逆方向のウソ」）。

**直し方の案**
- `publish.ts` に「署名済みイベントとリレー集合を受け取り、`sendEvent` から先だけをもう一度回す」関数を切り出す。`sendEvent`（`publish.ts:185`）は既に独立していて `reactions.ts:321` からも呼ばれているので、切り出しの土台はある。
- 送り先は `perRelay` のうち `outcome !== 'accepted'` のものだけ（設計 `:547`）。
- 回数の上限は**再送 2 回まで、Check again は無制限で別カウンタ**（§5 U5 で決定）。署名済みバイトのメモリ保持は許容し、永続化はしない（§5 U4）。
- リロードをまたいだ再送はしない。§W1.4 `:175` が「署名済み未公開イベントは絶対に永続化しない」と定めており、これは守る。

**受け入れ条件**
- AC-G3-1: 2 台中 1 台が `OK true`、1 台が無応答のとき、リトライは**無応答の 1 台にだけ**同じ id を再送する。リレーモックの記録で、accepted 側の受信回数が 1、非 accepted 側が 2、かつ 2 回とも同じ `id`（W-T27）。
- AC-G3-2: リトライ経路で `signEvent` が**追加で呼ばれない**（呼び出し回数が 1 のまま）。
- AC-G3-3: `failed` 表示のあと、利用者操作なしに 60 秒（仮想時間）経過してもリレーモックが追加の EVENT を受け取らない（W-T28）。
- AC-G3-4: リトライ上限に達したら、ボタンは「無効化」ではなく**理由付きの文言**に置き換わる（無効なボタンは「ここに機能がある」と読める、という §W1.2 の方針を踏襲）。

---

### G4（P4）`#t` probe の結果が UI に出ていない

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:581` `### W5.2 What the #t probe does and does not prove`
- `:583` 「per relay に `t-index: returned | not-returned | query-failed` として記録」
- `:588-591` 「positive は見た目より弱い」→ 文言は必ず "returned via `#t`" であり "`#t` is indexed" ではない
- `:862` 失敗マトリクス 25 行目（「このリレーは `#t` を索引していないかもしれない。discovery に出ないかもしれない」）
- `:967-968` W-T33

**現状の実測**
| 事実 | 実測 |
|---|---|
| probe は動いている | `publish.ts:279-282` の 2 本目のフィルタが `{kinds, authors, '#t': [DISCOVERY_TOPIC], limit: 16}` |
| 結果は計算されている | `publish.ts:51`（`Readback.tIndex`）、`:296` `:308` で `'not-returned'`、`:315` `:317` で `'returned'` |
| 結果は返っている | `publish.ts:70`・`:460` — `PublishResult.readback.tIndex` として呼び出し元まで届く |
| **UI で使われていない** | `grep -rn 'tIndex' src/ui/` → **0 件**（`carousel.ts:150` の `slotIndex` は別物）。`app.ts` 内の `readback` の出現は 6 箇所（`:1180` コメント、`:1201-1202` 設定値、`:1321-1322` 引数、`:1331` フォールバックの `readback: null`）で、**描画に使っている箇所は 1 つも無い** |
| **per relay になっていない** | 設計 `:583` は「per relay」と言うが、`readBackOnce` は 2 本のフィルタを 1 回の `fetchRound` にまとめて投げ（`publish.ts:283`）、返ってきたイベント集合から `id` 一致を探すだけ（`:286`）。**どのリレーがどちらのフィルタで返したかを区別していない。** `Round.events` は `{event, from}`（`relay.ts:19-22`）を持つので `from` は分かるが、「どのフィルタにマッチして返ったか」は rx-nostr の packet からは取れない |

**何が壊れるか**
- 自分のレコードが discovery（`#t` 検索）に出ないリレーがあっても、利用者は**知る手段がない**。「公開できたのに誰にも見つからない」が黙って起きる。
- §W5.2 の caveat（negative は強い / positive は弱い）が誰にも届かない。

**直し方の案**
- **最小手**: 集約値のまま出す。`readback.tIndex` を publish 結果パネルに 1 行足し、`not-returned` のときだけ §W8 の 25 行目の文言を出す。文言は必ず「`#t` で返ってきた」であって「`#t` が索引されている」ではない（`:590`）。
- **per relay にする**: `readBackOnce` を 2 本のフィルタ = 2 ラウンドに分け、`Round.events[].from` でリレー別に集計する。REQ が 1 論理ラウンド増えるので §9.2 の予算表に影響する（設計 `:1010-1014` が既に「予算表の改訂が要る」と書いている）。
- **集約のまま最小手を取る**（§5 U6 で決定）。per relay 化は、必要とする人が観測できてから。

**受け入れ条件**
- AC-G4-1: `#d` フィルタは返すが `#t` フィルタは返さないモックリレーで、publish 自体は `published` になり、かつ discovery の caveat 文字列が DOM に出る（W-T33）。
- AC-G4-2: `#t` が返ったときの文言に「索引されている」と読める語が含まれない。文字列突き合わせで固定する。
- AC-G4-3: probe の結果が `query-failed`（読み戻し自体が失敗）のとき、`not-returned` と**違う文字列**が出る（§W5.3 の「無知と観測を混ぜない」）。

---

### G5（P5・後回し）`auth-required` の NIP-42 検出が無い

**issue #12 本文とのずれ（先に訂正）**

issue は「`auth-required` は **outcome enum と文言だけ**存在」と書いているが、実測すると:

| 場所 | 実測 |
|---|---|
| `RelayOutcome` の enum | `src/data/publish.ts:35` — `'accepted' \| 'rejected' \| 'timeout' \| 'connection-failed' \| 'not-attempted'`。**`auth-required` は含まれていない** |
| 文言 | `src/ui/i18n.ts:166`（ja, publish outcomes）、`:323`（en, publish outcomes）、`:235`（ja, 読み取り側 coverage）、`:372`（en, 読み取り側 coverage）。計 4 箇所 |
| NIP-42 検出 | `grep -rn 'nip42\|NIP-42\|nip-42' src/` → **0 件**。`grep -rn "'AUTH'" src/` → **0 件** |
| `auth-required` を**生成**するコード | i18n を除いた `src/` で **0 件** |

つまり正確には「**型にすら無く、i18n の辞書にだけ存在する死んだキー**」。
`app.ts:1239` の `publishOutcomeText` は `i18n.has(...)` で引くので、値が来なければ何も起きない（壊れてはいない）。

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:492` §W4.2 の outcome 表（`auth-required` = "an `OK`/`CLOSED` indicating NIP-42"）
- `:522` §W4.3 で `failed` の条件に含まれる
- `:601` §W5.3 で `query-failed` の証拠に含まれる
- `:852` 失敗マトリクス 15 行目
- `:821` §W7.3 — NIP-42 は「スコープ外。`auth-required` として表示し、戦わない」

**現状の実測（挙動）**
- `sendEvent` は `publish.ts:230` で `p.ok === true ? 'accepted' : 'rejected'` の**2 値にしか畳まない**。NIP-42 を要求するリレーからの `OK false` は `rejected` になる。
- ただし `notice` は同じ行で保持され、`app.ts:1248` で `<q class="relay-notice">` として**逐語表示**される。NIP-01 の機械可読プレフィクス `auth-required: …` はそのまま利用者に届く。
- `CLOSED` の扱いは未確認 — `relay.ts` に `CLOSED` の文字列は無く、rx-nostr が何にマップするかを観測していない。

**何が壊れるか**
- 「認証が要る」が「拒否された」と表示される。ただし逐語 notice があるので、**完全な誤情報ではない**。
- 既定リレー 2 台が実際に NIP-42 を要求するかは**未確認**。要求しないなら、この穴で困る人は現時点で 0 人。

**直し方の案（着手しない。§5 U7 で後回しと決定）**
- `RelayOutcome` に `'auth-required'` を足し、`sendEvent` の `:230` を「`ok === false` かつ `notice` が `auth-required:` で始まるなら `auth-required`」に分ける。NIP-01 のプレフィクスに依存するので、§W4.2 `:496-498` が「§20.3 の probe で確認してから」と条件を付けている点は守る。
- **probe は先に走らせない**（§5 U7 で決定）。§7.5 の M-3 で `auth-required` の notice を実際に観測できたら、そこで優先度ごと繰り上げる。

**受け入れ条件（実施するとき）**
- AC-G5-1: `OK false` + `notice = "auth-required: we only accept authenticated writes"` を返すモックリレーで、outcome が `auth-required` として表示され、`rejected` とは違う文言になる。
- AC-G5-2: 同じ画面に notice の逐語が残っている（分類したからといって原文を消さない）。
- AC-G5-3: 全リレーが `auth-required` のとき集約は `failed` で、「利用者が禁止された」と読める文言が出ない（§W8 15 行目）。

---

### G6（P6・後回し）signer モデルが §W1.1 の分割になっていない

**設計の該当箇所**
- `docs/design-relay-native-write-path.md:93` §W1.1（`identitySource ∈ {none, pasted, remembered, signer}` × `signerState ∈ {absent, present-unauthorised, authorised, rejected, error}`）
- `:100-104` 「`identitySource` はランキングだけ、`signerState` は書き込みだけを駆動する」
- `:107` §W1.2 の 5 状態表
- `:166` §W1.4 何を永続化するか

**現状の実測**
| 設計の変数 | 現在の対応物 | 実測 |
|---|---|---|
| `signerState` | `Viewer.status: 'signedIn' \| 'signedOut'` + `Viewer.reason: 'noExtension' \| 'rejected' \| 'error' \| 'timeout' \| 'badKey'` + `Viewer.pending` | `app.ts:394`（`ViewerReason`）、`:399-407`（`Viewer`） |
| `identitySource` | `ViewerSource = 'none' \| 'pasted' \| 'nip07'` | `src/data/load.ts:23`。決定は `load.ts:103-121` |
| `identitySource` と `signerState` の分離 | **実質できている** | ランキング用の鍵は `relayViewer`（`app.ts:1112`）が持ち、貼り付け鍵が優先、無ければサインイン済み鍵（`app.ts:1136`）。Publish の可否は `signerCanSign()`（`app.ts:1214`）と `viewer.status !== 'signedIn'`（`app.ts:1268`）が独立に決める |
| `grep signerState / identitySource` | `src/` に **0 件**（名前としては存在しない） | |
| §W1.2 状態 1（拡張なし → **描画しない**） | **実装されている** | `app.ts:1266-1267` — `if (!signerCanSign()) return '<p class="publish-unavailable" …>'`。無効化ボタンではなく非描画 |
| §W1.2 状態 2 `present-unauthorised` | 名前としては無いが、`signedOut` + `reason: null`（未だ聞いていない）が同じ意味を担う。起動時に `getPublicKey()` を呼ばない方針は `app.ts:1950-1951` のコメントと `restoreViewerSession()` で守られている | |

**何が壊れるか**
- **利用者に届く実害が観測できない。** 上の 2 段判定で、拡張なし / 未サインイン / サインイン済み の 3 分岐は正しく出ている。
- 残るのは「§W6 を足すときに、`signerState === 'authorised' && authorised === winner.publisher` という §W6.4 の 2 段目のゲートを書きにくい」という**将来の見通しの問題**。

**直し方の案（§6 の段 4 に畳んだ）**
- G1 段階 B/C（§6 の段 4）で、そのついでに `Viewer` に `signerState` 相当の判別可能ユニオンを持たせる。**単独では着手しない。** §W6.4 の 2 段目ゲート（`signerState === 'authorised' && authorised === winner.publisher`）を書くために、そこで必要になる。

**受け入れ条件（実施するとき）**
- AC-G6-1: `window.nostr` が無いページで、Publish 関連の要素が DOM に**存在しない**（disabled ではない）（W-T1）。※ 現状でも満たしているはずなので、まず現状で通ることを確認してから触る。
- AC-G6-2: ロード後、利用者の操作前に NIP-07 のメソッド呼び出し回数が 0（W-T2）。
- AC-G6-3: リロード後、保存された鍵があってもサインイン状態は復元されず、Publish が有効にならない（W-T8）。**現在の実装は `sessionStorage` を使っており、設計の §W1.4 と食い違うが、実装が正で設計を直す（§5 U2 で決定）。**

---

## 3. 既存 docs との食い違い（どちらが正か）

### 3.1 削除されたファイルへの参照 — **コードが正、docs が陳腐化**

`20cdb9e`（"Rewrite the browser sources in TypeScript…"）で `nostr-catalog.js` / `nostr-canonical.js` /
`nip-explorer.js` / `i18n.js` は**リポジトリから消えている**（`ls` で 4 つとも `No such file or directory`）。

`docs/design-relay-native-write-path.md` はこれらを **62 行**にわたって参照しており、
`ファイル名:行番号` の形の相異なる参照が **48 個**ある。すべて追跡不能。

主なもの（対応先は実測で確認したもののみ挙げる）:

| 設計中の参照 | 現在の位置（実測） |
|---|---|
| `nostr-catalog.js:202`（`decodeNpub`） | `src/domain/npub.ts` |
| `nostr-catalog.js:47`（`MAX_FUTURE_SKEW_SEC`） | `src/domain/policy.ts:24` |
| `nostr-catalog.js:64`（`REQ_TIMEOUT_MS`） | `src/domain/policy.ts:41` |
| `nostr-catalog.js:66`（`SOFTWARE_SCHEMA`） | `src/domain/policy.ts:44` |
| `nostr-catalog.js:302` / `:303`（トピックの小文字・128 バイト） | `src/domain/records.ts:163` / `:164` |
| `nostr-catalog.js:326`（`homepage` の長さ判定） | `src/domain/records.ts:191` |
| `nostr-catalog.js:331-334`（`superseded_by` 自己ループ） | `src/domain/records.ts:198-203` |
| `nostr-canonical.js:358`（`canonicalize`） | `src/domain/json.ts`（`publish.ts:8` が import） |
| `nostr-catalog.js:566`（`selectSoftwareWinners`） | `src/domain/winners.ts` |
| `nostr-catalog.js:1291`（`createRelayContext`） | `src/data/relay.ts` |

**判定: 現在のコードが正。設計書の参照を書き換える必要がある。**
ただし本タスクの制約により**この文書では直していない**。→ 4章の要修正リストに載せた。

### 3.2 §W0.2 の localStorage キー — **実装（`sessionStorage`）が正、設計を直す（§5 U2）**

| 設計 | 実装 |
|---|---|
| `:81` `DRAFT_STORAGE_KEY = "nosmaps:draft:v1"` | `src/ui/explorer/draft-storage.ts:14` — `'nosmaps.publish.draft'` |
| `:80` `IDENTITY_STORAGE_KEY = "nosmaps:identity:v1"` | `src/ui/explorer/app.ts:370` — `VIEWER_SESSION_KEY = 'nosmaps.viewer.pubkey'` |
| `:171` viewer pubkey は **`localStorage`** に保存し、次回ロードでランキングに使う（`identitySource = "remembered"`） | `app.ts:422` は **`sessionStorage`** を使い、コメントで「タブを閉じれば消えるし、別タブに漏れない」と理由を書いている |

キー名の差は実害なし（どちらも観測可能で衝突していない）。
**`localStorage` か `sessionStorage` かは方針の差**であって、設計 `:171` は「次のロードでプロンプト無しにランキングできる」という利便性を、実装は「タブを閉じたら消える」というプライバシーを取っている。→ **プライバシーを取る（§5 U2）。設計 `:171` と `:80` を書き換える。**

### 3.3 §W4.3 の集約状態と実装の `PublishState` が一致しない — **実装が正、設計から `pending` を落とす（§5 U3）**

| 設計 `:517-522` の集約 | `src/data/publish.ts:56-58` の `PublishState` |
|---|---|
| `published` | ✅ あり |
| `published-partial` | ✅ あり |
| **`pending`**（「まだ確認できていない」。読み戻し予算が残っている状態） | ❌ **無い**（`grep "'pending'" src/data/publish.ts` → 0 件） |
| `unconfirmed` | ✅ あり |
| `failed` | ✅ あり |
| — | ➕ `blocked`（設計では §W8 の行 1-9 に相当する状態群） |
| — | ➕ `invalid`（同 行 10-12） |
| — | ➕ `superseded-during-publish`（設計 §W8 行 23 に相当） |
| — | ➕ `readback-quarantined`（同 行 24） |

`pending` が無いのは、実装が読み戻しループ（`publish.ts:430-438`）を `await` で回しきってから 1 回だけ結果を返す設計になっているため。
**利用者に届く実害は「待っている間、進捗が出ない」**（設計 `:631` は「checking, attempt 2 of 3」と出せと言っている）。
現状は `app.ts:1282` の "publishing" 表示のみで、何回目かは出ない。→ 実害は薄いので **P4 相当。`pending` は画面に出さず、読み戻し中は `publishing` のままにする（§5 U3 で決定）。**

### 3.4 §W5.3 の `query-failed` の証拠に `auth-required` が入っている

設計 `:601` は `query-failed` の証拠を「timeout, socket error, `CLOSED`, or auth-required」とする。
実装 `publish.ts:289-290` は `round.coverage` に `'eose'` が 1 つでもあれば `not-returned-yet`、無ければ `query-failed`。
`coverage.status` に実際にセットされる値は `relay.ts:202`（`'eose'`）、`:204`（`'timeout'` / `'error'`）、
`:162`（`'skipped'`）、`:168`（`'rejected'`）、`load.ts:316`（`'unavailable'`）で、**`auth-required` は一度も作られない**。
`RelayCoverage.status` は `src/domain/catalogue.ts:20` で `readonly status: string` と**素の string**なので、型でも縛られていない。
G5 と同じ根（NIP-42 未検出）。G5 の判定に従う。

### 3.5 定数名が実装に存在しない

設計 `:65-82` の書き込み定数のうち、`src/` に存在しないもの:

| 定数 | 状況 |
|---|---|
| `PUBLISH_MANUAL_RETRIES` | 0 件（G3） |
| `READBACK_TIMEOUT_MS` | 0 件。実際は `POLICY.REQ_TIMEOUT_MS`（`policy.ts:41` = 8000）を流用しており、設計 `:75` も「= `REQ_TIMEOUT_MS`」と言っているので**意味は一致**。名前だけ無い |
| `D_LOCAL_MAX_BYTES = 184` | 0 件。UI は `PUBLISH_D_MAX_BYTES = 192`（`app.ts:1194`）で **`d` 全体**を数え、`nosmaps:` 込みの表示をする（`app.ts:1231-1232`）。数える対象が違うだけで、実効の上限は `records.ts:141` の `D_MAX_BYTES`（`policy.ts:55` = 192）と一致 |
| `TOPIC_MAX_BYTES = 128` | 0 件。`records.ts:164` に `128` が**直値で埋まっている** |
| `MANAGE_LIMIT = 64` | 0 件（G1、機能ごと無い） |
| `SIGNER_TIMEOUT_MS = 60_000` | `policy.ts:79` に定数はあるが、**使用箇所が 0**。実際に効いているのは `params.ts:56` の `nip07TimeoutMs`（既定 **20000**）。**設計 60s vs 実装 20s の食い違い** |

`SIGNER_TIMEOUT_MS` の 60s / 20s は **60 秒が正。`params.ts:56` の 20000 を直す（§5 U8 で決定）**。他は名前だけの問題で実害なし。

---

## 4. 既存 docs の要修正リスト（この文書では直していない）

制約により既存 docs は触っていない。直すなら以下:

1. **`docs/design-relay-native-write-path.md` の `nostr-catalog.js` 等への参照 48 個（62 行）**を、`src/` 配下の現在位置に張り替える。3.1 の対応表が起点になる。ただし行番号は動くので、**行番号を書かず関数名／定数名で参照する**形に変えるのが妥当（そうすれば次のリファクタで再び死なない）。
2. **§W0.2 の `IDENTITY_STORAGE_KEY` / `DRAFT_STORAGE_KEY`** を**実装の値に合わせる**（`nosmaps.viewer.pubkey` / `nosmaps.publish.draft`）。§5 U2 で決定。
3. **§W1.4 の「viewer pubkey は localStorage」** を `sessionStorage` に**改める**。§5 U2 で決定。
4. **§W0.2 の `SIGNER_TIMEOUT_MS = 60_000`** に**実装側を揃える**（`params.ts:56` の 20000 → 60000）。設計は変えない。§5 U8 で決定。
5. **§W4.3 の集約表**に `blocked` / `invalid` / `superseded-during-publish` / `readback-quarantined` を追加し、**`pending` を落とす**。§W5.5 `:631` の「checking, attempt 2 of 3」も取り下げる。§5 U3 で決定。
6. **§W5.2 `:583` の「per relay に `t-index` を記録」** は、当面満たさないことを明記する（§5 U6 で決定。黙って外さない）。あわせて **§9.2 の予算表**に、署名前の 1 往復（§5 U1）を publication 行として加える。
7. **§W9 のテスト番号の重複**: `:648` の W-I3 の説明が「directly testable (§W9, W-T22)」と書いているが、W-T22 は §W3.4 の `created_at` テスト（`:937`）で、読み戻しの W-I3 テストは W-T30（`:960`）。**参照ミスと思われるが、原文の意図は未確認**なので勝手に直さない。
8. **`docs/design-relay-native-data.md`** 側にも同種の陳腐化がある可能性が高い（未確認 — 本タスクでは grep していない）。

---

## 5. 決定事項（U 項目の解決）

前の版ではこの節は「kojira に判断してもらうこと」という質問リストだった。
だが判断に要る材料は §2〜§4 の実測に全部出ている。**質問は残さず、全部決める。**
各項目は「決定」と「理由」で書く。理由を書けないものは決定ではないので、そういうものはここに載せない。

**U1. §W3.4 の「既存 winner」は、署名前に読み取り REQ を 1 往復増やして取る。（案 a）**

- **決定**: `publishSoftwareRecord`（`publish.ts:328-480`）の署名前に、その座標を引く論理 REQ を 1 ラウンド足す（`{kinds:[30078], authors:[self], '#d':[d]}`）。ロード済みカタログ／キャッシュの winner は**使わない**。無条件に毎回読む。
- **理由**: 案 (c)（キャッシュにあればそれを使い、無ければ読みに行く）は経路が 2 本になる。衝突を検出できずに更新が負けたとき、「キャッシュを信じて外したのか、読みに行った上で外したのか」が後から言えなくなる。**設計が複雑になったら疑う**という方針をそのまま適用して、常に 1 往復読む単純な形を取る。案 (b)（キャッシュのみ）は、そもそも古い winner を掴んだら G2 を直した意味が無くなるので採らない。
- **波及**: §9.2 の REQ 予算表（`design-relay-native-write-path.md:1010` の残項目 1）は、publication 行にこの署名前 1 往復を**加えて改訂する**。既存の記述は「`EVENT` + 1 read-back」なので、改訂後は「署名前 1 ラウンド + `EVENT` + 最大 `READBACK_ATTEMPTS` = 3 ラウンド + Check again 1 押しにつき 1 ラウンド」になる。Publish は体感で遅くなるが、その代わり「なぜ負けたか」を常に言える。

**U2. 身元の保存は `sessionStorage`。実装が正で、設計 §W1.4 / §W0.2 を直す。**

- **決定**: `app.ts:422` の `sessionStorage`（`VIEWER_SESSION_KEY = 'nosmaps.viewer.pubkey'`）をそのまま正とする。設計 `design-relay-native-write-path.md:171` の「viewer pubkey は `localStorage`」と `:80` の `IDENTITY_STORAGE_KEY` は**設計側を書き換える**。
- **理由**: 身元は、次回ロードでプロンプト無しにランキングできる利便性よりも、**タブを閉じたら消える・別タブに漏れない**ことを優先する。カタログのランキングは身元が無くても壊れない（`load.ts:103-121` が `identitySource = 'none'` を正常系として扱う）ので、利便性の側の損は小さく、プライバシー側の損は取り返しがつかない。
- **波及**: §4 の要修正リスト項目 2・3 は「実装に合わせて設計を直す」で確定。キー名（`nosmaps:identity:v1` → `nosmaps.viewer.pubkey`、`nosmaps:draft:v1` → `nosmaps.publish.draft`）も実装側の値に揃える。

**U3. `pending` は画面に出さない。読み戻し中は `publishing` のままにする。実装が正。**

- **決定**: `PublishState` に `pending` を足さない。読み戻しループ（`publish.ts:430-438`）は今どおり回しきってから 1 回だけ結果を返す。設計 §W4.3 `:517-522` の集約表から `pending` を落とし、§W5.5 `:631` の「checking, attempt 2 of 3」の要求も取り下げる。画面は `app.ts:1282` の "publishing" のままにする。
- **理由**: 進捗を出すには `publishSoftwareRecord` に進捗コールバックを足すことになり、**データ層の API の形が変わる**。UI のためにデータ層の署名を変えるのは、後から他の呼び出し元（`reactions.ts:321` が同じ `sendEvent` を使っている）にも波及する。得られるのは「待っている間の安心感」だけで、**ウソは今も出ていない**（§3.3 のとおり実害は薄い）。今この複雑さを払う価値は無い。
- **波及**: 設計 §W4.3 の集約表には、逆に実装側にあって設計に無い `blocked` / `invalid` / `superseded-during-publish` / `readback-quarantined` を**足す**（§4 の要修正リスト項目 5）。表の食い違いは「実装が正」の方向で閉じる。

**U4. 署名済み未公開イベントのメモリ保持は許容。永続化はしない。実装が正。**

- **決定**: `PublishForm.result`（`app.ts:1188`）に署名済みイベントを持ち続けてよい。リトライ（G3）はこのバイトを再送する。`localStorage` / `sessionStorage` / IndexedDB には**一切書かない**。
- **理由**: §W1.4 `:175` が禁じているのは「署名済み未公開イベントの**永続化**」であって、プロセス内保持ではない。リロードで消えるならディスクには残らず、設計の意図は守られている。下書き（`draft-storage.ts`）は署名前のテキストなので、これとは別物として今の永続化を続けてよい。
- **確認方法**: 「永続化していない」は観測で押さえる。リロード後に `sessionStorage` / `localStorage` のどのキーにも `sig` フィールドを含む値が入っていないこと。これは §7.5 の手動確認 M-1 のついでに 1 回見る（自動テストは立てない — 保存キーを増やす変更が入った瞬間に効かなくなる形の検査にしかならない）。

**U5. 再送は 2 回まで。Check again（読み戻しのみの再実行）は無制限。（案 a）**

- **決定**: `PUBLISH_MANUAL_RETRIES = 2` は**再送（EVENT の送信）だけ**を数える。§W5.5 の Check again は読み戻し REQ を 1 ラウンド走らせるだけなので、回数制限を付けない。両者は別カウンタにする（同じカウンタで数えない）。
- **理由**: 読み戻しは**副作用の無い読み取り**で、押しても世界は変わらない。回数を制限する理由が無い。制限すべきなのは書き込みの側だけで、そこは 2 回に抑える（同じ id を延々と投げ続けるのはリレーに対する迷惑であり、§W4.5 が「静かな背景リトライは無し」と言った理由と同じ）。
- **波及**: AC-G3-4（上限到達時は「無効化」ではなく理由付きの文言）は再送ボタンにだけ適用される。Check again は上限に達しないので、この分岐を持たない。

**U6. `#t` probe は集約のまま。リレー別にしない。**

- **決定**: G4 は「最小手」を取る。`readback.tIndex` の集約値を publish 結果パネルに 1 行足すだけにする。`readBackOnce` を 2 ラウンドに割らない。
- **理由**: リレー別にすると読み戻しの論理 REQ が 1 ラウンド増える。それで得られるのは「**どのリレー**で discovery に出ないか」という情報だが、**今それを必要としている人がいない**。既定リレーは 2 台（`policy.ts:18`）で、片方で出ないと分かったところで利用者が取れる行動は「別のリレーを足す」しかなく、それは集約値が `not-returned` の時点で同じく取れる。必要になった時点で割る。
- **波及**: 設計 §W5.2 `:583` の「per relay に記録」は、**当面は満たさない**ことを明記する（黙って外さない）。§9.2 の予算表は U1 の 1 往復だけを加算し、G4 由来の加算は無い。

**U7. NIP-42 の preflight probe は先に走らせない。G5 は後回しのまま。**

- **決定**: §20.3 の preflight probe を実装前提の作業として先に走らせることはしない。G5（`auth-required` の検出）は実装順の外に置く。§7.5 の M-3（既定リレー 2 台に接続したとき `auth-required` の notice が来るか）は、**手動確認のついでに観測できたら記録する**という位置づけに留める。
- **理由**: 既定リレー 2 台が NIP-42 を要求するかは**未観測**で、要求しないなら困る人は現時点で 0 人。困る事象が観測できてから着手する。今の実装でも `notice` は `app.ts:1248` で逐語表示されるので、`auth-required: …` という文字列自体は利用者に届いており、**完全に見えない状態ではない**。
- **繰り上げ条件**: M-3 で `auth-required` の notice を実際に観測したら、G5 は P5 から P2 相当へ繰り上げる。観測値（どのリレーが、どの文言で返したか）を記録してから判断する。

**U8. 署名器のタイムアウトは 60 秒。設計 §W0.2 が正で、実装 `params.ts:56` の 20 秒を 60 秒に直す。**

- **決定**: `src/ui/explorer/params.ts:56` の `positiveNumber(params.get('nip07timeout'), 20000)` を `60000` に変更する。同ファイル `:16` の doc コメント（「Default 20000 ms」）も直す。`policy.ts:79` の `SIGNER_TIMEOUT_MS = 60_000` が使用箇所 0 のまま浮いているので、**その定数を既定値として参照する**形にして、二重管理をやめる。
- **理由**: このタイムアウトが計っているのは「**人が署名ダイアログに答える時間**」であって、通信の待ちではない。20 秒の根拠は**コードに書かれていない**（`params.ts` のコメントは「答えられないプロンプトが永遠に settle しないのを防ぐ」としか言っておらず、なぜ 20 秒かは未確認）。人間の応答時間に合わせる方が根拠があり、設計 §W0.2 の 60 秒はまさにその理由で置かれている。
- **波及**: テストは `?nip07timeout=` で既定値を上書きしているので（`tests/nip07-signin.spec.js:173` = 2500、`:200` = 1500）、**既存テストの所要時間は増えない**。§4 の要修正リスト項目 4 は「実装を設計に合わせる」で確定。この変更は 1 行なので、実装順の先頭に置く（§6）。

**U9. G1 は C（上書き + 一覧 + 取り下げ）まで一気にやる。**

- **決定**: 段階 A（`d` の凍結）・段階 B（自分のレコード一覧）・段階 C（withdraw / reactivate）を 1 つの実装範囲として扱う。§W6.1 の単一著者 REQ を使う（§13.1 の carve-out は `design-relay-native-write-path.md:1022` で「適用済み」と記録されている）。
- **理由**: #12 で**実害が最大なのは「一度出した記録を取り下げられない」**（`publish.ts:102` で `content.state` が実質 `active` 固定、`state: 'withdrawn'` を渡す呼び出し元が `src/` に 0 件）で、その痛みは他人のカタログに出続けるという形で**第三者に届く**。段階 A で止めるとこの痛みはそのまま残る。そして取り下げを提供するには「自分が出した記録を特定する」導線が必須なので、**B は C の前提として自動的に含まれる**。A・B・C を切り分けても、結局 C を出すまで誰も救われない。
- **もう一つの理由**: Nostr は kind:5 で取り消せる（`policy.ts:17` `DELETION_KIND: 5`）ので、書き込み側で万一やらかしても後から撤回する手段が存在する。書き込みを過度に恐れて範囲を削る理由が無い。ただし**レコードの取り下げそのものに kind 5 は使わない**（§W6.6）——それは「消えた」というウソになるので、取り下げは同じ座標への `state: "withdrawn"` の新規イベントで行う。kind 5 はあくまで最後の逃げ道であって、設計上の手段ではない。
- **依存**: 段階 C は「同じ座標に新しいイベントを出す」ので G2（`created_at` の tie-break）が先に要る。§6 の順はこれに従う。

---

## 6. 実装順（確定）

§5 の決定を前提に、着手順を確定させる。原則は「**前の段が無いと次の段が壊れるもの**を先に置く」「小さくて独立しているものは、待たせずに先に片付ける」の 2 つ。

| # | やること | 由来 | なぜこの位置か |
|---|---|---|---|
| **0** | **署名器タイムアウト 20 秒 → 60 秒**（`params.ts:56` の既定値を `policy.ts:79` の `SIGNER_TIMEOUT_MS` 参照に変える。doc コメント `params.ts:16` も直す） | U8 | **既定値 1 行の変更**で、他のどの段にも依存しない。段 1 以降は実拡張で署名する手動確認（§7.5 M-1 / M-4）が増えるので、そこで 20 秒に打ち切られる前に直しておく。自動テストは `?nip07timeout=` で上書きするので（`nip07-signin.spec.js:173` / `:200`）**スイートの所要は増えない**。詰まる要素が無いので先頭 |
| **1** | **G2 — `created_at` の tie-break と `clock-conflict`**。署名前に 1 往復読む REQ を足す（U1）。`clock-conflict` を `blocked` の reason スラグとして i18n ja/en に追加。`+1` に落ちたことを診断に出す（W-I4） | G2 / U1 | **3 と 4 の前提**。同じ座標に新しいイベントを出す機能（上書き・取り下げ）は、これが無いと同一秒で負ける。U1 の 1 往復もここで入る |
| **2** | **G1 段階 A — `d` の凍結**。既存レコードから開いた編集フォームで `#publish-d` を `readonly` にし、「`d` を変えると別レコードになる」旨を出す | G1-A | 小さい。誤ったレコードの増殖を止める効果が即出る。3 の UI の土台にもなる |
| **3** | **G1 段階 B — 自分のレコード一覧**（§W6.1 の単一著者 REQ、`MANAGE_LIMIT = 64`。`foreign-d` は表示も件数もしない） | G1-B / U9 | 4 の**必須の前提**。取り下げるには、まず自分が出した記録を特定する導線が要る |
| **4** | **G1 段階 C — 取り下げ / 再有効化**（`state: "withdrawn"` を渡す UI 経路、`superseded_by` は withdraw のときだけ。§W6.5 の「確認できるまで取り下げ済みと書かない」を守る）。**G6 の型整理（`signerState` 相当の判別可能ユニオン）をここで一緒にやる** | G1-C / U9 / G6 | #12 で実害が最大のもの（U9 の理由）。§W6.4 の 2 段目ゲートを書くために G6 の整理がここで必要になるので、単独でやらずここに畳む |
| **5** | **G3 — 手動リトライ**（再送は 2 回まで、Check again は無制限。別カウンタ。署名済みバイトを再送し、`signEvent` を追加で呼ばない） | G3 / U4 / U5 | 0〜4 が無くても書けるが、実害の順（P3）が後ろなので後。U4 のとおりメモリ保持は既に成立しているので、切り出しだけで済む |
| **6** | **G4 — `#t` probe の表示**（集約値のまま 1 行足すだけ。文言は「`#t` で返ってきた」であり「索引されている」ではない） | G4 / U6 | 表示だけ。U6 でリレー別化を却下したので、作業は小さい |
| — | **G5 — NIP-42 の `auth-required` 検出** | G5 / U7 | **実装順に入れない。** preflight probe も先に走らせない（U7）。§7.5 の M-3 で `auth-required` の notice を観測できたら、その時点で優先度ごと繰り上げて再配置する |
| — | **G6 — signer モデルの分割** | G6 | **単独では着手しない。** 4 に畳んである |

**この順が §5 の決定と矛盾しないことの確認**:

- U9 = C なので、2・3・4 は「A で止める」選択肢を残していない。3 は 4 の前提として必ず通る
- U7 = 後回しなので、G5 は番号付きの段に**存在しない**（「6 の次」でもない）。観測が出るまで順序表に載せない
- U8 は実装修正を伴うので、番号付きの段（0）として明示した。「決定はしたが誰も直さない」を作らない
- U1 の署名前 1 往復は段 1 に含まれる。独立した段にしない（G2 の実装そのものだから）

---

## 7. テスト計画（実装範囲 C — 上書き / 一覧 / 取り下げ）

実装範囲は **C** に確定した。すなわち次の 3 つ:

1. **同じ `d` での上書き**（G2 の `created_at` 決定 + G1 段階 A の `d` 凍結）
2. **自分が出したレコードの一覧**（G1 段階 B、§W6.1 の単一著者 REQ）
3. **`withdrawn` による取り下げ**（G1 段階 C、§W6.2 / §W6.5）

この節は「どのテストを書くか」ではなく、**何を性質として押さえるか**と、**そのテストが本当に守っているとどう確かめるか**を決める。
書いてある件数・秒数は下記の実測値で、推測は「概算」と明記する。

### 7.0 実測ベースライン（この節の全ての数字の出どころ）

| 項目 | 実測値 | 取り方 |
|---|---|---|
| 総テスト件数 | **286 件 / 17 ファイル** | `npx playwright test --list` の最終行 `Total: 286 tests in 17 files` |
| `main` = `3cecf34` でのフル実行 | **269 passed / 17 failed / 0 flaky / 0 skipped** | `npx playwright test --reporter=json` の `.stats` = `{"expected":269,"unexpected":17,"flaky":0,"skipped":0}` |
| フル実行の所要 | **576830.882 ms（= 9.61 分）** | 同 `.stats.duration` |
| 1 件あたり | 576830.882 / 286 = **2016.9 ms**（実測平均） | 上の 2 値から |
| プロジェクト | `chromium` と `webkit` の 2 つ、`workers: 1`、`fullyParallel: false` | `playwright.config.js` |

**`test()` 1 本 = 実行件数 2 件**（chromium と webkit で 1 回ずつ）。以下で「本」と「件」は必ず区別する。

### 7.1 何を性質として検査するか（名簿列挙にしない）

「フィールドが表示された」「行が出た」の類は書かない。それらは**壊れた実装でも通る**。
3 つの機能それぞれについて、**壊れたときに世界に対して何が起きるか**を 1 つの文にして、それを検査する。

#### 機能 1 — 同じ `d` での上書き

守る性質: **「直したものが、直したとおりに読み手へ届く」**。
上書きが成立する条件は「同じ座標に、旧イベントより後に並ぶイベントが出て、読み戻したときの winner がそれである」こと。したがって検査するのは以下の 3 点だけ。

| # | 性質 | 何が偽ならアウトか |
|---|---|---|
| 1-A | **署名対象の `created_at` は、観測済み winner の `created_at` より必ず大きい。** 壁時計が winner と同値・過去でも成立する（W-T22 / AC-G2-1） | `created_at = now` を素で使うと、同一秒で `selectAddressableWinner`（`winners.ts:126`）の id tie-break に落ちて**新しい方が負けうる** |
| 1-B | **未来へは逃げない。** winner が `now + MAX_FUTURE_SKEW_SEC`（`policy.ts:24` = 600）を超える `created_at` を持つとき、`clock-conflict` で**署名前に止まる**（AC-G2-2） | 止まらなければ、他人が撒いた未来時刻に合わせて自分も未来イベントを出し、読み取り側の `futureCheck`（`event.ts:128`）に自分で引っかかる |
| 1-C | **`d` は上書き経路で変わらない。** 既存レコードから開いた編集フォームの `#publish-d` は `readonly` で、いかなる操作でも値が変わらない（AC-G1-1 / W-T37） | `d` が変われば §4.2 の意味で**別レコードが増えるだけ**で、元は消えずに残る。利用者は「直した」と思っている |

1-A は「値そのもの」を見る。UI 文字列ではなく **`window.__SIGN_ARG__.created_at`**（`tests/write-path.spec.js:120-121` に既にある仕掛け）を使う。
署名器に渡る前のバイトを見ているので、途中の描画が何を言おうと結果は動かない。

#### 機能 2 — 自分が出したレコードの一覧

守る性質: **「一覧に出るものは、自分が自分の名前空間で出したものだけ」**。
30078 は NIP-78 が「全アプリで共有」と規定した kind なので（`policy.ts:7-12`）、**他アプリのレコードが返ってくるのが正常**。一覧の正しさは「何が出たか」ではなく「**何が出なかったか**」で決まる。

| # | 性質 | 何が偽ならアウトか |
|---|---|---|
| 2-A | **他人の pubkey の行が 0。** 著者フィルタ（`authors: [self]`）を通したうえで、返却物にも他 pubkey を混ぜて検査する | REQ の `authors` を落としても、テストの入力が自分のイベントだけなら**気づけない**。だからモックには必ず他人のイベントを入れる |
| 2-B | **`nosmaps:` 名前空間の外の `d` を持つ行が 0。** かつ除外理由 `foreign-d`（`records.ts:136`）が診断に現れ、それらに対して**編集を提案する UI が DOM に存在しない**（AC-G1-2 / W-T36） | 他アプリのレコードに「編集」ボタンを出すと、押した利用者は他人の座標に自分の署名で上書きを試みる |
| 2-C | **件数と行数が一致し、除外されたものは件数にも入らない。** §W6.1 `:685-688`（「表示も件数もしない」） | 「64 件見つかりました」と言って 12 行しか出ないのは、利用者にとっては嘘 |

`tests/relay-unit.spec.js:134-199` に**実リレーから取ってきた本物の他アプリ 30078 が 4 件**ある。これを一覧のモックにそのまま流用する。作り物のダミーではなく実データで 2-A / 2-B を押さえられるので、新しい fixture は作らない。

#### 機能 3 — `withdrawn` による取り下げ

守る性質: **「取り下げたと言うのは、読み手にそう見えることを確認できたときだけ」**。
取り下げは「消す」ではなく「同じ座標に `state: "withdrawn"` の新しいイベントを出す」（§W6.6、kind 5 は使わない）。だから機能 1 の全性質を前提にする。

| # | 性質 | 何が偽ならアウトか |
|---|---|---|
| 3-A | **送られたイベントが `content.state === "withdrawn"` で、`name` と `summary` を保持し、`validateSoftwareEvent` が `ok` を返す**（AC-G1-3 / W-T38） | 中身を空にした取り下げは読み取り側で quarantine され、**旧 active が winner のまま残る**＝取り下げになっていない |
| 3-B | **読み戻しで確認できるまで、画面に「取り下げ済み」と読める文字列が出ない。** 確認前は §W6.5 の「まだ active に見えるクライアントがある」旨が出る（AC-G1-4） | これは `W-I3`（`tests/publish-failure-and-draft.spec.js:137`、`tests/write-path.spec.js:234`）と同じ嘘のかたち。**この形の嘘は既に 2 箇所で守られているので、3 番目も同じ形で守る** |
| 3-C | **2 台中 1 台だけが受理したとき、見出しに「1/2」が含まれ、もう一方を読むクライアントには依然 active に見える旨が出る**（AC-G1-5 / W-T40） | 部分成功を成功と書くと、利用者は「消えた」と信じたまま片方のリレーに出し続ける |
| 3-D | **確認後、その座標は一覧から消える。同じ座標に `active` を出し直すと再び現れる**（AC-G1-6 / W-T39） | 片道だけ通る実装（取り下げたら二度と戻せない）を早期に弾く |

3-B と 3-C は**同じ 1 本のテストで両方見る**。片方のリレーだけ `ok: false` にした状態で走らせれば、確認前の文言と「1/2」の見出しは同じ画面に同時に出る。

#### 機能 0 — §5 の決定のうち、機能 1〜3 の性質に載っていない 2 点

§5 で決めた U8（タイムアウト 20→60）と U1（署名前に 1 往復読む）は、上の 3 機能の性質表のどこにも入っていない。
**入っていないものは守られていない**ので、ここに足す。ただし**新規 `test()` は立てない** —— どちらも既存のテストに**アサーションを 1〜2 行足すだけ**で見える（7.3 の上限は崩さない）。

| # | 性質 | 何が偽ならアウトか | どこに足すか |
|---|---|---|---|
| 0-A | **署名器タイムアウトの既定値が `POLICY.SIGNER_TIMEOUT_MS`（= 60000）と一致する。** `readExplorerParams('')` の `nip07TimeoutMs` を直接読み、`POLICY.SIGNER_TIMEOUT_MS` と等値であることを見る（U8） | 20 秒に戻ると、署名ダイアログを読んでいる途中の人が `timeout` に落ちる。**利用者は何も間違えていないのに失敗になる** | `tests/nip07-signin.spec.js` の既存テスト（例: D）に 1 行。`readExplorerParams` を `nip-explorer.ts` の `catalog` グローバルに公開して、`page.evaluate` から純関数として引く |
| 0-B | **署名の前に、その座標を引く REQ が実際に飛んでいる。** `__MOCK_RELAY__.reqs` にその `#d` を含むフィルタが現れる時点が、`__NOSTR_CALLS__` に `signEvent` が現れる時点より**前**である。かつ、カタログに既に winner がある状態でも**同じ回数だけ飛ぶ**（U1） | キャッシュ経由に退行すると、古い winner を掴んだまま `created_at` を決める。1-A は「`+1` になっている」ことしか見ないので、**キャッシュの値で `+1` していても 1-A は通ってしまう** | 機能 1 (a) の `test()` に 2 アサーション。新しい `test()` は立てない |

0-A を純関数で見るのは意図的。実時間で 60 秒待って確かめるテストは 1 本で 60 秒 × 2 プロジェクト = 2 分を全員の待ちに乗せる（7.3 の実測平均 2016.9 ms/件に対して桁が違う）。
**この値が守っているのは「人が答えるのを待つ長さ」であって、待ちの実挙動ではない。** 値そのものを見れば足りる。

### 7.2 壊したときに実際に落ちることをどう確認するか（break-restore）

**落ちることを確認していないテストは、何も守っていない。** 新しく足す `test()` は 1 本残らずこの手順を通す。
**機能 0 のように既存テストへ足したアサーションも同じ扱い**で、新規 `test()` でないことは免除の理由にならない。
通していないテストは「書いた」とみなさない。手順は 5 ステップ:

1. 実装込みで対象 spec だけ green を確認（`npx playwright test --project=chromium <spec>`）
2. **下表のとおりに 1 箇所だけ壊す**（複数同時に壊さない。どのテストがどの穴を守っているかが分からなくなる）
3. 同じコマンドを再実行し、**期待したテストが、期待したアサーションで落ちる**ことを確認する。落ちたテスト名とエラーメッセージの 1 行目を控える
4. `git checkout -- <壊したファイル>` で復元し、green に戻ることを確認
5. 控えた「壊し方 → 落ちたテスト名 → メッセージ」を PR コメントに貼る

`--project=chromium` だけで回す。break-restore は「テストが実装に依存しているか」を見る作業で、ブラウザ差ではない。webkit まで回すと 1 回あたりの待ちが倍になる。

#### 壊し方の一覧（どの行をどう壊すか）

| 対象 | 壊す場所 | どう壊すか | 落ちるべき性質 |
|---|---|---|---|
| 機能 1 | `src/data/publish.ts:371` | 実装後の「winner を見て `created_at` を決める」呼び出しを、現行の `createdAt: nowSec` に**書き戻す**（＝ G2 未実装の状態） | 1-A（`__SIGN_ARG__.created_at` が `T+1` にならず `T` になる） |
| 機能 1 | G2 実装で入る `clock-conflict` の早期 return | その `return` 行を削除し、そのまま署名へ進ませる | 1-B（`__NOSTR_CALLS__` に `signEvent` が入り、モックリレーの `published.length` が 1 になる） |
| 機能 1 | `src/domain/winners.ts:126` | `e.id < best.id` を `e.id > best.id` に**反転**する | 1-A の読み戻し側（同一秒のとき winner が入れ替わり、`superseded-during-publish` になる） |
| 機能 1 | `src/ui/explorer/app.ts:1276` の `#publish-d` | 編集フローで付ける `readonly` 属性を**外す** | 1-C（`toHaveAttribute('readonly')` が落ちる。`fill()` が通ってしまうことも同時に見える） |
| 機能 2 | 一覧の REQ フィルタ（§W6.1 で新設） | `authors: [self]` を**削る** | 2-A（他人の pubkey の行数が 0 でなくなる） |
| 機能 2 | `src/domain/records.ts:136` | `if (d.indexOf(SOFTWARE_D_PREFIX) !== 0) return fail('foreign-d');` を**コメントアウト**する | 2-B（`relay-unit.spec.js:134-199` の実物 4 件が一覧に出る）。※ この 1 行は読み取り側でも効いているので、既存テストも同時に落ちる — それは想定どおりで、**落ちた既存テスト名も控える** |
| 機能 2 | 一覧の件数表示 | 除外前の配列長を件数に使うよう書き換える | 2-C（件数と行数が食い違う） |
| 機能 3 | `src/data/publish.ts:102` | `const state = input?.state === 'withdrawn' ? 'withdrawn' : 'active';` を `const state = 'active';` に**固定**する | 3-A（送信イベントの `content.state` が `active` のまま） |
| 機能 3 | `publishResultMarkup()`（`app.ts:1243-1264`）の状態分岐 | 取り下げ用の分岐を `published` と同じ文言に**すり替える** | 3-B（確認前に「取り下げ済み」が出る） |
| 機能 3 | 取り下げ結果の見出し | `t(...headlines.partial, {accepted, total})` を数無しの固定文言に置換 | 3-C（「1/2」が消える） |
| 機能 3 | 一覧の `withdrawn` フィルタ（`app.ts:622` の `recordState` 比較） | 比較を無条件 `true` にする | 3-D（取り下げ後も一覧に出続ける） |
| 機能 0 | `src/ui/explorer/params.ts:56` | 既定値を `POLICY.SIGNER_TIMEOUT_MS` 参照から `20000` に**書き戻す** | 0-A（既定値の等値アサーションが落ちる） |
| 機能 0 | G2 実装で入る署名前の読み取りラウンド | その呼び出しを削り、ロード済みカタログの winner を使うように**書き換える**（＝ U1 で却下した案 b） | 0-B（`signEvent` より前に `#d` の REQ が現れない。1-A も同時に落ちうるが、**落ちるのは 0-B だけで十分**） |

**注意**: 「壊す」は必ず**実装コードを壊す**のであって、テスト側の期待値をいじるのではない。
期待値を書き換えて落とすのは、テストが動いていることの確認にはならない。

### 7.3 粒度と件数の上限方針

フルスイートは **286 件 / 9.61 分**（7.0 の実測）。1 件あたり実測平均 **2016.9 ms**。
ここに 1 本足すたびに **2 件・約 4 秒**（実測平均からの概算）が全員の待ち時間に乗る。だから**上限を先に決める**。

**上限: 新規 `test()` は 6 本まで（＝ 12 件、286 → 298 件）。**

内訳（1 機能あたり 2 本）:

| 機能 | 本数 | 何をまとめるか |
|---|---|---|
| 1（上書き） | 2 本 | (a) 正常系: winner あり → `created_at` が `+1`、読み戻しで winner が自分になる、`d` が `readonly`（1-A / 1-C を 1 本に束ねる） (b) 異常系: 未来 winner → `clock-conflict`、`signEvent` 呼び出し 0 回、EVENT 送信 0 件（1-B） |
| 2（一覧） | 2 本 | (a) 他人 pubkey + 他アプリ `d` を混ぜたモックで、行数・件数・除外理由（2-A / 2-B / 2-C を 1 本に束ねる） (b) 純粋関数の単体: 一覧のフィルタ関数に上の実物 4 件を通す（`relay-unit.spec.js` に追記、DOM を起こさないので速い） |
| 3（取り下げ） | 2 本 | (a) 全リレー受理 → `state: "withdrawn"` の中身と、確認後に一覧から消え、`active` 再投稿で戻る（3-A / 3-D） (b) 1 台のみ受理 → 確認前の文言と「1/2」（3-B / 3-C） |

**束ねる根拠**: 1 本の `test()` に複数のアサーションを置くことと、1 つの性質につき 1 本の `test()` を立てることは別。
前者はコストがほぼゼロ（同じページを起こしたまま続けて見る）、後者は毎回ブラウザ起動と `goto` が乗る。
**画面を起こし直す必要がない検査は、同じ `test()` の中に置く。** 既存の `tests/write-path.spec.js` が 2 本で書き込み経路全体を見ているのと同じ方針。

**やらないこと（過剰にしない線引き）**:
- i18n の ja/en 両方でのスナップショット — 既に `tests/i18n-integrity.spec.js` が網羅している。取り下げ用に足す reason スラグは**そこに 1 行足すだけ**にして、新しい `test()` は立てない
- 375x812 のオーバーフロー検査を新規に立てる — 既存テスト（`write-path.spec.js:220-224`）が同じ画面を見ている。取り下げ UI が同じパネルに乗るなら、そこにアサーションを 1 行足す
- 「ボタンが表示される」「ラベルが正しい」系 — 7.1 の性質のどれも守っていない

**機能 0（0-A / 0-B）は本数に含めない。** どちらも既存の `test()` へのアサーション追加で、新しいブラウザ起動も `goto` も増やさない。
**したがって上限は 6 本 / 12 件のまま、286 → 298 件で変わらない。** 上限に触っていないので、今の時点で捨てるものは無い。

**もし実装中に 6 本を超えることになったら、捨てる順番は先に決めておく**（超えてから議論しない）:

1. **機能 2 (b)**（純関数の単体）を最初に捨てる。同じ `foreign-d` の除外は 2 (a) が DOM 越しに見ていて、性質 2-B は片方でも守られる。失うのは「速い層でも見ている」という冗長さだけ
2. 次に **機能 3 (a) の再有効化部分**（3-D の後半「`active` を出し直すと再び現れる」）を別アサーションごと落とし、3-A と 3-D の前半だけ残す。片道実装を弾く力は落ちるが、取り下げ自体は守られる
3. **1-A / 1-B / 2-A / 3-A / 3-B は捨てない。** この 5 つはどれも「利用者が嘘を信じる」か「取り下げが成立しない」に直結する。捨てるなら実装範囲の方を削る

**6 本を超えそうになったら、増やす前に 7.1 の性質表に戻る。** 表に無いものを検査しようとしているなら、それは要らない。

### 7.4 既存ベースラインとの突き合わせ（件数一致ではなく失敗テスト名の集合）

`main` は **17 件が既に赤い**。だから「17 件のままだから壊していない」という確認は**成立しない** —
既存の赤が 1 件緑になり、自分の変更で別の 1 件が赤くなっても、合計は 17 のままだからだ。
**突き合わせは必ず「失敗したテスト名の集合」で行う。**

#### `main` の失敗集合（実測、`3cecf34`、`--reporter=json` より）

```
chromium | e2e.spec.js:214 | explorer search records descriptions and tags in either UI language
chromium | e2e.spec.js:365 | language rerender preserves selected features, comparison, and open dialog context
chromium | e2e.spec.js:533 | comparison distinguishes no record from explicit unknown and evidence follows the aggregate record
chromium | e2e.spec.js:563 | reviewer history gathers reviews from every tool before applying its display limit
chromium | e2e.spec.js:578 | likes, bookmarks, text/image reviews, profiles, history, gallery, and image return work
chromium | e2e.spec.js:643 | pages, controls, inputs, and thumbnail occupancy remain compact with no overflow
chromium | e2e.spec.js:669 | three-way comparison and review/gallery dialogs have no horizontal overflow
chromium | landing.spec.js:40 | the carousel only shows fields that exist in the dataset and never invents ranking data
webkit | e2e.spec.js:214 | explorer search records descriptions and tags in either UI language
webkit | e2e.spec.js:365 | language rerender preserves selected features, comparison, and open dialog context
webkit | e2e.spec.js:408 | liveness never hides a row, in-page official information, fact/evaluation split, and evidence
webkit | e2e.spec.js:533 | comparison distinguishes no record from explicit unknown and evidence follows the aggregate record
webkit | e2e.spec.js:563 | reviewer history gathers reviews from every tool before applying its display limit
webkit | e2e.spec.js:578 | likes, bookmarks, text/image reviews, profiles, history, gallery, and image return work
webkit | e2e.spec.js:643 | pages, controls, inputs, and thumbnail occupancy remain compact with no overflow
webkit | e2e.spec.js:669 | three-way comparison and review/gallery dialogs have no horizontal overflow
webkit | landing.spec.js:40 | the carousel only shows fields that exist in the dataset and never invents ranking data
```

**この集合は 17 件で、`e2e.spec.js` と `landing.spec.js` の 2 ファイルにしか無い。**
`webkit` にだけ `e2e.spec.js:408` があり、`chromium` には無い（左右非対称）。件数だけ見ていると、この非対称は見えない。

#### 突き合わせの手順

```bash
# 取り方（ベースラインと変更後で同じコマンドを使う）
npx playwright test --reporter=json > /tmp/pw-<ラベル>.json
jq -r '[.suites[] | recurse(.suites[]?) | .specs[]? | select(.ok|not)
        | "\(.tests[0].projectName) | \(.file):\(.line) | \(.title)"] | sort | .[]' \
  /tmp/pw-<ラベル>.json > /tmp/fail-<ラベル>.txt

# 突き合わせ（差分が空であることが合格条件）
diff /tmp/fail-main.txt /tmp/fail-head.txt
```

**合格条件は `diff` が空であること。** 空でなかったら、次の 2 通りに分けて扱う:

- **`fail-head` にだけある行**（新しく赤くなった）— これは自分が壊した。直すまで先に進まない
- **`fail-main` にだけある行**（緑になった）— 副作用で直った可能性があるので、**なぜ直ったかを説明できるまで喜ばない**。説明できないなら、それは実装が別の何かを黙って変えている

`:line` を鍵に含めているので、**既存テストの行がずれただけでも差分が出る**。それは正しい振る舞い（同じ名前でも別の場所なら別物として一度見る）だが、docs 以外を触らない今回の変更では起きない。
実装のときに既存 spec の行がずれたら、その差分は「行番号だけの移動である」ことを目視で確かめてから消し込む。

### 7.5 自動テストで押さえられない部分（手動確認）

以下は自動テストの対象外。**モックリレーは自分が書いたとおりにしか振る舞わないので、これらを自動テストで「確認した」と書くのは嘘になる。**
実装が終わったあと、下記を手で 1 回ずつ通し、**結果を観測値としてこの文書か PR に書く**（通ったかどうかではなく、何が起きたかを書く）。

| # | 何を | どうやって | 何が観測できたら合格 |
|---|---|---|---|
| M-1 | 実リレーへの上書きが本当に届くか | 既定リレー（`wss://x.kojira.io`, `wss://nos.lol`、`policy.ts:18`）へ実際に publish → 同じ `d` で内容を変えて再 publish | 2 回目の読み戻しで winner が 2 回目の id。**両方のリレーで**。片方だけなら「1/2」が出る |
| M-2 | 実リレーでの取り下げが第三者にどう見えるか | M-1 のレコードを取り下げ、**別のブラウザ（別 pubkey、キャッシュ空）**でカタログを開く | 取り下げたレコードが一覧に出ない。`withdrawn` フィルタで出す指定にしたときだけ出る |
| M-3 | NIP-42 を要求するリレーの実挙動（G5。§5 U7 により preflight としては先行させない） | 上記 2 台に接続したとき `auth-required` の notice が来るか（§20.3） | **来るか来ないかを観測値として記録する。** 来るなら G5 は後回しをやめて繰り上げる |
| M-4 | 実 NIP-07 拡張での署名 | nos2x / Amber などの実拡張で M-1 を通す | 署名ダイアログが出て、`SIGNER_TIMEOUT_MS`（`policy.ts:79` = 60000）以内に返る。テストは `seckeySigner` を使うので、拡張特有の遅延・キャンセル挙動は自動では見えない |
| M-5 | **kind 5 を出していないこと** | M-2 の取り下げ操作の間、DevTools の WS フレームを見る | 送出されたイベントの `kind` に **5 が含まれない**（§W6.6）。`reactions.ts` は「いいね取り消し」で kind 5 を出すので（`policy.ts:17`）、**取り下げ操作で誤ってそちらの経路に入っていないこと**を目で確かめる。これは自動テストでも `published` 配列を見れば書けるが、**実拡張＋実リレーで一度は目視する**（モックは自分が書いたフレームしか記録しない） |
| M-6 | 他アプリのレコードを壊していないこと | M-1〜M-2 のあと、実リレーの 30078 を `{"kinds":[30078],"limit":80}` で引き直す | `relay-unit.spec.js:134-199` にある他アプリ 4 件が**そのまま残っている**。上書きが他人の座標に漏れていない |

M-3 は**観測が出たら判断が変わる**種類の項目だが、§5 U7 の決定により**先に走らせる preflight としては扱わない**。手動確認のついでに観測できたら、その値を記録する。
M-5 は自動テスト側にも 1 アサーション（`window.__MOCK_RELAY__.published.every(e => e.kind !== 5)`）を機能 3 のテストに**足すだけ**で済むので、新規 `test()` は立てない。

### 7.6 この計画のまとめ

- 検査するのは **3 機能 × 各 3〜4 個の性質**（7.1）。「表示された」ではなく「壊れたら世界に何が起きるか」で選んでいる
- **加えて機能 0 の 2 点**（U8 の既定値 60 秒 / U1 の署名前 1 往復）。既存テストへのアサーション追加で見るので、**本数は増えない**
- **新規 `test()` は 6 本（12 件）まで。** 286 件 / 9.61 分・1 件 2016.9 ms（実測）に上乗せする分を、最初から上限で縛る
- **全 6 本＋機能 0 の 2 アサーションが break-restore を通っていること**が「書いた」の定義。壊す場所と壊し方は 7.2 の表で行まで決めてある
- **合否は失敗テスト名の集合の `diff` が空であることで判定する。** 17 件という数字は使わない
- **実リレー・実拡張・kind 5 の非送出は手動**（7.5）。モックで確認したことにしない
