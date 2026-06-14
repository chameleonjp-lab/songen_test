    function tickSimulation() {
      state.frame += 1;
      state.simulationTimeMs += NETPLAY.fixedDtMs;
      const timestamp = state.simulationTimeMs;
      const dt = NETPLAY.fixedDtSec;

      if (state.replayMode && state.replayInputs) {
        applyReplayInputForFrame(state.frame);
      }

      syncLegacyKeysFromInput();
      recordInputFrame();
      updateFighterTimers(state.player, dt, timestamp);
      updateFighterTimers(state.cpu, dt, timestamp);
      applyInputToFighter(state.player, state.currentInputs.player, dt, timestamp);

      if (state.battleMode === BATTLE_MODE.local2p || state.replayMode) {
        applyInputToFighter(state.cpu, state.currentInputs.cpu, dt, timestamp);
      } else {
        processCpuScheduledActions(timestamp);
        updateCpu(dt, timestamp);
      }

      updateProjectiles(timestamp);
      const elapsed = Math.min(GAME.durationSec, state.simulationTimeMs / 1000);
      state.stats.elapsedSec = Math.floor(elapsed);
      state.stats.score = calcScore(false, Math.floor(elapsed));
      if (state.frame % 60 === 0) {
        state.hashLog.push({ frame: state.frame, hash: makeStateHash() });
      }
      clearPressedInputs(state.currentInputs.player);
      clearPressedInputs(state.currentInputs.cpu);

      if (elapsed >= GAME.durationSec && !state.ended) {
        finishBattle("draw", GAME.durationSec);
      }
    }

    function updateFighterTimers(fighter, dt, timestamp) {
      if (!fighter) return;
      fighter.staminaCarry += dt * 1000;
      while (fighter.staminaCarry >= LIMITS.staminaRegenMs) {
        fighter.staminaCarry -= LIMITS.staminaRegenMs;
        fighter.stamina = Math.min(LIMITS.staminaMax, fighter.stamina + 1);
      }
      if (fighter.jumpUntil <= timestamp) {
        fighter.jumpUntil = 0;
      }
    }

    function syncLegacyKeysFromInput() {
      state.keys.left = Boolean(state.currentInputs.player.left);
      state.keys.right = Boolean(state.currentInputs.player.right);
      state.keys.crouch = Boolean(state.currentInputs.player.crouch);
    }

    function applyInputToFighter(fighter, input, dt, timestamp) {
      if (!fighter || !input) return;
      let dir = 0;
      if (input.left) dir -= 1;
      if (input.right) dir += 1;
      fighter.crouch = Boolean(input.crouch) && !isJumping(fighter);
      moveFighter(fighter, dir, dt);
      if (input.jumpPressed) jump(fighter, timestamp);
      if (input.attackPressed) doAttack(fighter, timestamp);
      if (input.guardPressed) startGuard(fighter, timestamp);
    }

    function updateFighterState(fighter, dt, timestamp) {
      updateFighterTimers(fighter, dt, timestamp);
      if (fighter && fighter.id === "player") {
        applyInputToFighter(fighter, state.currentInputs.player, dt, timestamp);
      }
    }

    function updateCpu(dt, timestamp) {
      if (state.battleMode !== BATTLE_MODE.cpu) return;
      const cpu = state.cpu;
      const player = state.player;
      if (!cpu || !player) return;

      if (timestamp >= state.cpuBrain.crouchUntil) {
        cpu.crouch = false;
      }

      if (timestamp >= state.cpuBrain.nextThink) {
        state.cpuBrain.nextThink = timestamp + 220 + Math.random() * 180;
        const dist = Math.abs(player.x - cpu.x);
        let move = 0;
        if (dist > 225) {
          move = player.x < cpu.x ? -1 : 1;
        } else if (dist < 118 && Math.random() < 0.38) {
          move = player.x < cpu.x ? 1 : -1;
        } else if (Math.random() < 0.18) {
          move = Math.random() < 0.5 ? -1 : 1;
        }
        state.cpuBrain.move = move;

        if (!isJumping(cpu) && Math.random() < 0.12) {
          cpu.crouch = true;
          state.cpuBrain.crouchUntil = timestamp + 450 + Math.random() * 380;
        }

        if (!isJumping(cpu) && canJump(cpu) && Math.random() < 0.07) {
          jump(cpu, timestamp);
        }
      }

      moveFighter(cpu, state.cpuBrain.move, dt);

      if (timestamp >= state.cpuBrain.nextAttackCheck) {
        state.cpuBrain.nextAttackCheck = timestamp + 360 + Math.random() * 280;
        const dist = Math.abs(player.x - cpu.x);
        const range = LIMITS.fistRange;
        if (hasAnyArm(cpu) && dist <= range + 12 && cpu.stamina >= 1 && Math.random() < 0.42) {
          if (!isJumping(cpu) && Math.random() < 0.22 && canJump(cpu)) {
            jump(cpu, timestamp);
          }
          doAttack(cpu, timestamp);
        }
      }
    }

    function canMove(fighter) {
      return !fighter.parts.leftFoot.broken || !fighter.parts.rightFoot.broken;
    }

    function movementMultiplier(fighter) {
      const brokenCount = Number(fighter.parts.leftFoot.broken) + Number(fighter.parts.rightFoot.broken);
      if (brokenCount >= 2) return 0;
      if (brokenCount === 1) return 0.5;
      return 1;
    }

    function canJump(fighter) {
      return !fighter.parts.leftFoot.broken && !fighter.parts.rightFoot.broken;
    }

    function moveFighter(fighter, dir, dt) {
      if (!dir || !canMove(fighter)) return;
      const rect = state.stageRect || getStageRect();
      const speed = LIMITS.moveSpeed * movementMultiplier(fighter);
      fighter.x += dir * speed * dt;
      fighter.x = clamp(fighter.x, 48, rect.width - 48);
      keepFightersSeparated();
    }

    function keepFightersSeparated() {
      const p = state.player;
      const c = state.cpu;
      if (!p || !c) return;
      const rect = state.stageRect || getStageRect();
      const pad = 54;
      const minX = pad;
      const maxX = Math.max(pad + 120, rect.width - pad);
      const usableGap = Math.max(72, maxX - minX - 8);
      const minGap = Math.min(LIMITS.minGap, usableGap);
      const playerLeft = state.playerOnLeft !== false;

      // 試合開始時に選んだ左右関係を固定する。
      // キャラがすり抜けて左右が入れ替わると、攻撃方向・前面腕・近い側の足が崩れるため。
      let leftFighter = playerLeft ? p : c;
      let rightFighter = playerLeft ? c : p;

      if (leftFighter.x > rightFighter.x - minGap) {
        const mid = (leftFighter.x + rightFighter.x) / 2;
        leftFighter.x = mid - minGap / 2;
        rightFighter.x = mid + minGap / 2;
      }

      // 端で押し合った時も、2体まとめて画面内に戻す。
      if (leftFighter.x < minX) {
        const shift = minX - leftFighter.x;
        leftFighter.x += shift;
        rightFighter.x += shift;
      }
      if (rightFighter.x > maxX) {
        const shift = rightFighter.x - maxX;
        leftFighter.x -= shift;
        rightFighter.x -= shift;
      }

      leftFighter.x = clamp(leftFighter.x, minX, maxX - minGap);
      rightFighter.x = clamp(rightFighter.x, leftFighter.x + minGap, maxX);
    }

    function isJumping(fighter) {
      return fighter.jumpUntil > getBattleNowMs();
    }

    function postureOf(fighter) {
      if (isJumping(fighter)) return "jump";
      if (fighter.crouch) return "crouch";
      return "stand";
    }

    function attackHeightFor(fighter) {
      const posture = postureOf(fighter);
      // ジャンプ攻撃は相手の頭を狙う high 攻撃。
      // ただし、🤜の表示Y座標は yForAttackHeight で💪🫀💪の高さに合わせる。
      if (posture === "jump") return "high";
      if (posture === "crouch") return "low";
      return "mid";
    }

    function jump(fighter, timestamp) {
      if (!canJump(fighter) || isJumping(fighter)) return false;
      fighter.crouch = false;
      fighter.jumpUntil = timestamp + LIMITS.jumpMs;
      return true;
    }

    function hasAnyArm(fighter) {
      return !fighter.parts.leftArm.broken || !fighter.parts.rightArm.broken;
    }

    function canAttack(fighter, timestamp) {
      // 攻撃は拳のみ。頭突きは存在しない。
      // 通常の決着ルートは「防御側の前面腕が壊れる → 心臓に通る」。
      // ここは想定外の保険として、使える腕が1本もない場合だけ攻撃不可にする。
      if (fighter.stamina < 1) return false;
      if (timestamp - fighter.lastAttackAt < LIMITS.attackCooldownMs) return false;
      return hasAnyArm(fighter);
    }
