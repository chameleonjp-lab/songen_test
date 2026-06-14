# 尊厳を賭けようか オンライン対戦準備 1〜5 確認記録

## 作業開始時点

- 対象ファイル：index.html
- ベース：アップロードされた `index(12).html`
- 既存モード：CPU戦
- 今回はWebRTC本体を実装しない
- 今回はFirebase本番接続を実装しない
- 今回はCloudflare本番接続を実装しない
- 今回はSupabase新規テーブルを作らない
- 今回は既存CPU戦を最優先で守る

## フェーズ0：作業前の現状確認

### 修正前に確認したこと

- ベースファイルのHTML/JavaScriptをローカルで読み込み、主要構造を確認した。
- `state.player` / `state.cpu` / `fighter.id === "player"` / `fighter.id === "cpu"` を前提にしているため、内部IDは維持する方針にした。
- 戦闘ループが `requestAnimationFrame` の実時刻差で動いていることを確認した。
- CPU判断に `Math.random()` が含まれることを確認した。
- 入力処理がボタン押下から `jump()` / `doAttack()` / `startGuard()` を直接呼ぶ構造であることを確認した。

### 修正したこと

- `docs/online-roadmap-1-5-check.md` を追加した。

### 修正後に確認したこと

- 記録ファイルを作成した。

### 残った不安点

- ブラウザ実行テストは環境制限で実施できなかった。

### 次にやること

- フェーズ1以降の修正を進める。

## フェーズ1：ローカル2人対戦

### 修正前に確認したこと

- 既存CPU戦は `state.player` と `state.cpu` の2体で進む。
- 攻撃対象・表示・結果は内部IDに依存している。

### 修正したこと

- ホームに `CPU戦`、`ローカル2人対戦`、`オンライン対戦β` を追加した。
- `battleMode` を追加した。
- ローカル2人対戦でも内部的には `state.cpu` をP2として使うようにした。
- ローカル2人対戦では `updateCpu()` を呼ばず、P2キーボード入力で `state.cpu` を動かす準備をした。
- P2操作キーを追加した。
  - J：左
  - L：右
  - I：ジャンプ
  - K：しゃがみ
  - O：攻撃
  - P：ガード
- ローカル2人対戦では既存ランキング送信をしないようにした。

### 修正後に確認したこと

- JavaScript構文確認でエラーなし。
- `homeStartBtn` の古い参照が残っていないことを静的確認した。
- ボタン入力から `jump(state.player, nowMs())` などを直接呼ぶ参照が残っていないことを静的確認した。

### 残った不安点

- 実ブラウザでCPU戦・ローカル2人対戦の通し操作は未確認。

### 次にやること

- 実機でCPU戦とローカル2人対戦を確認する。

## フェーズ2：固定フレーム準備とtickSimulation

### 修正前に確認したこと

- 既存の `loop(timestamp)` は実時刻差 `dt` で全体を進めていた。
- `isJumping()`、ガード表示、被弾無敵などに実時刻依存があった。
- CPUの遅延ガードに `setTimeout()` が使われていた。

### 修正したこと

- `NETPLAY` を追加した。
- `frame`、`simulationTimeMs`、`accumulatorMs` を追加した。
- `getBattleNowMs()` を追加した。
- `tickSimulation()` を追加し、60fps相当の固定刻みで試合処理を進めるようにした。
- 1描画あたり最大5tickに制限した。
- `isJumping()` を試合内時刻基準へ寄せた。
- ガード表示、被弾無敵、部位ダメージ処理の時刻基準を試合内時刻へ寄せた。
- CPUの遅延行動を `setTimeout()` ではなく `scheduledActions` で処理するようにした。

### 修正後に確認したこと

- JavaScript構文確認でエラーなし。
- 勝敗に関係するCPU遅延行動の `setTimeout()` は除去した。
- 演出用の `setTimeout()` は残した。

### 残った不安点

