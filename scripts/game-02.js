    function closeRulesModal() {
      if (!dom.rulesModal) return;
      dom.rulesModal.classList.remove("active");
      dom.rulesModal.setAttribute("aria-hidden", "true");
    }

    function showToast(message) {
      clearTimeout(toastTimer);
      dom.toast.textContent = message;
      dom.toast.classList.add("active");
      toastTimer = setTimeout(() => dom.toast.classList.remove("active"), 1700);
    }

    function makeShareText(result) {
      const info = RESULT_TEXT[result.outcome] || RESULT_TEXT.draw;
      const phrase = makeOutcomePhrase(result.outcome, result.cpuName, result.playerName);
      return `${GAME.title}　で遊んだ！\n結果：${info.label}\n${phrase}\nスコア：${result.score}点\n${GAME.url}`;
    }

    async function shareText(text) {
      try {
        if (navigator.share) {
          await navigator.share({ text });
          return;
        }
        await navigator.clipboard.writeText(text);
        showToast("シェア文をコピーしました");
      } catch (error) {
        try {
          await navigator.clipboard.writeText(text);
          showToast("シェア文をコピーしました");
        } catch (copyError) {
          showToast("コピーできませんでした");
        }
      }
    }

    function initHeadGrid(root, type) {
      root.innerHTML = "";
      const randomBtn = document.createElement("button");
      randomBtn.type = "button";
      randomBtn.className = "head-choice selected";
      randomBtn.textContent = "？";
      randomBtn.dataset.value = "";
      root.appendChild(randomBtn);

      HEADS.forEach((head) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "head-choice";
        btn.textContent = head;
        btn.dataset.value = head;
        root.appendChild(btn);
      });

      root.addEventListener("click", (event) => {
        const btn = event.target.closest("button");
        if (!btn) return;
        root.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        if (type === "player") selectedPlayerHead = btn.dataset.value || "";
        if (type === "cpu") selectedCpuHead = btn.dataset.value || "";
      });
    }

    function collectSettings() {
      const battleMode = state.battleMode || BATTLE_MODE.cpu;
      const playerName = sanitizeName(dom.playerNameInput.value, "名無し", 12);
      try { localStorage.setItem("songen_player_name", playerName); } catch (error) {}
      const opponentFallback = battleMode === BATTLE_MODE.local2p ? "P2" : randItem(CPU_NAMES);
      const cpuName = sanitizeName(dom.cpuNameInput.value, opponentFallback, 10);
      const playerHead = selectedPlayerHead || randItem(HEADS);
      const cpuHead = selectedCpuHead || randItem(HEADS);
      const playerSide = document.querySelector('input[name="playerSide"]:checked')?.value || "left";
      return { battleMode, playerName, cpuName, playerHead, cpuHead, playerSide };
    }

    function createFighter(id, name, head, x) {
      return {
        id,
        name,
        head,
        x,
        y: 0,
        stamina: LIMITS.staminaMax,
        staminaCarry: 0,
        lastAttackAt: -9999,
        guardUntil: 0,
        guardStance: "mid",
        jumpUntil: 0,
        hitInvulnerableUntil: 0,
        crouch: false,
        parts: {
          leftArm: { damage: 0, broken: false },
          rightArm: { damage: 0, broken: false },
          leftFoot: { damage: 0, broken: false },
          rightFoot: { damage: 0, broken: false },
          head: { damage: 0, broken: false }
        }
      };
    }

    function getStageRect() {
      const rect = dom.stage.getBoundingClientRect();
      const fallbackWidth = Math.max(300, window.innerWidth || document.documentElement.clientWidth || 360);
      const fallbackHeight = Math.max(300, (window.innerHeight || document.documentElement.clientHeight || 640) - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stage-bottom-space")));
      state.stageRect = {
        width: rect.width > 40 ? rect.width : fallbackWidth,
        height: rect.height > 120 ? rect.height : fallbackHeight,
        left: rect.left || 0,
        top: rect.top || 0
      };
      return state.stageRect;
    }

    function setupBattle(settings) {
      cancelAnimationFrame(state.rafId);
      clearInterval(state.countdownTimer);
      state.running = false;
      state.countdown = false;
      state.ended = false;
      state.frame = 0;
      state.simulationTimeMs = 0;
      state.accumulatorMs = 0;
      state.projectiles = [];
      state.effects = [];
      state.projectileSeq = 1;
      state.inputLog = [];
      state.hashLog = [];
      resetInputBuffers();
      setBattleControlsEnabled(true);
      state.battleMode = settings.battleMode || BATTLE_MODE.cpu;
      state.cpuBrain = { nextThink: 0, move: 0, crouchUntil: 0, nextAttackCheck: 0, scheduledActions: [] };
      dom.stage.querySelectorAll(".projectile,.float-fx").forEach((el) => el.remove());
      lastSettings = settings;

      showScreen("battle");
      dom.countdown.textContent = "準備";
      dom.countdown.classList.add("active");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          initializeBattleActors(settings);
          beginCountdown();
        });
      });
    }

    function initializeBattleActors(settings) {
      const rect = getStageRect();
      const leftX = clamp(rect.width * 0.28, 70, Math.max(70, rect.width - 70));
      const rightX = clamp(rect.width * 0.72, 70, Math.max(70, rect.width - 70));

      state.playerOnLeft = settings.playerSide === "left";
      const playerX = state.playerOnLeft ? leftX : rightX;
      const cpuX = state.playerOnLeft ? rightX : leftX;
      state.player = createFighter("player", settings.playerName, settings.playerHead, playerX);
      state.cpu = createFighter("cpu", settings.cpuName, settings.cpuHead, cpuX);
      state.stats = {
        attacks: 0,
        guardSuccess: 0,
        enemyPartsBroken: 0,
        playerPartsBroken: 0,
        enemyHeadBroken: 0,
        playerHeadBroken: 0,
        enemyBrokenPartHits: 0,
        playerBrokenPartHits: 0,
        elapsedSec: 0,
        score: 0
      };
      renderHud(0);
      renderAll();
    }

    function beginCountdown() {
      enableGameplayBrowserGuard();
      clearInterval(state.countdownTimer);
      const steps = ["3", "2", "1", "開始"];
      let index = 0;
      dom.countdown.textContent = steps[index];
      dom.countdown.classList.add("active");
      state.countdown = true;
      state.countdownTimer = setInterval(() => {
        index += 1;
        if (index < steps.length) {
          dom.countdown.textContent = steps[index];
          return;
        }
        clearInterval(state.countdownTimer);
        state.countdownTimer = 0;
        dom.countdown.classList.remove("active");
        state.countdown = false;
        startBattleLoop();
      }, 720);
    }

    function startBattleLoop() {
      if (!state.player || !state.cpu) return;
      getStageRect();
      keepFightersSeparated();
      renderAll();
      state.running = true;
      state.ended = false;
      state.frame = 0;
      state.simulationTimeMs = 0;
      state.accumulatorMs = 0;
      state.battleStart = nowMs();
      state.lastFrame = state.battleStart;
      state.cpuBrain.nextThink = state.simulationTimeMs + 500;
      state.cpuBrain.nextAttackCheck = state.simulationTimeMs + 950;
      state.rafId = requestAnimationFrame(loop);
    }

    function loop(timestamp) {
      if (!state.running || state.ended) return;
      const elapsedRealMs = clamp(timestamp - state.lastFrame, 0, 100);
      state.lastFrame = timestamp;
      state.accumulatorMs += elapsedRealMs;

      let ticks = 0;
      while (state.accumulatorMs >= NETPLAY.fixedDtMs && ticks < NETPLAY.maxTicksPerFrame && state.running && !state.ended) {
        tickSimulation();
        state.accumulatorMs -= NETPLAY.fixedDtMs;
        ticks += 1;
      }

      if (ticks >= NETPLAY.maxTicksPerFrame) {
        state.accumulatorMs = 0;
      }

      renderAll();
      const elapsed = Math.min(GAME.durationSec, state.simulationTimeMs / 1000);
      renderHud(elapsed);

      if (!state.ended) state.rafId = requestAnimationFrame(loop);
    }
