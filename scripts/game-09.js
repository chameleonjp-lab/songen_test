    function bindNavigation() {
      bindTapButton(dom.buttons.homeCpu, () => showSetup(BATTLE_MODE.cpu));
      bindTapButton(dom.buttons.homeLocal2p, () => showSetup(BATTLE_MODE.local2p));
      bindTapButton(dom.buttons.homeOnline, showOnlineLobby);
      bindTapButton(dom.buttons.homeRules, openRulesModal);
      bindTapButton(dom.buttons.rulesClose, closeRulesModal);
      dom.rulesModal.addEventListener("click", (event) => {
        if (event.target === dom.rulesModal) closeRulesModal();
      });
      bindTapButton(dom.buttons.setupBack, () => showScreen("home"));
      bindTapButton(dom.buttons.onlineBack, () => showScreen("home"));
      bindTapButton(dom.buttons.onlineJoin, joinOnlineMockSlot);
      bindTapButton(dom.buttons.setupStart, () => setupBattle(collectSettings()));
      bindTapButton(dom.buttons.retire, retireBattle);
      bindTapButton(dom.buttons.homeShare, () => shareText(`${GAME.title}　で遊ぼう！\n${GAME.url}`));
      bindTapButton(dom.buttons.homeLab, () => { location.href = GAME.labUrl; });
      bindTapButton(dom.buttons.outcomeResult, () => {
        if (lastResult) showScreen("result");
      });
      bindTapButton(dom.buttons.resultLab, () => {
        state.running = false;
        state.countdown = false;
        state.ended = true;
        disableGameplayBrowserGuard();
        cancelAnimationFrame(state.rafId);
        clearInterval(state.countdownTimer);
        resetInputBuffers();
        dom.stage.querySelectorAll(".projectile,.float-fx").forEach((el) => el.remove());
        showScreen("home");
      });
      bindTapButton(dom.buttons.retry, () => {
        if (lastSettings) setupBattle(Object.assign({}, lastSettings));
        else showSetup(state.battleMode || BATTLE_MODE.cpu);
      });
      bindTapButton(dom.buttons.resultShare, () => {
        if (lastResult) shareText(makeShareText(lastResult));
      });
    }

    function showSetup(mode) {
      state.battleMode = mode || state.battleMode || BATTLE_MODE.cpu;
      updateSetupModeUi();
      let saved = "";
      try { saved = localStorage.getItem("songen_player_name") || ""; } catch (error) {}
      if (!dom.playerNameInput.value) dom.playerNameInput.value = saved;
      showScreen("setup");
    }

    function updateSetupModeUi() {
      const local = state.battleMode === BATTLE_MODE.local2p;
      if (dom.setupModeTitle) dom.setupModeTitle.textContent = local ? "ローカル2人対戦の設定" : "CPU戦の設定";
      if (dom.opponentHeadTitle) dom.opponentHeadTitle.textContent = local ? "P2頭選択" : "CPU頭選択";
      if (dom.opponentNameTitle) dom.opponentNameTitle.textContent = local ? "P2名" : "CPU名";
      if (dom.cpuNameInput) dom.cpuNameInput.placeholder = local ? "空欄ならP2" : "空欄ならランダム";
    }

    const mockSignalingAdapter = {
      slots: Array.from({ length: ONLINE_LIMITS.maxSlots }, (_, index) => ({
        slotId: index + 1,
        status: "empty",
        players: []
      })),
      async enterWithSharedPass(sharedPass, playerInfo) {
        const pass = String(sharedPass || "").trim();
        if (!pass) {
          const error = new Error("共通パスを入力してください");
          error.code = "NO_PASS";
          throw error;
        }
        const slot = this.slots.find((item) => item.players.length < ONLINE_LIMITS.playersPerSlot);
        if (!slot) {
          const error = new Error("ただいまオンライン対戦の枠が満員です。少ししてからもう一度お試しください。");
          error.code = "FULL";
          throw error;
        }
        slot.players.push({
          playerId: playerInfo.playerId,
          name: playerInfo.name,
          joinedAt: Date.now()
        });
        slot.status = slot.players.length >= ONLINE_LIMITS.playersPerSlot ? "full" : "waiting";
        return JSON.parse(JSON.stringify(slot));
      },
      async leave(slotId, playerId) {
        const slot = this.slots.find((item) => item.slotId === slotId);
        if (!slot) return null;
        slot.players = slot.players.filter((player) => player.playerId !== playerId);
        slot.status = slot.players.length ? "waiting" : "empty";
        return JSON.parse(JSON.stringify(slot));
      },
      async getSlots() {
        return JSON.parse(JSON.stringify(this.slots));
      }
    };

    const signalingAdapter = mockSignalingAdapter;

    function getLocalPlayerId() {
      try {
        const key = "songen_local_player_id";
        let id = localStorage.getItem(key);
        if (!id) {
          id = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          localStorage.setItem(key, id);
        }
        return id;
      } catch (error) {
        return `local_${Date.now().toString(36)}`;
      }
    }

    function showOnlineLobby() {
      renderOnlineSlots();
      if (dom.onlineStatus) {
        dom.onlineStatus.textContent = "共通パスを入力してください";
        dom.onlineStatus.className = "send-status";
      }
      showScreen("onlineLobby");
    }

    async function renderOnlineSlots() {
      if (!dom.onlineSlotList) return;
      const slots = await signalingAdapter.getSlots();
      dom.onlineSlotList.innerHTML = "";
      slots.forEach((slot) => {
        const row = document.createElement("div");
        row.className = "break-row";
        const statusText = slot.status === "empty" ? "空き" : slot.status === "waiting" ? "待機中" : slot.status === "full" ? "満員" : slot.status;
        row.innerHTML = `<span>slot_${slot.slotId}</span><strong>${statusText} ${slot.players.length}/${ONLINE_LIMITS.playersPerSlot}</strong>`;
        dom.onlineSlotList.appendChild(row);
      });
    }

    async function joinOnlineMockSlot() {
      const pass = dom.onlinePassInput ? dom.onlinePassInput.value : "";
      if (!String(pass || "").trim()) {
        dom.onlineStatus.textContent = "共通パスを入力してください";
        dom.onlineStatus.className = "send-status ng";
        return;
      }
      const playerInfo = {
        playerId: getLocalPlayerId() + "_" + Date.now().toString(36),
        name: sanitizeName(dom.playerNameInput && dom.playerNameInput.value, "名無し", 12)
      };
      try {
        const slot = await signalingAdapter.enterWithSharedPass(pass, playerInfo);
        state.onlineSession = { slotId: slot.slotId, playerId: playerInfo.playerId };
        dom.onlineStatus.textContent = `slot_${slot.slotId} に参加しました（${slot.players.length}/${ONLINE_LIMITS.playersPerSlot}）`;
        dom.onlineStatus.className = "send-status ok";
      } catch (error) {
        dom.onlineStatus.textContent = error && error.message ? error.message : "参加できませんでした";
        dom.onlineStatus.className = "send-status ng";
      }
      renderOnlineSlots();
    }

    function updateSideChoiceUi() {
      document.querySelectorAll('input[name="playerSide"]').forEach((input) => {
        const card = input.closest(".choice-card");
        if (card) card.classList.toggle("selected", input.checked);
      });
    }

    function bindSetupChoices() {
      document.querySelectorAll('input[name="playerSide"]').forEach((input) => {
        input.addEventListener("change", updateSideChoiceUi);
      });
      updateSideChoiceUi();
    }

    function preventGestureZoom() {
      document.addEventListener("contextmenu", (event) => event.preventDefault());
      document.addEventListener("selectstart", (event) => {
        const tag = (event.target && event.target.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") event.preventDefault();
      });
      document.addEventListener("dragstart", (event) => event.preventDefault());
      document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
      document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
      document.addEventListener("gestureend", (event) => event.preventDefault(), { passive: false });
      let lastTouchEnd = 0;
      document.addEventListener("touchend", (event) => {
        const interactive = event.target && event.target.closest && event.target.closest("button, input, textarea, label, select, a, .choice-card, .head-choice");
        if (interactive) {
          lastTouchEnd = Date.now();
          return;
        }

        const t = Date.now();
        if (t - lastTouchEnd <= 320) event.preventDefault();
        lastTouchEnd = t;
      }, { passive: false });
    }
