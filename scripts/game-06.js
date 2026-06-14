    function yForPart(fighter, part) {
      if (part === "head") return yForHeight("high", fighter);
      if (String(part).includes("Foot")) return yForHeight("low", fighter);
      return yForHeight("mid", fighter);
    }

    function flashFighter(id) {
      const root = dom.fighters[id].root;
      root.classList.add("hit-flash");
      setTimeout(() => root.classList.remove("hit-flash"), 130);
    }

    function createEffect(text, x, y) {
      const el = document.createElement("div");
      el.className = "float-fx";
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      dom.stage.appendChild(el);
      setTimeout(() => el.remove(), 620);
    }

    function renderAll() {
      getStageRect();
      renderFighter(state.player);
      renderFighter(state.cpu);
    }

    function renderFighter(fighter) {
      if (!fighter) return;
      const rect = state.stageRect || getStageRect();
      const fdom = dom.fighters[fighter.id];
      const posture = postureOf(fighter);
      const jumpLift = posture === "jump" ? -38 : 0;
      const crouchDrop = posture === "crouch" ? 10 : 0;
      const baseGround = clamp(rect.height - LIMITS.fighterGroundMargin, 132, rect.height - 48);
      const baseY = baseGround + jumpLift + crouchDrop;
      fighter.y = baseY;
      fdom.root.style.left = `${fighter.x}px`;
      fdom.root.style.top = `${baseY}px`;
      fdom.root.classList.toggle("jumping", posture === "jump");
      fdom.root.classList.toggle("crouching", posture === "crouch");
      fdom.name.textContent = fighter.name;
      fdom.head.textContent = fighter.parts.head.broken ? "💩" : fighter.head;
      fdom.head.classList.toggle("empty", false);
      fdom.head.classList.toggle("broken-head", fighter.parts.head.broken);
      renderArms(fighter, fdom);
      renderFeet(fighter, fdom);
      fdom.guard.classList.remove("active");
    }

    function renderArms(fighter, fdom) {
      const opponent = fighter.id === "player" ? state.cpu : state.player;
      const guardActive = fighter.guardUntil > getBattleNowMs() && hasAnyArm(fighter) && !isJumping(fighter) && opponent;
      const front = opponent ? frontArmFor(fighter, opponent) : "rightArm";
      const back = oppositePart(front);
      const guardArm = guardActive ? selectedGuardArm(fighter, opponent) : null;

      let leftText = fighter.parts.leftArm.broken ? "" : "💪";
      let rightText = fighter.parts.rightArm.broken ? "" : "💪";
      let leftGuard = false;
      let rightGuard = false;

      if (guardActive && guardArm) {
        // ガード中は腕を追加表示しない。残っている腕そのものを前側セルへ移す。
        leftText = "";
        rightText = "";
        if (front === "leftArm") {
          leftText = "💪";
          leftGuard = true;
        } else {
          rightText = "💪";
          rightGuard = true;
        }
      }

      fdom.leftArm.textContent = leftText;
      fdom.rightArm.textContent = rightText;
      fdom.leftArm.classList.toggle("empty", !leftText);
      fdom.rightArm.classList.toggle("empty", !rightText);
      fdom.leftArm.classList.toggle("guard-arm", leftGuard);
      fdom.rightArm.classList.toggle("guard-arm", rightGuard);
      fdom.leftArm.classList.remove("front-foot");
      fdom.rightArm.classList.remove("front-foot");
    }

    function renderFeet(fighter, fdom) {
      const opponent = fighter.id === "player" ? state.cpu : state.player;
      const leftBroken = fighter.parts.leftFoot.broken;
      const rightBroken = fighter.parts.rightFoot.broken;
      let left = leftBroken ? "" : "🦵";
      let right = rightBroken ? "" : "🦵";
      let frontCell = null;

      if (opponent) {
        const near = getNearPart(fighter, opponent, "Foot");
        const far = near === "leftFoot" ? "rightFoot" : "leftFoot";
        if (fighter.parts[near].broken && !fighter.parts[far].broken) {
          // 近い側の足が壊れた時は、遠い側の足を前側セルへ出す。
          // 見た目と当たり判定を同じ前側位置にそろえる。
          if (near === "leftFoot") {
            left = "🦵";
            right = "";
            frontCell = "leftFoot";
          } else {
            left = "";
            right = "🦵";
            frontCell = "rightFoot";
          }
        } else if (!fighter.parts[near].broken) {
          frontCell = near;
        }
      }

      fdom.leftFoot.textContent = left;
      fdom.rightFoot.textContent = right;
      fdom.leftFoot.classList.toggle("empty", !left);
      fdom.rightFoot.classList.toggle("empty", !right);
      fdom.leftFoot.classList.toggle("front-foot", frontCell === "leftFoot" && !!left);
      fdom.rightFoot.classList.toggle("front-foot", frontCell === "rightFoot" && !!right);
    }

    function renderHud(elapsed) {
      const remain = Math.max(0, Math.ceil(GAME.durationSec - elapsed));
      dom.timeValue.textContent = String(remain);
      dom.scoreValue.textContent = `${state.stats.score}点`;
      dom.staminaValue.textContent = state.player.stamina.toFixed(1);
      const full = Math.floor(state.player.stamina);
      const half = state.player.stamina % 1 >= 0.5 ? "▣" : "";
      dom.staminaBar.textContent = "■".repeat(full) + half + "□".repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
    }

    function calcScore(withVictory, elapsedSec) {
      return (withVictory ? 5000 : 0)
        - 30 * state.stats.attacks
        + 120 * state.stats.guardSuccess
        + 300 * Math.max(0, state.stats.enemyPartsBroken - state.stats.enemyHeadBroken)
        + 1000 * state.stats.enemyHeadBroken
        + 300 * state.stats.enemyBrokenPartHits
        - 500 * state.stats.playerPartsBroken
        - 300 * state.stats.playerBrokenPartHits
        - 10 * elapsedSec;
    }

    function setBattleControlsEnabled(enabled) {
      [
        dom.buttons.left,
        dom.buttons.right,
        dom.buttons.jump,
        dom.buttons.crouch,
        dom.buttons.attack,
        dom.buttons.guard,
        dom.buttons.retire
      ].forEach((button) => {
        if (!button) return;
        button.disabled = !enabled;
        button.classList.toggle("disabled", !enabled);
      });

      if (!enabled) {
        resetInputBuffers();
        document.querySelectorAll(".control-btn.is-pressed,.control-btn.pressed").forEach((button) => {
          button.classList.remove("is-pressed", "pressed");
        });
      }
    }

    function finishBattle(outcome, fixedElapsedSec) {
      if (state.ended) return;
      state.ended = true;
      state.running = false;
      state.countdown = false;
      disableGameplayBrowserGuard();
      cancelAnimationFrame(state.rafId);
      const elapsed = fixedElapsedSec ?? Math.min(GAME.durationSec, Math.max(0, state.simulationTimeMs / 1000));
      const elapsedSec = clamp(Math.ceil(elapsed), 0, GAME.durationSec);
      state.stats.elapsedSec = elapsedSec;
      const score = calcScore(outcome === "win", elapsedSec);
      state.stats.score = score;
      const result = {
        outcome,
        score,
        attacks: state.stats.attacks,
        guardSuccess: state.stats.guardSuccess,
        enemyPartsBroken: state.stats.enemyPartsBroken,
        playerPartsBroken: state.stats.playerPartsBroken,
        elapsedSec,
        playerName: state.player.name,
        cpuName: state.cpu.name,
        battleMode: state.battleMode,
        enemyHeadBroken: state.stats.enemyHeadBroken,
        playerHeadBroken: state.stats.playerHeadBroken
      };
      lastResult = result;
      setBattleControlsEnabled(false);
      populateResult(result);
      sendScoreAfterResult(result);
      showOutcomeAfterFinish(result);
    }

    function renderOutcomeFighter(fighter, fdom, card) {
      if (!fighter || !fdom) return;

      const posture = postureOf(fighter);

      if (card) {
        card.classList.remove("posture-stand", "posture-crouch", "posture-jump");
        card.classList.add(`posture-${posture}`);
      }

      fdom.name.textContent = fighter.name;

      fdom.head.textContent = fighter.parts.head.broken ? "💩" : fighter.head;
      fdom.head.classList.toggle("broken-head", fighter.parts.head.broken);

      fdom.leftArm.textContent = fighter.parts.leftArm.broken ? "" : "💪";
      fdom.rightArm.textContent = fighter.parts.rightArm.broken ? "" : "💪";
      fdom.leftFoot.textContent = fighter.parts.leftFoot.broken ? "" : "🦵";
      fdom.rightFoot.textContent = fighter.parts.rightFoot.broken ? "" : "🦵";

      ["leftArm", "rightArm", "leftFoot", "rightFoot"].forEach((key) => {
        if (!fdom[key]) return;
        fdom[key].classList.toggle("empty", !fdom[key].textContent);
        fdom[key].classList.remove("guard-arm", "front-foot");
      });
    }
