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
1. 署名の前に「その座標の現在の winner」を得る必要がある。取り方が 2 通りあり、これは俺が決めてはいけない → **U1**。
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
- 回数の上限と、Check again（読み戻しだけの再実行）を同じカウンタで数えるかは決めていない → **U4 / U5**。
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
- どちらを取るかは REQ 予算の話 → **U6**。

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

**直し方の案（実施は保留）**
- `RelayOutcome` に `'auth-required'` を足し、`sendEvent` の `:230` を「`ok === false` かつ `notice` が `auth-required:` で始まるなら `auth-required`」に分ける。NIP-01 のプレフィクスに依存するので、§W4.2 `:496-498` が「§20.3 の probe で確認してから」と条件を付けている点は守る。
- **その probe が未実施なので、先に probe をやるべき。** → **U7**。

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

**直し方の案（実施は保留）**
- G1 段階 B/C に着手するときに、そのついでで `Viewer` に `signerState` 相当の判別可能ユニオンを持たせる。**単独でやる価値は無い。**

**受け入れ条件（実施するとき）**
- AC-G6-1: `window.nostr` が無いページで、Publish 関連の要素が DOM に**存在しない**（disabled ではない）（W-T1）。※ 現状でも満たしているはずなので、まず現状で通ることを確認してから触る。
- AC-G6-2: ロード後、利用者の操作前に NIP-07 のメソッド呼び出し回数が 0（W-T2）。
- AC-G6-3: リロード後、保存された鍵があってもサインイン状態は復元されず、Publish が有効にならない（W-T8）。**ただし現在の実装は `sessionStorage` を使っており、設計の §W1.4 と食い違う → U2。**

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

### 3.2 §W0.2 の localStorage キー — **要判定（U2）**

| 設計 | 実装 |
|---|---|
| `:81` `DRAFT_STORAGE_KEY = "nosmaps:draft:v1"` | `src/ui/explorer/draft-storage.ts:14` — `'nosmaps.publish.draft'` |
| `:80` `IDENTITY_STORAGE_KEY = "nosmaps:identity:v1"` | `src/ui/explorer/app.ts:370` — `VIEWER_SESSION_KEY = 'nosmaps.viewer.pubkey'` |
| `:171` viewer pubkey は **`localStorage`** に保存し、次回ロードでランキングに使う（`identitySource = "remembered"`） | `app.ts:422` は **`sessionStorage`** を使い、コメントで「タブを閉じれば消えるし、別タブに漏れない」と理由を書いている |

キー名の差は実害なし（どちらも観測可能で衝突していない）。
**`localStorage` か `sessionStorage` かは方針の差**であって、設計 `:171` は「次のロードでプロンプト無しにランキングできる」という利便性を、実装は「タブを閉じたら消える」というプライバシーを取っている。→ **U2**。

### 3.3 §W4.3 の集約状態と実装の `PublishState` が一致しない — **要判定（U3）**

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
現状は `app.ts:1282` の "publishing" 表示のみで、何回目かは出ない。→ 実害は薄いので **P4 相当。U3 で方針を聞く。**

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

`SIGNER_TIMEOUT_MS` の 60s / 20s は**要判定 → U8**。他は名前だけの問題で実害なし。

---

## 4. 既存 docs の要修正リスト（この文書では直していない）

制約により既存 docs は触っていない。直すなら以下:

1. **`docs/design-relay-native-write-path.md` の `nostr-catalog.js` 等への参照 48 個（62 行）**を、`src/` 配下の現在位置に張り替える。3.1 の対応表が起点になる。ただし行番号は動くので、**行番号を書かず関数名／定数名で参照する**形に変えるのが妥当（そうすれば次のリファクタで再び死なない）。
2. **§W0.2 の `IDENTITY_STORAGE_KEY` / `DRAFT_STORAGE_KEY`** を実装の値に合わせるか、実装を設計に合わせるか（U2 の決定後）。
3. **§W1.4 の「viewer pubkey は localStorage」** を `sessionStorage` に改めるか（U2 の決定後）。
4. **§W0.2 の `SIGNER_TIMEOUT_MS = 60_000`** と実装の 20000 のどちらかに揃える（U8 の決定後）。
5. **§W4.3 の集約表**に `blocked` / `invalid` / `superseded-during-publish` / `readback-quarantined` を追加し、`pending` の扱いを決める（U3 の決定後）。
6. **§W9 のテスト番号の重複**: `:648` の W-I3 の説明が「directly testable (§W9, W-T22)」と書いているが、W-T22 は §W3.4 の `created_at` テスト（`:937`）で、読み戻しの W-I3 テストは W-T30（`:960`）。**参照ミスと思われるが、原文の意図は未確認**なので勝手に直さない。
7. **`docs/design-relay-native-data.md`** 側にも同種の陳腐化がある可能性が高い（未確認 — 本タスクでは grep していない）。

