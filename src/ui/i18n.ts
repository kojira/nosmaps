/* Central browser-only translations shared by every page.
   UI layer: reads the DOM (document.documentElement.lang) and sessionStorage. */

/** The two languages every user-facing string must exist in. */
export type Language = 'ja' | 'en';

/** A translation node: a leaf string, a list, or a group of more nodes. Typed as
   nodes rather than as the literal shape the dictionaries happen to have — the
   point of the type is that a lookup lands on a node, and nothing else, so a miss
   surfaces as `undefined` instead of being read back as `any`. */
export type I18nNode =
  | string
  | readonly I18nNode[]
  | {readonly [key: string]: I18nNode};

export type I18nVariables = {readonly [key: string]: string | number};

export interface I18nMissing {
  readonly path: string;
  readonly language: Language;
  readonly detail: string;
}

const dictionaries: {readonly [K in Language]: I18nNode} = {
  ja: {
    localeName: '日本語', otherLocale: 'English', language: '言語', skip: '本文へスキップ', close: '閉じる',
    all: 'すべて', none: 'なし', unknown: '不明', optional: '任意', reset: '条件をリセット', remove: '外す', add: '追加', replace: '入れ替え',
    title: 'nosmaps — Nostrツールを見つける', description: '目的・カテゴリ・機能からNostr周辺ツールを探して比較できます。',
    footer: {source: 'GitHubでソースコードを見る', sourceNewTab: 'GitHubでソースコードを見る（新しいタブで開きます）'},
    categories: {
      clients: {name: 'クライアント', icon: 'smartphone', description: 'タイムラインや投稿を扱うクライアント。'},
      relay: {name: 'リレー運用', icon: 'dns', description: 'リレーの設定や接続状況を確認する運用ツール。'},
      identity: {name: 'ID・鍵管理', icon: 'key', description: '鍵とプロフィールを管理する補助ツール。'},
      media: {name: '画像・動画', icon: 'movie', description: '作品やメディアを公開する制作ツール。'},
      analytics: {name: '観測・分析', icon: 'analytics', description: 'イベントや接続傾向を可視化する観測ツール。'},
      dev: {name: '開発者向け', icon: 'code', description: 'NIPやイベントを確認する開発ツール。'},
      /* §21.6 R6: 41件のうち4件が発行者自身の言葉で「ウォレット」と名乗ったので seed に加えた唯一の語。 */
      wallet: {name: 'ウォレット', icon: 'wallet', description: 'Bitcoin・Lightningのウォレット。'}
    },
    statuses: {active: '稼働中', stale: '更新停滞', dead: '終了／到達不能', unknown: '不明'},
    /* §21.4 R4: レコードの状態（active / withdrawn）は「プロジェクトが生きているか」ではない。 */
    recordStates: {active: '公開中（active）', withdrawn: '取り下げ済み（withdrawn）'},
    liveness: {unknown: '不明', reachable: '到達可能', unreachable: '到達不能', archived: 'アーカイブ済み', moved: '移転', superseded: '後継あり'},
    /* §21.7 R7: 実データが持っていた8値。unknown は否定ではなく「一次情報が何も言っていない」。 */
    support: {
      supported: '対応', partial: '部分対応', not_supported: '非対応（明示）', not_applicable: '対象外',
      planned: '予定', disabled: '実装済み・無効', withdrawn: '対応取りやめ', unknown: '不明（主張なし）',
      out_of_family: '別の仕様ファミリ'
    },
    evidence: {
      supported: '一次情報が無条件に対応を主張しています。',
      partial: '一次情報が制限つきで対応を主張しています。',
      not_supported: '一次情報が「対応しない」と明示しています。沈黙よりも強い言明です。',
      not_applicable: '一次情報が「この仕様は当てはまらない」と述べています。分母には数えません。',
      planned: '一次情報が予定として挙げています。現時点の実装ではありません。',
      disabled: '実装済みで、既定では無効になっています。',
      withdrawn: 'かつて対応していましたが取り下げられました。',
      unknown: '一次情報は何も述べていません。非対応という意味ではありません。',
      out_of_family: '主張は別の仕様ファミリにあります。NIPの主張は記録されていません。'
    },
    /* §21.2.3: id をピン留めしたスナップショットに照合した結果。落とさず、書き換えず、そのまま出す。 */
    registryStatus: {resolved: 'レジストリで解決', not_in_registry: 'レジストリに無い', unresolvable: 'スナップショット無し'},
    /* §21.1 R1: 主張の出どころ。転記は「そのプロジェクトが言った」ではなく「署名者が書き写した」。 */
    basis: {transcribed: '転記（署名者が読んだ文書の写し）', self_declared: '自己申告', tested: '実行して検証'},
    observers: {crawler: 'Nosmaps観測', community: 'コミュニティレビュー', maintainer: 'メンテナー申告'},
    landing: {
      headline: 'Nostrの地図、ここにあります！',
      lead: '目的や機能から、Nostrのアプリ・サービスを探して比べられます。',
      carouselTitle: 'アプリ・サービス',
      carouselLabel: 'アプリ・サービスの紹介',
      slideLabel: '{name}（{index}／{total}）',
      openEntry: '{name} の詳細を開く',
      position: '{index} / {total}',
      previous: '前の項目', next: '次の項目',
      category: 'カテゴリ', platform: '対応環境',
      explorerCta: '機能から探す', explorerHelp: 'アプリ・サービスを機能で絞り込み、NIPの根拠まで確認できます。'
    },
    explorer: {
      pageTitle: 'Nosmaps — 機能から探す', pageDescription: '機能からNostrツール候補を探し、NIPの根拠と機能差を比較できます。', location: '機能から探す', back: 'トップページへ戻る',
      search: 'アプリ／サービスを全文検索', searchPlaceholder: '名称・概要・カテゴリ・OS・提供形態・別名', featureGroup: '主要機能（複数選択・AND条件）', categoryGroup: 'カテゴリで絞り込む', allCategoriesDescription: 'すべてのカテゴリから探します。',
      candidates: '候補', noFeature: '機能は未選択：すべての候補を表示', featureAnd: '機能条件（すべてAND）', viewNips: 'NIPを見る', activeAnd: '有効な条件（すべてAND）', noExtra: '追加条件なし',
      settings: '詳細設定', platform: 'OS／環境', updateStatus: '更新状態', activeStatus: '稼働・停滞・不明', support: '機能対応', featureNeeded: '機能を1つ以上選ぶと使えます。', delivery: '提供形態', webApp: 'Webアプリ', installed: 'インストール型', mobileApp: 'モバイルアプリ', oss: 'OSS', includeDead: '終了／到達不能も含める', savedOnly: 'ブックマーク済みだけ', nipSearch: 'NIP番号・名称', supportModes: {all: 'すべて（不明も含む）', confirmed: '対応・部分対応のみ'}, supportModeHelp: '既定は「対応・部分対応のみ」です。主張が無いもの（不明）は既定では出ません。', unstatedSetAside: '選んだ機能について一次情報が何も述べていないエントリが{count}件あります。非対応という意味ではありません。', showUnstated: '不明も含めて表示', unknownInfo: '「不明」について', unknownHelp: '材料不足で判定を保留した状態です。非対応を意味しません。終了／到達不能は選んだ場合だけ表示します。',
      selectedCount: '{count}件を選択（最大3件）', compareByFeature: '機能で比較', clearSelection: '選択解除', evidenceTitle: '技術的な裏付け', primarySource: '公式NIP一次資料', chooseForNips: '機能を選ぶと、関連するNIPの一次資料を表示します。',
      facts: '事実・観測', evaluations: '利用者評価', noFeatureCondition: '機能条件なし', category: 'カテゴリ', observed: '最終観測', officialLinks: '{name}の公式情報', site: '公式サイト', distribution: 'アプリ配布', docs: '公式Docs', source: 'ソース', linkDetails: '{type}の情報', displayUrl: 'URL', opensInNewTab: '新しいタブで開きます', checkedAt: '最終確認日時',
      like: 'いいね {count}', bookmark: 'ブックマーク', bookmarked: 'ブックマーク済み', reviews: 'レビュー {count}', privateDefault: '非公開', public: '公開', publicToggle: '公開にする',
      endedRecord: '終了／到達不能の記録。', alternatives: '同じ機能の稼働候補へ戻る', compareAdd: '比較に追加', details: '詳細・根拠',
      count: '{count}件', noMatch: '条件に合う候補がありません', noMatchHelp: '上の条件を1件ずつ外して広げられます。', removeGets: '「{label}」を外すと {count}件', resetAll: 'すべての条件をリセット',
      conditionFeature: '機能「{value}」', conditionQuery: '全文検索「{value}」', conditionPlatform: 'OS／環境「{value}」', conditionCategory: 'カテゴリ「{value}」', conditionStatus: '更新状態「{value}」', conditionSupport: '機能対応「{value}」', conditionDelivery: '提供形態「{value}」', conditionOss: 'OSS「{value}」', conditionDead: '終了／到達不能を含む', conditionSaved: 'ブックマーク済みだけ', conditionNip: 'NIP「{value}」', conditionTool: 'エントリ「{value}」', conditionRemove: '{label}を外す',
      /* issue #1 / #21: 並び順。実在する値だけを鍵にする。「リリースが新しい順」は無い ——
         レコードは自分の公開日を述べていない。持っているのはイベントの created_at＝
         収集した時刻なので、ラベルもそのまま「収集日」と書く。表示と値が同じ事実を
         指している限り捏造ではない。 */
      sort: {
        label: '並び順',
        'default': '既定の順',
        'name-asc': '名前（昇順）', 'name-desc': '名前（降順）',
        'likes-desc': 'いいねが多い順', 'likes-asc': 'いいねが少ない順',
        'collected-desc': '収集日が新しい順', 'collected-asc': '収集日が古い順',
        /* 並び順から外れた行の見出しは、外れた理由＝鍵の次元ごとに別の文。 */
        unranked: {
          likes: {
            heading: 'いいね数：未観測',
            notice: 'いいね数を観測していないエントリが{count}件あり、この並び順には入れていません（0件という意味ではありません）。'
          },
          collected: {
            heading: '収集日：未観測',
            notice: '収集日を持たないエントリが{count}件あり、この並び順には入れていません（最も古いという意味ではありません）。'
          }
        }
      },
      /* §21 の新語彙。unknown は「値が無い」ことを名指す語で、0 でも否定でもない。 */
      summaryAbsent: '概要は公開されていません', freeTopic: 'レコードが公開したトピック。この端末に対応するラベルはありません。',
      recordState: 'レコードの状態', recordStateFilter: 'レコードの状態', recordStateHelp: 'プロジェクトの生存とは別の軸です。',
      liveness: 'プロジェクトの生存', livenessDerived: '生存確認：{value}',
      livenessUncounted: 'ソーシャルグラフが無いため、記録済みの観測 {count} 件はどれも数えていません。',
      /* issue #15-2: 到達可能と言える根拠は、収集時に記録が残っている応答だけ。記録が無ければ不明のまま。 */
      livenessFromSource: '到達可能と言える根拠：{url}（{date} に応答を記録）',
      capabilityClaims: '対応主張', noClaimPublished: '対応主張は公開されていません', noNipClaims: 'NIPの主張は記録されていません',
      claimFamilyCount: '{family} {count}件', claimSource: '主張の出典', claimCaveats: '出典の但し書き', caveat: '但し書き',
      basis: '主張の根拠', assertedAt: '主張の取得日', notation: '出典の記法', sourceText: '出典の該当行',
      registryStatus: 'レジストリ照合', registryDeprecated: 'レジストリで非推奨',
      notInRegistry: 'ピン留めしたレジストリスナップショット {revision} に無いIDです',
      noRegistrySnapshot: 'ファミリ {family} のレジストリスナップショットがありません',
      primarySources: '出典', noOfficialLinks: '出典にリンクの記載はありません',
      noReviewsObserved: 'レビューは観測していません', collectedData: '一次情報から収集',
      platformSourced: '対応環境が記録されているエントリだけが一致します。',
      topicCorrection: '収集時のトピック：{collected} —',
      nonClaim: {modules: 'NIP名のモジュール（対応主張ではありません）', crates: 'NIP名のクレート（対応主張ではありません）'},
      detailKicker: '対応の根拠', supportFor: '{feature}への対応', observer: '観測主体', nipPurpose: 'NIPの用途', state: '状態', os: 'OS／環境', license: 'ライセンス',
      compareTitle: '{count}件の機能比較', differencesFirst: '差がある項目を先に表示します。', removeCandidate: '{name}を比較から外す', removeShort: '外す', alternative: '別の候補', replaceTarget: '入れ替える候補', addComparison: '比較に追加', replaceComparison: '選んだ候補と入れ替え', needTwo: '比較するには2件以上を選んでください。', featuresSection: '機能', basicsSection: '基本情報', nipEvidence: 'NIP裏付け',
      reviewTitle: '{name}のレビュー', reviewCount: '{count}件', openGallery: '画像ギャラリー', reviewer: '投稿者', postedAt: '投稿日時', use: '用途', rating: '評価', appVersion: 'アプリversion', notEntered: '未入力', helpful: '役に立った {count}', unhelpful: '立たなかった {count}', voters: '評価者{count}人・内訳', writeReview: 'レビューを追加', body: '本文', bodyPlaceholder: '使った場面や気づいたこと', image: '画像', deviceImage: '端末から選ぶ', osOptional: '対象OS（任意）', versionOptional: 'version（任意）', useOptional: '用途（任意）', ratingOptional: '評価（任意）', createReview: 'レビューを追加', chooseBodyOrImage: '本文か画像を選んでください。', addedReview: 'レビューを追加しました', imageOnly: '本文なし（画像のみ）',
      profileTitle: 'レビュアープロフィール', joined: '利用開始', activity: '投稿履歴の広がり', posting: '投稿傾向', voteHistory: '過去レビューと役立ち内訳', history: 'レビュー履歴',
      /* 投稿フォーム (issue #9 スライス2)。成功の言い切りは readback が返ったときにしか出さないので、
         見出しは必ず「何台中何台」を持つ。「公開しました」だけの文字列はここに存在しない。 */
      publish: {
        title: 'レコードを投稿する',
        lead: '署名はNIP-07拡張が行い、この画面は秘密鍵に触れません。公開できたと言えるのは、リレーから読み戻せたときだけです。',
        noSigner: 'このブラウザにNIP-07拡張がありません。投稿にはNIP-07拡張が必要です。閲覧はそのまま続けられます。',
        signInFirst: '投稿するにはNIP-07でサインインしてください。',
        dLocal: '識別子（d の nosmaps: より後ろ）',
        dBytes: 'd 全体で {bytes} / {max} バイト（nosmaps: の8バイトを含む）',
        name: '名前',
        summary: '概要',
        summaryHelp: '空欄のままでも投稿できます。発行者が書いた概要が無いことは、無いと書くのが正確です。',
        homepage: '公式サイト（任意・https:// で始まること）',
        topics: '追加トピック（カンマ区切り）',
        topicsHelp: 'nosmaps トピックは発見のために必ず付きます。外せません。',
        submit: '署名して投稿',
        publishing: '投稿中…',
        eventId: '署名したイベントID',
        partialConsequence: '受け付けなかったリレーだけを読んでいるクライアントには、このレコードは見えません。',
        /* §W3.4 / W-I4: created_at を1秒進めたことは隠さない。進めた理由と、進める前に
           実際に観測した値を並べて出す。「勝手に時刻を作った」と「同じ秒で負けないように
           1秒だけ足した」は別のことなので、後者だと分かる形で書く。 */
        clockBumped: '同じ座標に created_at {prior} のレコードを観測したので、同じ秒で負けないように created_at を {createdAt} にしました（+1秒）。',
        clockConflictDetail: '観測した created_at は {prior} で、この端末の時計（{now}）より先です。何も署名していません。',
        headlines: {
          published: '{total}台中{accepted}台に公開し、読み戻せました。',
          partial: '{total}台中{accepted}台に公開し、読み戻せました。',
          unconfirmed: '署名と受領はされましたが、{attempts}回試しても読み戻せませんでした。保存されている可能性はあります。',
          failed: '公開されていません。',
          invalid: 'この内容は投稿できません。',
          blocked: '署名の前に中止しました。',
          other: '状態: {state}'
        },
        outcomes: {
          accepted: '受け付けた（OK true）',
          rejected: '拒否した（OK false）',
          timeout: '応答なし（未確定。失敗ではありません）',
          'connection-failed': '接続できなかった（未確定）',
          'auth-required': '認証が必要',
          'not-attempted': '送っていない'
        },
        reasons: {
          'bad-d': '識別子が不正です（印字可能なASCIIのみ、d 全体で192バイトまで）。',
          'bad-schema': '必須の項目が足りないか、長さの上限を超えています。',
          'foreign-d': '識別子が nosmaps: 名前空間の外を指しています。',
          'foreign-profile': 'content が nosmaps のプロファイルではありません。',
          'bad-topic': 'トピックが不正です（空、または128バイト超）。',
          'multi-value-t': 't タグは1つの値だけを持てます。',
          'uppercase-topic': 'トピックは小文字だけです。',
          'unknown-field': 'v1プロファイルに無い項目が含まれています。',
          'bad-version': 'version は 1 だけです。',
          'bad-state': 'state は active か withdrawn だけです。',
          'bad-superseded-by': 'superseded_by が座標として不正です。',
          'tag-content-mismatch': 'state タグと content の state が食い違っています。',
          'future-timestamp': 'created_at がこの端末の時計より未来です。',
          'future-horizon': 'created_at が遠すぎる未来です。',
          'signer-absent': 'NIP-07拡張が見つかりません。',
          'signer-rejected': 'NIP-07拡張が署名を返しませんでした。プロンプトを閉じた場合はもう一度お試しください。',
          'signer-wrong-pubkey': 'NIP-07拡張がサインイン時と別の公開鍵で署名しました。何も送っていません。',
          'signer-mutated-event': 'NIP-07拡張が渡した内容を書き換えました。何も送っていません。',
          'signer-missing-fields': 'NIP-07拡張の返した署名済みイベントが読めません。何も送っていません。',
          'signer-invalid-record': '署名後のイベントが検証を通りませんでした。何も送っていません。',
          'nip07-key-unparsable': 'NIP-07拡張が公開鍵として読めない値を返しました。',
          'pubkey-mismatch': 'サインイン時と別の公開鍵が返りました。何も送っていません。',
          'clock-conflict': 'この座標のレコードが、この端末の時計より先の時刻で記録されています。端末の時計を確認してください。',
          'relay-unavailable': 'リレー層を初期化できませんでした。',
          'all-relays-rejected': 'すべてのリレーが拒否しました。',
          'publish-error': '投稿の途中でエラーが起きました。公開されたかどうかは分かりません。',
          'not-returned-yet': 'この回では返ってきませんでした。存在しないという意味ではありません。',
          'query-failed': '読み戻しの問い合わせ自体が失敗したので、何も分かっていません。',
          'readback-quarantined': '読み戻したイベントが検証で隔離されました。',
          'superseded-during-publish': '同じ座標に、より新しい別のイベントが観測されました。',
          'no-readback': '読み戻しを実行できませんでした。',
          unavailable: 'データ層を読み込めていません。',
          unknownReason: '理由: {reason}'
        }
      },
      /* issue #12: 自分が出したレコードの一覧。「観測できなかった」と「問い合わせが完了しなかった」を
         別の文言にしてあるのは、利用者が次に取る行動が違うから —— 後者を「0件」と書くと、
         もう出してあるレコードをもう一度出しに行かせることになる。 */
      manage: {
        title: '自分が出したレコード',
        loading: 'リレーに問い合わせています…',
        empty: 'このリレーでは、あなたの署名したレコードは観測されませんでした。存在しないという意味ではありません。',
        queryFailed: '問い合わせが完了しなかったので、件数は0ではなく不明です。何も観測できていません。',
        unavailable: 'リレーに1台も接続できませんでした。観測できたことは何もありません。',
        truncated: '上限 {limit} 件まで読みました。これより多くのレコードがある可能性があります。',
        count: '{count} 件',
        coordinate: '識別子 d',
        updatedAt: '最終更新'
      },
      /* NIP-07 サインイン。失敗の原因は原因ごとに別の文言で出す —— 「拡張が無い」「断られた」
         「エラーが返った」「応答が無い」は利用者が次に取る行動が違う。 */
      viewer: {
        label: 'ビューアのサインイン状態', signedIn: 'サインイン済み', signedOut: '未サインイン',
        signIn: 'NIP-07でサインイン', signingIn: '接続中…', signOut: 'サインアウト',
        reasonDetail: '{reason}（拡張の応答: {detail}）',
        reasons: {
          noExtension: 'NIP-07拡張が見つかりません（このブラウザに window.nostr がありません）。',
          rejected: 'NIP-07拡張で公開鍵の共有を許可されませんでした。',
          error: 'NIP-07拡張がエラーを返しました。',
          timeout: 'NIP-07拡張が{seconds}秒以内に応答しませんでした。',
          badKey: 'NIP-07拡張が公開鍵として読めない値を返しました。'
        }
      },
      galleryTitle: '{name}のレビュー画像', galleryEmpty: '添付画像はまだありません。', enlarge: '拡大', originalReview: '元レビュー', imageTitle: 'レビュー画像', remainingGallery: '残り{count}件を含む画像ギャラリーを開く', imageAlt: '{author}・{date}のレビュー画像',
      voteBreakdown: '役立ち評価の内訳', communityVotes: 'コミュニティの評価', helpfulVotes: '役に立った', unhelpfulVotes: '立たなかった',
      toastLiked: 'いいねを更新しました', toastLikeUnconfirmed: 'リレーは受け取りましたが、まだ読み戻せていません', toastLikeFailed: 'いいねを送れませんでした', likeAdd: 'いいねする（kind 7 をリレーへ発行）', likeRetract: 'いいねを取り消す（kind 5 をリレーへ発行）', likeSending: '送信中…', likeNeedsSigner: 'いいねにはNIP-07拡張が必要です', likeNeedsSignIn: 'いいねするにはNIP-07でサインインしてください', likeNoTarget: 'この行には反応できる座標がありません', toastBookmarked: 'ブックマークを更新しました', toastVoted: '評価を更新しました', toastPublic: '公開範囲を更新しました', compareLimit: '比較は最大3件です',
      loading: '機能対応情報を読み込み中…', emptyState: '候補は0件です', errorState: '対応情報を取得できませんでした', retry: '再試行', partialState: '一部の候補を表示しています。', offlineState: '保存済みの候補を表示しています。', offlineBanner: 'オフライン：保存済みの候補を表示しています。',
      staleState: '前回観測したレコードを表示しています。今回のラウンドを完了できませんでした。', incompleteState: '一部のリレー応答が揃わなかったため、結果は不完全です。', unavailableState: '設定したリレーからは表示できるレコードを観測できませんでした（存在しないという意味ではありません）。',
      sampleData: 'サンプル', relayVerified: 'リレー検証済み', relayEmptyTitle: '該当レコードなし', relayEmpty: '設定したリレーでは、該当トピックを付けた kind 30078 レコードを観測できませんでした。存在しないという意味ではありません。',
      relayDiagnostics: 'リレー診断', relayNoData: 'リレー結果を取得できませんでした。', relayReload: 'リレーから再取得', relayRelays: 'リレーとカバレッジ', relayCurators: '推薦者（あなたのグラフ内）', relayNoCuration: '観測できた kind 30267 セットはありません', relayManualCurators: '手動で数えている pubkey', relayCuratorSets: 'セット', relayCuratorSetsValue: '{used} / {observed}', relayCuratorMembers: 'メンバー数',
      relayGraph: 'ソーシャルグラフ', relayGraphState: '状態', relayGraphCoverage: 'カバレッジ', relayGraphFollows: 'グラフ人数 |G|', relayGraphFollowsValue: '{used} / {total}', relayGraphMalformed: '不正な p タグ', relayViewer: 'ビューア鍵', relayViewerSource: '鍵の取得元',
      relayRounds: 'ラウンド', relayChunks: 'チャンク', relayQuarantined: '隔離 (quarantined)', relayUnresolved: '推薦されたが未観測の座標', relaySlugs: '診断',
      relayAsOf: 'as-of', relayReqs: 'REQ集計', relayLogical: '論理REQ', relayPhysical: '物理REQ', relayHttp: 'HTTP試行', relayCache: 'キャッシュヒット', relayReason: '理由',
      discoveryScope: 'あなたのリレーでトピック「{topics}」を公開したレコードのみ。すべてのツールではありません。',
      recommendations: 'あなたのネットワークで{count}人が推薦', recommendationsUnknown: '推薦数: 不明（フォローリストが必要）',
      graphNoneBanner: 'パーソナライズされていません。推薦数の集計にはフォローリストが必要です。Nostr鍵を接続するか、npubを貼り付けると読み取り専用で並び替えできます。',
      graphConnect: 'Nostr鍵を接続 (NIP-07)', graphPasteLabel: 'npub または hex', graphApply: 'この鍵で並び替える',
      graphStateLine: 'グラフ: {state}（{coverage}・数える pubkey {used}/{total}）', graphStateLineShort: 'グラフ: {state}（{coverage}）',
      graphStates: {none: 'なし', 'self-only': '自分のみ', tier1: 'フォローリスト', 'tier1+tier2': 'フォロー＋1ホップ'},
      graphCoverage: {fresh: '最新', stale: '古い', incomplete: '不完全', truncated: '打ち切り', unknown: '不明'},
      coverage: {eose: '完了 (EOSE)', timeout: 'タイムアウト', error: 'エラー', 'auth-required': '認証要求', rejected: '拒否', disconnected: '切断', skipped: '未実行'},
      nipPurposes: {'01': '基本イベント・署名・クライアント／リレー間メッセージ', '02': 'kind 3によるフォローリスト', '05': 'DNSベース識別子と公開鍵の対応確認', '09': 'kind 5によるイベント削除リクエスト', '11': 'HTTPで取得するリレー情報文書', '19': 'npub・note等のbech32エンコード識別子', '21': 'nostr: URIによる識別子リンク', '23': 'kind 30023による長文コンテンツ', '25': 'kind 7によるリアクション', '42': 'リレーに対するクライアント認証', '44': 'バージョン付き暗号化ペイロード形式', '46': '秘密鍵を分離するリモート署名', '47': 'リモートLightningウォレット接続', '57': 'zap request／receiptによるLightning支払い記録', '65': 'kind 10002によるread／writeリレー一覧', '78': 'アプリ固有データの保存'},
      features: {
        posts: ['投稿・返信', 'タイムラインで読み書きし、返信したい', 'タイムライン 投稿 返信'], dm: ['DM', '暗号化した個別メッセージを送りたい', '暗号化DM 個別メッセージ'], search: ['検索', '投稿や人、識別子を探したい', '検索 人 識別子'], media: ['画像・動画', '画像や動画を見たり公開したい', 'メディア 画像投稿 動画投稿'], notifications: ['通知', '返信・リアクション・zapに気づきたい', '通知 リアクション'], accounts: ['複数アカウント', '複数の鍵やプロフィールを切り替えたい', 'マルチアカウント'], signing: ['外部署名', '秘密鍵をアプリから分離したい', 'リモート署名'], wallet: ['Wallet・Zap', 'zapやウォレット接続を使いたい', '支払い 投げ銭'], longform: ['長文', '記事や長いコンテンツを書きたい', '長文コンテンツ 記事'], community: ['チャンネル', 'コミュニティで会話・運営したい', 'チャンネル コミュニティ']
      },
      reviewsSeed: {
        aBody: '複数端末で読みやすく、通知設定も見つけやすい。', bBody: '検索結果からプロフィールへ戻る流れが分かりやすかった。', cBody: '画像を見ながら会話を追いやすい。',
        aBio: '複数OSでクライアントの導線とアクセシビリティを確認しています。', bBio: '初見利用と比較検証を中心に記録しています。',
        aSpread: '28か月・11カテゴリ・Web/Desktop/Mobile', bSpread: '9か月・6カテゴリ・Web中心', aPosts: '月2〜9件。短文、画像、確認メモ。', bPosts: '月1〜4件。比較レビューと返信。', localName: 'あなた', localBio: 'この画面で追加したレビュー。',
        screenTimeline: 'タイムライン', screenSettings: '設定画面', screenMedia: 'メディア表示'
      }
    }
  },
  en: {
    localeName: 'English', otherLocale: '日本語', language: 'Language', skip: 'Skip to content', close: 'Close',
    all: 'All', none: 'None', unknown: 'Unknown', optional: 'Optional', reset: 'Reset filters', remove: 'Remove', add: 'Add', replace: 'Replace',
    title: 'nosmaps — Find Nostr tools', description: 'Discover and compare Nostr tools by goal, category, and feature.',
    footer: {source: 'View the source on GitHub', sourceNewTab: 'View the source on GitHub (opens in a new tab)'},
    categories: {
      clients: {name: 'Clients', icon: 'smartphone', description: 'Clients for timelines and publishing.'}, relay: {name: 'Relay operations', icon: 'dns', description: 'Tools for relay configuration and connectivity.'}, identity: {name: 'Identity & keys', icon: 'key', description: 'Tools for keys and profiles.'}, media: {name: 'Media', icon: 'movie', description: 'Tools for publishing creative media.'}, analytics: {name: 'Analytics', icon: 'analytics', description: 'Tools for observing events and connections.'}, dev: {name: 'Developer tools', icon: 'code', description: 'Tools for inspecting NIPs and events.'}, wallet: {name: 'Wallet', icon: 'wallet', description: 'Bitcoin and Lightning wallets.'}
    },
    statuses: {active: 'Active', stale: 'Stale', dead: 'Ended / unreachable', unknown: 'Unknown'},
    recordStates: {active: 'Published (active)', withdrawn: 'Withdrawn'},
    liveness: {unknown: 'Unknown', reachable: 'Reachable', unreachable: 'Unreachable', archived: 'Archived', moved: 'Moved', superseded: 'Superseded'},
    support: {
      supported: 'Supported', partial: 'Partial', not_supported: 'Not supported', not_applicable: 'Not applicable',
      planned: 'Planned', disabled: 'Implemented but disabled', withdrawn: 'Support withdrawn', unknown: 'Unknown (no claim)',
      out_of_family: 'Other spec family'
    },
    evidence: {
      supported: 'The primary source asserts it without qualification.',
      partial: 'The primary source asserts it with a stated limitation.',
      not_supported: 'The primary source explicitly denies it. That is a stronger statement than silence.',
      not_applicable: 'The source says the capability does not apply. It is not counted in any denominator.',
      planned: 'Listed as intended, not present today.',
      disabled: 'Implemented, and switched off by default.',
      withdrawn: 'Was supported, and has since been removed.',
      unknown: 'The source makes no statement. This is not a denial.',
      out_of_family: 'The claims are in another spec family. No NIP claim is recorded.'
    },
    registryStatus: {resolved: 'Resolved in the registry', not_in_registry: 'Not in the registry', unresolvable: 'No registry snapshot'},
    basis: {transcribed: 'Transcribed (a copy of a document the signer read)', self_declared: 'Self-declared', tested: 'Tested by running it'},
    observers: {crawler: 'Nosmaps observation', community: 'Community review', maintainer: 'Maintainer statement'},
    landing: {
      headline: "Here's the map of Nostr!",
      lead: 'Find and compare Nostr apps and services by purpose and by feature.',
      carouselTitle: 'Apps and services',
      carouselLabel: 'Apps and services',
      slideLabel: '{name} ({index} of {total})',
      openEntry: 'Open {name} in the explorer',
      position: '{index} / {total}',
      previous: 'Previous item', next: 'Next item',
      category: 'Category', platform: 'Platform',
      explorerCta: 'Explore by feature', explorerHelp: 'Filter apps and services by feature and follow the NIP evidence.'
    },
    explorer: {
      pageTitle: 'Nosmaps — Explore by feature', pageDescription: 'Find Nostr tools by feature and compare differences with NIP evidence.', location: 'Explore by feature', back: 'Back to the top page', search: 'Search apps and services', searchPlaceholder: 'Name, summary, category, OS, delivery, alias', featureGroup: 'Core features (multiple selection uses AND)', categoryGroup: 'Filter by category', allCategoriesDescription: 'Browse tools from every category.', candidates: 'Candidates', noFeature: 'No feature selected: showing all candidates', featureAnd: 'Feature filters (all AND)', viewNips: 'View NIPs', activeAnd: 'Active filters (all AND)', noExtra: 'No additional filters', settings: 'More filters', platform: 'OS / platform', updateStatus: 'Update status', activeStatus: 'Active, stale, or unknown', support: 'Feature support', featureNeeded: 'Select at least one feature to use this filter.', delivery: 'Delivery', webApp: 'Web app', installed: 'Installed app', mobileApp: 'Mobile app', oss: 'OSS', includeDead: 'Include ended / unreachable', savedOnly: 'Bookmarked only', nipSearch: 'NIP number or name', supportModes: {all: 'All (including unknown)', confirmed: 'Supported or partial only'}, supportModeHelp: 'Defaults to supported or partial only. Entries with no stated claim (unknown) are not shown by default.', unstatedSetAside: '{count} entries state nothing about the selected features. That is not the same as unsupported.', showUnstated: 'Show unknown as well', unknownInfo: 'About “Unknown”', unknownHelp: 'Unknown means the evidence is insufficient, not unsupported. Ended or unreachable entries appear only when selected.', selectedCount: '{count} selected (maximum 3)', compareByFeature: 'Compare features', clearSelection: 'Clear selection', evidenceTitle: 'Technical evidence', primarySource: 'Official NIP source', chooseForNips: 'Select a feature to show related primary NIP sources.', facts: 'Facts & observations', evaluations: 'User evaluations', noFeatureCondition: 'No feature filter', category: 'Category', observed: 'Last observed', officialLinks: 'Official information for {name}', site: 'Official site', distribution: 'Distribution', docs: 'Official docs', source: 'Source', linkDetails: '{type} information', displayUrl: 'URL', opensInNewTab: 'Opens in a new tab', checkedAt: 'Last checked', like: 'Like {count}', bookmark: 'Bookmark', bookmarked: 'Bookmarked', reviews: 'Reviews {count}', privateDefault: 'Private', public: 'Public', publicToggle: 'Make public', endedRecord: 'Ended / unreachable record.', alternatives: 'Return to active candidates with these features', compareAdd: 'Add to comparison', details: 'Details & evidence', count: '{count}', noMatch: 'No candidates match these filters', noMatchHelp: 'Remove filters one at a time to broaden the results.', removeGets: 'Remove “{label}” for {count} results', resetAll: 'Reset every filter', conditionFeature: 'Feature “{value}”', conditionQuery: 'Full-text “{value}”', conditionPlatform: 'OS / platform “{value}”', conditionCategory: 'Category “{value}”', conditionStatus: 'Update status “{value}”', conditionSupport: 'Feature support “{value}”', conditionDelivery: 'Delivery “{value}”', conditionOss: 'OSS “{value}”', conditionDead: 'Include ended / unreachable', conditionSaved: 'Bookmarked only', conditionNip: 'NIP “{value}”', conditionTool: 'Entry “{value}”', conditionRemove: 'Remove {label}', detailKicker: 'Support evidence', supportFor: 'Support for {feature}', observer: 'Observer', nipPurpose: 'NIP purpose', state: 'Status', os: 'OS / platform', license: 'License', compareTitle: '{count}-way feature comparison', differencesFirst: 'Items that differ appear first.', removeCandidate: 'Remove {name} from comparison', removeShort: 'Remove', alternative: 'Another candidate', replaceTarget: 'Candidate to replace', addComparison: 'Add to comparison', replaceComparison: 'Replace selected candidate', needTwo: 'Choose at least two candidates to compare.', featuresSection: 'Features', basicsSection: 'Basic information', nipEvidence: 'NIP evidence', reviewTitle: 'Reviews for {name}', reviewCount: '{count} reviews', openGallery: 'Image gallery', reviewer: 'Reviewer', postedAt: 'Posted', use: 'Use', rating: 'Rating', appVersion: 'App version', notEntered: 'Not entered', helpful: 'Helpful {count}', unhelpful: 'Not helpful {count}', voters: '{count} voters · breakdown', writeReview: 'Add a review', body: 'Review', bodyPlaceholder: 'Where you used it and what you noticed', image: 'Image', deviceImage: 'Choose from device', osOptional: 'OS (optional)', versionOptional: 'Version (optional)', useOptional: 'Use (optional)', ratingOptional: 'Rating (optional)', createReview: 'Add review', chooseBodyOrImage: 'Choose text or an image.', addedReview: 'Review added', imageOnly: 'No text (image only)', profileTitle: 'Reviewer profile', joined: 'Joined', activity: 'Activity span', posting: 'Posting pattern', voteHistory: 'Review and vote history', history: 'Review history',
      publish: {
        title: 'Publish a record',
        lead: 'Your NIP-07 extension does the signing; this page never touches a private key. It only says published when the record was read back from a relay.',
        noSigner: 'No NIP-07 extension in this browser. Publishing needs one. Browsing is unaffected.',
        signInFirst: 'Sign in with NIP-07 to publish.',
        dLocal: 'Identifier (the part of d after nosmaps:)',
        dBytes: '{bytes} / {max} bytes for the whole d (the 8 bytes of nosmaps: included)',
        name: 'Name',
        summary: 'Summary',
        summaryHelp: 'Leaving this empty is allowed. If the publisher wrote no summary, an empty one is the accurate answer.',
        homepage: 'Homepage (optional, must start with https://)',
        topics: 'Extra topics (comma separated)',
        topicsHelp: 'The nosmaps topic is always attached so the record is discoverable. It cannot be removed.',
        submit: 'Sign and publish',
        publishing: 'Publishing…',
        eventId: 'Signed event id',
        partialConsequence: 'Clients that read only the relays which did not accept it will not see this record.',
        clockBumped: 'A record at this address was observed with created_at {prior}, so created_at was set to {createdAt} (+1 second) rather than risk losing a same-second tie.',
        clockConflictDetail: 'The observed created_at is {prior}, which is ahead of this device clock ({now}). Nothing was signed.',
        headlines: {
          published: 'Published to {accepted} of {total} relays and read back.',
          partial: 'Published to {accepted} of {total} relays and read back.',
          unconfirmed: 'Signed and acknowledged, but we could not read it back in {attempts} attempts. It may still be stored.',
          failed: 'Not published.',
          invalid: 'This record cannot be published as entered.',
          blocked: 'Stopped before signing.',
          other: 'State: {state}'
        },
        outcomes: {
          accepted: 'accepted (OK true)',
          rejected: 'rejected (OK false)',
          timeout: 'no answer (undetermined, not a failure)',
          'connection-failed': 'could not connect (undetermined)',
          'auth-required': 'authentication required',
          'not-attempted': 'nothing was sent'
        },
        reasons: {
          'bad-d': 'The identifier is not valid (printable ASCII only, 192 bytes for the whole d).',
          'bad-schema': 'A required field is missing or a length ceiling was exceeded.',
          'foreign-d': 'The identifier points outside the nosmaps: namespace.',
          'foreign-profile': 'The content is not the nosmaps profile.',
          'bad-topic': 'A topic is not valid (empty, or over 128 bytes).',
          'multi-value-t': 'A t tag carries only one value.',
          'uppercase-topic': 'Topics are lowercase only.',
          'unknown-field': 'A field outside the v1 profile is present.',
          'bad-version': 'version must be 1.',
          'bad-state': 'state must be active or withdrawn.',
          'bad-superseded-by': 'superseded_by is not a valid coordinate.',
          'tag-content-mismatch': 'The state tag disagrees with the state in content.',
          'future-timestamp': 'created_at is ahead of this device clock.',
          'future-horizon': 'created_at is too far in the future.',
          'signer-absent': 'No NIP-07 extension was found.',
          'signer-rejected': 'The NIP-07 extension returned no signature. If you dismissed the prompt, try again.',
          'signer-wrong-pubkey': 'The extension signed with a different public key than the one you signed in with. Nothing was sent.',
          'signer-mutated-event': 'The extension changed the event we handed it. Nothing was sent.',
          'signer-missing-fields': 'The signed event returned by the extension is not readable. Nothing was sent.',
          'signer-invalid-record': 'The signed event did not pass validation. Nothing was sent.',
          'nip07-key-unparsable': 'The extension returned a value that is not a readable public key.',
          'pubkey-mismatch': 'A different public key came back than the one you signed in with. Nothing was sent.',
          'clock-conflict': 'A record at this address is already timestamped ahead of this device\u2019s clock. Check your system time.',
          'relay-unavailable': 'The relay layer could not be initialised.',
          'all-relays-rejected': 'Every relay refused it.',
          'publish-error': 'Publishing errored part way through. Whether it was stored is unknown.',
          'not-returned-yet': 'It did not come back in this round. That is not a claim that it is absent.',
          'query-failed': 'The read-back query itself failed, so nothing was learned.',
          'readback-quarantined': 'The event we read back was quarantined by validation.',
          'superseded-during-publish': 'A newer event was observed at the same coordinate.',
          'no-readback': 'The read-back could not be run.',
          unavailable: 'The data layer is not loaded.',
          unknownReason: 'Reason: {reason}'
        }
      },
      manage: {
        title: 'Records you published',
        loading: 'Asking the relays…',
        empty: 'No record signed by you was observed on these relays. That is not a claim that none exists.',
        queryFailed: 'The query did not complete, so the number of records is unknown, not zero. Nothing was observed.',
        unavailable: 'Not one relay could be reached, so nothing was observed at all.',
        truncated: 'Read up to the ceiling of {limit} records. There may be more than this list shows.',
        count: '{count} records',
        coordinate: 'Identifier d',
        updatedAt: 'Last updated'
      },
      viewer: {
        label: 'Viewer sign-in state', signedIn: 'Signed in', signedOut: 'Not signed in',
        signIn: 'Sign in with NIP-07', signingIn: 'Connecting…', signOut: 'Sign out',
        reasonDetail: '{reason} (extension said: {detail})',
        reasons: {
          noExtension: 'No NIP-07 extension found (this browser has no window.nostr).',
          rejected: 'The NIP-07 extension did not allow sharing the public key.',
          error: 'The NIP-07 extension returned an error.',
          timeout: 'The NIP-07 extension did not answer within {seconds} seconds.',
          badKey: 'The NIP-07 extension returned a value that is not a readable public key.'
        }
      }, galleryTitle: 'Review images for {name}', galleryEmpty: 'No images have been attached yet.', enlarge: 'Enlarge', originalReview: 'Original review', imageTitle: 'Review image', remainingGallery: 'Open gallery including {count} more', imageAlt: 'Review image by {author} on {date}', voteBreakdown: 'Vote breakdown', communityVotes: 'Community votes', helpfulVotes: 'Helpful', unhelpfulVotes: 'Not helpful', toastLiked: 'Like updated', toastLikeUnconfirmed: 'A relay accepted it, but it has not been read back yet', toastLikeFailed: 'The like could not be sent', likeAdd: 'Like (publishes a kind 7 to the relays)', likeRetract: 'Remove like (publishes a kind 5 to the relays)', likeSending: 'Sending…', likeNeedsSigner: 'Liking needs a NIP-07 extension', likeNeedsSignIn: 'Sign in with NIP-07 to like', likeNoTarget: 'This row states no coordinate to react to', toastBookmarked: 'Bookmark updated', toastVoted: 'Vote updated', toastPublic: 'Visibility updated', compareLimit: 'You can compare up to three', loading: 'Loading feature support…', emptyState: 'There are no candidates', errorState: 'Feature information could not be loaded', retry: 'Retry', partialState: 'Showing part of the candidate list.', offlineState: 'Showing saved candidates.', offlineBanner: 'Offline: showing saved candidates.', staleState: 'Showing records observed earlier; the current round could not be completed.', incompleteState: 'Some relay results did not complete, so this list is partial.', unavailableState: 'No displayable record was observed on the configured relays. That is not a claim that none exists.', sampleData: 'Sample', relayVerified: 'Relay-verified', relayEmptyTitle: 'No matching record', relayEmpty: 'No kind 30078 record carrying the queried topic was observed on the configured relays. That is not a claim that none exists.', relayDiagnostics: 'Relay diagnostics', relayNoData: 'Relay results could not be retrieved.', relayReload: 'Refetch from relays', relayRelays: 'Relays and coverage', relayCurators: 'Recommenders in your network', relayNoCuration: 'No kind 30267 set was observed', relayManualCurators: 'Manually counted pubkeys', relayCuratorSets: 'Sets', relayCuratorSetsValue: '{used} / {observed}', relayCuratorMembers: 'Members', relayGraph: 'Social graph', relayGraphState: 'State', relayGraphCoverage: 'Coverage', relayGraphFollows: 'Graph size |G|', relayGraphFollowsValue: '{used} of {total}', relayGraphMalformed: 'Malformed p tags', relayViewer: 'Viewer key', relayViewerSource: 'Key source', relayRounds: 'Rounds', relayChunks: 'Chunks', relayQuarantined: 'Quarantined', relayUnresolved: 'Recommended but unobserved coordinates', relaySlugs: 'Diagnostics', relayAsOf: 'As of', relayReqs: 'REQ counts', relayLogical: 'Logical REQs', relayPhysical: 'Physical REQs', relayHttp: 'HTTP attempts', relayCache: 'Cache hits', relayReason: 'Reason', discoveryScope: 'Records that published topic “{topics}” on your relays — not all tools.', recommendations: 'Recommended by {count} in your network', recommendationsUnknown: 'Recommendations: unknown (needs a follow list)', graphNoneBanner: 'Not personalised — recommendation counts need a follow list. Connect a Nostr key, or paste an npub to rank in read-only mode.', graphConnect: 'Connect a Nostr key (NIP-07)', graphPasteLabel: 'npub or hex', graphApply: 'Rank with this key', graphStateLine: 'Graph: {state} ({coverage} · {used} of {total} in your graph)', graphStateLineShort: 'Graph: {state} ({coverage})', graphStates: {none: 'none', 'self-only': 'self-only', tier1: 'tier1', 'tier1+tier2': 'tier1+tier2'}, graphCoverage: {fresh: 'fresh', stale: 'stale', incomplete: 'incomplete', truncated: 'truncated', unknown: 'unknown'}, coverage: {eose: 'Complete (EOSE)', timeout: 'Timeout', error: 'Error', 'auth-required': 'Auth required', rejected: 'Rejected', disconnected: 'Disconnected', skipped: 'Not issued'},
      features: {posts: ['Posts & replies', 'Read, write, and reply on a timeline', 'timeline post reply'], dm: ['DM', 'Send encrypted direct messages', 'encrypted DM direct message'], search: ['Search', 'Find posts, people, and identifiers', 'search person identifier'], media: ['Images & video', 'View and publish images or video', 'media image video'], notifications: ['Notifications', 'Notice replies, reactions, and zaps', 'notification reaction'], accounts: ['Multiple accounts', 'Switch between keys and profiles', 'multi account'], signing: ['External signing', 'Keep private keys separate from the app', 'remote signing'], wallet: ['Wallet & Zap', 'Use zaps and wallet connections', 'payment tip'], longform: ['Long-form', 'Write articles and longer content', 'article long form'], community: ['Channels', 'Talk and organize in communities', 'channel community']},
      reviewsSeed: {aBody: 'Readable across devices, and notification settings were easy to find.', bBody: 'The path from search results back to a profile was clear.', cBody: 'It was easy to follow the conversation alongside images.', aBio: 'Reviews client navigation and accessibility across several operating systems.', bBio: 'Records first-use and comparison findings.', aSpread: '28 months · 11 categories · Web/Desktop/Mobile', bSpread: '9 months · 6 categories · mostly Web', aPosts: '2–9 per month: short posts, images, and notes.', bPosts: '1–4 per month: comparisons and replies.', localName: 'You', localBio: 'Reviews added on this screen.', screenTimeline: 'Timeline', screenSettings: 'Settings', screenMedia: 'Media view'},
      /* issue #1 / #21: sort orders. Only keys that name something the records
         state. There is no "newest release" — the records publish no date of
         their own. What they do carry is the event's created_at, the moment they
         were collected, and that is exactly what these two keys are called. */
      sort: {
        label: 'Sort by',
        'default': 'Default order',
        'name-asc': 'Name (A→Z)', 'name-desc': 'Name (Z→A)',
        'likes-desc': 'Most liked', 'likes-asc': 'Fewest liked',
        'collected-desc': 'Newest collected', 'collected-asc': 'Oldest collected',
        /* One sentence per dimension: what the set-aside rows are missing differs. */
        unranked: {
          likes: {
            heading: 'Likes: not observed',
            notice: '{count} entries have no observed like count and are left out of this order (that is not the same as zero).'
          },
          collected: {
            heading: 'Collection date: not observed',
            notice: '{count} entries carry no collection date and are left out of this order (that is not the same as being the oldest).'
          }
        }
      },
      summaryAbsent: 'No summary published', freeTopic: 'A topic the record published; this client ships no label for it.',
      recordState: 'Record state', recordStateFilter: 'Record state', recordStateHelp: 'A separate axis from project liveness.',
      liveness: 'Project liveness', livenessDerived: 'Liveness check: {value}',
      livenessFromSource: 'Grounds for reachable: {url} (a response was recorded on {date})',
      livenessUncounted: 'No social graph, so none of the {count} recorded observations is counted.',
      capabilityClaims: 'Capability claims', noClaimPublished: 'No capability claim published', noNipClaims: 'No NIP claims recorded',
      claimFamilyCount: '{count} {family} claims', claimSource: 'Claim source', claimCaveats: 'Verbatim caveats from the source', caveat: 'Caveat',
      basis: 'Claim basis', assertedAt: 'Claim fetched', notation: 'Source notation', sourceText: 'Verbatim source line',
      registryStatus: 'Registry resolution', registryDeprecated: 'unrecommended in the registry',
      notInRegistry: 'not in the pinned registry snapshot {revision}',
      noRegistrySnapshot: 'no registry snapshot for family {family}',
      primarySources: 'Sources', noOfficialLinks: 'No link is recorded',
      noReviewsObserved: 'No reviews observed', collectedData: 'From primary sources',
      platformSourced: 'Matches only entries with a recorded platform.',
      topicCorrection: 'Collected topics: {collected} —',
      nonClaim: {modules: 'Modules named after NIPs (not a support claim)', crates: 'Crates named after NIPs (not a support claim)'},
      nipPurposes: {'01': 'Basic events, signatures, and client/relay messages', '02': 'Follow lists using kind 3', '05': 'Verification between DNS identifiers and public keys', '09': 'Event deletion requests using kind 5', '11': 'Relay information retrieved over HTTP', '19': 'bech32 identifiers such as npub and note', '21': 'Identifier links using the nostr: URI scheme', '23': 'Long-form content using kind 30023', '25': 'Reactions using kind 7', '42': 'Client authentication to relays', '44': 'Versioned encrypted payloads', '46': 'Remote signing with private keys kept separate', '47': 'Remote Lightning wallet connections', '57': 'Lightning payments using zap requests and receipts', '65': 'Read/write relay lists using kind 10002', '78': 'Storage for app-specific data'}
    }
  }
};
const valid = (value: unknown): value is Language =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(dictionaries, value);

