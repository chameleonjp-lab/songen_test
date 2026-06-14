    function init() {
      initHeadGrid(dom.playerHeadGrid, "player");
      initHeadGrid(dom.cpuHeadGrid, "cpu");
      bindControls();
      bindNavigation();
      bindSetupChoices();
      preventGestureZoom();
      bindBrowserGestureGuard();
      let saved = "";
      try { saved = localStorage.getItem("songen_player_name") || ""; } catch (error) {}
      dom.playerNameInput.value = saved;
      window.addEventListener("resize", () => {
        const rect = getStageRect();
        if (state.player) state.player.x = clamp(state.player.x, 48, rect.width - 48);
        if (state.cpu) state.cpu.x = clamp(state.cpu.x, 48, rect.width - 48);
        keepFightersSeparated();
        renderAll();
      });
    }

    init();
