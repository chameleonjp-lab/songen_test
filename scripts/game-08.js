    window.__songenDebug = {
      getInputLog,
      replayInputLog,
      getHashLog,
      makeStateHash,
      makeStateSnapshotForHash
    };

    function setPressedButton(btn, pressed) {
      btn.classList.toggle("is-pressed", Boolean(pressed));
    }

    function bindHoldButton(btn, onDown, onUp) {
      const down = (event) => {
        event.preventDefault();
        setPressedButton(btn, true);
        onDown();
      };
      const up = (event) => {
        event.preventDefault();
        setPressedButton(btn, false);
        onUp();
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", up);
    }

    function setPlayerHoldInput(key, value) {
      if (!state.currentInputs || !state.currentInputs.player) resetInputBuffers();
      state.currentInputs.player[key] = Boolean(value);
      state.keys[key] = Boolean(value);
    }

    function queuePlayerPressedInput(key) {
      if (!state.running || state.ended) return;
      if (!state.currentInputs || !state.currentInputs.player) resetInputBuffers();
      state.currentInputs.player[key] = true;
    }

    function queueCpuPressedInput(key) {
      if (!state.running || state.ended || state.battleMode !== BATTLE_MODE.local2p) return;
      if (!state.currentInputs || !state.currentInputs.cpu) resetInputBuffers();
      state.currentInputs.cpu[key] = true;
    }

    function bindControls() {
      bindHoldButton(dom.buttons.left, () => setPlayerHoldInput("left", true), () => setPlayerHoldInput("left", false));
      bindHoldButton(dom.buttons.right, () => setPlayerHoldInput("right", true), () => setPlayerHoldInput("right", false));
      bindHoldButton(dom.buttons.crouch, () => setPlayerHoldInput("crouch", true), () => setPlayerHoldInput("crouch", false));

      const bindPressed = (btn, key) => {
        if (!btn) return;
        btn.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          setPressedButton(btn, true);
          queuePlayerPressedInput(key);
        });
        const clear = (event) => {
          if (event && event.preventDefault) event.preventDefault();
          setPressedButton(btn, false);
        };
        btn.addEventListener("pointerup", clear);
        btn.addEventListener("pointercancel", clear);
        btn.addEventListener("pointerleave", clear);
      };

      bindPressed(dom.buttons.jump, "jumpPressed");
      bindPressed(dom.buttons.attack, "attackPressed");
      bindPressed(dom.buttons.guard, "guardPressed");

      bindLocal2pKeyboardControls();
      bindLegacyTouchControlFallback();
    }


    function bindLegacyTouchControlFallback() {
      if (window.PointerEvent) return;

      const bindHold = (btn, onDown, onUp) => {
        if (!btn) return;
        const down = (event) => {
          event.preventDefault();
          setPressedButton(btn, true);
          onDown();
        };
        const up = (event) => {
          if (event) event.preventDefault();
          setPressedButton(btn, false);
          onUp();
        };
        btn.addEventListener("touchstart", down, { passive: false });
        btn.addEventListener("touchend", up, { passive: false });
        btn.addEventListener("touchcancel", up, { passive: false });
        btn.addEventListener("mousedown", down);
        btn.addEventListener("mouseup", up);
        btn.addEventListener("mouseleave", up);
      };

      const bindAction = (btn, key) => {
        if (!btn) return;
        const down = (event) => {
          event.preventDefault();
          setPressedButton(btn, true);
          queuePlayerPressedInput(key);
        };
        const up = (event) => {
          if (event) event.preventDefault();
          setPressedButton(btn, false);
        };
        btn.addEventListener("touchstart", down, { passive: false });
        btn.addEventListener("touchend", up, { passive: false });
        btn.addEventListener("touchcancel", up, { passive: false });
        btn.addEventListener("mousedown", down);
        btn.addEventListener("mouseup", up);
        btn.addEventListener("mouseleave", up);
      };

      bindHold(dom.buttons.left, () => setPlayerHoldInput("left", true), () => setPlayerHoldInput("left", false));
      bindHold(dom.buttons.right, () => setPlayerHoldInput("right", true), () => setPlayerHoldInput("right", false));
      bindHold(dom.buttons.crouch, () => setPlayerHoldInput("crouch", true), () => setPlayerHoldInput("crouch", false));

      bindAction(dom.buttons.jump, "jumpPressed");
      bindAction(dom.buttons.attack, "attackPressed");
      bindAction(dom.buttons.guard, "guardPressed");
    }

    function bindLocal2pKeyboardControls() {
      const map = {
        j: { key: "left", hold: true },
        l: { key: "right", hold: true },
        k: { key: "crouch", hold: true },
        i: { key: "jumpPressed", hold: false },
        o: { key: "attackPressed", hold: false },
        p: { key: "guardPressed", hold: false }
      };

      window.addEventListener("keydown", (event) => {
        const item = map[String(event.key || "").toLowerCase()];
        if (!item || state.battleMode !== BATTLE_MODE.local2p || !state.running || state.ended) return;
        event.preventDefault();
        if (item.hold) state.currentInputs.cpu[item.key] = true;
        else if (!event.repeat) queueCpuPressedInput(item.key);
      });

      window.addEventListener("keyup", (event) => {
        const item = map[String(event.key || "").toLowerCase()];
        if (!item || !item.hold) return;
        event.preventDefault();
        state.currentInputs.cpu[item.key] = false;
      });
    }

    function retireBattle() {
      if (!state.running || state.ended) return;
      resetInputBuffers();
      finishBattle("retire");
    }

    function isGameplayLocked() {
      return Boolean(state.running || state.countdown);
    }

    function enableGameplayBrowserGuard() {
      document.body.classList.add("playing-lock");
      if (!state.historyLockActive && window.history && history.pushState) {
        try {
          history.pushState({ songenGameLock: true }, "", location.href);
          state.historyLockActive = true;
        } catch (error) {
          state.historyLockActive = false;
        }
      }
    }

    function disableGameplayBrowserGuard() {
      document.body.classList.remove("playing-lock");
      state.historyLockActive = false;
    }

    function bindBrowserGestureGuard() {
      // iOS Safariの画面端スワイプ戻るはOS側操作なので、完全には止めきれない。
      // ただしゲーム中に戻る操作が発生した場合は、同じページへ押し戻す。
      window.addEventListener("popstate", () => {
        if (isGameplayLocked()) {
          try {
            history.pushState({ songenGameLock: true }, "", location.href);
            state.historyLockActive = true;
          } catch (error) {
            // ゲーム本体は止めない。
          }
          showToast("ゲーム中は戻る操作を無効にしています");
        }
      });

      document.addEventListener("touchstart", (event) => {
        if (!isGameplayLocked()) return;
        state.lastViewportTouchAt = Date.now();
        if (event.touches && event.touches.length > 1) {
          event.preventDefault();
        }
      }, { passive: false });

      document.addEventListener("touchmove", (event) => {
        if (!isGameplayLocked()) return;
        const target = event.target;
        const interactive = target && target.closest && target.closest(".control-btn, .retire-btn");
        if (interactive || (event.touches && event.touches.length > 1)) {
          event.preventDefault();
        }
      }, { passive: false });

      document.addEventListener("gesturestart", (event) => {
        if (isGameplayLocked()) event.preventDefault();
      }, { passive: false });
      document.addEventListener("gesturechange", (event) => {
        if (isGameplayLocked()) event.preventDefault();
      }, { passive: false });
      document.addEventListener("gestureend", (event) => {
        if (isGameplayLocked()) event.preventDefault();
      }, { passive: false });

      document.addEventListener("dblclick", (event) => {
        if (isGameplayLocked()) event.preventDefault();
      }, { passive: false });
    }

    function bindTapButton(btn, handler) {
      if (!btn) return;
      let lastTapAt = 0;

      const run = (event) => {
        if (event) event.preventDefault();
        const t = Date.now();
        if (t - lastTapAt < 250) return;
        lastTapAt = t;
        handler(event);
      };

      btn.addEventListener("click", run);
      btn.addEventListener("pointerup", (event) => {
        if (event.pointerType === "touch") run(event);
      });

      if (!window.PointerEvent) {
        btn.addEventListener("touchend", run, { passive: false });
      }
    }