function detectLanguage(): Language {
  let stored: string | null;
  try {
    stored = sessionStorage.getItem('nosmaps.language');
  } catch {
    stored = null;
  }
  if (valid(stored)) return stored;
  const candidates = [...(navigator.languages ?? []), navigator.language ?? ''];
  const detected = candidates.find(item => /^(ja|en)\b/i.test(item));
  return /^en\b/i.test(detected ?? '') ? 'en' : 'ja';
}

let language: Language = detectLanguage();
const listeners = new Set<(next: Language) => void>();

/* Walking a path can pass a leaf or run off the end of a list, and both mean
   "nothing here". The step reads the node as a lookup table only when it really
   is one, so a miss yields undefined instead of throwing. */
function read(object: I18nNode | undefined, path: string): I18nNode | undefined {
  return path.split('.').reduce<I18nNode | undefined>((value, key) => {
    if (value === undefined || typeof value === 'string') return undefined;
    if (Array.isArray(value)) {
      const index = Number(key);
      return Number.isInteger(index) ? value[index] : undefined;
    }
    return (value as {readonly [k: string]: I18nNode | undefined})[key];
  }, object);
}

function format(value: string, variables: I18nVariables = {}): string {
  return value.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const supplied = variables[key];
    return supplied === undefined ? `{${key}}` : String(supplied);
  });
}