---

## 5. U 項目 — kojira に判断してもらうこと

俺が勝手に決めると仕様の芯に触るもの。

**U1. §W3.4 の「既存 winner」をどこから取る？**
`created_at = max(now, prior.created_at + 1)` を計算するには、署名前にその座標の現在の winner が要る。手が 2 つある:
(a) 署名前に読み取り REQ を 1 往復増やす（正確。ただし §9.2 の REQ 予算が増え、Publish が体感で遅くなる）
(b) 既にロード済みのカタログ／キャッシュの winner を使う（往復ゼロ。ただし古い可能性があり、古いと衝突を検出できない）
(c) 両方 — キャッシュにあればそれを使い、無ければ読みに行く
**どれにしますか？**

**U2. 身元の保存は `localStorage` と `sessionStorage` のどっち？**
設計 §W1.4 は `localStorage`（次回ロードでプロンプト無しにランキングできる）、実装は `sessionStorage`（タブを閉じたら消える／別タブに漏れない）。
**プライバシーを取って実装を正とし設計を直しますか、それとも利便性を取って実装を変えますか？**

**U3. 読み戻し中の `pending` 状態を画面に出しますか？**
設計 §W4.3 / §W5.5 は「確認中（3 回中 2 回目）」を出せと言っていますが、実装は読み戻しを回しきってから 1 回だけ描画します。
出すなら `publishSoftwareRecord` に進捗コールバックを足すことになり、データ層の API 形が変わります。
**進捗を出しますか、それとも「待っている間は publishing のまま」で良しとしますか？**

**U4. リトライ用に署名済みイベントをメモリに保持し続けて良いですか？**
§W4.5 は「同じ署名バイトを再送」、§W1.4 は「署名済み未公開イベントは**永続化しない**」。
永続化しないのは守るとして、**リロードまでのメモリ保持は許容範囲**という理解で合っていますか？
（現状 `app.ts:1188` の `PublishForm.result` に既に入っているので、実質そうなっています）

**U5. `PUBLISH_MANUAL_RETRIES = 2` は何を 2 回と数えますか？**
§W4.5 は「リトライ（再送）は 2 回まで」、§W5.5 の Check again（読み戻しだけの再実行）には上限が書かれていません。
(a) 再送 2 回、Check again は無制限
(b) 両方あわせて 2 回
(c) それぞれ 2 回
**どれですか？**

**U6. `#t` probe をリレー別にしますか、集約のままにしますか？**
リレー別にすると §W5.2 の記述どおりになりますが、読み戻しの論理 REQ が 1 ラウンド増えます（§9.2 の予算表の改訂が要る＝設計 §W10 項目 1 に既出）。
集約のままなら実装は「表示を足すだけ」で済みますが、「どのリレーで discovery に出ないか」は言えなくなります。
**どちらにしますか？**

**U7. NIP-42（G5）は §20.3 の preflight probe を先にやりますか？**
既定リレー 2 台が NIP-42 を要求するかは未観測です。要求しないなら、この穴で困る人は現時点で 0 人なので後回しが妥当だと思っています。
**probe を先に走らせて、実際に要求されることが観測できてから直す、で良いですか？**

**U8. 署名器のタイムアウトは 60 秒（設計）と 20 秒（実装 `params.ts:56`）のどちらが正ですか？**
設計 §W0.2 の理由は「人がダイアログに答えている」。実装の 20 秒は根拠がコードに書かれていません（未確認）。

**U9. G1 をどこまでやりますか？**
段階 A（`d` を読み取り専用にするだけ）/ 段階 B（自分のレコード一覧を足す）/ 段階 C（withdraw / reactivate まで）。
C まで行くと §W6.1 の単一著者 REQ が要り、それは §13.1 の carve-out（設計 `:1022` で「適用済み」とされている）に依存します。
**A だけ先に出しますか、C まで一気にやりますか？**

---

## 6. 実装順の提案（U 項目が解決したあと）

1. **G2**（`created_at`）— G1 段階 C の前提。単独でも「更新が黙って負ける」を直せる。
2. **G1 段階 A**（`d` の凍結）— 小さく、誤ったレコードの増殖を止める。
3. **G1 段階 B/C**（管理・取り下げ）— G6 の型整理をここで一緒にやる。
4. **G3**（手動リトライ）
5. **G4**（`#t` の表示）
6. **G5 / G6** — 観測が出るまで、あるいは 3 のついでまで、着手しない。
