# 固定SNS画像とホーム・結果共有の確認

## 変更と維持するもの

- 正式名: 尊厳を賭けようか。正式URL: https://chameleonjp.codeberg.page/songen_wo_kakeyouka/
- GitHubリポジトリの旧名 songen_test からの改名を理由に、既存ゲームslug/参加者/保存識別値は変更しない。
- 実ゲームから固定1200×630 PNGを作成し、OG/Twitterと配布対象へ追加。画像は紹介用の構成であり、画面全体をそのまま掲載したものではない。
- 全15言語のホーム/結果共有文に正式タグ `#尊厳を賭けようか #ゲーム制作` を付加。他の翻訳、点数計算、ゲームルール、ランキング契約は変更しない。
- Xボタンは元からホーム/結果にある。通常画面の独立コピー専用ボタンはない。既存のnoopener/ポップアップ失敗時のコピーfallbackは維持する。

## 実素材

- 素材固定commit: `8bebe23f8984e7e81f37bdf078597a7867deba24`。
- 素材検証CI: https://github.com/chameleonjp-lab/songen_wo_kakeyouka/actions/runs/41438016239
- 匿名の通常CPU戦、既存設定UIから😺/🐻を選択、seed31。通常カウントダウン後の実DOMステージを取得し、実時間・ルール・描画を改変していない。
- 元画像1000×616 SHA-256: `3d4a0dd679966e47bea50bc18aa1007ecc746718e449d88031bc8399bdbadc82`。
- 実盤面の人物部分を等比拡大・切り出し、タイトル/紹介文だけを追加。架空の場面、実参加者の名前、試験スコアは含めない。画面内のCPU名は既存のランダム候補であり本人名ではない。
- 最終 `assets/social-card.png`: 1200×630 / 449816 bytes / SHA-256 `c2f17ea86cb9963b39c57b058340e729071c42be8cd267040226143f0fd7d5bd`。
- 「心臓を拳で狙う」「頭・腕・脚が壊れる」は既存ルールm013/m017と実装に基づく。AI生成のゲーム画面ではない。

## 検査範囲

- `npm run check`、`npm test`。実共有関数の15言語/4結果/CPU・local2p/負・零・大きい点数で、ゲーム名・結果・点数・URL・2タグと280文字相当以内を確認。元結果オブジェクト不変。
- PNG寸法とmetadata、実buildがPNGを配布し開発資料を配布しないことを確認。
- 既存実ブラウザ回帰のassert/RPCmockを維持し、ローカル静的ファイルを直接返す方式へ変更。ネットワークへの転送/リダイレクトは行わない。Service WorkerとWebSocketも遮断。
- 新しい実可視受入はChromium/WebKit各18ケース（15言語393×852縦＋日本語・英語・ドイツ語852×393横）。通常匿名CPU開始→リタイア→結果表示を使用し、ゲーム時計や終了関数の差し替えはしない。
- X黒地白文字・44px以上・全文・全矩形viewport内・祖先clip/透明度・中心hit・1操作1intent・実共有文一致・結果と端末内記録不変を確認。代表画像をartifactへ保存して実見する。
- 大半の可視ケースはwindow.openのURL引数を捕捉する検査。加えて日本語縦1ケースずつは実window.open/実popupを開き、その最初の要求だけをcontext routeでローカルHTMLとして返す。X本番への通信や投稿は行わず、null fallbackの検査と分離する。
- ランキング読取はローカル空配列mockのみ。実スコア送信を含む他の外部HTTPは遮断する。公開ランキングへ試験値を送らない。
- 横画面はスクロール後にXボタンへ到達して押せる範囲の受入であり、画面全体が一画面内に収まる保証ではない。
- iPhone Safari実機、翻訳の母語話者評価、Xカードの本番取得/キャッシュ、正式公開先の配信は別途未確認。

## 適用・戻し方

本人がPRを確認してマージする。作業branch/PRからPages artifact uploadや配備は実行しない。検証専用の作業branch push triggerはPR作成前に除く。
OG/Twitter画像URLだけは実配信を確認済みのGitHub Pages https://chameleonjp-lab.github.io/songen_wo_kakeyouka/assets/social-card.png を使用する（既存indexは2026-11-02 06:00 UTCにHTTP200、main `268f9bfff4226aa74f2e4c64e3e3123bf9cb8e82` と全文一致確認済み）。この新画像自体はマージ後の配信待ちであり、まだ公開到達済みとは扱わない。canonicalと共有先URLは正式Codebergのまま維持する。
GitHubマージとCodeberg正式URLへの配信は同一ではない。このPRで登録URLの切替やCodeberg公開を実行しない。正式先へ反映されるまでカード画像の配信完了とは扱わない。

公開後、iPhoneでホームと結果のXを押し、ゲーム名・点数・2タグを確認。X投稿前にキャンセルしてもよい。ポップアップ制限時は既存コピーfallbackを確認。画像URLと実カードの反映は別に確認する。
戻す場合はこのPRの変更を通常のrevert PRにし、既存スコアや端末内参加者情報を削除しない。
