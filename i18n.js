/* Central browser-only translations shared by all public concepts. */
(() => {
  'use strict';

  const dictionaries = {
    ja: {
      localeName: '日本語', otherLocale: 'English', language: '言語', skip: '本文へスキップ', close: '閉じる',
      all: 'すべて', none: 'なし', unknown: '不明', optional: '任意', reset: '条件をリセット', remove: '外す', add: '追加', replace: '入れ替え',
      title: 'nosmaps — Nostrツールを見つける', description: '目的・カテゴリ・機能からNostr周辺ツールを探して比較できます。',
      nav: {home: '4つの探し方', explorer: '機能から探す', submit: '候補を提案', curate: '推薦コメント', correction: '情報を訂正'},
      categories: {
        clients: {name: 'クライアント', icon: 'smartphone', description: 'タイムラインや投稿を扱うクライアント。'},
        relay: {name: 'リレー運用', icon: 'dns', description: 'リレーの設定や接続状況を確認する運用ツール。'},
        identity: {name: 'ID・鍵管理', icon: 'key', description: '鍵とプロフィールを管理する補助ツール。'},
        media: {name: '画像・動画', icon: 'movie', description: '作品やメディアを公開する制作ツール。'},
        analytics: {name: '観測・分析', icon: 'analytics', description: 'イベントや接続傾向を可視化する観測ツール。'},
        dev: {name: '開発者向け', icon: 'code', description: 'NIPやイベントを確認する開発ツール。'}
      },
      purposes: [
        {id: 'read', label: 'まず読む'}, {id: 'talk', label: '仲間と話す'}, {id: 'publish', label: '作品を公開'},
        {id: 'community', label: 'コミュニティ運営'}, {id: 'keys', label: '自分の鍵を守る'}, {id: 'relay', label: 'リレーを管理'},
        {id: 'observe', label: 'データを観測'}, {id: 'build', label: 'アプリを作る'}
      ],
      statuses: {active: '稼働中', stale: '更新停滞', dead: '終了／到達不能', unknown: '不明'},
      support: {implemented: '対応', partial: '部分対応', planned: '予定', unknown: '不明'},
      evidence: {
        implemented: '主要な操作とイベント形式を確認', partial: '主要な操作を確認し、一部は確認待ち',
        planned: '公開された計画に対応候補として記載', unknown: '確認材料が足りないため保留'
      },
      observers: {crawler: 'Nosmaps観測', community: 'コミュニティレビュー', maintainer: 'メンテナー申告'},
      concepts: {
        heroKicker: '4つの探し方 · 36ツール', heroTitle: 'Nostrの道具を、\nどう見つけたい？', heroLead: '目的、比較、カテゴリ、機能。今の探し方に近い入口から始められます。',
        gridLabel: '探し方を選ぶ', target: '向いている人', open: '{letter}を開く',
        A: {title: '目的から探す', target: '初めて使う人', summary: 'やりたいことを選び、用語を知らなくても候補へ進めます。', points: ['目的から開始', '短い候補一覧', '次の一歩を確認']},
        B: {title: '一覧・絞り込み・比較', target: '候補を効率よく比べたい人', summary: '複数条件と3件比較で、判断に必要な差を確認できます。', points: ['複数条件で絞り込み', '最大3件を比較', '根拠を一覧で確認']},
        C: {title: 'カテゴリを辿る探索', target: '周辺領域も見つけたい人', summary: '分類を歩き、検索語を決めずに道具と出会えます。', points: ['カテゴリから探索', '関連領域へ移動', 'カードから詳細へ']},
        D: {title: '機能探索・比較', target: '代替や別候補を探す人', summary: '使いたい機能から候補を逆引きし、NIPの根拠と機能差を比較できます。', points: ['複数機能をAND検索', '終了候補を初期除外', 'NIPの根拠へ移動']},
        principles: [{title: '共通の36件', text: 'どの入口でも同じ候補を探せます。'}, {title: '根拠を確認', text: '状態と観測日時を詳細・比較に表示します。'}, {title: '静的に配信', text: 'ブラウザだけで操作できます。'}],
        mode: 'コンセプト {letter}', switchMode: '探し方を切り替える', purposeTitle: '今日は何をしたい？', purposeHelp: '近いものをひとつ選んでください。', allPurposes: '全部見る',
        search: 'キーワード検索', searchPlaceholder: '名前・特徴で検索', categoryFilter: 'カテゴリで絞り込む', allCategoriesDescription: 'すべてのカテゴリから探します。', status: '状態', platform: '環境', sort: '並び順', name: '名前',
        results: '{count}件の候補', exploring: '{count}件を探索中', categoryTrail: '全領域', discoveryFeed: '発見フィード', detail: '詳細を見る', compare: '比較', compareAdd: '比較に追加',
        selected: '{count}件を選択', compareRecommended: '2〜3件', compareOpen: '比較する', clear: '解除', noResults: '候補が見つかりません', noResultsHelp: '条件を減らすか、別の言葉で試してください。',
        observed: '観測 {date}', basis: '根拠', observedAt: '最終観測日時', method: '判定方法', platformLabel: '対応環境', license: 'ライセンス', observationLog: '観測ログ', item: '項目',
        contribution: {submit: ['候補を提案', '新しい道具の情報'], curate: ['推薦コメント', '掲載候補へのコメント'], correction: ['情報を訂正', '作者からの修正内容'], name: '対象名', namePlaceholder: '例：新しいツール', category: 'カテゴリ', note: '内容', notePlaceholder: '確認してほしい内容や根拠', author: '作者として提案する', review: '内容を確認', confirmed: '内容を確認しました'},
        toastAdded: '比較候補に追加しました', compareLimit: '比較は最大3件です'
      },
      explorer: {
        pageTitle: 'Nosmaps — 機能から探す', pageDescription: '機能からNostrツール候補を探し、NIPの根拠と機能差を比較できます。', location: '機能から探す', back: '4つの探し方へ戻る',
        search: 'アプリ／サービスを全文検索', searchPlaceholder: '名称・概要・カテゴリ・OS・提供形態・別名', featureGroup: '主要機能（複数選択・AND条件）', categoryGroup: 'カテゴリで絞り込む', allCategoriesDescription: 'すべてのカテゴリから探します。',
        candidates: '候補', noFeature: '機能は未選択：すべての候補を表示', featureAnd: '機能条件（すべてAND）', viewNips: 'NIPを見る', activeAnd: '有効な条件（すべてAND）', noExtra: '追加条件なし',
        settings: '詳細設定', platform: 'OS／環境', updateStatus: '更新状態', activeStatus: '稼働・停滞・不明', support: '機能対応', featureNeeded: '機能を1つ以上選ぶと使えます。', delivery: '提供形態', webApp: 'Webアプリ', installed: 'インストール型', mobileApp: 'モバイルアプリ', oss: 'OSS', includeDead: '終了／到達不能も含める', savedOnly: 'ブックマーク済みだけ', nipSearch: 'NIP番号・名称', unknownInfo: '「不明」について', unknownHelp: '材料不足で判定を保留した状態です。非対応を意味しません。終了／到達不能は選んだ場合だけ表示します。',
        selectedCount: '{count}件を選択（最大3件）', compareByFeature: '機能で比較', clearSelection: '選択解除', evidenceTitle: '技術的な裏付け', primarySource: '公式NIP一次資料', chooseForNips: '機能を選ぶと、関連するNIPの一次資料を表示します。',
        facts: '事実・観測', evaluations: '利用者評価', noFeatureCondition: '機能条件なし', category: 'カテゴリ', observed: '最終観測', officialLinks: '{name}の公式情報', site: '公式サイト', distribution: 'アプリ配布', docs: '公式Docs', source: 'ソース', linkDetails: '{type}の情報', displayUrl: 'URL', checkedAt: '最終確認日時',
        like: 'いいね {count}', bookmark: 'ブックマーク', bookmarked: 'ブックマーク済み', reviews: 'レビュー {count}', privateDefault: '非公開', public: '公開', publicToggle: '公開にする',
        endedRecord: '終了／到達不能の記録。', alternatives: '同じ機能の稼働候補へ戻る', compareAdd: '比較に追加', details: '詳細・根拠',
        count: '{count}件', noMatch: '条件に合う候補がありません', noMatchHelp: '上の条件を1件ずつ外して広げられます。', removeGets: '「{label}」を外すと {count}件', resetAll: 'すべての条件をリセット',
        conditionFeature: '機能「{value}」', conditionQuery: '全文検索「{value}」', conditionPlatform: 'OS／環境「{value}」', conditionCategory: 'カテゴリ「{value}」', conditionStatus: '更新状態「{value}」', conditionSupport: '機能対応「{value}」', conditionDelivery: '提供形態「{value}」', conditionOss: 'OSS「{value}」', conditionDead: '終了／到達不能を含む', conditionSaved: 'ブックマーク済みだけ', conditionNip: 'NIP「{value}」', conditionRemove: '{label}を外す',
        detailKicker: '対応の根拠', supportFor: '{feature}への対応', observer: '観測主体', nipPurpose: 'NIPの用途', state: '状態', os: 'OS／環境', license: 'ライセンス',
        compareTitle: '{count}件の機能比較', differencesFirst: '差がある項目を先に表示します。', removeCandidate: '{name}を比較から外す', removeShort: '外す', alternative: '別の候補', replaceTarget: '入れ替える候補', addComparison: '比較に追加', replaceComparison: '選んだ候補と入れ替え', needTwo: '比較するには2件以上を選んでください。', featuresSection: '機能', basicsSection: '基本情報', nipEvidence: 'NIP裏付け',
        reviewTitle: '{name}のレビュー', reviewCount: '{count}件', openGallery: '画像ギャラリー', reviewer: '投稿者', postedAt: '投稿日時', use: '用途', rating: '評価', appVersion: 'アプリversion', notEntered: '未入力', helpful: '役に立った {count}', unhelpful: '立たなかった {count}', voters: '評価者{count}人・内訳', writeReview: 'レビューを追加', body: '本文', bodyPlaceholder: '使った場面や気づいたこと', image: '画像', chooseImage: '画像を選ぶ', deviceImage: '端末から選ぶ', osOptional: '対象OS（任意）', versionOptional: 'version（任意）', useOptional: '用途（任意）', ratingOptional: '評価（任意）', createReview: 'レビューを追加', chooseBodyOrImage: '本文か画像を選んでください。', addedReview: 'レビューを追加しました', imageOnly: '本文なし（画像のみ）',
        profileTitle: 'レビュアープロフィール', joined: '利用開始', activity: '投稿履歴の広がり', posting: '投稿傾向', voteHistory: '過去レビューと役立ち内訳', history: 'レビュー履歴',
        galleryTitle: '{name}のレビュー画像', galleryEmpty: '添付画像はまだありません。', enlarge: '拡大', originalReview: '元レビュー', imageTitle: 'レビュー画像', remainingGallery: '残り{count}件を含む画像ギャラリーを開く', imageAlt: '{author}・{date}のレビュー画像',
        voteBreakdown: '役立ち評価の内訳', communityVotes: 'コミュニティの評価', helpfulVotes: '役に立った', unhelpfulVotes: '立たなかった',
        toastLiked: 'いいねを更新しました', toastBookmarked: 'ブックマークを更新しました', toastVoted: '評価を更新しました', toastPublic: '公開範囲を更新しました', compareLimit: '比較は最大3件です',
        loading: '機能対応情報を読み込み中…', emptyState: '候補は0件です', errorState: '対応情報を取得できませんでした', retry: '再試行', partialState: '一部の候補を表示しています。', offlineState: '保存済みの候補を表示しています。', offlineBanner: 'オフライン：保存済みの候補を表示しています。',
        staleState: '以前に検証済みの世代を表示しています。現在のポインタまたはブロブを完全には検証できませんでした。', incompleteState: '一部のリレー応答が揃わなかったため、結果は不完全です。', unavailableState: '設定したリレーで検証済みのカタログを表示できませんでした。',
        sampleData: 'サンプル', relayVerified: 'リレー検証済み', relayEmptyTitle: '検証済みカタログなし', relayEmpty: '設定したリレーでは検証済みのカタログが見つかりませんでした。',
        relayDiagnostics: 'リレー診断', relayNoData: 'リレー結果を取得できませんでした。', relayReload: 'リレーから再取得', relayRelays: 'リレーとカバレッジ', relayCurators: 'キュレーター', relayPointer: 'ポインタID', relayGeneration: '世代', relayBlob: 'ブロブSHA-256', relayVerifiedAt: '検証時刻', relayAsOf: 'as-of', relayReqs: 'REQ集計', relayLogical: '論理REQ', relayPhysical: '物理REQ', relayHttp: 'HTTP試行', relayCache: 'キャッシュヒット', relayReason: '理由', relayCuratorStatus: '状態',
        coverage: {eose: '完了 (EOSE)', timeout: 'タイムアウト', error: 'エラー', 'auth-required': '認証要求', rejected: '拒否', disconnected: '切断'},
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
      nav: {home: 'Four ways to explore', explorer: 'Explore features', submit: 'Suggest a tool', curate: 'Recommendation', correction: 'Correct information'},
      categories: {
        clients: {name: 'Clients', icon: 'smartphone', description: 'Clients for timelines and publishing.'}, relay: {name: 'Relay operations', icon: 'dns', description: 'Tools for relay configuration and connectivity.'}, identity: {name: 'Identity & keys', icon: 'key', description: 'Tools for keys and profiles.'}, media: {name: 'Media', icon: 'movie', description: 'Tools for publishing creative media.'}, analytics: {name: 'Analytics', icon: 'analytics', description: 'Tools for observing events and connections.'}, dev: {name: 'Developer tools', icon: 'code', description: 'Tools for inspecting NIPs and events.'}
      },
      purposes: [{id: 'read', label: 'Read first'}, {id: 'talk', label: 'Talk with others'}, {id: 'publish', label: 'Publish work'}, {id: 'community', label: 'Run a community'}, {id: 'keys', label: 'Protect my keys'}, {id: 'relay', label: 'Manage relays'}, {id: 'observe', label: 'Observe data'}, {id: 'build', label: 'Build an app'}],
      statuses: {active: 'Active', stale: 'Stale', dead: 'Ended / unreachable', unknown: 'Unknown'},
      support: {implemented: 'Supported', partial: 'Partial', planned: 'Planned', unknown: 'Unknown'},
      evidence: {implemented: 'Core interaction and event format confirmed', partial: 'Core interaction confirmed; some cases pending', planned: 'Listed as a candidate in the published plan', unknown: 'Held pending more evidence'},
      observers: {crawler: 'Nosmaps observation', community: 'Community review', maintainer: 'Maintainer statement'},
      concepts: {
        heroKicker: 'Four paths · 36 tools', heroTitle: 'How do you want to\nfind a Nostr tool?', heroLead: 'Start with the path closest to your task: goal, comparison, category, or feature.', gridLabel: 'Choose an exploration path', target: 'Best for', open: 'Open {letter}',
        A: {title: 'Explore by goal', target: 'People getting started', summary: 'Choose what you want to do and reach candidates without knowing the terminology.', points: ['Start with a goal', 'Short candidate list', 'See the next step']},
        B: {title: 'Filter and compare', target: 'People evaluating options', summary: 'Use several filters and a three-way comparison to see meaningful differences.', points: ['Combine filters', 'Compare up to three', 'Check evidence inline']},
        C: {title: 'Browse categories', target: 'People exploring adjacent areas', summary: 'Walk through categories and discover tools without choosing a search phrase.', points: ['Browse by category', 'Move to adjacent areas', 'Open details from cards']},
        D: {title: 'Explore and compare features', target: 'People seeking alternatives', summary: 'Find candidates from desired features and compare feature differences with NIP evidence.', points: ['AND multiple features', 'Hide ended options initially', 'Follow NIP evidence']},
        principles: [{title: 'The same 36', text: 'Every path explores the same candidates.'}, {title: 'Evidence in view', text: 'Details and comparisons show status dates and evidence.'}, {title: 'Static delivery', text: 'Everything works in the browser.'}],
        mode: 'Concept {letter}', switchMode: 'Switch exploration path', purposeTitle: 'What would you like to do?', purposeHelp: 'Choose the closest option.', allPurposes: 'Show all', search: 'Keyword search', searchPlaceholder: 'Search name or characteristic', categoryFilter: 'Filter by category', allCategoriesDescription: 'Browse tools from every category.', status: 'Status', platform: 'Platform', sort: 'Sort', name: 'Name', results: '{count} candidates', exploring: 'Exploring {count}', categoryTrail: 'All areas', discoveryFeed: 'Discovery feed', detail: 'View details', compare: 'Compare', compareAdd: 'Add to comparison', selected: '{count} selected', compareRecommended: '2–3 recommended', compareOpen: 'Compare', clear: 'Clear', noResults: 'No candidates found', noResultsHelp: 'Remove a condition or try another phrase.', observed: 'Observed {date}', basis: 'Evidence', observedAt: 'Last observed', method: 'Assessment method', platformLabel: 'Platforms', license: 'License', observationLog: 'Observation log', item: 'Item',
        contribution: {submit: ['Suggest a tool', 'Information about a new tool'], curate: ['Recommendation', 'A comment about a candidate'], correction: ['Correct information', 'A correction from the author'], name: 'Name', namePlaceholder: 'Example: a new tool', category: 'Category', note: 'Details', notePlaceholder: 'What should be checked and why', author: 'I am the author', review: 'Review details', confirmed: 'Details reviewed'}, toastAdded: 'Added to comparison', compareLimit: 'You can compare up to three'
      },
      explorer: {
        pageTitle: 'Nosmaps — Explore by feature', pageDescription: 'Find Nostr tools by feature and compare differences with NIP evidence.', location: 'Explore by feature', back: 'Back to four exploration paths', search: 'Search apps and services', searchPlaceholder: 'Name, summary, category, OS, delivery, alias', featureGroup: 'Core features (multiple selection uses AND)', categoryGroup: 'Filter by category', allCategoriesDescription: 'Browse tools from every category.', candidates: 'Candidates', noFeature: 'No feature selected: showing all candidates', featureAnd: 'Feature filters (all AND)', viewNips: 'View NIPs', activeAnd: 'Active filters (all AND)', noExtra: 'No additional filters', settings: 'More filters', platform: 'OS / platform', updateStatus: 'Update status', activeStatus: 'Active, stale, or unknown', support: 'Feature support', featureNeeded: 'Select at least one feature to use this filter.', delivery: 'Delivery', webApp: 'Web app', installed: 'Installed app', mobileApp: 'Mobile app', oss: 'OSS', includeDead: 'Include ended / unreachable', savedOnly: 'Bookmarked only', nipSearch: 'NIP number or name', unknownInfo: 'About “Unknown”', unknownHelp: 'Unknown means the evidence is insufficient, not unsupported. Ended or unreachable entries appear only when selected.', selectedCount: '{count} selected (maximum 3)', compareByFeature: 'Compare features', clearSelection: 'Clear selection', evidenceTitle: 'Technical evidence', primarySource: 'Official NIP source', chooseForNips: 'Select a feature to show related primary NIP sources.', facts: 'Facts & observations', evaluations: 'User evaluations', noFeatureCondition: 'No feature filter', category: 'Category', observed: 'Last observed', officialLinks: 'Official information for {name}', site: 'Official site', distribution: 'Distribution', docs: 'Official docs', source: 'Source', linkDetails: '{type} information', displayUrl: 'URL', checkedAt: 'Last checked', like: 'Like {count}', bookmark: 'Bookmark', bookmarked: 'Bookmarked', reviews: 'Reviews {count}', privateDefault: 'Private', public: 'Public', publicToggle: 'Make public', endedRecord: 'Ended / unreachable record.', alternatives: 'Return to active candidates with these features', compareAdd: 'Add to comparison', details: 'Details & evidence', count: '{count}', noMatch: 'No candidates match these filters', noMatchHelp: 'Remove filters one at a time to broaden the results.', removeGets: 'Remove “{label}” for {count} results', resetAll: 'Reset every filter', conditionFeature: 'Feature “{value}”', conditionQuery: 'Full-text “{value}”', conditionPlatform: 'OS / platform “{value}”', conditionCategory: 'Category “{value}”', conditionStatus: 'Update status “{value}”', conditionSupport: 'Feature support “{value}”', conditionDelivery: 'Delivery “{value}”', conditionOss: 'OSS “{value}”', conditionDead: 'Include ended / unreachable', conditionSaved: 'Bookmarked only', conditionNip: 'NIP “{value}”', conditionRemove: 'Remove {label}', detailKicker: 'Support evidence', supportFor: 'Support for {feature}', observer: 'Observer', nipPurpose: 'NIP purpose', state: 'Status', os: 'OS / platform', license: 'License', compareTitle: '{count}-way feature comparison', differencesFirst: 'Items that differ appear first.', removeCandidate: 'Remove {name} from comparison', removeShort: 'Remove', alternative: 'Another candidate', replaceTarget: 'Candidate to replace', addComparison: 'Add to comparison', replaceComparison: 'Replace selected candidate', needTwo: 'Choose at least two candidates to compare.', featuresSection: 'Features', basicsSection: 'Basic information', nipEvidence: 'NIP evidence', reviewTitle: 'Reviews for {name}', reviewCount: '{count} reviews', openGallery: 'Image gallery', reviewer: 'Reviewer', postedAt: 'Posted', use: 'Use', rating: 'Rating', appVersion: 'App version', notEntered: 'Not entered', helpful: 'Helpful {count}', unhelpful: 'Not helpful {count}', voters: '{count} voters · breakdown', writeReview: 'Add a review', body: 'Review', bodyPlaceholder: 'Where you used it and what you noticed', image: 'Image', chooseImage: 'Choose an image', deviceImage: 'Choose from device', osOptional: 'OS (optional)', versionOptional: 'Version (optional)', useOptional: 'Use (optional)', ratingOptional: 'Rating (optional)', createReview: 'Add review', chooseBodyOrImage: 'Choose text or an image.', addedReview: 'Review added', imageOnly: 'No text (image only)', profileTitle: 'Reviewer profile', joined: 'Joined', activity: 'Activity span', posting: 'Posting pattern', voteHistory: 'Review and vote history', history: 'Review history', galleryTitle: 'Review images for {name}', galleryEmpty: 'No images have been attached yet.', enlarge: 'Enlarge', originalReview: 'Original review', imageTitle: 'Review image', remainingGallery: 'Open gallery including {count} more', imageAlt: 'Review image by {author} on {date}', voteBreakdown: 'Vote breakdown', communityVotes: 'Community votes', helpfulVotes: 'Helpful', unhelpfulVotes: 'Not helpful', toastLiked: 'Like updated', toastBookmarked: 'Bookmark updated', toastVoted: 'Vote updated', toastPublic: 'Visibility updated', compareLimit: 'You can compare up to three', loading: 'Loading feature support…', emptyState: 'There are no candidates', errorState: 'Feature information could not be loaded', retry: 'Retry', partialState: 'Showing part of the candidate list.', offlineState: 'Showing saved candidates.', offlineBanner: 'Offline: showing saved candidates.', staleState: 'Showing a previously verified generation; the current pointer or blob could not be fully verified.', incompleteState: 'Some relay results did not complete, so this list is partial.', unavailableState: 'No verified catalog could be shown from the configured relays.', sampleData: 'Sample', relayVerified: 'Relay-verified', relayEmptyTitle: 'No verified catalog', relayEmpty: 'No verified catalog was found on the configured relays.', relayDiagnostics: 'Relay diagnostics', relayNoData: 'Relay results could not be retrieved.', relayReload: 'Refetch from relays', relayRelays: 'Relays and coverage', relayCurators: 'Curators', relayPointer: 'Pointer id', relayGeneration: 'Generation', relayBlob: 'Blob SHA-256', relayVerifiedAt: 'Verified at', relayAsOf: 'As of', relayReqs: 'REQ counts', relayLogical: 'Logical REQs', relayPhysical: 'Physical REQs', relayHttp: 'HTTP attempts', relayCache: 'Cache hits', relayReason: 'Reason', relayCuratorStatus: 'Status', coverage: {eose: 'Complete (EOSE)', timeout: 'Timeout', error: 'Error', 'auth-required': 'Auth required', rejected: 'Rejected', disconnected: 'Disconnected'},
        features: {posts: ['Posts & replies', 'Read, write, and reply on a timeline', 'timeline post reply'], dm: ['DM', 'Send encrypted direct messages', 'encrypted DM direct message'], search: ['Search', 'Find posts, people, and identifiers', 'search person identifier'], media: ['Images & video', 'View and publish images or video', 'media image video'], notifications: ['Notifications', 'Notice replies, reactions, and zaps', 'notification reaction'], accounts: ['Multiple accounts', 'Switch between keys and profiles', 'multi account'], signing: ['External signing', 'Keep private keys separate from the app', 'remote signing'], wallet: ['Wallet & Zap', 'Use zaps and wallet connections', 'payment tip'], longform: ['Long-form', 'Write articles and longer content', 'article long form'], community: ['Channels', 'Talk and organize in communities', 'channel community']},
        reviewsSeed: {aBody: 'Readable across devices, and notification settings were easy to find.', bBody: 'The path from search results back to a profile was clear.', cBody: 'It was easy to follow the conversation alongside images.', aBio: 'Reviews client navigation and accessibility across several operating systems.', bBio: 'Records first-use and comparison findings.', aSpread: '28 months · 11 categories · Web/Desktop/Mobile', bSpread: '9 months · 6 categories · mostly Web', aPosts: '2–9 per month: short posts, images, and notes.', bPosts: '1–4 per month: comparisons and replies.', localName: 'You', localBio: 'Reviews added on this screen.', screenTimeline: 'Timeline', screenSettings: 'Settings', screenMedia: 'Media view'},
        nipPurposes: {'01': 'Basic events, signatures, and client/relay messages', '02': 'Follow lists using kind 3', '05': 'Verification between DNS identifiers and public keys', '09': 'Event deletion requests using kind 5', '11': 'Relay information retrieved over HTTP', '19': 'bech32 identifiers such as npub and note', '21': 'Identifier links using the nostr: URI scheme', '23': 'Long-form content using kind 30023', '25': 'Reactions using kind 7', '42': 'Client authentication to relays', '44': 'Versioned encrypted payloads', '46': 'Remote signing with private keys kept separate', '47': 'Remote Lightning wallet connections', '57': 'Lightning payments using zap requests and receipts', '65': 'Read/write relay lists using kind 10002', '78': 'Storage for app-specific data'}
      }
    }
  };

  const valid = language => Object.prototype.hasOwnProperty.call(dictionaries, language);
  let language;
  try { language = sessionStorage.getItem('nosmaps.language'); } catch (_) { language = null; }
  if (!valid(language)) {
    const detected = [...(navigator.languages || []), navigator.language || ''].find(item => /^(ja|en)\b/i.test(item));
    language = /^en\b/i.test(detected || '') ? 'en' : 'ja';
  }
  const listeners = new Set();
  const read = (object, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], object);
  const format = (value, variables = {}) => typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`) : value;
  const api = {
    get language() { return language; },
    get dictionaries() { return dictionaries; },
    value(path, selectedLanguage = language) { return read(dictionaries[selectedLanguage], path) ?? read(dictionaries.ja, path); },
    t(path, variables, selectedLanguage = language) { return format(api.value(path, selectedLanguage), variables); },
    set(next) {
      if (!valid(next) || next === language) return;
      language = next;
      try { sessionStorage.setItem('nosmaps.language', language); } catch (_) {}
      document.documentElement.lang = language;
      listeners.forEach(listener => listener(language));
    },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    applyDocument() { document.documentElement.lang = language; }
  };
  api.applyDocument();
  window.NOSMAPS_I18N = api;
})();
