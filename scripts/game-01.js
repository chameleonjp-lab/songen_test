"use strict";

    /******************************************************************
     * Supabase設定
     * ここを公開前に差し替えてください。
     * Publishable key が未設定でも、ゲーム本体はそのまま遊べます。
     ******************************************************************/
    const SUPABASE_URL = "https://mlpnjgezrnhdxsxolyzj.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM";

    const GAME = Object.freeze({
      title: "尊厳を賭けようか",
      slug: "songen_wo_kakeyouka",
      url: "https://codeberg.org/chameleonjp/songen_test",
      labUrl: "https://chameleonjp.codeberg.page/chameleonjp_lab/",
      durationSec: 180,
      version: "songen_test_online_roadmap_1_5_v20260615"
    });

    const HEADS = ["𓃾", "𓃿", "𓄀", "𓄁", "𓄃", "𓄇", "𓅿", "𓆀", "𓆁", "🌕", "🌝", "🔵", "😺", "🐶", "🐯", "🦊", "🐹", "🐻"];
    const CPU_NAMES = ["徘徊者", "リスナー", "配信者", "枠主", "荒らし", "ROM専", "コメ専", "コメ職人", "ガヤ", "モデレーター", "オーナー"];

    const LIMITS = Object.freeze({
      fistRange: 168,
hitWidth: 46,
      minGap: 100,
      fighterBaseY: 0.88,
      fighterGroundMargin: 78,
      moveSpeed: 112,
      jumpMs: 800,
      attackCooldownMs: 650,
      hitStunMs: 360,
      guardMs: 500,
      staminaMax: 5,
      staminaRegenMs: 3000
    });

    const PART_MAX = Object.freeze({
      leftArm: 2,
      rightArm: 2,
      leftFoot: 2,
      rightFoot: 2,
      head: 3
    });

    const RESULT_TEXT = Object.freeze({
      win: { label: "勝利" },
      loss: { label: "敗北" },
      retire: { label: "リタイア" },
      draw: { label: "引き分け" }
    });

    const BATTLE_MODE = Object.freeze({
      cpu: "cpu",
      local2p: "local2p"
    });

    const NETPLAY = Object.freeze({
      fixedFps: 60,
      fixedDtMs: 1000 / 60,
      fixedDtSec: 1 / 60,
      maxTicksPerFrame: 5
    });

    const ONLINE_LIMITS = Object.freeze({
      maxSlots: 3,
      playersPerSlot: 2
    });

    function makeOutcomePhrase(outcome, cpuName, playerName) {
      const enemy = sanitizeName(cpuName, "CPU", 10);
      const self = sanitizeName(playerName, "プレイヤー", 12);
      if (outcome === "win") return `${enemy}の尊厳を破壊した`;
      if (outcome === "loss") return `${enemy}に${self}の尊厳を破壊された`;
      if (outcome === "retire") return `${enemy}に${self}の尊厳を差し出した`;
      return `${enemy}との尊厳は保たれた`;
    }

    const $ = (id) => document.getElementById(id);

    const dom = {
      screens: {
        home: $("homeScreen"),
        setup: $("setupScreen"),
        battle: $("battleScreen"),
        outcome: $("outcomeScreen"),
        result: $("resultScreen"),
        onlineLobby: $("onlineLobbyScreen")
      },
      stage: $("stage"),
      countdown: $("countdown"),
      toast: $("toast"),
      rulesModal: $("rulesModal"),
      playerNameInput: $("playerNameInput"),
      cpuNameInput: $("cpuNameInput"),
      setupModeTitle: $("setupModeTitle"),
      opponentHeadTitle: $("opponentHeadTitle"),
      opponentNameTitle: $("opponentNameTitle"),
      playerHeadGrid: $("playerHeadGrid"),
      cpuHeadGrid: $("cpuHeadGrid"),
      onlinePassInput: $("onlinePassInput"),
      onlineStatus: $("onlineStatus"),
      onlineSlotList: $("onlineSlotList"),
      timeValue: $("timeValue"),
      scoreValue: $("scoreValue"),
      staminaValue: $("staminaValue"),
      staminaBar: $("staminaBar"),
      outcomeStatus: $("outcomeStatus"),
      outcomeMessage: $("outcomeMessage"),
      outcomeScore: $("outcomeScore"),
      outcomeCards: {
        player: $("outcomePlayerCard"),
        cpu: $("outcomeCpuCard")
      },
      outcomeFighters: {
        player: {
          name: $("outcomePlayerName"), head: $("outcomePlayerHead"),
          leftArm: $("outcomePlayerLeftArm"), rightArm: $("outcomePlayerRightArm"),
          leftFoot: $("outcomePlayerLeftFoot"), rightFoot: $("outcomePlayerRightFoot")
        },
        cpu: {
          name: $("outcomeCpuName"), head: $("outcomeCpuHead"),
          leftArm: $("outcomeCpuLeftArm"), rightArm: $("outcomeCpuRightArm"),
          leftFoot: $("outcomeCpuLeftFoot"), rightFoot: $("outcomeCpuRightFoot")
        }
      },
      resultMain: $("resultMain"),
      resultSub: $("resultSub"),
      scoreBig: $("scoreBig"),
      bdAttacks: $("bdAttacks"),
      bdGuards: $("bdGuards"),
      bdEnemyBroken: $("bdEnemyBroken"),
      bdPlayerBroken: $("bdPlayerBroken"),
      bdElapsed: $("bdElapsed"),
      sendStatus: $("sendStatus"),
      fighters: {
        player: {
          root: $("playerFighter"), name: $("playerFighterName"), headRow: $("playerHeadRow"), head: $("playerHeadPart"),
          leftArm: $("playerLeftArm"), rightArm: $("playerRightArm"), leftFoot: $("playerLeftFoot"), rightFoot: $("playerRightFoot"), guard: $("playerGuardMark")
        },
        cpu: {
          root: $("cpuFighter"), name: $("cpuFighterName"), headRow: $("cpuHeadRow"), head: $("cpuHeadPart"),
          leftArm: $("cpuLeftArm"), rightArm: $("cpuRightArm"), leftFoot: $("cpuLeftFoot"), rightFoot: $("cpuRightFoot"), guard: $("cpuGuardMark")
        }
      },
      buttons: {
        homeCpu: $("homeCpuBtn"), homeLocal2p: $("homeLocal2pBtn"), homeOnline: $("homeOnlineBtn"),
        homeShare: $("homeShareBtn"), homeRules: $("homeRulesBtn"), homeLab: $("homeLabBtn"),
        rulesClose: $("rulesCloseBtn"),
        setupStart: $("setupStartBtn"), setupBack: $("setupBackBtn"),
        retire: $("retireBtn"),
        outcomeResult: $("outcomeResultBtn"),
        retry: $("retryBtn"), resultShare: $("resultShareBtn"), resultLab: $("resultLabBtn"),
        onlineJoin: $("onlineJoinBtn"), onlineBack: $("onlineBackBtn"),
        left: $("leftBtn"), right: $("rightBtn"), jump: $("jumpBtn"), crouch: $("crouchBtn"), attack: $("attackBtn"), guard: $("guardBtn")
      }
    };

    let selectedPlayerHead = "";
    let selectedCpuHead = "";
    let lastSettings = null;
    let lastResult = null;
    let toastTimer = null;

    const state = {
      running: false,
      countdown: false,
      ended: false,
      rafId: 0,
      countdownTimer: 0,
      lastFrame: 0,
      battleStart: 0,
      frame: 0,
      simulationTimeMs: 0,
      accumulatorMs: 0,
      battleMode: BATTLE_MODE.cpu,
      projectiles: [],
      projectileSeq: 1,
      effects: [],
      keys: {
        left: false,
        right: false,
        crouch: false
      },
      currentInputs: {
        player: makeEmptyInput(),
        cpu: makeEmptyInput()
      },
      inputLog: [],
      replayMode: false,
      replayInputs: null,
      hashLog: [],
      onlineSession: null,
      stageRect: null,
      stats: null,
      player: null,
      cpu: null,
      cpuBrain: {
        nextThink: 0,
        move: 0,
        crouchUntil: 0,
        nextAttackCheck: 0,
        scheduledActions: []
      },
      playerOnLeft: true,
      historyLockActive: false,
      lastViewportTouchAt: 0
    };

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function randItem(list) {
      return list[Math.floor(Math.random() * list.length)];
    }

    function nowMs() {
      return performance.now();
    }

    function getBattleNowMs() {
      if (Number.isFinite(state.simulationTimeMs) && (state.running || state.countdown || state.ended || state.simulationTimeMs > 0)) {
        return state.simulationTimeMs;
      }
      return nowMs();
    }

    function makeEmptyInput() {
      return {
        left: false,
        right: false,
        crouch: false,
        jumpPressed: false,
        attackPressed: false,
        guardPressed: false
      };
    }

    function cloneInput(input) {
      return {
        left: Boolean(input && input.left),
        right: Boolean(input && input.right),
        crouch: Boolean(input && input.crouch),
        jumpPressed: Boolean(input && input.jumpPressed),
        attackPressed: Boolean(input && input.attackPressed),
        guardPressed: Boolean(input && input.guardPressed)
      };
    }

    function clearPressedInputs(input) {
      if (!input) return;
      input.jumpPressed = false;
      input.attackPressed = false;
      input.guardPressed = false;
    }

    function resetInputBuffers() {
      state.currentInputs = { player: makeEmptyInput(), cpu: makeEmptyInput() };
      state.keys.left = false;
      state.keys.right = false;
      state.keys.crouch = false;
    }

    function sanitizeName(value, fallback, maxLen) {
      const cleaned = String(value || "").replace(/[\r\n\t]/g, " ").trim().slice(0, maxLen);
      return cleaned || fallback;
    }

    function showScreen(name) {
      Object.values(dom.screens).forEach((screen) => { if (screen) screen.classList.remove("active"); });
      if (dom.screens[name]) dom.screens[name].classList.add("active");
    }

    function openRulesModal() {
      if (!dom.rulesModal) return;
      dom.rulesModal.classList.add("active");
      dom.rulesModal.setAttribute("aria-hidden", "false");
    }
