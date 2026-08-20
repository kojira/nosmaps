// src/data/catalogue-data.ts
function looksLikeData(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return Array.isArray(candidate.tools) && typeof candidate.meta === "object";
}
function readCatalogueData() {
  const value = globalThis.NOSMAPS_DATA;
  if (!looksLikeData(value)) {
    throw new Error("nosmaps: data.js did not provide NOSMAPS_DATA");
  }
  return value;
}

// src/ui/i18n.ts
var dictionaries = {
  ja: {
    localeName: "\u65E5\u672C\u8A9E",
    otherLocale: "English",
    language: "\u8A00\u8A9E",
    skip: "\u672C\u6587\u3078\u30B9\u30AD\u30C3\u30D7",
    close: "\u9589\u3058\u308B",
    all: "\u3059\u3079\u3066",
    none: "\u306A\u3057",
    unknown: "\u4E0D\u660E",
    optional: "\u4EFB\u610F",
    reset: "\u6761\u4EF6\u3092\u30EA\u30BB\u30C3\u30C8",
    remove: "\u5916\u3059",
    add: "\u8FFD\u52A0",
    replace: "\u5165\u308C\u66FF\u3048",
    title: "nosmaps \u2014 Nostr\u30C4\u30FC\u30EB\u3092\u898B\u3064\u3051\u308B",
    description: "\u76EE\u7684\u30FB\u30AB\u30C6\u30B4\u30EA\u30FB\u6A5F\u80FD\u304B\u3089Nostr\u5468\u8FBA\u30C4\u30FC\u30EB\u3092\u63A2\u3057\u3066\u6BD4\u8F03\u3067\u304D\u307E\u3059\u3002",
    footer: { source: "GitHub\u3067\u30BD\u30FC\u30B9\u30B3\u30FC\u30C9\u3092\u898B\u308B", sourceNewTab: "GitHub\u3067\u30BD\u30FC\u30B9\u30B3\u30FC\u30C9\u3092\u898B\u308B\uFF08\u65B0\u3057\u3044\u30BF\u30D6\u3067\u958B\u304D\u307E\u3059\uFF09" },
    categories: {
      clients: { name: "\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8", icon: "smartphone", description: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u3084\u6295\u7A3F\u3092\u6271\u3046\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3002" },
      relay: { name: "\u30EA\u30EC\u30FC\u904B\u7528", icon: "dns", description: "\u30EA\u30EC\u30FC\u306E\u8A2D\u5B9A\u3084\u63A5\u7D9A\u72B6\u6CC1\u3092\u78BA\u8A8D\u3059\u308B\u904B\u7528\u30C4\u30FC\u30EB\u3002" },
      identity: { name: "ID\u30FB\u9375\u7BA1\u7406", icon: "key", description: "\u9375\u3068\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3092\u7BA1\u7406\u3059\u308B\u88DC\u52A9\u30C4\u30FC\u30EB\u3002" },
      media: { name: "\u753B\u50CF\u30FB\u52D5\u753B", icon: "movie", description: "\u4F5C\u54C1\u3084\u30E1\u30C7\u30A3\u30A2\u3092\u516C\u958B\u3059\u308B\u5236\u4F5C\u30C4\u30FC\u30EB\u3002" },
      analytics: { name: "\u89B3\u6E2C\u30FB\u5206\u6790", icon: "analytics", description: "\u30A4\u30D9\u30F3\u30C8\u3084\u63A5\u7D9A\u50BE\u5411\u3092\u53EF\u8996\u5316\u3059\u308B\u89B3\u6E2C\u30C4\u30FC\u30EB\u3002" },
      dev: { name: "\u958B\u767A\u8005\u5411\u3051", icon: "code", description: "NIP\u3084\u30A4\u30D9\u30F3\u30C8\u3092\u78BA\u8A8D\u3059\u308B\u958B\u767A\u30C4\u30FC\u30EB\u3002" },
      /* §21.6 R6: 41件のうち4件が発行者自身の言葉で「ウォレット」と名乗ったので seed に加えた唯一の語。 */
      wallet: { name: "\u30A6\u30A9\u30EC\u30C3\u30C8", icon: "wallet", description: "Bitcoin\u30FBLightning\u306E\u30A6\u30A9\u30EC\u30C3\u30C8\u3002" }
    },
    statuses: { active: "\u7A3C\u50CD\u4E2D", stale: "\u66F4\u65B0\u505C\u6EDE", dead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD", unknown: "\u4E0D\u660E" },
    /* §21.4 R4: レコードの状態（active / withdrawn）は「プロジェクトが生きているか」ではない。 */
    recordStates: { active: "\u516C\u958B\u4E2D\uFF08active\uFF09", withdrawn: "\u53D6\u308A\u4E0B\u3052\u6E08\u307F\uFF08withdrawn\uFF09" },
    liveness: { unknown: "\u4E0D\u660E", reachable: "\u5230\u9054\u53EF\u80FD", unreachable: "\u5230\u9054\u4E0D\u80FD", archived: "\u30A2\u30FC\u30AB\u30A4\u30D6\u6E08\u307F", moved: "\u79FB\u8EE2", superseded: "\u5F8C\u7D99\u3042\u308A" },
    /* §21.7 R7: 実データが持っていた8値。unknown は否定ではなく「一次情報が何も言っていない」。 */
    support: {
      supported: "\u5BFE\u5FDC",
      partial: "\u90E8\u5206\u5BFE\u5FDC",
      not_supported: "\u975E\u5BFE\u5FDC\uFF08\u660E\u793A\uFF09",
      not_applicable: "\u5BFE\u8C61\u5916",
      planned: "\u4E88\u5B9A",
      disabled: "\u5B9F\u88C5\u6E08\u307F\u30FB\u7121\u52B9",
      withdrawn: "\u5BFE\u5FDC\u53D6\u308A\u3084\u3081",
      unknown: "\u4E0D\u660E\uFF08\u4E3B\u5F35\u306A\u3057\uFF09",
      out_of_family: "\u5225\u306E\u4ED5\u69D8\u30D5\u30A1\u30DF\u30EA"
    },
    evidence: {
      supported: "\u4E00\u6B21\u60C5\u5831\u304C\u7121\u6761\u4EF6\u306B\u5BFE\u5FDC\u3092\u4E3B\u5F35\u3057\u3066\u3044\u307E\u3059\u3002",
      partial: "\u4E00\u6B21\u60C5\u5831\u304C\u5236\u9650\u3064\u304D\u3067\u5BFE\u5FDC\u3092\u4E3B\u5F35\u3057\u3066\u3044\u307E\u3059\u3002",
      not_supported: "\u4E00\u6B21\u60C5\u5831\u304C\u300C\u5BFE\u5FDC\u3057\u306A\u3044\u300D\u3068\u660E\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u6C88\u9ED9\u3088\u308A\u3082\u5F37\u3044\u8A00\u660E\u3067\u3059\u3002",
      not_applicable: "\u4E00\u6B21\u60C5\u5831\u304C\u300C\u3053\u306E\u4ED5\u69D8\u306F\u5F53\u3066\u306F\u307E\u3089\u306A\u3044\u300D\u3068\u8FF0\u3079\u3066\u3044\u307E\u3059\u3002\u5206\u6BCD\u306B\u306F\u6570\u3048\u307E\u305B\u3093\u3002",
      planned: "\u4E00\u6B21\u60C5\u5831\u304C\u4E88\u5B9A\u3068\u3057\u3066\u6319\u3052\u3066\u3044\u307E\u3059\u3002\u73FE\u6642\u70B9\u306E\u5B9F\u88C5\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      disabled: "\u5B9F\u88C5\u6E08\u307F\u3067\u3001\u65E2\u5B9A\u3067\u306F\u7121\u52B9\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002",
      withdrawn: "\u304B\u3064\u3066\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3057\u305F\u304C\u53D6\u308A\u4E0B\u3052\u3089\u308C\u307E\u3057\u305F\u3002",
      unknown: "\u4E00\u6B21\u60C5\u5831\u306F\u4F55\u3082\u8FF0\u3079\u3066\u3044\u307E\u305B\u3093\u3002\u975E\u5BFE\u5FDC\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      out_of_family: "\u4E3B\u5F35\u306F\u5225\u306E\u4ED5\u69D8\u30D5\u30A1\u30DF\u30EA\u306B\u3042\u308A\u307E\u3059\u3002NIP\u306E\u4E3B\u5F35\u306F\u8A18\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"
    },
    /* §21.2.3: id をピン留めしたスナップショットに照合した結果。落とさず、書き換えず、そのまま出す。 */
    registryStatus: { resolved: "\u30EC\u30B8\u30B9\u30C8\u30EA\u3067\u89E3\u6C7A", not_in_registry: "\u30EC\u30B8\u30B9\u30C8\u30EA\u306B\u7121\u3044", unresolvable: "\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u7121\u3057" },
    /* §21.1 R1: 主張の出どころ。転記は「そのプロジェクトが言った」ではなく「署名者が書き写した」。 */
    basis: { transcribed: "\u8EE2\u8A18\uFF08\u7F72\u540D\u8005\u304C\u8AAD\u3093\u3060\u6587\u66F8\u306E\u5199\u3057\uFF09", self_declared: "\u81EA\u5DF1\u7533\u544A", tested: "\u5B9F\u884C\u3057\u3066\u691C\u8A3C" },
    observers: { crawler: "Nosmaps\u89B3\u6E2C", community: "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u30EC\u30D3\u30E5\u30FC", maintainer: "\u30E1\u30F3\u30C6\u30CA\u30FC\u7533\u544A" },
    landing: {
      headline: "Nostr\u306E\u5730\u56F3\u3001\u3053\u3053\u306B\u3042\u308A\u307E\u3059\uFF01",
      lead: "\u76EE\u7684\u3084\u6A5F\u80FD\u304B\u3089\u3001Nostr\u306E\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u3092\u63A2\u3057\u3066\u6BD4\u3079\u3089\u308C\u307E\u3059\u3002",
      carouselTitle: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9",
      carouselLabel: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u306E\u7D39\u4ECB",
      slideLabel: "{name}\uFF08{index}\uFF0F{total}\uFF09",
      openEntry: "{name} \u306E\u8A73\u7D30\u3092\u958B\u304F",
      position: "{index} / {total}",
      previous: "\u524D\u306E\u9805\u76EE",
      next: "\u6B21\u306E\u9805\u76EE",
      category: "\u30AB\u30C6\u30B4\u30EA",
      platform: "\u5BFE\u5FDC\u74B0\u5883",
      explorerCta: "\u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      explorerHelp: "\u30A2\u30D7\u30EA\u30FB\u30B5\u30FC\u30D3\u30B9\u3092\u6A5F\u80FD\u3067\u7D5E\u308A\u8FBC\u307F\u3001NIP\u306E\u6839\u62E0\u307E\u3067\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002"
    },
    explorer: {
      pageTitle: "Nosmaps \u2014 \u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      pageDescription: "\u6A5F\u80FD\u304B\u3089Nostr\u30C4\u30FC\u30EB\u5019\u88DC\u3092\u63A2\u3057\u3001NIP\u306E\u6839\u62E0\u3068\u6A5F\u80FD\u5DEE\u3092\u6BD4\u8F03\u3067\u304D\u307E\u3059\u3002",
      location: "\u6A5F\u80FD\u304B\u3089\u63A2\u3059",
      back: "\u30C8\u30C3\u30D7\u30DA\u30FC\u30B8\u3078\u623B\u308B",
      search: "\u30A2\u30D7\u30EA\uFF0F\u30B5\u30FC\u30D3\u30B9\u3092\u5168\u6587\u691C\u7D22",
      searchPlaceholder: "\u540D\u79F0\u30FB\u6982\u8981\u30FB\u30AB\u30C6\u30B4\u30EA\u30FBOS\u30FB\u63D0\u4F9B\u5F62\u614B\u30FB\u5225\u540D",
      featureGroup: "\u4E3B\u8981\u6A5F\u80FD\uFF08\u8907\u6570\u9078\u629E\u30FBAND\u6761\u4EF6\uFF09",
      categoryGroup: "\u30AB\u30C6\u30B4\u30EA\u3067\u7D5E\u308A\u8FBC\u3080",
      allCategoriesDescription: "\u3059\u3079\u3066\u306E\u30AB\u30C6\u30B4\u30EA\u304B\u3089\u63A2\u3057\u307E\u3059\u3002",
      candidates: "\u5019\u88DC",
      noFeature: "\u6A5F\u80FD\u306F\u672A\u9078\u629E\uFF1A\u3059\u3079\u3066\u306E\u5019\u88DC\u3092\u8868\u793A",
      featureAnd: "\u6A5F\u80FD\u6761\u4EF6\uFF08\u3059\u3079\u3066AND\uFF09",
      viewNips: "NIP\u3092\u898B\u308B",
      activeAnd: "\u6709\u52B9\u306A\u6761\u4EF6\uFF08\u3059\u3079\u3066AND\uFF09",
      noExtra: "\u8FFD\u52A0\u6761\u4EF6\u306A\u3057",
      settings: "\u8A73\u7D30\u8A2D\u5B9A",
      platform: "OS\uFF0F\u74B0\u5883",
      updateStatus: "\u66F4\u65B0\u72B6\u614B",
      activeStatus: "\u7A3C\u50CD\u30FB\u505C\u6EDE\u30FB\u4E0D\u660E",
      support: "\u6A5F\u80FD\u5BFE\u5FDC",
      featureNeeded: "\u6A5F\u80FD\u30921\u3064\u4EE5\u4E0A\u9078\u3076\u3068\u4F7F\u3048\u307E\u3059\u3002",
      delivery: "\u63D0\u4F9B\u5F62\u614B",
      webApp: "Web\u30A2\u30D7\u30EA",
      installed: "\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u578B",
      mobileApp: "\u30E2\u30D0\u30A4\u30EB\u30A2\u30D7\u30EA",
      oss: "OSS",
      includeDead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u3082\u542B\u3081\u308B",
      savedOnly: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F\u3060\u3051",
      nipSearch: "NIP\u756A\u53F7\u30FB\u540D\u79F0",
      supportModes: { all: "\u3059\u3079\u3066\uFF08\u4E0D\u660E\u3082\u542B\u3080\uFF09", confirmed: "\u5BFE\u5FDC\u30FB\u90E8\u5206\u5BFE\u5FDC\u306E\u307F" },
      supportModeHelp: "\u65E2\u5B9A\u306F\u300C\u5BFE\u5FDC\u30FB\u90E8\u5206\u5BFE\u5FDC\u306E\u307F\u300D\u3067\u3059\u3002\u4E3B\u5F35\u304C\u7121\u3044\u3082\u306E\uFF08\u4E0D\u660E\uFF09\u306F\u65E2\u5B9A\u3067\u306F\u51FA\u307E\u305B\u3093\u3002",
      unstatedSetAside: "\u9078\u3093\u3060\u6A5F\u80FD\u306B\u3064\u3044\u3066\u4E00\u6B21\u60C5\u5831\u304C\u4F55\u3082\u8FF0\u3079\u3066\u3044\u306A\u3044\u30A8\u30F3\u30C8\u30EA\u304C{count}\u4EF6\u3042\u308A\u307E\u3059\u3002\u975E\u5BFE\u5FDC\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      showUnstated: "\u4E0D\u660E\u3082\u542B\u3081\u3066\u8868\u793A",
      unknownInfo: "\u300C\u4E0D\u660E\u300D\u306B\u3064\u3044\u3066",
      unknownHelp: "\u6750\u6599\u4E0D\u8DB3\u3067\u5224\u5B9A\u3092\u4FDD\u7559\u3057\u305F\u72B6\u614B\u3067\u3059\u3002\u975E\u5BFE\u5FDC\u3092\u610F\u5473\u3057\u307E\u305B\u3093\u3002\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u306F\u9078\u3093\u3060\u5834\u5408\u3060\u3051\u8868\u793A\u3057\u307E\u3059\u3002",
      selectedCount: "{count}\u4EF6\u3092\u9078\u629E\uFF08\u6700\u59273\u4EF6\uFF09",
      compareByFeature: "\u6A5F\u80FD\u3067\u6BD4\u8F03",
      clearSelection: "\u9078\u629E\u89E3\u9664",
      evidenceTitle: "\u6280\u8853\u7684\u306A\u88CF\u4ED8\u3051",
      primarySource: "\u516C\u5F0FNIP\u4E00\u6B21\u8CC7\u6599",
      chooseForNips: "\u6A5F\u80FD\u3092\u9078\u3076\u3068\u3001\u95A2\u9023\u3059\u308BNIP\u306E\u4E00\u6B21\u8CC7\u6599\u3092\u8868\u793A\u3057\u307E\u3059\u3002",
      facts: "\u4E8B\u5B9F\u30FB\u89B3\u6E2C",
      evaluations: "\u5229\u7528\u8005\u8A55\u4FA1",
      noFeatureCondition: "\u6A5F\u80FD\u6761\u4EF6\u306A\u3057",
      category: "\u30AB\u30C6\u30B4\u30EA",
      observed: "\u6700\u7D42\u89B3\u6E2C",
      officialLinks: "{name}\u306E\u516C\u5F0F\u60C5\u5831",
      site: "\u516C\u5F0F\u30B5\u30A4\u30C8",
      distribution: "\u30A2\u30D7\u30EA\u914D\u5E03",
      docs: "\u516C\u5F0FDocs",
      source: "\u30BD\u30FC\u30B9",
      linkDetails: "{type}\u306E\u60C5\u5831",
      displayUrl: "URL",
      opensInNewTab: "\u65B0\u3057\u3044\u30BF\u30D6\u3067\u958B\u304D\u307E\u3059",
      checkedAt: "\u6700\u7D42\u78BA\u8A8D\u65E5\u6642",
      like: "\u3044\u3044\u306D {count}",
      bookmark: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF",
      bookmarked: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F",
      reviews: "\u30EC\u30D3\u30E5\u30FC {count}",
      privateDefault: "\u975E\u516C\u958B",
      public: "\u516C\u958B",
      publicToggle: "\u516C\u958B\u306B\u3059\u308B",
      endedRecord: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u306E\u8A18\u9332\u3002",
      alternatives: "\u540C\u3058\u6A5F\u80FD\u306E\u7A3C\u50CD\u5019\u88DC\u3078\u623B\u308B",
      compareAdd: "\u6BD4\u8F03\u306B\u8FFD\u52A0",
      details: "\u8A73\u7D30\u30FB\u6839\u62E0",
      count: "{count}\u4EF6",
      noMatch: "\u6761\u4EF6\u306B\u5408\u3046\u5019\u88DC\u304C\u3042\u308A\u307E\u305B\u3093",
      noMatchHelp: "\u4E0A\u306E\u6761\u4EF6\u30921\u4EF6\u305A\u3064\u5916\u3057\u3066\u5E83\u3052\u3089\u308C\u307E\u3059\u3002",
      removeGets: "\u300C{label}\u300D\u3092\u5916\u3059\u3068 {count}\u4EF6",
      resetAll: "\u3059\u3079\u3066\u306E\u6761\u4EF6\u3092\u30EA\u30BB\u30C3\u30C8",
      conditionFeature: "\u6A5F\u80FD\u300C{value}\u300D",
      conditionQuery: "\u5168\u6587\u691C\u7D22\u300C{value}\u300D",
      conditionPlatform: "OS\uFF0F\u74B0\u5883\u300C{value}\u300D",
      conditionCategory: "\u30AB\u30C6\u30B4\u30EA\u300C{value}\u300D",
      conditionStatus: "\u66F4\u65B0\u72B6\u614B\u300C{value}\u300D",
      conditionSupport: "\u6A5F\u80FD\u5BFE\u5FDC\u300C{value}\u300D",
      conditionDelivery: "\u63D0\u4F9B\u5F62\u614B\u300C{value}\u300D",
      conditionOss: "OSS\u300C{value}\u300D",
      conditionDead: "\u7D42\u4E86\uFF0F\u5230\u9054\u4E0D\u80FD\u3092\u542B\u3080",
      conditionSaved: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F\u3060\u3051",
      conditionNip: "NIP\u300C{value}\u300D",
      conditionTool: "\u30A8\u30F3\u30C8\u30EA\u300C{value}\u300D",
      conditionRemove: "{label}\u3092\u5916\u3059",
      /* issue #1 / #21: 並び順。実在する値だけを鍵にする。「リリースが新しい順」は無い ——
         レコードは自分の公開日を述べていない。持っているのはイベントの created_at＝
         収集した時刻なので、ラベルもそのまま「収集日」と書く。表示と値が同じ事実を
         指している限り捏造ではない。 */
      sort: {
        label: "\u4E26\u3073\u9806",
        "default": "\u65E2\u5B9A\u306E\u9806",
        "name-asc": "\u540D\u524D\uFF08\u6607\u9806\uFF09",
        "name-desc": "\u540D\u524D\uFF08\u964D\u9806\uFF09",
        "likes-desc": "\u3044\u3044\u306D\u304C\u591A\u3044\u9806",
        "likes-asc": "\u3044\u3044\u306D\u304C\u5C11\u306A\u3044\u9806",
        "collected-desc": "\u53CE\u96C6\u65E5\u304C\u65B0\u3057\u3044\u9806",
        "collected-asc": "\u53CE\u96C6\u65E5\u304C\u53E4\u3044\u9806",
        /* 並び順から外れた行の見出しは、外れた理由＝鍵の次元ごとに別の文。 */
        unranked: {
          likes: {
            heading: "\u3044\u3044\u306D\u6570\uFF1A\u672A\u89B3\u6E2C",
            notice: "\u3044\u3044\u306D\u6570\u3092\u89B3\u6E2C\u3057\u3066\u3044\u306A\u3044\u30A8\u30F3\u30C8\u30EA\u304C{count}\u4EF6\u3042\u308A\u3001\u3053\u306E\u4E26\u3073\u9806\u306B\u306F\u5165\u308C\u3066\u3044\u307E\u305B\u3093\uFF080\u4EF6\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002"
          },
          collected: {
            heading: "\u53CE\u96C6\u65E5\uFF1A\u672A\u89B3\u6E2C",
            notice: "\u53CE\u96C6\u65E5\u3092\u6301\u305F\u306A\u3044\u30A8\u30F3\u30C8\u30EA\u304C{count}\u4EF6\u3042\u308A\u3001\u3053\u306E\u4E26\u3073\u9806\u306B\u306F\u5165\u308C\u3066\u3044\u307E\u305B\u3093\uFF08\u6700\u3082\u53E4\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002"
          }
        }
      },
      /* §21 の新語彙。unknown は「値が無い」ことを名指す語で、0 でも否定でもない。 */
      summaryAbsent: "\u6982\u8981\u306F\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      freeTopic: "\u30EC\u30B3\u30FC\u30C9\u304C\u516C\u958B\u3057\u305F\u30C8\u30D4\u30C3\u30AF\u3002\u3053\u306E\u7AEF\u672B\u306B\u5BFE\u5FDC\u3059\u308B\u30E9\u30D9\u30EB\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      recordState: "\u30EC\u30B3\u30FC\u30C9\u306E\u72B6\u614B",
      recordStateFilter: "\u30EC\u30B3\u30FC\u30C9\u306E\u72B6\u614B",
      recordStateHelp: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u751F\u5B58\u3068\u306F\u5225\u306E\u8EF8\u3067\u3059\u3002",
      liveness: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u751F\u5B58",
      livenessDerived: "\u751F\u5B58\u78BA\u8A8D\uFF1A{value}",
      livenessUncounted: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30B0\u30E9\u30D5\u304C\u7121\u3044\u305F\u3081\u3001\u8A18\u9332\u6E08\u307F\u306E\u89B3\u6E2C {count} \u4EF6\u306F\u3069\u308C\u3082\u6570\u3048\u3066\u3044\u307E\u305B\u3093\u3002",
      /* issue #15-2: 到達可能と言える根拠は、収集時に記録が残っている応答だけ。記録が無ければ不明のまま。 */
      livenessFromSource: "\u5230\u9054\u53EF\u80FD\u3068\u8A00\u3048\u308B\u6839\u62E0\uFF1A{url}\uFF08{date} \u306B\u5FDC\u7B54\u3092\u8A18\u9332\uFF09",
      capabilityClaims: "\u5BFE\u5FDC\u4E3B\u5F35",
      noClaimPublished: "\u5BFE\u5FDC\u4E3B\u5F35\u306F\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      noNipClaims: "NIP\u306E\u4E3B\u5F35\u306F\u8A18\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093",
      claimFamilyCount: "{family} {count}\u4EF6",
      claimSource: "\u4E3B\u5F35\u306E\u51FA\u5178",
      claimCaveats: "\u51FA\u5178\u306E\u4F46\u3057\u66F8\u304D",
      caveat: "\u4F46\u3057\u66F8\u304D",
      basis: "\u4E3B\u5F35\u306E\u6839\u62E0",
      assertedAt: "\u4E3B\u5F35\u306E\u53D6\u5F97\u65E5",
      notation: "\u51FA\u5178\u306E\u8A18\u6CD5",
      sourceText: "\u51FA\u5178\u306E\u8A72\u5F53\u884C",
      registryStatus: "\u30EC\u30B8\u30B9\u30C8\u30EA\u7167\u5408",
      registryDeprecated: "\u30EC\u30B8\u30B9\u30C8\u30EA\u3067\u975E\u63A8\u5968",
      notInRegistry: "\u30D4\u30F3\u7559\u3081\u3057\u305F\u30EC\u30B8\u30B9\u30C8\u30EA\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8 {revision} \u306B\u7121\u3044ID\u3067\u3059",
      noRegistrySnapshot: "\u30D5\u30A1\u30DF\u30EA {family} \u306E\u30EC\u30B8\u30B9\u30C8\u30EA\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093",
      primarySources: "\u51FA\u5178",
      noOfficialLinks: "\u51FA\u5178\u306B\u30EA\u30F3\u30AF\u306E\u8A18\u8F09\u306F\u3042\u308A\u307E\u305B\u3093",
      noReviewsObserved: "\u30EC\u30D3\u30E5\u30FC\u306F\u89B3\u6E2C\u3057\u3066\u3044\u307E\u305B\u3093",
      collectedData: "\u4E00\u6B21\u60C5\u5831\u304B\u3089\u53CE\u96C6",
      platformSourced: "\u5BFE\u5FDC\u74B0\u5883\u304C\u8A18\u9332\u3055\u308C\u3066\u3044\u308B\u30A8\u30F3\u30C8\u30EA\u3060\u3051\u304C\u4E00\u81F4\u3057\u307E\u3059\u3002",
      topicCorrection: "\u53CE\u96C6\u6642\u306E\u30C8\u30D4\u30C3\u30AF\uFF1A{collected} \u2014",
      nonClaim: { modules: "NIP\u540D\u306E\u30E2\u30B8\u30E5\u30FC\u30EB\uFF08\u5BFE\u5FDC\u4E3B\u5F35\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09", crates: "NIP\u540D\u306E\u30AF\u30EC\u30FC\u30C8\uFF08\u5BFE\u5FDC\u4E3B\u5F35\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09" },
      detailKicker: "\u5BFE\u5FDC\u306E\u6839\u62E0",
      supportFor: "{feature}\u3078\u306E\u5BFE\u5FDC",
      observer: "\u89B3\u6E2C\u4E3B\u4F53",
      nipPurpose: "NIP\u306E\u7528\u9014",
      state: "\u72B6\u614B",
      os: "OS\uFF0F\u74B0\u5883",
      license: "\u30E9\u30A4\u30BB\u30F3\u30B9",
      compareTitle: "{count}\u4EF6\u306E\u6A5F\u80FD\u6BD4\u8F03",
      differencesFirst: "\u5DEE\u304C\u3042\u308B\u9805\u76EE\u3092\u5148\u306B\u8868\u793A\u3057\u307E\u3059\u3002",
      removeCandidate: "{name}\u3092\u6BD4\u8F03\u304B\u3089\u5916\u3059",
      removeShort: "\u5916\u3059",
      alternative: "\u5225\u306E\u5019\u88DC",
      replaceTarget: "\u5165\u308C\u66FF\u3048\u308B\u5019\u88DC",
      addComparison: "\u6BD4\u8F03\u306B\u8FFD\u52A0",
      replaceComparison: "\u9078\u3093\u3060\u5019\u88DC\u3068\u5165\u308C\u66FF\u3048",
      needTwo: "\u6BD4\u8F03\u3059\u308B\u306B\u306F2\u4EF6\u4EE5\u4E0A\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
      featuresSection: "\u6A5F\u80FD",
      basicsSection: "\u57FA\u672C\u60C5\u5831",
      nipEvidence: "NIP\u88CF\u4ED8\u3051",
      reviewTitle: "{name}\u306E\u30EC\u30D3\u30E5\u30FC",
      reviewCount: "{count}\u4EF6",
      openGallery: "\u753B\u50CF\u30AE\u30E3\u30E9\u30EA\u30FC",
      reviewer: "\u6295\u7A3F\u8005",
      postedAt: "\u6295\u7A3F\u65E5\u6642",
      use: "\u7528\u9014",
      rating: "\u8A55\u4FA1",
      appVersion: "\u30A2\u30D7\u30EAversion",
      notEntered: "\u672A\u5165\u529B",
      helpful: "\u5F79\u306B\u7ACB\u3063\u305F {count}",
      unhelpful: "\u7ACB\u305F\u306A\u304B\u3063\u305F {count}",
      voters: "\u8A55\u4FA1\u8005{count}\u4EBA\u30FB\u5185\u8A33",
      writeReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0",
      body: "\u672C\u6587",
      bodyPlaceholder: "\u4F7F\u3063\u305F\u5834\u9762\u3084\u6C17\u3065\u3044\u305F\u3053\u3068",
      image: "\u753B\u50CF",
      deviceImage: "\u7AEF\u672B\u304B\u3089\u9078\u3076",
      osOptional: "\u5BFE\u8C61OS\uFF08\u4EFB\u610F\uFF09",
      versionOptional: "version\uFF08\u4EFB\u610F\uFF09",
      useOptional: "\u7528\u9014\uFF08\u4EFB\u610F\uFF09",
      ratingOptional: "\u8A55\u4FA1\uFF08\u4EFB\u610F\uFF09",
      createReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0",
      chooseBodyOrImage: "\u672C\u6587\u304B\u753B\u50CF\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
      addedReview: "\u30EC\u30D3\u30E5\u30FC\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F",
      imageOnly: "\u672C\u6587\u306A\u3057\uFF08\u753B\u50CF\u306E\u307F\uFF09",
      profileTitle: "\u30EC\u30D3\u30E5\u30A2\u30FC\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB",
      joined: "\u5229\u7528\u958B\u59CB",
      activity: "\u6295\u7A3F\u5C65\u6B74\u306E\u5E83\u304C\u308A",
      posting: "\u6295\u7A3F\u50BE\u5411",
      voteHistory: "\u904E\u53BB\u30EC\u30D3\u30E5\u30FC\u3068\u5F79\u7ACB\u3061\u5185\u8A33",
      history: "\u30EC\u30D3\u30E5\u30FC\u5C65\u6B74",
      /* 投稿フォーム (issue #9 スライス2)。成功の言い切りは readback が返ったときにしか出さないので、
         見出しは必ず「何台中何台」を持つ。「公開しました」だけの文字列はここに存在しない。 */
      publish: {
        title: "\u30EC\u30B3\u30FC\u30C9\u3092\u6295\u7A3F\u3059\u308B",
        lead: "\u7F72\u540D\u306FNIP-07\u62E1\u5F35\u304C\u884C\u3044\u3001\u3053\u306E\u753B\u9762\u306F\u79D8\u5BC6\u9375\u306B\u89E6\u308C\u307E\u305B\u3093\u3002\u516C\u958B\u3067\u304D\u305F\u3068\u8A00\u3048\u308B\u306E\u306F\u3001\u30EA\u30EC\u30FC\u304B\u3089\u8AAD\u307F\u623B\u305B\u305F\u3068\u304D\u3060\u3051\u3067\u3059\u3002",
        noSigner: "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306BNIP-07\u62E1\u5F35\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u6295\u7A3F\u306B\u306FNIP-07\u62E1\u5F35\u304C\u5FC5\u8981\u3067\u3059\u3002\u95B2\u89A7\u306F\u305D\u306E\u307E\u307E\u7D9A\u3051\u3089\u308C\u307E\u3059\u3002",
        signInFirst: "\u6295\u7A3F\u3059\u308B\u306B\u306FNIP-07\u3067\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
        dLocal: "\u8B58\u5225\u5B50\uFF08d \u306E nosmaps: \u3088\u308A\u5F8C\u308D\uFF09",
        dBytes: "d \u5168\u4F53\u3067 {bytes} / {max} \u30D0\u30A4\u30C8\uFF08nosmaps: \u306E8\u30D0\u30A4\u30C8\u3092\u542B\u3080\uFF09",
        dChangeNote: "\u8B58\u5225\u5B50\u3092\u5909\u3048\u308B\u3068\u3001\u540C\u3058\u30EC\u30B3\u30FC\u30C9\u306E\u66F4\u65B0\u3067\u306F\u306A\u304F\u5225\u306E\u30EC\u30B3\u30FC\u30C9\u306B\u306A\u308A\u307E\u3059\u3002",
        dLockedNote: "\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u306F\u516C\u958B\u6E08\u307F\u3067\u3059\u3002\u8B58\u5225\u5B50\u3092\u5909\u3048\u308B\u3068\u5225\u306E\u30EC\u30B3\u30FC\u30C9\u306B\u306A\u308B\u305F\u3081\u3001\u5909\u66F4\u3067\u304D\u307E\u305B\u3093\u3002",
        name: "\u540D\u524D",
        summary: "\u6982\u8981",
        summaryHelp: "\u7A7A\u6B04\u306E\u307E\u307E\u3067\u3082\u6295\u7A3F\u3067\u304D\u307E\u3059\u3002\u767A\u884C\u8005\u304C\u66F8\u3044\u305F\u6982\u8981\u304C\u7121\u3044\u3053\u3068\u306F\u3001\u7121\u3044\u3068\u66F8\u304F\u306E\u304C\u6B63\u78BA\u3067\u3059\u3002",
        homepage: "\u516C\u5F0F\u30B5\u30A4\u30C8\uFF08\u4EFB\u610F\u30FBhttps:// \u3067\u59CB\u307E\u308B\u3053\u3068\uFF09",
        topics: "\u8FFD\u52A0\u30C8\u30D4\u30C3\u30AF\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09",
        topicsHelp: "nosmaps \u30C8\u30D4\u30C3\u30AF\u306F\u767A\u898B\u306E\u305F\u3081\u306B\u5FC5\u305A\u4ED8\u304D\u307E\u3059\u3002\u5916\u305B\u307E\u305B\u3093\u3002",
        submit: "\u7F72\u540D\u3057\u3066\u6295\u7A3F",
        publishing: "\u6295\u7A3F\u4E2D\u2026",
        eventId: "\u7F72\u540D\u3057\u305F\u30A4\u30D9\u30F3\u30C8ID",
        partialConsequence: "\u53D7\u3051\u4ED8\u3051\u306A\u304B\u3063\u305F\u30EA\u30EC\u30FC\u3060\u3051\u3092\u8AAD\u3093\u3067\u3044\u308B\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306B\u306F\u3001\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u306F\u898B\u3048\u307E\u305B\u3093\u3002",
        /* §W3.4 / W-I4: created_at を1秒進めたことは隠さない。進めた理由と、進める前に
           実際に観測した値を並べて出す。「勝手に時刻を作った」と「同じ秒で負けないように
           1秒だけ足した」は別のことなので、後者だと分かる形で書く。 */
        clockBumped: "\u540C\u3058\u5EA7\u6A19\u306B created_at {prior} \u306E\u30EC\u30B3\u30FC\u30C9\u3092\u89B3\u6E2C\u3057\u305F\u306E\u3067\u3001\u540C\u3058\u79D2\u3067\u8CA0\u3051\u306A\u3044\u3088\u3046\u306B created_at \u3092 {createdAt} \u306B\u3057\u307E\u3057\u305F\uFF08+1\u79D2\uFF09\u3002",
        clockConflictDetail: "\u89B3\u6E2C\u3057\u305F created_at \u306F {prior} \u3067\u3001\u3053\u306E\u7AEF\u672B\u306E\u6642\u8A08\uFF08{now}\uFF09\u3088\u308A\u5148\u3067\u3059\u3002\u4F55\u3082\u7F72\u540D\u3057\u3066\u3044\u307E\u305B\u3093\u3002",
        headlines: {
          published: "{total}\u53F0\u4E2D{accepted}\u53F0\u306B\u516C\u958B\u3057\u3001\u8AAD\u307F\u623B\u305B\u307E\u3057\u305F\u3002",
          partial: "{total}\u53F0\u4E2D{accepted}\u53F0\u306B\u516C\u958B\u3057\u3001\u8AAD\u307F\u623B\u305B\u307E\u3057\u305F\u3002",
          unconfirmed: "\u7F72\u540D\u3068\u53D7\u9818\u306F\u3055\u308C\u307E\u3057\u305F\u304C\u3001{attempts}\u56DE\u8A66\u3057\u3066\u3082\u8AAD\u307F\u623B\u305B\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4FDD\u5B58\u3055\u308C\u3066\u3044\u308B\u53EF\u80FD\u6027\u306F\u3042\u308A\u307E\u3059\u3002",
          failed: "\u516C\u958B\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
          invalid: "\u3053\u306E\u5185\u5BB9\u306F\u6295\u7A3F\u3067\u304D\u307E\u305B\u3093\u3002",
          blocked: "\u7F72\u540D\u306E\u524D\u306B\u4E2D\u6B62\u3057\u307E\u3057\u305F\u3002",
          other: "\u72B6\u614B: {state}"
        },
        outcomes: {
          accepted: "\u53D7\u3051\u4ED8\u3051\u305F\uFF08OK true\uFF09",
          rejected: "\u62D2\u5426\u3057\u305F\uFF08OK false\uFF09",
          timeout: "\u5FDC\u7B54\u306A\u3057\uFF08\u672A\u78BA\u5B9A\u3002\u5931\u6557\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09",
          "connection-failed": "\u63A5\u7D9A\u3067\u304D\u306A\u304B\u3063\u305F\uFF08\u672A\u78BA\u5B9A\uFF09",
          "auth-required": "\u8A8D\u8A3C\u304C\u5FC5\u8981",
          "not-attempted": "\u9001\u3063\u3066\u3044\u306A\u3044"
        },
        reasons: {
          "bad-d": "\u8B58\u5225\u5B50\u304C\u4E0D\u6B63\u3067\u3059\uFF08\u5370\u5B57\u53EF\u80FD\u306AASCII\u306E\u307F\u3001d \u5168\u4F53\u3067192\u30D0\u30A4\u30C8\u307E\u3067\uFF09\u3002",
          "bad-schema": "\u5FC5\u9808\u306E\u9805\u76EE\u304C\u8DB3\u308A\u306A\u3044\u304B\u3001\u9577\u3055\u306E\u4E0A\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002",
          "foreign-d": "\u8B58\u5225\u5B50\u304C nosmaps: \u540D\u524D\u7A7A\u9593\u306E\u5916\u3092\u6307\u3057\u3066\u3044\u307E\u3059\u3002",
          "foreign-profile": "content \u304C nosmaps \u306E\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
          "bad-topic": "\u30C8\u30D4\u30C3\u30AF\u304C\u4E0D\u6B63\u3067\u3059\uFF08\u7A7A\u3001\u307E\u305F\u306F128\u30D0\u30A4\u30C8\u8D85\uFF09\u3002",
          "multi-value-t": "t \u30BF\u30B0\u306F1\u3064\u306E\u5024\u3060\u3051\u3092\u6301\u3066\u307E\u3059\u3002",
          "uppercase-topic": "\u30C8\u30D4\u30C3\u30AF\u306F\u5C0F\u6587\u5B57\u3060\u3051\u3067\u3059\u3002",
          "unknown-field": "v1\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB\u306B\u7121\u3044\u9805\u76EE\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002",
          "bad-version": "version \u306F 1 \u3060\u3051\u3067\u3059\u3002",
          "bad-state": "state \u306F active \u304B withdrawn \u3060\u3051\u3067\u3059\u3002",
          "bad-superseded-by": "superseded_by \u304C\u5EA7\u6A19\u3068\u3057\u3066\u4E0D\u6B63\u3067\u3059\u3002",
          "tag-content-mismatch": "state \u30BF\u30B0\u3068 content \u306E state \u304C\u98DF\u3044\u9055\u3063\u3066\u3044\u307E\u3059\u3002",
          "future-timestamp": "created_at \u304C\u3053\u306E\u7AEF\u672B\u306E\u6642\u8A08\u3088\u308A\u672A\u6765\u3067\u3059\u3002",
          "future-horizon": "created_at \u304C\u9060\u3059\u304E\u308B\u672A\u6765\u3067\u3059\u3002",
          "signer-absent": "NIP-07\u62E1\u5F35\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002",
          "signer-rejected": "NIP-07\u62E1\u5F35\u304C\u7F72\u540D\u3092\u8FD4\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u9589\u3058\u305F\u5834\u5408\u306F\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
          "signer-wrong-pubkey": "NIP-07\u62E1\u5F35\u304C\u30B5\u30A4\u30F3\u30A4\u30F3\u6642\u3068\u5225\u306E\u516C\u958B\u9375\u3067\u7F72\u540D\u3057\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-mutated-event": "NIP-07\u62E1\u5F35\u304C\u6E21\u3057\u305F\u5185\u5BB9\u3092\u66F8\u304D\u63DB\u3048\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-missing-fields": "NIP-07\u62E1\u5F35\u306E\u8FD4\u3057\u305F\u7F72\u540D\u6E08\u307F\u30A4\u30D9\u30F3\u30C8\u304C\u8AAD\u3081\u307E\u305B\u3093\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "signer-invalid-record": "\u7F72\u540D\u5F8C\u306E\u30A4\u30D9\u30F3\u30C8\u304C\u691C\u8A3C\u3092\u901A\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "nip07-key-unparsable": "NIP-07\u62E1\u5F35\u304C\u516C\u958B\u9375\u3068\u3057\u3066\u8AAD\u3081\u306A\u3044\u5024\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002",
          "pubkey-mismatch": "\u30B5\u30A4\u30F3\u30A4\u30F3\u6642\u3068\u5225\u306E\u516C\u958B\u9375\u304C\u8FD4\u308A\u307E\u3057\u305F\u3002\u4F55\u3082\u9001\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "clock-conflict": "\u3053\u306E\u5EA7\u6A19\u306E\u30EC\u30B3\u30FC\u30C9\u304C\u3001\u3053\u306E\u7AEF\u672B\u306E\u6642\u8A08\u3088\u308A\u5148\u306E\u6642\u523B\u3067\u8A18\u9332\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u7AEF\u672B\u306E\u6642\u8A08\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          "relay-unavailable": "\u30EA\u30EC\u30FC\u5C64\u3092\u521D\u671F\u5316\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          "all-relays-rejected": "\u3059\u3079\u3066\u306E\u30EA\u30EC\u30FC\u304C\u62D2\u5426\u3057\u307E\u3057\u305F\u3002",
          "publish-error": "\u6295\u7A3F\u306E\u9014\u4E2D\u3067\u30A8\u30E9\u30FC\u304C\u8D77\u304D\u307E\u3057\u305F\u3002\u516C\u958B\u3055\u308C\u305F\u304B\u3069\u3046\u304B\u306F\u5206\u304B\u308A\u307E\u305B\u3093\u3002",
          "not-returned-yet": "\u3053\u306E\u56DE\u3067\u306F\u8FD4\u3063\u3066\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
          "query-failed": "\u8AAD\u307F\u623B\u3057\u306E\u554F\u3044\u5408\u308F\u305B\u81EA\u4F53\u304C\u5931\u6557\u3057\u305F\u306E\u3067\u3001\u4F55\u3082\u5206\u304B\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          "readback-quarantined": "\u8AAD\u307F\u623B\u3057\u305F\u30A4\u30D9\u30F3\u30C8\u304C\u691C\u8A3C\u3067\u9694\u96E2\u3055\u308C\u307E\u3057\u305F\u3002",
          "superseded-during-publish": "\u540C\u3058\u5EA7\u6A19\u306B\u3001\u3088\u308A\u65B0\u3057\u3044\u5225\u306E\u30A4\u30D9\u30F3\u30C8\u304C\u89B3\u6E2C\u3055\u308C\u307E\u3057\u305F\u3002",
          "no-readback": "\u8AAD\u307F\u623B\u3057\u3092\u5B9F\u884C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          unavailable: "\u30C7\u30FC\u30BF\u5C64\u3092\u8AAD\u307F\u8FBC\u3081\u3066\u3044\u307E\u305B\u3093\u3002",
          unknownReason: "\u7406\u7531: {reason}"
        }
      },
      /* issue #12: 自分が出したレコードの一覧。「観測できなかった」と「問い合わせが完了しなかった」を
         別の文言にしてあるのは、利用者が次に取る行動が違うから —— 後者を「0件」と書くと、
         もう出してあるレコードをもう一度出しに行かせることになる。 */
      manage: {
        title: "\u81EA\u5206\u304C\u51FA\u3057\u305F\u30EC\u30B3\u30FC\u30C9",
        loading: "\u30EA\u30EC\u30FC\u306B\u554F\u3044\u5408\u308F\u305B\u3066\u3044\u307E\u3059\u2026",
        empty: "\u3053\u306E\u30EA\u30EC\u30FC\u3067\u306F\u3001\u3042\u306A\u305F\u306E\u7F72\u540D\u3057\u305F\u30EC\u30B3\u30FC\u30C9\u306F\u89B3\u6E2C\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
        queryFailed: "\u554F\u3044\u5408\u308F\u305B\u304C\u5B8C\u4E86\u3057\u306A\u304B\u3063\u305F\u306E\u3067\u3001\u4EF6\u6570\u306F0\u3067\u306F\u306A\u304F\u4E0D\u660E\u3067\u3059\u3002\u4F55\u3082\u89B3\u6E2C\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002",
        unavailable: "\u30EA\u30EC\u30FC\u306B1\u53F0\u3082\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u89B3\u6E2C\u3067\u304D\u305F\u3053\u3068\u306F\u4F55\u3082\u3042\u308A\u307E\u305B\u3093\u3002",
        truncated: "\u4E0A\u9650 {limit} \u4EF6\u307E\u3067\u8AAD\u307F\u307E\u3057\u305F\u3002\u3053\u308C\u3088\u308A\u591A\u304F\u306E\u30EC\u30B3\u30FC\u30C9\u304C\u3042\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002",
        count: "{count} \u4EF6",
        coordinate: "\u8B58\u5225\u5B50 d",
        updatedAt: "\u6700\u7D42\u66F4\u65B0",
        /* §W6.5 取り下げ。確認文が「取り下げは削除ではない」と述べるのは §7.3 の要請で、
           取り下げを削除と読ませないため。結果の語彙は、読み戻しで確認できたときにだけ
           「確認しました」と言い、確認できていない間は「まだ active に見える」と書く。 */
        withdraw: "\u53D6\u308A\u4E0B\u3052\u308B",
        withdrawing: "\u53D6\u308A\u4E0B\u3052\u4E2D\u2026",
        withdrawConfirm: "\u53D6\u308A\u4E0B\u3052\u3092\u5B9F\u884C",
        withdrawCancel: "\u3084\u3081\u308B",
        withdrawPrompt: "\u300C{name}\u300D\u3092\u53D6\u308A\u4E0B\u3052\u307E\u3059\u3002\u53D6\u308A\u4E0B\u3052\u306F\u524A\u9664\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u53D6\u308A\u4E0B\u3052\u3092\u89B3\u6E2C\u3057\u305F\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306F\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u3092\u4E00\u89A7\u306B\u51FA\u3055\u306A\u304F\u306A\u308A\u307E\u3059\u304C\u3001\u30A4\u30D9\u30F3\u30C8\u304C\u6D88\u3048\u308B\u308F\u3051\u3067\u306F\u306A\u304F\u3001\u53D6\u308A\u4E0B\u3052\u3092\u89B3\u6E2C\u3057\u3066\u3044\u306A\u3044\u30EA\u30EC\u30FC\u3084\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306B\u306F\u53E4\u3044\u7248\u304C\u305D\u306E\u307E\u307E\u6B8B\u308A\u307E\u3059\u3002",
        withdrawHeadlines: {
          confirmed: "\u53D6\u308A\u4E0B\u3052\u3092\u8AAD\u307F\u623B\u3057\u3066\u78BA\u8A8D\u3057\u307E\u3057\u305F\uFF08{accepted}/{total} \u4EF6\u306E\u30EA\u30EC\u30FC\u304C\u53D7\u3051\u53D6\u308A\u307E\u3057\u305F\uFF09\u3002",
          partial: "\u53D6\u308A\u4E0B\u3052\u3092\u8AAD\u307F\u623B\u3057\u3066\u78BA\u8A8D\u3057\u307E\u3057\u305F\u304C\u3001\u53D7\u3051\u53D6\u3063\u305F\u306E\u306F {accepted}/{total} \u4EF6\u306E\u30EA\u30EC\u30FC\u3060\u3051\u3067\u3059\u3002",
          unconfirmed: "\u53D6\u308A\u4E0B\u3052\u3092\u8AAD\u307F\u623B\u305B\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{attempts} \u56DE\u8A66\u884C\uFF09\u3002\u5C4A\u3044\u305F\u304B\u3069\u3046\u304B\u306F\u5206\u304B\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
          failed: "\u53D6\u308A\u4E0B\u3052\u3092\u3069\u306E\u30EA\u30EC\u30FC\u306B\u3082\u5C4A\u3051\u3089\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          invalid: "\u53D6\u308A\u4E0B\u3052\u308B\u30EC\u30B3\u30FC\u30C9\u304C\u691C\u8A3C\u3092\u901A\u3089\u306A\u304B\u3063\u305F\u306E\u3067\u3001\u4F55\u3082\u7F72\u540D\u3057\u3066\u3044\u307E\u305B\u3093\u3002",
          blocked: "\u53D6\u308A\u4E0B\u3052\u306F\u9001\u308B\u524D\u306B\u6B62\u307E\u308A\u307E\u3057\u305F\u3002\u4F55\u3082\u7F72\u540D\u3057\u3066\u3044\u307E\u305B\u3093\u3002",
          other: "\u53D6\u308A\u4E0B\u3052\u306E\u72B6\u614B: {state}"
        },
        withdrawNotDeletion: "\u53D6\u308A\u4E0B\u3052\u306F\u524A\u9664\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u53E4\u3044\u7248\u3092\u6301\u3063\u3066\u3044\u308B\u30EA\u30EC\u30FC\u304B\u3089\u30A4\u30D9\u30F3\u30C8\u304C\u6D88\u3048\u308B\u308F\u3051\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
        withdrawStillActive: "\u53D6\u308A\u4E0B\u3052\u3092\u8AAD\u307F\u623B\u3057\u3066\u78BA\u8A8D\u3067\u304D\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u304C\u307E\u3060 active \u306B\u898B\u3048\u308B\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u304C\u3042\u308A\u307E\u3059\u3002",
        withdrawPartialActive: "\u53D6\u308A\u4E0B\u3052\u3092\u53D7\u3051\u53D6\u3063\u3066\u3044\u306A\u3044\u30EA\u30EC\u30FC\u3060\u3051\u3092\u8AAD\u3080\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306B\u306F\u3001\u3053\u306E\u30EC\u30B3\u30FC\u30C9\u306F\u307E\u3060 active \u306B\u898B\u3048\u307E\u3059\u3002"
      },
      /* NIP-07 サインイン。失敗の原因は原因ごとに別の文言で出す —— 「拡張が無い」「断られた」
         「エラーが返った」「応答が無い」は利用者が次に取る行動が違う。 */
      viewer: {
        label: "\u30D3\u30E5\u30FC\u30A2\u306E\u30B5\u30A4\u30F3\u30A4\u30F3\u72B6\u614B",
        signedIn: "\u30B5\u30A4\u30F3\u30A4\u30F3\u6E08\u307F",
        signedOut: "\u672A\u30B5\u30A4\u30F3\u30A4\u30F3",
        signIn: "NIP-07\u3067\u30B5\u30A4\u30F3\u30A4\u30F3",
        signingIn: "\u63A5\u7D9A\u4E2D\u2026",
        signOut: "\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8",
        reasonDetail: "{reason}\uFF08\u62E1\u5F35\u306E\u5FDC\u7B54: {detail}\uFF09",
        reasons: {
          noExtension: "NIP-07\u62E1\u5F35\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306B window.nostr \u304C\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
          rejected: "NIP-07\u62E1\u5F35\u3067\u516C\u958B\u9375\u306E\u5171\u6709\u3092\u8A31\u53EF\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          error: "NIP-07\u62E1\u5F35\u304C\u30A8\u30E9\u30FC\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002",
          timeout: "NIP-07\u62E1\u5F35\u304C{seconds}\u79D2\u4EE5\u5185\u306B\u5FDC\u7B54\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
          badKey: "NIP-07\u62E1\u5F35\u304C\u516C\u958B\u9375\u3068\u3057\u3066\u8AAD\u3081\u306A\u3044\u5024\u3092\u8FD4\u3057\u307E\u3057\u305F\u3002"
        }
      },
      galleryTitle: "{name}\u306E\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      galleryEmpty: "\u6DFB\u4ED8\u753B\u50CF\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
      enlarge: "\u62E1\u5927",
      originalReview: "\u5143\u30EC\u30D3\u30E5\u30FC",
      imageTitle: "\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      remainingGallery: "\u6B8B\u308A{count}\u4EF6\u3092\u542B\u3080\u753B\u50CF\u30AE\u30E3\u30E9\u30EA\u30FC\u3092\u958B\u304F",
      imageAlt: "{author}\u30FB{date}\u306E\u30EC\u30D3\u30E5\u30FC\u753B\u50CF",
      voteBreakdown: "\u5F79\u7ACB\u3061\u8A55\u4FA1\u306E\u5185\u8A33",
      communityVotes: "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u306E\u8A55\u4FA1",
      helpfulVotes: "\u5F79\u306B\u7ACB\u3063\u305F",
      unhelpfulVotes: "\u7ACB\u305F\u306A\u304B\u3063\u305F",
      toastLiked: "\u3044\u3044\u306D\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastLikeUnconfirmed: "\u30EA\u30EC\u30FC\u306F\u53D7\u3051\u53D6\u308A\u307E\u3057\u305F\u304C\u3001\u307E\u3060\u8AAD\u307F\u623B\u305B\u3066\u3044\u307E\u305B\u3093",
      toastLikeFailed: "\u3044\u3044\u306D\u3092\u9001\u308C\u307E\u305B\u3093\u3067\u3057\u305F",
      likeAdd: "\u3044\u3044\u306D\u3059\u308B\uFF08kind 7 \u3092\u30EA\u30EC\u30FC\u3078\u767A\u884C\uFF09",
      likeRetract: "\u3044\u3044\u306D\u3092\u53D6\u308A\u6D88\u3059\uFF08kind 5 \u3092\u30EA\u30EC\u30FC\u3078\u767A\u884C\uFF09",
      likeSending: "\u9001\u4FE1\u4E2D\u2026",
      likeNeedsSigner: "\u3044\u3044\u306D\u306B\u306FNIP-07\u62E1\u5F35\u304C\u5FC5\u8981\u3067\u3059",
      likeNeedsSignIn: "\u3044\u3044\u306D\u3059\u308B\u306B\u306FNIP-07\u3067\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044",
      likeNoTarget: "\u3053\u306E\u884C\u306B\u306F\u53CD\u5FDC\u3067\u304D\u308B\u5EA7\u6A19\u304C\u3042\u308A\u307E\u305B\u3093",
      toastBookmarked: "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastVoted: "\u8A55\u4FA1\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      toastPublic: "\u516C\u958B\u7BC4\u56F2\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F",
      compareLimit: "\u6BD4\u8F03\u306F\u6700\u59273\u4EF6\u3067\u3059",
      loading: "\u6A5F\u80FD\u5BFE\u5FDC\u60C5\u5831\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
      emptyState: "\u5019\u88DC\u306F0\u4EF6\u3067\u3059",
      errorState: "\u5BFE\u5FDC\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
      retry: "\u518D\u8A66\u884C",
      partialState: "\u4E00\u90E8\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      offlineState: "\u4FDD\u5B58\u6E08\u307F\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      offlineBanner: "\u30AA\u30D5\u30E9\u30A4\u30F3\uFF1A\u4FDD\u5B58\u6E08\u307F\u306E\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002",
      staleState: "\u524D\u56DE\u89B3\u6E2C\u3057\u305F\u30EC\u30B3\u30FC\u30C9\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u4ECA\u56DE\u306E\u30E9\u30A6\u30F3\u30C9\u3092\u5B8C\u4E86\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
      incompleteState: "\u4E00\u90E8\u306E\u30EA\u30EC\u30FC\u5FDC\u7B54\u304C\u63C3\u308F\u306A\u304B\u3063\u305F\u305F\u3081\u3001\u7D50\u679C\u306F\u4E0D\u5B8C\u5168\u3067\u3059\u3002",
      unavailableState: "\u8A2D\u5B9A\u3057\u305F\u30EA\u30EC\u30FC\u304B\u3089\u306F\u8868\u793A\u3067\u304D\u308B\u30EC\u30B3\u30FC\u30C9\u3092\u89B3\u6E2C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      sampleData: "\u30B5\u30F3\u30D7\u30EB",
      relayVerified: "\u30EA\u30EC\u30FC\u691C\u8A3C\u6E08\u307F",
      relayEmptyTitle: "\u8A72\u5F53\u30EC\u30B3\u30FC\u30C9\u306A\u3057",
      relayEmpty: "\u8A2D\u5B9A\u3057\u305F\u30EA\u30EC\u30FC\u3067\u306F\u3001\u8A72\u5F53\u30C8\u30D4\u30C3\u30AF\u3092\u4ED8\u3051\u305F kind 30078 \u30EC\u30B3\u30FC\u30C9\u3092\u89B3\u6E2C\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5B58\u5728\u3057\u306A\u3044\u3068\u3044\u3046\u610F\u5473\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      relayDiagnostics: "\u30EA\u30EC\u30FC\u8A3A\u65AD",
      relayNoData: "\u30EA\u30EC\u30FC\u7D50\u679C\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
      relayReload: "\u30EA\u30EC\u30FC\u304B\u3089\u518D\u53D6\u5F97",
      relayRelays: "\u30EA\u30EC\u30FC\u3068\u30AB\u30D0\u30EC\u30C3\u30B8",
      relayCurators: "\u63A8\u85A6\u8005\uFF08\u3042\u306A\u305F\u306E\u30B0\u30E9\u30D5\u5185\uFF09",
      relayNoCuration: "\u89B3\u6E2C\u3067\u304D\u305F kind 30267 \u30BB\u30C3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093",
      relayManualCurators: "\u624B\u52D5\u3067\u6570\u3048\u3066\u3044\u308B pubkey",
      relayCuratorSets: "\u30BB\u30C3\u30C8",
      relayCuratorSetsValue: "{used} / {observed}",
      relayCuratorMembers: "\u30E1\u30F3\u30D0\u30FC\u6570",
      relayGraph: "\u30BD\u30FC\u30B7\u30E3\u30EB\u30B0\u30E9\u30D5",
      relayGraphState: "\u72B6\u614B",
      relayGraphCoverage: "\u30AB\u30D0\u30EC\u30C3\u30B8",
      relayGraphFollows: "\u30B0\u30E9\u30D5\u4EBA\u6570 |G|",
      relayGraphFollowsValue: "{used} / {total}",
      relayGraphMalformed: "\u4E0D\u6B63\u306A p \u30BF\u30B0",
      relayViewer: "\u30D3\u30E5\u30FC\u30A2\u9375",
      relayViewerSource: "\u9375\u306E\u53D6\u5F97\u5143",
      relayRounds: "\u30E9\u30A6\u30F3\u30C9",
      relayChunks: "\u30C1\u30E3\u30F3\u30AF",
      relayQuarantined: "\u9694\u96E2 (quarantined)",
      relayUnresolved: "\u63A8\u85A6\u3055\u308C\u305F\u304C\u672A\u89B3\u6E2C\u306E\u5EA7\u6A19",
      relaySlugs: "\u8A3A\u65AD",
      relayAsOf: "as-of",
      relayReqs: "REQ\u96C6\u8A08",
      relayLogical: "\u8AD6\u7406REQ",
      relayPhysical: "\u7269\u7406REQ",
      relayHttp: "HTTP\u8A66\u884C",
      relayCache: "\u30AD\u30E3\u30C3\u30B7\u30E5\u30D2\u30C3\u30C8",
      relayReason: "\u7406\u7531",
      discoveryScope: "\u3042\u306A\u305F\u306E\u30EA\u30EC\u30FC\u3067\u30C8\u30D4\u30C3\u30AF\u300C{topics}\u300D\u3092\u516C\u958B\u3057\u305F\u30EC\u30B3\u30FC\u30C9\u306E\u307F\u3002\u3059\u3079\u3066\u306E\u30C4\u30FC\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
      recommendations: "\u3042\u306A\u305F\u306E\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u3067{count}\u4EBA\u304C\u63A8\u85A6",
      recommendationsUnknown: "\u63A8\u85A6\u6570: \u4E0D\u660E\uFF08\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8\u304C\u5FC5\u8981\uFF09",
      graphNoneBanner: "\u30D1\u30FC\u30BD\u30CA\u30E9\u30A4\u30BA\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u63A8\u85A6\u6570\u306E\u96C6\u8A08\u306B\u306F\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8\u304C\u5FC5\u8981\u3067\u3059\u3002Nostr\u9375\u3092\u63A5\u7D9A\u3059\u308B\u304B\u3001npub\u3092\u8CBC\u308A\u4ED8\u3051\u308B\u3068\u8AAD\u307F\u53D6\u308A\u5C02\u7528\u3067\u4E26\u3073\u66FF\u3048\u3067\u304D\u307E\u3059\u3002",
      graphConnect: "Nostr\u9375\u3092\u63A5\u7D9A (NIP-07)",
      graphPasteLabel: "npub \u307E\u305F\u306F hex",
      graphApply: "\u3053\u306E\u9375\u3067\u4E26\u3073\u66FF\u3048\u308B",
      graphStateLine: "\u30B0\u30E9\u30D5: {state}\uFF08{coverage}\u30FB\u6570\u3048\u308B pubkey {used}/{total}\uFF09",
      graphStateLineShort: "\u30B0\u30E9\u30D5: {state}\uFF08{coverage}\uFF09",
      graphStates: { none: "\u306A\u3057", "self-only": "\u81EA\u5206\u306E\u307F", tier1: "\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8", "tier1+tier2": "\u30D5\u30A9\u30ED\u30FC\uFF0B1\u30DB\u30C3\u30D7" },
      graphCoverage: { fresh: "\u6700\u65B0", stale: "\u53E4\u3044", incomplete: "\u4E0D\u5B8C\u5168", truncated: "\u6253\u3061\u5207\u308A", unknown: "\u4E0D\u660E" },
      coverage: { eose: "\u5B8C\u4E86 (EOSE)", timeout: "\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8", error: "\u30A8\u30E9\u30FC", "auth-required": "\u8A8D\u8A3C\u8981\u6C42", rejected: "\u62D2\u5426", disconnected: "\u5207\u65AD", skipped: "\u672A\u5B9F\u884C" },
      nipPurposes: { "01": "\u57FA\u672C\u30A4\u30D9\u30F3\u30C8\u30FB\u7F72\u540D\u30FB\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\uFF0F\u30EA\u30EC\u30FC\u9593\u30E1\u30C3\u30BB\u30FC\u30B8", "02": "kind 3\u306B\u3088\u308B\u30D5\u30A9\u30ED\u30FC\u30EA\u30B9\u30C8", "05": "DNS\u30D9\u30FC\u30B9\u8B58\u5225\u5B50\u3068\u516C\u958B\u9375\u306E\u5BFE\u5FDC\u78BA\u8A8D", "09": "kind 5\u306B\u3088\u308B\u30A4\u30D9\u30F3\u30C8\u524A\u9664\u30EA\u30AF\u30A8\u30B9\u30C8", "11": "HTTP\u3067\u53D6\u5F97\u3059\u308B\u30EA\u30EC\u30FC\u60C5\u5831\u6587\u66F8", "19": "npub\u30FBnote\u7B49\u306Ebech32\u30A8\u30F3\u30B3\u30FC\u30C9\u8B58\u5225\u5B50", "21": "nostr: URI\u306B\u3088\u308B\u8B58\u5225\u5B50\u30EA\u30F3\u30AF", "23": "kind 30023\u306B\u3088\u308B\u9577\u6587\u30B3\u30F3\u30C6\u30F3\u30C4", "25": "kind 7\u306B\u3088\u308B\u30EA\u30A2\u30AF\u30B7\u30E7\u30F3", "42": "\u30EA\u30EC\u30FC\u306B\u5BFE\u3059\u308B\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u8A8D\u8A3C", "44": "\u30D0\u30FC\u30B8\u30E7\u30F3\u4ED8\u304D\u6697\u53F7\u5316\u30DA\u30A4\u30ED\u30FC\u30C9\u5F62\u5F0F", "46": "\u79D8\u5BC6\u9375\u3092\u5206\u96E2\u3059\u308B\u30EA\u30E2\u30FC\u30C8\u7F72\u540D", "47": "\u30EA\u30E2\u30FC\u30C8Lightning\u30A6\u30A9\u30EC\u30C3\u30C8\u63A5\u7D9A", "57": "zap request\uFF0Freceipt\u306B\u3088\u308BLightning\u652F\u6255\u3044\u8A18\u9332", "65": "kind 10002\u306B\u3088\u308Bread\uFF0Fwrite\u30EA\u30EC\u30FC\u4E00\u89A7", "78": "\u30A2\u30D7\u30EA\u56FA\u6709\u30C7\u30FC\u30BF\u306E\u4FDD\u5B58" },
      features: {
        posts: ["\u6295\u7A3F\u30FB\u8FD4\u4FE1", "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u3067\u8AAD\u307F\u66F8\u304D\u3057\u3001\u8FD4\u4FE1\u3057\u305F\u3044", "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3 \u6295\u7A3F \u8FD4\u4FE1"],
        dm: ["DM", "\u6697\u53F7\u5316\u3057\u305F\u500B\u5225\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u308A\u305F\u3044", "\u6697\u53F7\u5316DM \u500B\u5225\u30E1\u30C3\u30BB\u30FC\u30B8"],
        search: ["\u691C\u7D22", "\u6295\u7A3F\u3084\u4EBA\u3001\u8B58\u5225\u5B50\u3092\u63A2\u3057\u305F\u3044", "\u691C\u7D22 \u4EBA \u8B58\u5225\u5B50"],
        media: ["\u753B\u50CF\u30FB\u52D5\u753B", "\u753B\u50CF\u3084\u52D5\u753B\u3092\u898B\u305F\u308A\u516C\u958B\u3057\u305F\u3044", "\u30E1\u30C7\u30A3\u30A2 \u753B\u50CF\u6295\u7A3F \u52D5\u753B\u6295\u7A3F"],
        notifications: ["\u901A\u77E5", "\u8FD4\u4FE1\u30FB\u30EA\u30A2\u30AF\u30B7\u30E7\u30F3\u30FBzap\u306B\u6C17\u3065\u304D\u305F\u3044", "\u901A\u77E5 \u30EA\u30A2\u30AF\u30B7\u30E7\u30F3"],
        accounts: ["\u8907\u6570\u30A2\u30AB\u30A6\u30F3\u30C8", "\u8907\u6570\u306E\u9375\u3084\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3092\u5207\u308A\u66FF\u3048\u305F\u3044", "\u30DE\u30EB\u30C1\u30A2\u30AB\u30A6\u30F3\u30C8"],
        signing: ["\u5916\u90E8\u7F72\u540D", "\u79D8\u5BC6\u9375\u3092\u30A2\u30D7\u30EA\u304B\u3089\u5206\u96E2\u3057\u305F\u3044", "\u30EA\u30E2\u30FC\u30C8\u7F72\u540D"],
        wallet: ["Wallet\u30FBZap", "zap\u3084\u30A6\u30A9\u30EC\u30C3\u30C8\u63A5\u7D9A\u3092\u4F7F\u3044\u305F\u3044", "\u652F\u6255\u3044 \u6295\u3052\u92AD"],
        longform: ["\u9577\u6587", "\u8A18\u4E8B\u3084\u9577\u3044\u30B3\u30F3\u30C6\u30F3\u30C4\u3092\u66F8\u304D\u305F\u3044", "\u9577\u6587\u30B3\u30F3\u30C6\u30F3\u30C4 \u8A18\u4E8B"],
        community: ["\u30C1\u30E3\u30F3\u30CD\u30EB", "\u30B3\u30DF\u30E5\u30CB\u30C6\u30A3\u3067\u4F1A\u8A71\u30FB\u904B\u55B6\u3057\u305F\u3044", "\u30C1\u30E3\u30F3\u30CD\u30EB \u30B3\u30DF\u30E5\u30CB\u30C6\u30A3"]
      },
      reviewsSeed: {
        aBody: "\u8907\u6570\u7AEF\u672B\u3067\u8AAD\u307F\u3084\u3059\u304F\u3001\u901A\u77E5\u8A2D\u5B9A\u3082\u898B\u3064\u3051\u3084\u3059\u3044\u3002",
        bBody: "\u691C\u7D22\u7D50\u679C\u304B\u3089\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u3078\u623B\u308B\u6D41\u308C\u304C\u5206\u304B\u308A\u3084\u3059\u304B\u3063\u305F\u3002",
        cBody: "\u753B\u50CF\u3092\u898B\u306A\u304C\u3089\u4F1A\u8A71\u3092\u8FFD\u3044\u3084\u3059\u3044\u3002",
        aBio: "\u8907\u6570OS\u3067\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306E\u5C0E\u7DDA\u3068\u30A2\u30AF\u30BB\u30B7\u30D3\u30EA\u30C6\u30A3\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u3002",
        bBio: "\u521D\u898B\u5229\u7528\u3068\u6BD4\u8F03\u691C\u8A3C\u3092\u4E2D\u5FC3\u306B\u8A18\u9332\u3057\u3066\u3044\u307E\u3059\u3002",
        aSpread: "28\u304B\u6708\u30FB11\u30AB\u30C6\u30B4\u30EA\u30FBWeb/Desktop/Mobile",
        bSpread: "9\u304B\u6708\u30FB6\u30AB\u30C6\u30B4\u30EA\u30FBWeb\u4E2D\u5FC3",
        aPosts: "\u67082\u301C9\u4EF6\u3002\u77ED\u6587\u3001\u753B\u50CF\u3001\u78BA\u8A8D\u30E1\u30E2\u3002",
        bPosts: "\u67081\u301C4\u4EF6\u3002\u6BD4\u8F03\u30EC\u30D3\u30E5\u30FC\u3068\u8FD4\u4FE1\u3002",
        localName: "\u3042\u306A\u305F",
        localBio: "\u3053\u306E\u753B\u9762\u3067\u8FFD\u52A0\u3057\u305F\u30EC\u30D3\u30E5\u30FC\u3002",
        screenTimeline: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3",
        screenSettings: "\u8A2D\u5B9A\u753B\u9762",
        screenMedia: "\u30E1\u30C7\u30A3\u30A2\u8868\u793A"
      }
    }
  },
  en: {
    localeName: "English",
    otherLocale: "\u65E5\u672C\u8A9E",
    language: "Language",
    skip: "Skip to content",
    close: "Close",
    all: "All",
    none: "None",
    unknown: "Unknown",
    optional: "Optional",
    reset: "Reset filters",
    remove: "Remove",
    add: "Add",
    replace: "Replace",
    title: "nosmaps \u2014 Find Nostr tools",
    description: "Discover and compare Nostr tools by goal, category, and feature.",
    footer: { source: "View the source on GitHub", sourceNewTab: "View the source on GitHub (opens in a new tab)" },
    categories: {
      clients: { name: "Clients", icon: "smartphone", description: "Clients for timelines and publishing." },
      relay: { name: "Relay operations", icon: "dns", description: "Tools for relay configuration and connectivity." },
      identity: { name: "Identity & keys", icon: "key", description: "Tools for keys and profiles." },
      media: { name: "Media", icon: "movie", description: "Tools for publishing creative media." },
      analytics: { name: "Analytics", icon: "analytics", description: "Tools for observing events and connections." },
      dev: { name: "Developer tools", icon: "code", description: "Tools for inspecting NIPs and events." },
      wallet: { name: "Wallet", icon: "wallet", description: "Bitcoin and Lightning wallets." }
    },
    statuses: { active: "Active", stale: "Stale", dead: "Ended / unreachable", unknown: "Unknown" },
    recordStates: { active: "Published (active)", withdrawn: "Withdrawn" },
    liveness: { unknown: "Unknown", reachable: "Reachable", unreachable: "Unreachable", archived: "Archived", moved: "Moved", superseded: "Superseded" },
    support: {
      supported: "Supported",
      partial: "Partial",
      not_supported: "Not supported",
      not_applicable: "Not applicable",
      planned: "Planned",
      disabled: "Implemented but disabled",
      withdrawn: "Support withdrawn",
      unknown: "Unknown (no claim)",
      out_of_family: "Other spec family"
    },
    evidence: {
      supported: "The primary source asserts it without qualification.",
      partial: "The primary source asserts it with a stated limitation.",
      not_supported: "The primary source explicitly denies it. That is a stronger statement than silence.",
      not_applicable: "The source says the capability does not apply. It is not counted in any denominator.",
      planned: "Listed as intended, not present today.",
      disabled: "Implemented, and switched off by default.",
      withdrawn: "Was supported, and has since been removed.",
      unknown: "The source makes no statement. This is not a denial.",
      out_of_family: "The claims are in another spec family. No NIP claim is recorded."
    },
    registryStatus: { resolved: "Resolved in the registry", not_in_registry: "Not in the registry", unresolvable: "No registry snapshot" },
    basis: { transcribed: "Transcribed (a copy of a document the signer read)", self_declared: "Self-declared", tested: "Tested by running it" },
    observers: { crawler: "Nosmaps observation", community: "Community review", maintainer: "Maintainer statement" },
    landing: {
      headline: "Here's the map of Nostr!",
      lead: "Find and compare Nostr apps and services by purpose and by feature.",
      carouselTitle: "Apps and services",
      carouselLabel: "Apps and services",
      slideLabel: "{name} ({index} of {total})",
      openEntry: "Open {name} in the explorer",
      position: "{index} / {total}",
      previous: "Previous item",
      next: "Next item",
      category: "Category",
      platform: "Platform",
      explorerCta: "Explore by feature",
      explorerHelp: "Filter apps and services by feature and follow the NIP evidence."
    },
    explorer: {
      pageTitle: "Nosmaps \u2014 Explore by feature",
      pageDescription: "Find Nostr tools by feature and compare differences with NIP evidence.",
      location: "Explore by feature",
      back: "Back to the top page",
      search: "Search apps and services",
      searchPlaceholder: "Name, summary, category, OS, delivery, alias",
      featureGroup: "Core features (multiple selection uses AND)",
      categoryGroup: "Filter by category",
      allCategoriesDescription: "Browse tools from every category.",
      candidates: "Candidates",
      noFeature: "No feature selected: showing all candidates",
      featureAnd: "Feature filters (all AND)",
      viewNips: "View NIPs",
      activeAnd: "Active filters (all AND)",
      noExtra: "No additional filters",
      settings: "More filters",
      platform: "OS / platform",
      updateStatus: "Update status",
      activeStatus: "Active, stale, or unknown",
      support: "Feature support",
      featureNeeded: "Select at least one feature to use this filter.",
      delivery: "Delivery",
      webApp: "Web app",
      installed: "Installed app",
      mobileApp: "Mobile app",
      oss: "OSS",
      includeDead: "Include ended / unreachable",
      savedOnly: "Bookmarked only",
      nipSearch: "NIP number or name",
      supportModes: { all: "All (including unknown)", confirmed: "Supported or partial only" },
      supportModeHelp: "Defaults to supported or partial only. Entries with no stated claim (unknown) are not shown by default.",
      unstatedSetAside: "{count} entries state nothing about the selected features. That is not the same as unsupported.",
      showUnstated: "Show unknown as well",
      unknownInfo: "About \u201CUnknown\u201D",
      unknownHelp: "Unknown means the evidence is insufficient, not unsupported. Ended or unreachable entries appear only when selected.",
      selectedCount: "{count} selected (maximum 3)",
      compareByFeature: "Compare features",
      clearSelection: "Clear selection",
      evidenceTitle: "Technical evidence",
      primarySource: "Official NIP source",
      chooseForNips: "Select a feature to show related primary NIP sources.",
      facts: "Facts & observations",
      evaluations: "User evaluations",
      noFeatureCondition: "No feature filter",
      category: "Category",
      observed: "Last observed",
      officialLinks: "Official information for {name}",
      site: "Official site",
      distribution: "Distribution",
      docs: "Official docs",
      source: "Source",
      linkDetails: "{type} information",
      displayUrl: "URL",
      opensInNewTab: "Opens in a new tab",
      checkedAt: "Last checked",
      like: "Like {count}",
      bookmark: "Bookmark",
      bookmarked: "Bookmarked",
      reviews: "Reviews {count}",
      privateDefault: "Private",
      public: "Public",
      publicToggle: "Make public",
      endedRecord: "Ended / unreachable record.",
      alternatives: "Return to active candidates with these features",
      compareAdd: "Add to comparison",
      details: "Details & evidence",
      count: "{count}",
      noMatch: "No candidates match these filters",
      noMatchHelp: "Remove filters one at a time to broaden the results.",
      removeGets: "Remove \u201C{label}\u201D for {count} results",
      resetAll: "Reset every filter",
      conditionFeature: "Feature \u201C{value}\u201D",
      conditionQuery: "Full-text \u201C{value}\u201D",
      conditionPlatform: "OS / platform \u201C{value}\u201D",
      conditionCategory: "Category \u201C{value}\u201D",
      conditionStatus: "Update status \u201C{value}\u201D",
      conditionSupport: "Feature support \u201C{value}\u201D",
      conditionDelivery: "Delivery \u201C{value}\u201D",
      conditionOss: "OSS \u201C{value}\u201D",
      conditionDead: "Include ended / unreachable",
      conditionSaved: "Bookmarked only",
      conditionNip: "NIP \u201C{value}\u201D",
      conditionTool: "Entry \u201C{value}\u201D",
      conditionRemove: "Remove {label}",
      detailKicker: "Support evidence",
      supportFor: "Support for {feature}",
      observer: "Observer",
      nipPurpose: "NIP purpose",
      state: "Status",
      os: "OS / platform",
      license: "License",
      compareTitle: "{count}-way feature comparison",
      differencesFirst: "Items that differ appear first.",
      removeCandidate: "Remove {name} from comparison",
      removeShort: "Remove",
      alternative: "Another candidate",
      replaceTarget: "Candidate to replace",
      addComparison: "Add to comparison",
      replaceComparison: "Replace selected candidate",
      needTwo: "Choose at least two candidates to compare.",
      featuresSection: "Features",
      basicsSection: "Basic information",
      nipEvidence: "NIP evidence",
      reviewTitle: "Reviews for {name}",
      reviewCount: "{count} reviews",
      openGallery: "Image gallery",
      reviewer: "Reviewer",
      postedAt: "Posted",
      use: "Use",
      rating: "Rating",
      appVersion: "App version",
      notEntered: "Not entered",
      helpful: "Helpful {count}",
      unhelpful: "Not helpful {count}",
      voters: "{count} voters \xB7 breakdown",
      writeReview: "Add a review",
      body: "Review",
      bodyPlaceholder: "Where you used it and what you noticed",
      image: "Image",
      deviceImage: "Choose from device",
      osOptional: "OS (optional)",
      versionOptional: "Version (optional)",
      useOptional: "Use (optional)",
      ratingOptional: "Rating (optional)",
      createReview: "Add review",
      chooseBodyOrImage: "Choose text or an image.",
      addedReview: "Review added",
      imageOnly: "No text (image only)",
      profileTitle: "Reviewer profile",
      joined: "Joined",
      activity: "Activity span",
      posting: "Posting pattern",
      voteHistory: "Review and vote history",
      history: "Review history",
      publish: {
        title: "Publish a record",
        lead: "Your NIP-07 extension does the signing; this page never touches a private key. It only says published when the record was read back from a relay.",
        noSigner: "No NIP-07 extension in this browser. Publishing needs one. Browsing is unaffected.",
        signInFirst: "Sign in with NIP-07 to publish.",
        dLocal: "Identifier (the part of d after nosmaps:)",
        dBytes: "{bytes} / {max} bytes for the whole d (the 8 bytes of nosmaps: included)",
        dChangeNote: "Changing the identifier does not update this record; it creates a different one.",
        dLockedNote: "This record is published. The identifier is locked, because changing it would create a different record rather than update this one.",
        name: "Name",
        summary: "Summary",
        summaryHelp: "Leaving this empty is allowed. If the publisher wrote no summary, an empty one is the accurate answer.",
        homepage: "Homepage (optional, must start with https://)",
        topics: "Extra topics (comma separated)",
        topicsHelp: "The nosmaps topic is always attached so the record is discoverable. It cannot be removed.",
        submit: "Sign and publish",
        publishing: "Publishing\u2026",
        eventId: "Signed event id",
        partialConsequence: "Clients that read only the relays which did not accept it will not see this record.",
        clockBumped: "A record at this address was observed with created_at {prior}, so created_at was set to {createdAt} (+1 second) rather than risk losing a same-second tie.",
        clockConflictDetail: "The observed created_at is {prior}, which is ahead of this device clock ({now}). Nothing was signed.",
        headlines: {
          published: "Published to {accepted} of {total} relays and read back.",
          partial: "Published to {accepted} of {total} relays and read back.",
          unconfirmed: "Signed and acknowledged, but we could not read it back in {attempts} attempts. It may still be stored.",
          failed: "Not published.",
          invalid: "This record cannot be published as entered.",
          blocked: "Stopped before signing.",
          other: "State: {state}"
        },
        outcomes: {
          accepted: "accepted (OK true)",
          rejected: "rejected (OK false)",
          timeout: "no answer (undetermined, not a failure)",
          "connection-failed": "could not connect (undetermined)",
          "auth-required": "authentication required",
          "not-attempted": "nothing was sent"
        },
        reasons: {
          "bad-d": "The identifier is not valid (printable ASCII only, 192 bytes for the whole d).",
          "bad-schema": "A required field is missing or a length ceiling was exceeded.",
          "foreign-d": "The identifier points outside the nosmaps: namespace.",
          "foreign-profile": "The content is not the nosmaps profile.",
          "bad-topic": "A topic is not valid (empty, or over 128 bytes).",
          "multi-value-t": "A t tag carries only one value.",
          "uppercase-topic": "Topics are lowercase only.",
          "unknown-field": "A field outside the v1 profile is present.",
          "bad-version": "version must be 1.",
          "bad-state": "state must be active or withdrawn.",
          "bad-superseded-by": "superseded_by is not a valid coordinate.",
          "tag-content-mismatch": "The state tag disagrees with the state in content.",
          "future-timestamp": "created_at is ahead of this device clock.",
          "future-horizon": "created_at is too far in the future.",
          "signer-absent": "No NIP-07 extension was found.",
          "signer-rejected": "The NIP-07 extension returned no signature. If you dismissed the prompt, try again.",
          "signer-wrong-pubkey": "The extension signed with a different public key than the one you signed in with. Nothing was sent.",
          "signer-mutated-event": "The extension changed the event we handed it. Nothing was sent.",
          "signer-missing-fields": "The signed event returned by the extension is not readable. Nothing was sent.",
          "signer-invalid-record": "The signed event did not pass validation. Nothing was sent.",
          "nip07-key-unparsable": "The extension returned a value that is not a readable public key.",
          "pubkey-mismatch": "A different public key came back than the one you signed in with. Nothing was sent.",
          "clock-conflict": "A record at this address is already timestamped ahead of this device\u2019s clock. Check your system time.",
          "relay-unavailable": "The relay layer could not be initialised.",
          "all-relays-rejected": "Every relay refused it.",
          "publish-error": "Publishing errored part way through. Whether it was stored is unknown.",
          "not-returned-yet": "It did not come back in this round. That is not a claim that it is absent.",
          "query-failed": "The read-back query itself failed, so nothing was learned.",
          "readback-quarantined": "The event we read back was quarantined by validation.",
          "superseded-during-publish": "A newer event was observed at the same coordinate.",
          "no-readback": "The read-back could not be run.",
          unavailable: "The data layer is not loaded.",
          unknownReason: "Reason: {reason}"
        }
      },
      manage: {
        title: "Records you published",
        loading: "Asking the relays\u2026",
        empty: "No record signed by you was observed on these relays. That is not a claim that none exists.",
        queryFailed: "The query did not complete, so the number of records is unknown, not zero. Nothing was observed.",
        unavailable: "Not one relay could be reached, so nothing was observed at all.",
        truncated: "Read up to the ceiling of {limit} records. There may be more than this list shows.",
        count: "{count} records",
        coordinate: "Identifier d",
        updatedAt: "Last updated",
        withdraw: "Withdraw",
        withdrawing: "Withdrawing\u2026",
        withdrawConfirm: "Withdraw it",
        withdrawCancel: "Cancel",
        withdrawPrompt: "Withdraw \u201C{name}\u201D. Withdrawal is not deletion: clients that observe the withdrawal stop listing this record, but no event is erased, and relays or clients that never observe it keep serving the older version.",
        withdrawHeadlines: {
          confirmed: "The withdrawal was read back and confirmed ({accepted} of {total} relays took it).",
          partial: "The withdrawal was read back, but only {accepted} of {total} relays took it.",
          unconfirmed: "The withdrawal could not be read back after {attempts} attempts. Whether it arrived is unknown.",
          failed: "The withdrawal reached no relay at all.",
          invalid: "The record failed validation, so nothing was signed.",
          blocked: "The withdrawal stopped before anything was sent. Nothing was signed.",
          other: "Withdrawal state: {state}"
        },
        withdrawNotDeletion: "Withdrawal is not deletion. No event is erased from relays that hold the older version.",
        withdrawStillActive: "The withdrawal has not been read back, so some clients still see this record as active.",
        withdrawPartialActive: "Clients reading only the relays that did not take the withdrawal still see this record as active."
      },
      viewer: {
        label: "Viewer sign-in state",
        signedIn: "Signed in",
        signedOut: "Not signed in",
        signIn: "Sign in with NIP-07",
        signingIn: "Connecting\u2026",
        signOut: "Sign out",
        reasonDetail: "{reason} (extension said: {detail})",
        reasons: {
          noExtension: "No NIP-07 extension found (this browser has no window.nostr).",
          rejected: "The NIP-07 extension did not allow sharing the public key.",
          error: "The NIP-07 extension returned an error.",
          timeout: "The NIP-07 extension did not answer within {seconds} seconds.",
          badKey: "The NIP-07 extension returned a value that is not a readable public key."
        }
      },
      galleryTitle: "Review images for {name}",
      galleryEmpty: "No images have been attached yet.",
      enlarge: "Enlarge",
      originalReview: "Original review",
      imageTitle: "Review image",
      remainingGallery: "Open gallery including {count} more",
      imageAlt: "Review image by {author} on {date}",
      voteBreakdown: "Vote breakdown",
      communityVotes: "Community votes",
      helpfulVotes: "Helpful",
      unhelpfulVotes: "Not helpful",
      toastLiked: "Like updated",
      toastLikeUnconfirmed: "A relay accepted it, but it has not been read back yet",
      toastLikeFailed: "The like could not be sent",
      likeAdd: "Like (publishes a kind 7 to the relays)",
      likeRetract: "Remove like (publishes a kind 5 to the relays)",
      likeSending: "Sending\u2026",
      likeNeedsSigner: "Liking needs a NIP-07 extension",
      likeNeedsSignIn: "Sign in with NIP-07 to like",
      likeNoTarget: "This row states no coordinate to react to",
      toastBookmarked: "Bookmark updated",
      toastVoted: "Vote updated",
      toastPublic: "Visibility updated",
      compareLimit: "You can compare up to three",
      loading: "Loading feature support\u2026",
      emptyState: "There are no candidates",
      errorState: "Feature information could not be loaded",
      retry: "Retry",
      partialState: "Showing part of the candidate list.",
      offlineState: "Showing saved candidates.",
      offlineBanner: "Offline: showing saved candidates.",
      staleState: "Showing records observed earlier; the current round could not be completed.",
      incompleteState: "Some relay results did not complete, so this list is partial.",
      unavailableState: "No displayable record was observed on the configured relays. That is not a claim that none exists.",
      sampleData: "Sample",
      relayVerified: "Relay-verified",
      relayEmptyTitle: "No matching record",
      relayEmpty: "No kind 30078 record carrying the queried topic was observed on the configured relays. That is not a claim that none exists.",
      relayDiagnostics: "Relay diagnostics",
      relayNoData: "Relay results could not be retrieved.",
      relayReload: "Refetch from relays",
      relayRelays: "Relays and coverage",
      relayCurators: "Recommenders in your network",
      relayNoCuration: "No kind 30267 set was observed",
      relayManualCurators: "Manually counted pubkeys",
      relayCuratorSets: "Sets",
      relayCuratorSetsValue: "{used} / {observed}",
      relayCuratorMembers: "Members",
      relayGraph: "Social graph",
      relayGraphState: "State",
      relayGraphCoverage: "Coverage",
      relayGraphFollows: "Graph size |G|",
      relayGraphFollowsValue: "{used} of {total}",
      relayGraphMalformed: "Malformed p tags",
      relayViewer: "Viewer key",
      relayViewerSource: "Key source",
      relayRounds: "Rounds",
      relayChunks: "Chunks",
      relayQuarantined: "Quarantined",
      relayUnresolved: "Recommended but unobserved coordinates",
      relaySlugs: "Diagnostics",
      relayAsOf: "As of",
      relayReqs: "REQ counts",
      relayLogical: "Logical REQs",
      relayPhysical: "Physical REQs",
      relayHttp: "HTTP attempts",
      relayCache: "Cache hits",
      relayReason: "Reason",
      discoveryScope: "Records that published topic \u201C{topics}\u201D on your relays \u2014 not all tools.",
      recommendations: "Recommended by {count} in your network",
      recommendationsUnknown: "Recommendations: unknown (needs a follow list)",
      graphNoneBanner: "Not personalised \u2014 recommendation counts need a follow list. Connect a Nostr key, or paste an npub to rank in read-only mode.",
      graphConnect: "Connect a Nostr key (NIP-07)",
      graphPasteLabel: "npub or hex",
      graphApply: "Rank with this key",
      graphStateLine: "Graph: {state} ({coverage} \xB7 {used} of {total} in your graph)",
      graphStateLineShort: "Graph: {state} ({coverage})",
      graphStates: { none: "none", "self-only": "self-only", tier1: "tier1", "tier1+tier2": "tier1+tier2" },
      graphCoverage: { fresh: "fresh", stale: "stale", incomplete: "incomplete", truncated: "truncated", unknown: "unknown" },
      coverage: { eose: "Complete (EOSE)", timeout: "Timeout", error: "Error", "auth-required": "Auth required", rejected: "Rejected", disconnected: "Disconnected", skipped: "Not issued" },
      features: { posts: ["Posts & replies", "Read, write, and reply on a timeline", "timeline post reply"], dm: ["DM", "Send encrypted direct messages", "encrypted DM direct message"], search: ["Search", "Find posts, people, and identifiers", "search person identifier"], media: ["Images & video", "View and publish images or video", "media image video"], notifications: ["Notifications", "Notice replies, reactions, and zaps", "notification reaction"], accounts: ["Multiple accounts", "Switch between keys and profiles", "multi account"], signing: ["External signing", "Keep private keys separate from the app", "remote signing"], wallet: ["Wallet & Zap", "Use zaps and wallet connections", "payment tip"], longform: ["Long-form", "Write articles and longer content", "article long form"], community: ["Channels", "Talk and organize in communities", "channel community"] },
      reviewsSeed: { aBody: "Readable across devices, and notification settings were easy to find.", bBody: "The path from search results back to a profile was clear.", cBody: "It was easy to follow the conversation alongside images.", aBio: "Reviews client navigation and accessibility across several operating systems.", bBio: "Records first-use and comparison findings.", aSpread: "28 months \xB7 11 categories \xB7 Web/Desktop/Mobile", bSpread: "9 months \xB7 6 categories \xB7 mostly Web", aPosts: "2\u20139 per month: short posts, images, and notes.", bPosts: "1\u20134 per month: comparisons and replies.", localName: "You", localBio: "Reviews added on this screen.", screenTimeline: "Timeline", screenSettings: "Settings", screenMedia: "Media view" },
      /* issue #1 / #21: sort orders. Only keys that name something the records
         state. There is no "newest release" — the records publish no date of
         their own. What they do carry is the event's created_at, the moment they
         were collected, and that is exactly what these two keys are called. */
      sort: {
        label: "Sort by",
        "default": "Default order",
        "name-asc": "Name (A\u2192Z)",
        "name-desc": "Name (Z\u2192A)",
        "likes-desc": "Most liked",
        "likes-asc": "Fewest liked",
        "collected-desc": "Newest collected",
        "collected-asc": "Oldest collected",
        /* One sentence per dimension: what the set-aside rows are missing differs. */
        unranked: {
          likes: {
            heading: "Likes: not observed",
            notice: "{count} entries have no observed like count and are left out of this order (that is not the same as zero)."
          },
          collected: {
            heading: "Collection date: not observed",
            notice: "{count} entries carry no collection date and are left out of this order (that is not the same as being the oldest)."
          }
        }
      },
      summaryAbsent: "No summary published",
      freeTopic: "A topic the record published; this client ships no label for it.",
      recordState: "Record state",
      recordStateFilter: "Record state",
      recordStateHelp: "A separate axis from project liveness.",
      liveness: "Project liveness",
      livenessDerived: "Liveness check: {value}",
      livenessFromSource: "Grounds for reachable: {url} (a response was recorded on {date})",
      livenessUncounted: "No social graph, so none of the {count} recorded observations is counted.",
      capabilityClaims: "Capability claims",
      noClaimPublished: "No capability claim published",
      noNipClaims: "No NIP claims recorded",
      claimFamilyCount: "{count} {family} claims",
      claimSource: "Claim source",
      claimCaveats: "Verbatim caveats from the source",
      caveat: "Caveat",
      basis: "Claim basis",
      assertedAt: "Claim fetched",
      notation: "Source notation",
      sourceText: "Verbatim source line",
      registryStatus: "Registry resolution",
      registryDeprecated: "unrecommended in the registry",
      notInRegistry: "not in the pinned registry snapshot {revision}",
      noRegistrySnapshot: "no registry snapshot for family {family}",
      primarySources: "Sources",
      noOfficialLinks: "No link is recorded",
      noReviewsObserved: "No reviews observed",
      collectedData: "From primary sources",
      platformSourced: "Matches only entries with a recorded platform.",
      topicCorrection: "Collected topics: {collected} \u2014",
      nonClaim: { modules: "Modules named after NIPs (not a support claim)", crates: "Crates named after NIPs (not a support claim)" },
      nipPurposes: { "01": "Basic events, signatures, and client/relay messages", "02": "Follow lists using kind 3", "05": "Verification between DNS identifiers and public keys", "09": "Event deletion requests using kind 5", "11": "Relay information retrieved over HTTP", "19": "bech32 identifiers such as npub and note", "21": "Identifier links using the nostr: URI scheme", "23": "Long-form content using kind 30023", "25": "Reactions using kind 7", "42": "Client authentication to relays", "44": "Versioned encrypted payloads", "46": "Remote signing with private keys kept separate", "47": "Remote Lightning wallet connections", "57": "Lightning payments using zap requests and receipts", "65": "Read/write relay lists using kind 10002", "78": "Storage for app-specific data" }
    }
  }
};
var valid = (value) => typeof value === "string" && Object.prototype.hasOwnProperty.call(dictionaries, value);
function detectLanguage() {
  let stored;
  try {
    stored = sessionStorage.getItem("nosmaps.language");
  } catch {
    stored = null;
  }
  if (valid(stored)) return stored;
  const candidates = [...navigator.languages ?? [], navigator.language ?? ""];
  const detected = candidates.find((item) => /^(ja|en)\b/i.test(item));
  return /^en\b/i.test(detected ?? "") ? "en" : "ja";
}
var language = detectLanguage();
var listeners = /* @__PURE__ */ new Set();
function read(object, path) {
  return path.split(".").reduce((value, key) => {
    if (value === void 0 || typeof value === "string") return void 0;
    if (Array.isArray(value)) {
      const index = Number(key);
      return Number.isInteger(index) ? value[index] : void 0;
    }
    return value[key];
  }, object);
}
function format(value, variables = {}) {
  return value.replace(/\{(\w+)\}/g, (_match, key) => {
    const supplied = variables[key];
    return supplied === void 0 ? `{${key}}` : String(supplied);
  });
}
var missing = [];
var reported = /* @__PURE__ */ new Set();
function reportMissing(path, selectedLanguage, detail) {
  const signature = `${selectedLanguage}:${path}:${detail}`;
  missing.push({ path, language: selectedLanguage, detail });
  if (reported.has(signature)) return;
  reported.add(signature);
  console.error(`[nosmaps i18n] ${detail}: "${path}" (language: ${selectedLanguage})`);
}
var i18n = {
  get language() {
    return language;
  },
  get dictionaries() {
    return dictionaries;
  },
  get missing() {
    return missing.map((entry) => ({ ...entry }));
  },
  has(path, selectedLanguage = language) {
    return read(dictionaries[selectedLanguage], path) !== void 0 || read(dictionaries.ja, path) !== void 0;
  },
  /** The raw node, undefined and all: `value` is the lookup that is allowed to
      come back empty, and saying so is what stops a miss from being stringified
      further down. Callers that reach markup go through `t`, which has no hole. */
  value(path, selectedLanguage = language) {
    const found = read(dictionaries[selectedLanguage], path) ?? read(dictionaries.ja, path);
    if (found === void 0) reportMissing(path, selectedLanguage, "missing translation key");
    return found;
  },
  /** Always a string, per the missing-key contract above -- the key path stands
      in for a missing or non-string key. Declaring the return type is what makes
      handing `found` straight back an error rather than a silent "undefined". */
  t(path, variables, selectedLanguage = language) {
    const found = i18n.value(path, selectedLanguage);
    if (typeof found === "string") return format(found, variables);
    if (found !== void 0) {
      reportMissing(path, selectedLanguage, "translation key is not a string");
    }
    return path;
  },
  set(next) {
    if (!valid(next) || next === language) return;
    language = next;
    try {
      sessionStorage.setItem("nosmaps.language", language);
    } catch {
    }
    document.documentElement.lang = language;
    listeners.forEach((listener) => listener(language));
  },
  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  applyDocument() {
    document.documentElement.lang = language;
  }
};
i18n.applyDocument();

// src/ui/icons.ts
var paths = {
  apps: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
  tag: "M21.4 11.6l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l9 9c.4.4.9.6 1.4.6s1-.2 1.4-.6l7-7c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z",
  smartphone: "M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-6 3h2v-1h-2v1z",
  dns: "M20 13H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM6 18.5A1.5 1.5 0 1 1 6 15a1.5 1.5 0 0 1 0 3.5zM20 3H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 8.5A1.5 1.5 0 1 1 6 5a1.5 1.5 0 0 1 0 3.5z",
  key: "M7 14a5 5 0 1 1 4.9-6H22v4h-2v2h-2v2h-6.1A5 5 0 0 1 7 14zm0-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  movie: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM4 10h16v9H4v-9z",
  analytics: "M5 9.2h3V19H5V9.2zM10.5 5h3v14h-3V5zM16 12h3v7h-3v-7z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  mail: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  search: "M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 11.5 11 14.51 14.5 10l4.5 6H5l3.5-4.5z",
  notifications: "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  account: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  wallet: "M21 7V5c0-1.1-.9-2-2-2H5C3.34 3 2 4.34 2 6v12c0 1.66 1.34 3 3 3h16V9h-4c-1.1 0-2-.9-2-2H5a1 1 0 0 1 0-2h14v2h2zm-4 4h2v4h-2v-4z",
  article: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z",
  groups: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3a3 3 0 0 0 0 6zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
};
function svg(name, className = "material-icon") {
  const path = paths[name] ?? paths["apps"] ?? "";
  return `<svg class="${className}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="${path}"></path></svg>`;
}
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initialOf(tool) {
  const name = typeof tool?.name === "string" ? tool.name.trim() : "";
  const first = [...name][0];
  return first ? first.toLocaleUpperCase() : "";
}
function placeholderMarkup(initial) {
  return `<span class="entity-icon is-placeholder" data-entity-initial="${esc(initial)}" aria-hidden="true"></span>`;
}
function placeholderElement(initial) {
  const span = document.createElement("span");
  span.className = "entity-icon is-placeholder";
  span.setAttribute("data-entity-initial", initial);
  span.setAttribute("aria-hidden", "true");
  return span;
}
function entity(tool) {
  const initial = initialOf(tool);
  const icon = tool ? tool.icon : null;
  const url = icon && typeof icon.url === "string" ? icon.url : "";
  if (!url) return placeholderMarkup(initial);
  return `<img class="entity-icon" src="${esc(url)}" data-entity-initial="${esc(initial)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}
document.addEventListener("error", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement) || !target.classList.contains("entity-icon")) return;
  target.replaceWith(placeholderElement(target.getAttribute("data-entity-initial") ?? ""));
}, true);
var icons = Object.freeze({ svg, entity, names: Object.freeze(Object.keys(paths)) });

// src/ui/carousel.ts
var ROTATION_MS = 2500;
function esc2(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
var t = (key, variables) => i18n.t(key, variables);
function mountLanding(data) {
  const entries = data.tools.filter((tool) => tool && tool.name);
  const PAD = entries.length > 2 ? 2 : 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = { index: 0, position: 0, paused: false };
  let timer = null;
  let track = null;
  let viewport = null;
  const wrap = (position2) => {
    const total = entries.length;
    return total ? (position2 % total + total) % total : 0;
  };
  const seedTopics = data.seedTopics ?? [];
  function languageControl() {
    return `<div class="language-switch" role="group" aria-label="${esc2(t("language"))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === "ja"}">\u65E5\u672C\u8A9E</button><button type="button" data-language="en" aria-pressed="${i18n.language === "en"}">English</button></div>`;
  }
  function fact(label, value) {
    return `<div class="slide-fact"><span class="slide-fact-label">${esc2(label)}</span><span class="slide-fact-value">${esc2(value)}</span></div>`;
  }
  function slots() {
    const items = entries.map((tool, index) => ({ tool, index, clone: false }));
    if (!PAD) return items;
    const before = items.slice(-PAD).map((item) => ({ ...item, clone: true }));
    const after = items.slice(0, PAD).map((item) => ({ ...item, clone: true }));
    return [...before, ...items, ...after];
  }
  function topicLabel(topic) {
    if (!seedTopics.includes(topic)) return topic;
    const node = i18n.value(`categories.${topic}`);
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const name = node.name;
      if (typeof name === "string") return name;
    }
    return topic;
  }
  function slide(item, slot) {
    const tool = item.tool;
    const label = (tool.topics ?? []).map(topicLabel).join(" / ");
    const facts = [
      label ? fact(t("landing.category"), label) : "",
      tool.platformText ? fact(t("landing.platform"), tool.platformText) : ""
    ].filter(Boolean);
    const accessibleName = t("landing.slideLabel", {
      name: tool.name,
      index: item.index + 1,
      total: entries.length
    });
    const identity = item.clone ? 'data-clone="true"' : `data-slide-index="${item.index}"`;
    const href = `nip-explorer.html?tool=${encodeURIComponent(tool.id)}`;
    const body = `<div class="slide-identity">${icons.entity(tool)}<h3 class="slide-name">${esc2(tool.name)}</h3></div><p class="slide-description${tool.summaryAbsent ? " is-unknown" : ""}">${esc2(tool.summaryAbsent ? t("explorer.summaryAbsent") : tool.summary)}</p>${facts.length ? `<div class="slide-facts">${facts.join("")}</div>` : ""}`;
    return `<article class="carousel-slide" role="group" aria-label="${esc2(accessibleName)}" aria-hidden="true" data-slot-index="${slot}" ${identity}><a class="slide-link" href="${esc2(href)}" data-slide-link="${esc2(tool.id)}" aria-label="${esc2(t("landing.openEntry", { name: tool.name }))}" tabindex="-1">${body}</a></article>`;
  }
  function position() {
    return t("landing.position", { index: state.index + 1, total: entries.length });
  }
  function carousel() {
    return `<section class="carousel" id="carousel" aria-label="${esc2(t("landing.carouselLabel"))}"><div class="carousel-head"><h2>${esc2(t("landing.carouselTitle"))}</h2></div><div class="carousel-viewport" id="carousel-viewport"><div class="carousel-track" id="carousel-track">${slots().map(slide).join("")}</div></div><div class="carousel-controls"><button class="carousel-nav" type="button" data-carousel-step="-1" aria-controls="carousel-track" aria-label="${esc2(t("landing.previous"))}" title="${esc2(t("landing.previous"))}">\u2039</button><span class="carousel-position" id="carousel-position">${esc2(position())}</span><button class="carousel-nav" type="button" data-carousel-step="1" aria-controls="carousel-track" aria-label="${esc2(t("landing.next"))}" title="${esc2(t("landing.next"))}">\u203A</button></div></section>`;
  }
  function step() {
    if (!track) return 0;
    const slides = track.querySelectorAll(".carousel-slide");
    const first = slides[0];
    const second = slides[1];
    if (slides.length < 2 || !second) return first ? first.offsetWidth : 0;
    return second.offsetLeft - (first?.offsetLeft ?? 0);
  }
  function offset() {
    if (!track || !viewport) return 0;
    const first = track.querySelector(".carousel-slide");
    if (!first) return 0;
    return (state.position + PAD) * step() - (viewport.clientWidth - first.offsetWidth) / 2;
  }
  function applyTransform(animate) {
    if (!track) return;
    if (!animate) track.style.transition = "none";
    track.style.transform = `translate3d(${-Math.round(offset())}px, 0, 0)`;
    if (!animate) {
      void track.offsetWidth;
      track.style.transition = "";
    }
  }
  function normalise() {
    const wrapped = wrap(state.position);
    if (wrapped === state.position) return;
    state.position = wrapped;
    applyTransform(false);
  }
  function paint() {
    if (!track) return;
    const centre = state.position + PAD;
    track.querySelectorAll(".carousel-slide").forEach((element) => {
      const distance = Number(element.dataset["slotIndex"]) - centre;
      element.classList.toggle("is-current", distance === 0);
      element.classList.toggle("is-side", Math.abs(distance) === 1);
      const exposed = !element.dataset["clone"] && Number(element.dataset["slideIndex"]) === state.index;
      if (exposed) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", "true");
      const link = element.querySelector(".slide-link");
      if (link instanceof HTMLAnchorElement) link.tabIndex = exposed ? 0 : -1;
    });
    const indicator = document.querySelector("#carousel-position");
    if (indicator) indicator.textContent = position();
  }
  function show(delta) {
    if (!entries.length) return;
    normalise();
    state.position += delta;
    state.index = wrap(state.position);
    applyTransform(true);
    if (reducedMotion.matches) normalise();
    paint();
  }
  function stopRotation() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }
  function startRotation() {
    stopRotation();
    if (reducedMotion.matches || state.paused || entries.length < 2) return;
    timer = setInterval(() => show(1), ROTATION_MS);
  }
  function setPaused(paused) {
    state.paused = paused;
    if (paused) stopRotation();
    else startRotation();
  }
  function bindCarousel() {
    const element = document.querySelector("#carousel");
    track = document.querySelector("#carousel-track");
    viewport = document.querySelector("#carousel-viewport");
    if (!element || !track) return;
    element.addEventListener("mouseenter", () => setPaused(true));
    element.addEventListener("mouseleave", () => setPaused(false));
    element.addEventListener("focusin", () => setPaused(true));
    element.addEventListener("focusout", (event) => {
      const related = event instanceof FocusEvent ? event.relatedTarget : null;
      if (!(related instanceof Node) || !element.contains(related)) setPaused(false);
    });
    track.addEventListener("transitionend", (event) => {
      if (event.target !== track || event.propertyName !== "transform") return;
      normalise();
      paint();
    });
    state.position = state.index;
    applyTransform(false);
    paint();
  }
  function render2() {
    document.title = t("title");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("description");
    const skip = document.querySelector("#skip-link");
    if (skip) skip.textContent = t("skip");
    const header = document.querySelector("#site-header");
    if (header) {
      header.innerHTML = `<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">N</span><span>nosmaps</span></a>${languageControl()}`;
    }
    const main = document.querySelector("#main");
    if (main) {
      main.innerHTML = `<section class="hero"><h1>${esc2(t("landing.headline"))}</h1><p class="lead">${esc2(t("landing.lead"))}</p><p class="hero-actions"><a class="primary link-button" href="nip-explorer.html">${esc2(t("landing.explorerCta"))}</a></p><p class="hero-help">${esc2(t("landing.explorerHelp"))}</p></section>${carousel()}`;
    }
    bindCarousel();
    startRotation();
  }
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const language2 = target.closest("[data-language]");
    if (language2) {
      const next = language2.dataset["language"];
      if (next !== void 0) i18n.set(next);
      return;
    }
    const control = target.closest("[data-carousel-step]");
    if (control) {
      show(Number(control.dataset["carouselStep"]));
      startRotation();
    }
  });
  window.addEventListener("resize", () => applyTransform(false));
  reducedMotion.addEventListener("change", () => {
    applyTransform(false);
    startRotation();
  });
  i18n.onChange(render2);
  render2();
}

// src/ui/site-footer.ts
var SOURCE_URL = "https://github.com/kojira/nosmaps";
function esc3(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
function render() {
  const footer = document.querySelector("#site-footer");
  if (!footer) return;
  footer.innerHTML = `<div class="site-footer-inner"><a class="footer-source" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${esc3(i18n.t("footer.sourceNewTab"))}">${esc3(i18n.t("footer.source"))}</a></div>`;
}
function mountSiteFooter() {
  i18n.onChange(render);
  render();
}

// src/entry/landing.ts
window.NOSMAPS_I18N = i18n;
mountLanding(readCatalogueData());
mountSiteFooter();