- 体感速度、攻撃タイミング、ジャンプ時間、ガード時間は実ブラウザで要確認。

### 次にやること

- 実機でCPU戦の操作感を確認する。

## フェーズ3：入力バッファ・入力ログ・再生

### 修正前に確認したこと

- 既存入力は押下時に直接戦闘関数を呼んでいた。
- 左右移動・しゃがみは押しっぱなし、攻撃・ジャンプ・ガードは押した瞬間として扱う必要がある。

### 修正したこと

- `makeEmptyInput()`、`cloneInput()`、`clearPressedInputs()` を追加した。
- `currentInputs.player` / `currentInputs.cpu` を追加した。
- 入力を「押しっぱなし」と「押した瞬間」に分けた。
- ボタン入力から直接 `jump()` / `doAttack()` / `startGuard()` を呼ばないようにした。
- `tickSimulation()` の中で入力を処理するようにした。
- `inputLog` を追加した。
- `window.__songenDebug.getInputLog()` を追加した。
- `window.__songenDebug.replayInputLog()` を追加した。

### 修正後に確認したこと

- JavaScript構文確認でエラーなし。
- 旧方式の直接呼び出し参照が残っていないことを静的確認した。

### 残った不安点

- 実ブラウザで押しっぱなし・一回押しの体感確認が必要。
- 入力ログ再生はコンソール操作での確認が必要。

### 次にやること

- 実機またはPCブラウザで入力ログ取得・再生を確認する。

## フェーズ4：状態確認値

### 修正前に確認したこと

- 状態は `state.player`、`state.cpu`、`state.stats`、`state.projectiles` に分散していた。
- DOMや演出は状態確認値に入れてはいけない。

### 修正したこと

- `serializeFighterForHash()` を追加した。
- `serializeStatsForHash()` を追加した。
- `serializeProjectilesForHash()` を追加した。
- `makeStateSnapshotForHash()` を追加した。
- `makeStateHash()` を追加した。
- `hashLog` を追加した。
- 60フレームごとに状態確認値を記録するようにした。
- `window.__songenDebug.getHashLog()` を追加した。

### 修正後に確認したこと

- JavaScript構文確認でエラーなし。
- 状態確認値にDOM要素を入れない実装にした。

### 残った不安点

- 同じ入力ログで同じ状態確認値になるかは、実ブラウザで要確認。

### 次にやること

- 入力ログ再生と状態確認値の一致を確認する。

## フェーズ5：共通パス + 最大3試合の待ち合わせ画面

### 修正前に確認したこと

- 既存ホームにはオンライン入口がなかった。
- 今回は外部サービス接続を入れない方針。

### 修正したこと

- `onlineLobbyScreen` を追加した。
- 共通パス入力欄を追加した。
- 参加ボタン、状態表示、枠表示、戻るボタンを追加した。
- `ONLINE_LIMITS.maxSlots = 3` を追加した。
- `mockSignalingAdapter` を追加した。
- `signalingAdapter` はmockのみを使うようにした。
- 共通パス未入力では参加できないようにした。
- 3枠すべて満員の場合は満員表示を出すようにした。
- Firebase、Cloudflare、WebRTC、Supabase新規保存は入れていない。

### 修正後に確認したこと

- JavaScript構文確認でエラーなし。
- 外部サービス本接続を追加していないことを確認した。

### 残った不安点

- ブラウザ実行テストは環境制限で未確認。

### 次にやること

- 実機でオンラインβ画面の遷移とmock枠表示を確認する。

## ローカル検証結果

- `node --check` によるJavaScript構文確認：通過
- ブラウザ自動実行テスト：環境制限により `ERR_BLOCKED_BY_ADMINISTRATOR` で実施不可

## 作業後の注意

この段階では、まだWebRTC対戦は実装していない。  
Firebase、Cloudflare、Supabase新規テーブルも未使用。  
次の段階では、実機確認でCPU戦が壊れていないことを最優先で確認する。
