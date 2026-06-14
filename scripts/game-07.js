    function renderOutcome(result) {
      const info = RESULT_TEXT[result.outcome] || RESULT_TEXT.draw;
      dom.outcomeStatus.textContent = info.label;
      dom.outcomeMessage.textContent = makeOutcomePhrase(result.outcome, result.cpuName, result.playerName);
      dom.outcomeScore.textContent = `スコア：${result.score}点`;

      renderOutcomeFighter(state.player, dom.outcomeFighters.player, dom.outcomeCards.player);
      renderOutcomeFighter(state.cpu, dom.outcomeFighters.cpu, dom.outcomeCards.cpu);

      dom.outcomeCards.player.classList.remove("winner", "loser");
      dom.outcomeCards.cpu.classList.remove("winner", "loser");

      if (result.outcome === "win") {
        dom.outcomeCards.player.classList.add("winner");
        dom.outcomeCards.cpu.classList.add("loser");
      } else if (result.outcome === "loss" || result.outcome === "retire") {
        dom.outcomeCards.player.classList.add("loser");
        dom.outcomeCards.cpu.classList.add("winner");
      }
    }

    function showOutcomeAfterFinish(result) {
      renderOutcome(result);
      dom.countdown.textContent = "終了";
      dom.countdown.classList.add("active");
      setTimeout(() => {
        dom.countdown.classList.remove("active");
        showScreen("outcome");
      }, 650);
    }

    function populateResult(result) {
      const info = RESULT_TEXT[result.outcome] || RESULT_TEXT.draw;
      dom.resultMain.textContent = info.label;
      dom.resultSub.textContent = makeOutcomePhrase(result.outcome, result.cpuName, result.playerName);
      dom.scoreBig.textContent = `${result.score}点`;
      dom.bdAttacks.textContent = String(result.attacks);
      dom.bdGuards.textContent = String(result.guardSuccess);
      dom.bdEnemyBroken.textContent = String(result.enemyPartsBroken);
      dom.bdPlayerBroken.textContent = String(result.playerPartsBroken);
      dom.bdElapsed.textContent = `${result.elapsedSec}秒`;
      dom.sendStatus.textContent = "ランキング送信中...";
      dom.sendStatus.className = "send-status";
    }

    

    async function sendScoreAfterResult(result) {
      if (result && result.battleMode === BATTLE_MODE.local2p) {
        dom.sendStatus.textContent = "ローカル2人対戦のため、ランキング送信は行いません";
        dom.sendStatus.className = "send-status";
        return;
      }
      if (!supabaseConfigured()) {
        dom.sendStatus.textContent = "ランキング連携：Publishable key設定後に有効になります";
        dom.sendStatus.className = "send-status";
        return;
      }

      try {
        await submitScore(result.playerName, result.score);
        dom.sendStatus.textContent = "ランキング登録しました";
        dom.sendStatus.className = "send-status ok";
      } catch (error) {
        const message = error && error.message ? String(error.message).slice(0, 90) : "詳細不明";
        dom.sendStatus.textContent = "ランキング登録に失敗しました：" + message;
        dom.sendStatus.className = "send-status ng";
        console.warn("score submit failed", error);
      }
    }
