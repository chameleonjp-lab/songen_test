    function doAttack(fighter, timestamp) {
      if (!canAttack(fighter, timestamp)) return false;
      const target = fighter.id === "player" ? state.cpu : state.player;
      const dir = target.x > fighter.x ? 1 : -1;
      const height = attackHeightFor(fighter);
      const range = LIMITS.fistRange;
      const emoji = dir > 0 ? "🤜" : "🤛";

      // 弾の終点は相手の中心ではなく、攻撃の最大射程。
      // 実際の命中は毎フレームの現在座標と相手パーツ座標の交差で決める。
      const startX = fighter.x + dir * 24;
      const endX = fighter.x + dir * range;
      const travel = Math.abs(endX - startX);
      const duration = attackDuration(travel);

      fighter.stamina = Math.max(0, fighter.stamina - 1);
      fighter.lastAttackAt = timestamp;

      if (fighter.id === "player") state.stats.attacks += 1;

      const projectile = {
        id: state.projectileSeq++,
        owner: fighter.id,
        target: target.id,
        type: "fist",
        height,
        emoji,
        startX,
        endX,
        previousX: startX,
        currentX: startX,
        y: yForAttackHeight(height, fighter),
        dir,
        createdAt: timestamp,
        durationMs: duration * 1000,
        progress: 0,
        removed: false,
        resolved: false,
        el: null
      };
      projectile.el = createProjectileEl(projectile);
      state.projectiles.push(projectile);
      if (fighter.id === "player") maybeCpuGuard(projectile, timestamp);
      return true;
    }

    function attackDuration(distance) {
      if (distance <= 72) return 0.2;
      if (distance <= 120) return 0.35;
      return 0.5;
    }

    function yForHeight(height, fighter) {
      const rect = state.stageRect || getStageRect();
      const base = fighter && fighter.y ? fighter.y : Math.max(120, rect.height - LIMITS.fighterGroundMargin);
      if (height === "high") return base - 35;
      if (height === "low") return base + 34;
      return base;
    }

    function createProjectileEl(projectile) {
      const el = document.createElement("div");
      el.className = "projectile";
      el.textContent = projectile.emoji;
      el.style.left = `${projectile.startX}px`;
      el.style.top = `${projectile.y}px`;
      dom.stage.appendChild(el);
      return el;
    }

    

    function maybeCpuGuard(projectile, timestamp) {
      if (state.battleMode !== BATTLE_MODE.cpu) return;
      const cpu = state.cpu;
      const player = state.player;
      if (!cpu || !player || state.ended) return;

      const predictedPart = predictHitTarget(projectile, cpu, player);
      if (predictedPart === "miss") return;

      const dangerous = predictedPart === "heart";
      const defenseChance = dangerous ? 0.82 : 0.42;
      if (Math.random() > defenseChance) return;

      const delay = clamp(projectile.durationMs * (0.32 + Math.random() * 0.22), 70, 260);
      const executeAtMs = timestamp + delay;

      if (projectile.height === "high") {
        state.cpuBrain.scheduledActions.push({
          executeAtMs,
          type: "crouch",
          projectileId: projectile.id,
          untilMs: executeAtMs + 420 + Math.random() * 240
        });
        return;
      }

      state.cpuBrain.scheduledActions.push({
        executeAtMs,
        type: "guard",
        projectileId: projectile.id,
        crouch: projectile.height === "low"
      });
    }

    function processCpuScheduledActions(timestamp) {
      const actions = state.cpuBrain.scheduledActions || [];
      if (!actions.length || state.battleMode !== BATTLE_MODE.cpu) return;
      const remaining = [];
      for (const action of actions) {
        if (!action || action.executeAtMs > timestamp) {
          remaining.push(action);
          continue;
        }
        const cpu = state.cpu;
        if (!state.running || state.ended || !cpu || isJumping(cpu)) continue;
        const projectile = state.projectiles.find((p) => p.id === action.projectileId);
        if (!projectile || projectile.removed) continue;

        if (action.type === "crouch") {
          cpu.crouch = true;
          state.cpuBrain.crouchUntil = action.untilMs || (timestamp + 420);
          continue;
        }

        if (action.type === "guard") {
          if (cpu.stamina < 0.5 || !hasAnyArm(cpu)) continue;
          cpu.crouch = Boolean(action.crouch);
          startGuard(cpu, timestamp);
        }
      }
      state.cpuBrain.scheduledActions = remaining;
    }

    function startGuard(fighter, timestamp) {
      if (isJumping(fighter)) return false;
      if (!hasAnyArm(fighter)) return false;
      if (fighter.stamina < 0.5) return false;
      fighter.stamina = Math.max(0, fighter.stamina - 0.5);
      fighter.guardUntil = timestamp + LIMITS.guardMs;
      fighter.guardStance = fighter.crouch ? "low" : "mid";
      return true;
    }

    

    function updateProjectiles(timestamp) {
      const heartHits = [];

      for (const p of state.projectiles) {
        if (p.removed) continue;
        const rawProgress = (timestamp - p.createdAt) / p.durationMs;
        const progress = clamp(rawProgress, 0, 1);
        p.previousX = Number.isFinite(p.currentX) ? p.currentX : p.startX;
        p.currentX = p.startX + (p.endX - p.startX) * progress;
        p.progress = rawProgress;
        if (p.el) {
          p.el.style.left = `${p.currentX}px`;
          p.el.style.top = `${p.y}px`;
        }
      }

      resolveProjectileCollisions();

      for (const p of state.projectiles) {
        if (p.removed || p.resolved) continue;

        const impact = getProjectileImpactInfo(p, timestamp);
        const hasImpact = impact.type !== "miss" && projectileReachedImpact(p, impact.x);

        if (hasImpact) {
          p.resolved = true;
          p.currentX = impact.x;
          if (p.el) {
            p.el.style.left = `${p.currentX}px`;
            p.el.style.top = `${p.y}px`;
          }
          const result = resolveAttackHit(p, timestamp, impact);
          p.removed = true;
          if (p.el) p.el.remove();
          if (result && result.type === "heart") heartHits.push(result.owner);
          continue;
        }

        if (p.progress >= 1) {
          p.resolved = true;
          createEffect("…", p.currentX, p.y);
          p.removed = true;
          if (p.el) p.el.remove();
        }
      }

      state.projectiles = state.projectiles.filter((p) => !p.removed);
      const playerHeart = heartHits.includes("player");
      const cpuHeart = heartHits.includes("cpu");
      if (playerHeart && cpuHeart) {
        finishBattle("draw");
      } else if (playerHeart) {
        finishBattle("win");
      } else if (cpuHeart) {
        finishBattle("loss");
      }
    }

    function resolveProjectileCollisions() {
      for (let i = 0; i < state.projectiles.length; i++) {
        const a = state.projectiles[i];
        if (a.removed || a.type !== "fist") continue;
        for (let j = i + 1; j < state.projectiles.length; j++) {
          const b = state.projectiles[j];
          if (b.removed || b.type !== "fist") continue;
          if (a.owner === b.owner || a.height !== b.height) continue;
          if (Math.abs((a.currentX || a.startX) - (b.currentX || b.startX)) <= 28) {
            createEffect("💥", ((a.currentX || a.startX) + (b.currentX || b.startX)) / 2, a.y);
            a.removed = true;
            b.removed = true;
            if (a.el) a.el.remove();
            if (b.el) b.el.remove();
          }
        }
      }
    }

    function getProjectileImpactInfo(projectile, timestamp) {
      const attacker = projectile.owner === "player" ? state.player : state.cpu;
      const target = projectile.target === "player" ? state.player : state.cpu;

      if (guardSucceeds(target, projectile, timestamp)) {
        const guardArm = selectedGuardArm(target, attacker) || frontArmFor(target, attacker);
        return {
          type: "guard",
          part: guardArm,
          x: target.x + visualPartOffset(target, guardArm, attacker),
          y: yForHeight(target.guardStance, target)
        };
      }

      const targetPart = predictHitTarget(projectile, target, attacker);
      if (targetPart === "miss") {
        return {
          type: "miss",
          part: "miss",
          x: null,
          y: projectile.y
        };
      }

      return {
        type: targetPart === "heart" ? "heart" : "part",
        part: targetPart,
        x: target.x + visualPartOffset(target, targetPart, attacker),
        y: yForPart(target, targetPart || projectile.height)
      };
    }
