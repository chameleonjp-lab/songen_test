    function projectileReachedImpact(projectile, impactX) {
      if (!Number.isFinite(impactX)) return false;

      const previousX = Number.isFinite(projectile.previousX) ? projectile.previousX : projectile.startX;
      const currentX = Number.isFinite(projectile.currentX) ? projectile.currentX : projectile.startX;
      const padding = 20;

      const minX = Math.min(previousX, currentX) - padding;
      const maxX = Math.max(previousX, currentX) + padding;
      if (impactX < minX || impactX > maxX) return false;

      if (projectile.dir > 0) {
        return currentX + padding >= impactX;
      }
      return currentX - padding <= impactX;
    }

    function resolveAttackHit(projectile, timestamp, impactInfo) {
      const target = projectile.target === "player" ? state.player : state.cpu;
      const impact = impactInfo || getProjectileImpactInfo(projectile, timestamp);
      const impactX = Number.isFinite(impact.x) ? impact.x : (Number.isFinite(projectile.currentX) ? projectile.currentX : projectile.endX);
      const impactY = Number.isFinite(impact.y) ? impact.y : projectile.y;

      if (impact.type === "miss") {
        createEffect("…", impactX, impactY);
        return { type: "miss" };
      }

      if (target.hitInvulnerableUntil && target.hitInvulnerableUntil > timestamp) {
        createEffect("…", impactX, impactY);
        return { type: "miss" };
      }

      if (impact.type === "guard") {
        consumeGuardSuccess(target);
        createEffect("✨", impactX, impactY);
        return { type: "guard" };
      }

      if (impact.part === "heart" || impact.type === "heart") {
        createEffect("🫀", impactX, impactY);
        return { type: "heart", owner: projectile.owner };
      }

      damagePart(target, impact.part, projectile.owner);
      return { type: "part", part: impact.part };
    }

    function guardSucceeds(target, projectile, timestamp) {
      if (target.guardUntil < timestamp) return false;
      if (!hasAnyArm(target)) return false;
      if (isJumping(target)) return false;
      const attacker = projectile.owner === "player" ? state.player : state.cpu;
      if (!selectedGuardArm(target, attacker)) return false;
      if (target.guardStance === "mid" && projectile.height === "mid") return true;
      if (target.guardStance === "low" && projectile.height === "low") return true;
      return false;
    }

    function consumeGuardSuccess(target) {
      target.stamina = Math.max(0, target.stamina - 0.5);
      if (target.id === "player") {
        state.stats.guardSuccess += 1;
      }
    }



    

        

    

    function nearestAliveArmOrFoot(target, attacker) {
      const candidates = ["leftArm", "rightArm", "leftFoot", "rightFoot"]
        .filter((part) => target.parts[part] && !target.parts[part].broken)
        .map((part) => ({
          part,
          distance: Math.abs((target.x + visualPartOffset(target, part, attacker)) - attacker.x)
        }))
        .sort((a, b) => a.distance - b.distance);

      return candidates.length ? candidates[0].part : null;
    }

    function predictHitTarget(projectile, target, attacker) {
      const posture = postureOf(target);
      const height = projectile.height;

      if (posture === "stand") {
        // 相手が立ち：
        // high → 頭
        // mid  → 前面の腕 → 心臓。残った腕はガード時だけ防御に使える。
        // low  → 足。足がなければ空振り。
        if (height === "high") return "head";
        if (height === "mid") return frontAliveArm(target, attacker) || "heart";
        if (height === "low") return nearestAliveFoot(target, attacker) || "miss";
      }

      if (posture === "crouch") {
        // 相手がしゃがみ：
        // high → 空振り
        // mid  → 頭
        // low  → 近い腕または足 → 心臓
        if (height === "high") return "miss";
        if (height === "mid") return "head";
        if (height === "low") return nearestAliveArmOrFoot(target, attacker) || "heart";
      }

      if (posture === "jump") {
        // 相手がジャンプ：
        // 足があれば足。足がなければ空振り。
        return nearestAliveFoot(target, attacker) || "miss";
      }

      return "miss";
    }

    function frontAliveArm(target, attacker) {
      const front = getNearPart(target, attacker, "Arm");
      return target.parts[front].broken ? null : front;
    }

    

    function nearestAliveFoot(target, attacker) {
      const near = getNearPart(target, attacker, "Foot");
      const far = near === "leftFoot" ? "rightFoot" : "leftFoot";
      if (!target.parts[near].broken) return near;
      if (!target.parts[far].broken) return far;
      return null;
    }

    function getNearPart(target, attacker, suffix) {
      const attackerIsLeft = attacker.x < target.x;
      return attackerIsLeft ? `left${suffix}` : `right${suffix}`;
    }

    function oppositePart(part) {
      if (part === "leftArm") return "rightArm";
      if (part === "rightArm") return "leftArm";
      if (part === "leftFoot") return "rightFoot";
      if (part === "rightFoot") return "leftFoot";
      return null;
    }

    function frontArmFor(target, attacker) {
      return getNearPart(target, attacker, "Arm");
    }

    function selectedGuardArm(target, attacker) {
      if (!attacker) return null;
      const front = frontArmFor(target, attacker);
      const back = oppositePart(front);
      if (back && !target.parts[back].broken) return back;
      if (!target.parts[front].broken) return front;
      return null;
    }

    function damagePart(target, part, ownerId) {
      const data = target.parts[part];
      if (!data) return;

      const attacker = ownerId === "player" ? state.player : state.cpu;

      // 最新仕様：
      // 壊れた腕・足は通常ヒット対象にも防御パーツにもならない。
      // 念のためここに来ても、追加スコアや追加ダメージは発生させない。
      // 頭だけは💩として見た目に残るため、頭への追加ヒットはスコアだけ変える。
      if (data.broken) {
        if (part !== "head") {
          createEffect("…", target.x + visualPartOffset(target, part, attacker), yForPart(target, part));
          return;
        }

        flashFighter(target.id);
        target.hitInvulnerableUntil = getBattleNowMs() + LIMITS.hitStunMs;
        if (ownerId === "player" && target.id === "cpu") {
          state.stats.enemyBrokenPartHits += 1;
          createEffect("+300", target.x + visualPartOffset(target, part, attacker), yForPart(target, part));
        } else if (ownerId === "cpu" && target.id === "player") {
          state.stats.playerBrokenPartHits += 1;
          createEffect("-300", target.x + visualPartOffset(target, part, attacker), yForPart(target, part));
        } else {
          createEffect("•", target.x + visualPartOffset(target, part, attacker), yForPart(target, part));
        }
        return;
      }

      data.damage += 1;
      flashFighter(target.id);
      target.hitInvulnerableUntil = getBattleNowMs() + LIMITS.hitStunMs;
      const brokenNow = data.damage >= PART_MAX[part];
      createEffect(brokenNow ? "💥" : "•", target.x + visualPartOffset(target, part, attacker), yForPart(target, part));
      if (brokenNow) {
        data.broken = true;
        if (ownerId === "player" && target.id === "cpu") {
          state.stats.enemyPartsBroken += 1;
          if (part === "head") state.stats.enemyHeadBroken += 1;
        }
        if (ownerId === "cpu" && target.id === "player") {
          state.stats.playerPartsBroken += 1;
          if (part === "head") state.stats.playerHeadBroken += 1;
        }
      }
    }

    

    function staticPartOffset(part) {
      if (part === "leftArm" || part === "leftFoot") return -38;
      if (part === "rightArm" || part === "rightFoot") return 38;
      return 0;
    }

    function visualPartOffset(target, part, attacker) {
      if (!part || part === "heart" || part === "head" || part === "miss") return 0;

      if (String(part).includes("Arm")) {
        const guardActive = target.guardUntil > getBattleNowMs() && hasAnyArm(target) && !isJumping(target) && attacker;
        if (guardActive && selectedGuardArm(target, attacker) === part) {
          return staticPartOffset(frontArmFor(target, attacker));
        }
        return staticPartOffset(part);
      }

      if (String(part).includes("Foot") && attacker) {
        const near = getNearPart(target, attacker, "Foot");
        const far = oppositePart(near);
        if (part === far && target.parts[near] && target.parts[near].broken && target.parts[far] && !target.parts[far].broken) {
          return staticPartOffset(near);
        }
      }

      return staticPartOffset(part);
    }

    function yForAttackHeight(height, fighter) {
      // ジャンプ攻撃は判定上は high だが、見た目の🤜はジャンプ中の💪🫀💪の高さから出す。
      // これにより、立ち相手の頭へ向かう見た目と当たり判定を合わせる。
      if (height === "high" && fighter && postureOf(fighter) === "jump") {
        return yForHeight("mid", fighter);
      }
      return yForHeight(height, fighter);
    }