function getSupabasePublishableKey() {
      return String(SUPABASE_PUBLISHABLE_KEY || "").trim();
    }

    function supabaseConfigured() {
      const key = getSupabasePublishableKey();
      return /^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(SUPABASE_URL)
        && key
        && !key.includes("PASTE_")
        && !key.includes("YOUR_")
        && !key.includes("REPLACE_")
        && !SUPABASE_URL.includes("YOUR_PROJECT_ID");
    }

    async function submitScore(displayName, score) {
      if (!supabaseConfigured()) {
        throw new Error("Supabase is not configured");
      }

      const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/submit_score`;
      const key = getSupabasePublishableKey();
      const headers = {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`
      };
      const body = {
        p_display_name: displayName,
        p_game_slug: GAME.slug,
        p_score: Math.trunc(score),
        p_client_version: GAME.version
      };

      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        throw new Error(sanitizeSubmitError(text || `HTTP ${response.status}`));
      }
      return safeParseJson(text);
    }

    function safeParseJson(text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (error) { return null; }
    }

    function sanitizeSubmitError(text) {
      return String(text || "")
        .replaceAll(SUPABASE_PUBLISHABLE_KEY, "[publishable-key]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
    }

    function recordInputFrame() {
      if (state.replayMode) return;
      state.inputLog.push({
        frame: state.frame,
        player: cloneInput(state.currentInputs.player),
        cpu: cloneInput(state.currentInputs.cpu)
      });
    }

    function applyReplayInputForFrame(frame) {
      const entry = Array.isArray(state.replayInputs) ? state.replayInputs.find((item) => item && item.frame === frame) : null;
      state.currentInputs.player = cloneInput(entry && entry.player);
      state.currentInputs.cpu = cloneInput(entry && entry.cpu);
    }

    function getInputLog() {
      return JSON.parse(JSON.stringify(state.inputLog || []));
    }

    function getHashLog() {
      return JSON.parse(JSON.stringify(state.hashLog || []));
    }

    function replayInputLog(log, settings) {
      if (!Array.isArray(log)) throw new Error("input log must be an array");
      state.replayMode = true;
      state.replayInputs = JSON.parse(JSON.stringify(log));
      const baseSettings = settings || lastSettings || collectSettings();
      setupBattle(Object.assign({}, baseSettings));
      return true;
    }

    function serializePartState(parts) {
      const out = {};
      ["leftArm", "rightArm", "leftFoot", "rightFoot", "head"].forEach((key) => {
        out[key] = {
          damage: parts && parts[key] ? parts[key].damage : 0,
          broken: parts && parts[key] ? Boolean(parts[key].broken) : false
        };
      });
      return out;
    }

    function serializeFighterForHash(fighter) {
      if (!fighter) return null;
      return {
        id: fighter.id,
        x: Math.round(fighter.x * 100) / 100,
        stamina: Math.round(fighter.stamina * 100) / 100,
        crouch: Boolean(fighter.crouch),
        jumpUntil: Math.round(fighter.jumpUntil || 0),
        guardUntil: Math.round(fighter.guardUntil || 0),
        guardStance: fighter.guardStance,
        lastAttackAt: Math.round(fighter.lastAttackAt || 0),
        hitInvulnerableUntil: Math.round(fighter.hitInvulnerableUntil || 0),
        parts: serializePartState(fighter.parts)
      };
    }

    function serializeStatsForHash(stats) {
      if (!stats) return null;
      return {
        attacks: stats.attacks,
        guardSuccess: stats.guardSuccess,
        enemyPartsBroken: stats.enemyPartsBroken,
        playerPartsBroken: stats.playerPartsBroken,
        enemyHeadBroken: stats.enemyHeadBroken,
        playerHeadBroken: stats.playerHeadBroken,
        enemyBrokenPartHits: stats.enemyBrokenPartHits,
        playerBrokenPartHits: stats.playerBrokenPartHits,
        elapsedSec: stats.elapsedSec,
        score: stats.score
      };
    }

    function serializeProjectilesForHash(projectiles) {
      return (projectiles || []).map((p) => ({
        id: p.id,
        owner: p.owner,
        target: p.target,
        type: p.type,
        height: p.height,
        startX: Math.round(p.startX * 100) / 100,
        endX: Math.round(p.endX * 100) / 100,
        previousX: Math.round((p.previousX || 0) * 100) / 100,
        currentX: Math.round((p.currentX || 0) * 100) / 100,
        y: Math.round((p.y || 0) * 100) / 100,
        dir: p.dir,
        createdAt: Math.round(p.createdAt || 0),
        durationMs: Math.round(p.durationMs || 0),
        progress: Math.round((p.progress || 0) * 1000) / 1000,
        removed: Boolean(p.removed),
        resolved: Boolean(p.resolved)
      }));
    }

    function makeStateSnapshotForHash() {
      return {
        frame: state.frame,
        simulationTimeMs: Math.round(state.simulationTimeMs),
        battleMode: state.battleMode,
        player: serializeFighterForHash(state.player),
        cpu: serializeFighterForHash(state.cpu),
        stats: serializeStatsForHash(state.stats),
        projectiles: serializeProjectilesForHash(state.projectiles),
        ended: Boolean(state.ended)
      };
    }

    function makeStateHash() {
      const text = JSON.stringify(makeStateSnapshotForHash());
      let hash = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    }
