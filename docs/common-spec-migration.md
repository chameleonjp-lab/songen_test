# 尊厳を賭けようか — 共通仕様と移行前確認

確認日: 2026-11-02 JST。対象は無印 `songen_wo_kakeyouka`。2・3とは別ゲームです。

## 対象・正本・差分

- 現登録・公開: 実験場の有効データと表示カード、[現 Codeberg ページ](https://chameleonjp.codeberg.page/songen_wo_kakeyouka/) を照合。
- [既存 GitHub main](https://github.com/chameleonjp-lab/songen_test/commit/6d6032c3a358085469de9d187f3f24602f85b599) は同じ題名・slug・紹介・7ルール。新規リポジトリや登録追加は行いません。
- 公開 Codeberg は CPU 戦のみ、version `songen_wo_kakeyouka_v1_20260606_40_remove_dangling_async`。GitHub main は従来から固定 tick、入力ログ、ローカル2人対戦、オンラインβのメモリ内待ち合わせ mock を含みます。実際のネット対戦は未実装です。
- 公開版と GitHub の採点関数 `calcScore`、攻撃可否、ジャンプ可否、攻撃高さ、ガード判定、前面腕/足の選択などは一致。制限時間180秒・部位耐久・移動/スタミナ等の定数も一致。一方 CPU 時刻制御は異なり、全機能同等・操作感同等・移行先が完全上位版とはまだ断言できません。
- GitHub にあった名前必須は、公開 Codeberg では空欄で遊べることと食い違っていました。今回は名前を任意にし、空欄を公開用の「名無し」に変換して送らないよう分離します。
- 今回は GitHub main の戦闘コアを維持。14関数の固定ハッシュ検査があります。採点・180秒・リタイアの既存結果扱い・内部 `player/cpu` ・`cpu/local2p` ・slug は変更していません。

- 2026-11-02 02:39 JST に既存ソース記載の GitHub URL `https://chameleonjp-lab.github.io/songen_test/` を開くと GitHub Pages「Site not found / 404」を確認。GitHub公開成功ではなく、初回配信準備の段階です。

## 13項目の対応表

|項目|状態・根拠 / 残る制限|
|---|---|
|1 対象条件|現登録・Codeberg公開確認。GitHubへの公開切替は未実施|
|2 既存記録/ルール|既存キー `songen_player_name` / `songen_local_player_id` を維持。戦闘主要14関数ハッシュ、採点検査。新しい端末設定は `songen_` 接頭辞|
|3 正式URL移行|準備中。共有は現在確認済みCodeberg URLのまま。GitHub実ページ・固定tick操作感・データ引継ぎ確認前に旧リンクやDBを変更しない|
|4 15言語|表示用辞書・選択保存・ブラウザ言語fallback・動的結果/ランキング/エラー。サイノメ基準はmain `79b1e5733e725cd1148b10fa5699ba846e2bf57d` の15言語。自然さは母語話者未確認。プレイヤー名/識別値は翻訳しない|
|5 任意名/送信|ホーム任意名、説明、開始時snapshot、匿名送信0、ローカル2人既存非送信、UUID別永続receipt、同UUID再送。名前変更で別参加者を作る処理は追加していない。サーバー名同一性問題は未解決|
|6 ランキング|ホーム/結果とも実カード詳細URL。既存集計RPCへ30行要求、loading/empty/failure/retry、古い応答抑止。既存サーバーは名前集計のため「異なる本人30人」は未保証。本人順位/人数の推測なし|
|7 X共有|黒白、home紹介/result今回結果とmode/score、利用者確定、コピー代替。個人名は含めない。投稿完了とは表示しない|
|8 効果音|下記イベント表。ブラウザ生成のみ、音声なしでも判定/情報を維持|
|9 初回音|初回on/0.35、保存off/0を尊重、gesture開始、interrupted/hiddenで古い音停止、6voice上限。実際の聞こえ方とiPhoneは未確認|
|10 UI/IME|home導線、44px操作、16px入力、長文折返し、安全領域、IME中開始/キー操作除外。実機受入は未実施|
|11 公開|PRは検査のみ。main push時に同commit検査/build成果物、current main/既存workflow Sourceを確認し配備。設定変更なし。Source未確認・本番配備未実施|
|12 検証|Node/HappyDOM mock、syntax/辞書placeholder/主要coreハッシュ。実スコア送信なし。実機/実音/本番受入とは区別|
|13 成果物|ゲーム別Draft PR、当資料、テスト。本人マージと公開後確認待ちを分離|

## 送信とランキングの依存関係

既存通常集計の `submit_score` は再送受付を識別できません。本変更は通常用 `submit_score_once_shared_v1` に固定UUID・開始時名・同じ確定スコアを渡します。未導入/失敗時は結果とreceiptを保持し、非冪等の旧RPCへfallbackしません。

関連: [実験場 PR #43](https://github.com/chameleonjp-lab/chameleonjp_lab/pull/43)。同PRの通常用receipt SQLは別の適用作業です。このゲームPRだけではDBへ適用されません。既存名前キーを別人に分ける方式・過去スコア帰属・独立参加者30人は別途方式確定と検証が必要です。本PRを「全13項目完成」「そのまま本番切替可能」としないでください。

## 効果音表

|イベント|役割/条件|重複/停止|実装|
|---|---|---|---|
|頭選択・ジャンプ|短い操作反応、実際に選択/ジャンプ成立時|同種80ms抑止|initHeadGrid/jump|
|開始|試合開始の準備|1開始snapshotにつき1回|setupBattle|
|攻撃|発射成立時のみ|既存cooldown+80ms|doAttack|
|ガード成功|防御成立の反応|80ms|consumeGuardSuccess|
|部位命中/破壊|命中と破壊の区別|全体6voice、短い減衰|damagePart|
|残り10秒|残り時間の補助|各秒1回、文字の残り時間も維持|renderHud|
|決着|勝利とその他の決着|結果確定時のみ|finishBattle|

全て `js/audio.js`。hidden/pagehide/interrupted時停止・disconnect、未初期化や失敗でゲームを止めない。音源のダウンロードや有料素材なし。

## 移行・公開順序

1. このDraft PRの検証と残課題を確認。通常receipt RPCの適用は別承認/別作業。
2. 本人がPRをマージ。現在のPages Sourceが未設定/branch配信なら、所有者が Settings → Pages → Build and deployment → Source を GitHub Actions に設定する必要があります。自動で設定を書き換えません。
3. マージcommitの検査/build成功を確認。配備は同commit artifactのみ、旧runの遅延配備をcurrent main照合/concurrencyで抑止。
4. 実際のGitHubゲームURL、CPU/local2p/mock表示、180秒・採点・音・言語・iPhoneを確認。Codebergとの固定tick操作差を受入確認。
5. その後に限り正式URL定義・実験場実DBのリンク・旧ページ案内を別の最小変更として切替。現時点ではその変更を含めません。

異なる公開origin間でlocalStorageは自動移動しません。旧Codebergの名前等は残りますが、GitHubで継続利用済みとは言えません。設定の手動再入力/明示的な安全なエクスポート取込の別設計が必要です。サーバー側の過去スコアを削除/改名/再集計しません。

## iPhone Safariでの短い確認

- 初回音on→最初の操作を音off→開始して無音。off/音量0を保存して再読込。
- 日本語名の変換確定だけでは開始しない。空欄/空白でもCPU戦、結果、ランキング閲覧、X共有が使える。
- Xをキャンセルして戻る/画面ロック/別タブ復帰で結果保持・古い音が連続しない。
- 縦横/キーボード表示/短い領域/長い翻訳で開始・共有・再挑戦・30行末尾に到達できる。
- 名前あり送信は、承認済み検証環境でのみ失敗→再送→同UUIDを確認。本番へ試験スコアを送らない。

## 戻し方

未マージならDraft PRを保留でき、Codeberg公開には影響しません。マージ後の問題は既存正常commitへのrevert PRを作り本人が判断します。現行公開URLは検証完了までCodebergのままです。旧localStorage、スコア、参加者情報は削除しません。

## 今回の検査記録

- Node tests: 32/32成功（失敗/再送、誤ったHTTP200、localStorage getter拒否、全15言語、audio例外cleanup、主要core14関数ハッシュを含む）。
- 構文・15言語×126キー・placeholder・静的build成功。独立レビューでも32/32再実行、主要指摘3件を修正後に再確認。
- 本番スコア送信/DB変更/Pages設定変更/本番配備/実機/iPhone/実音/母語評価は行っていません。
- 通常receipt応答はsubmission ID/今回scoreそのものを返さない契約です。acceptedと既知型を確認し、不正本文を成功扱いにしません。もしIDが返る場合の不一致も拒否しますが、サーバーからpayload全文を読み戻せたとは報告しません。

### 追加の保存・表示整合検査

同一UUIDの別payloadや壊れた同ID保存を非破壊で拒否し、同payloadのsentだけを再利用します。これは正常なrandomUUID生成の衝突を想定した変更ではなく、既存保存が不整合なときの偽成功/上書き防止です。ランキングは正規配列と各行の名前・順位・整数スコアを確認し、不正本文を「記録なし」や「名無し0点」に変換しません。空配列だけが空状態です。正常な0点/負点/同順位/Unicode名を維持し、30行超や1,048,576 UTF-16コード単位超（実バイト数の検査ではない）の想定外応答は失敗表示にします。UUID能力が利用不可でもプレイは開始でき、送信を保留します。追加回帰を含む最終39テスト成功（初回32から拡充）。