/* Missing-key contract: a lookup that resolves to nothing is reported, never
   rendered. t() is the only lookup whose result reaches markup, so it always
   returns a string -- the key path itself when the key is missing, which is
   visible, greppable and searchable, unlike the "undefined" that String() used
   to produce silently. */
const missing: I18nMissing[] = [];
const reported = new Set<string>();

function reportMissing(path: string, selectedLanguage: Language, detail: string): void {
  const signature = `${selectedLanguage}:${path}:${detail}`;
  missing.push({path, language: selectedLanguage, detail});
  if (reported.has(signature)) return;
  reported.add(signature);
  console.error(`[nosmaps i18n] ${detail}: "${path}" (language: ${selectedLanguage})`);
}

export const i18n = {
  get language(): Language { return language; },
  get dictionaries(): {readonly [K in Language]: I18nNode} { return dictionaries; },
  get missing(): I18nMissing[] { return missing.map(entry => ({...entry})); },

  has(path: string, selectedLanguage: Language = language): boolean {
    return read(dictionaries[selectedLanguage], path) !== undefined
      || read(dictionaries.ja, path) !== undefined;
  },

  /** The raw node, undefined and all: `value` is the lookup that is allowed to
      come back empty, and saying so is what stops a miss from being stringified
      further down. Callers that reach markup go through `t`, which has no hole. */
  value(path: string, selectedLanguage: Language = language): I18nNode | undefined {
    const found = read(dictionaries[selectedLanguage], path) ?? read(dictionaries.ja, path);
    if (found === undefined) reportMissing(path, selectedLanguage, 'missing translation key');
    return found;
  },

  /** Always a string, per the missing-key contract above -- the key path stands
      in for a missing or non-string key. Declaring the return type is what makes
      handing `found` straight back an error rather than a silent "undefined". */
  t(path: string, variables?: I18nVariables, selectedLanguage: Language = language): string {
    const found = i18n.value(path, selectedLanguage);
    if (typeof found === 'string') return format(found, variables);
    if (found !== undefined) {
      reportMissing(path, selectedLanguage, 'translation key is not a string');
    }
    return path;
  },

  set(next: unknown): void {
    if (!valid(next) || next === language) return;
    language = next;
    try {
      sessionStorage.setItem('nosmaps.language', language);
    } catch { /* a browser that refuses storage still switches language */ }
    document.documentElement.lang = language;
    listeners.forEach(listener => listener(language));
  },

  onChange(listener: (next: Language) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  applyDocument(): void { document.documentElement.lang = language; }
};

i18n.applyDocument();
