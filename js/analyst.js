(function (global) {
  function analyzeMatch(track, profile) {
    const { rangeScore, clamp } = global.AppFinder;
    const bpm = track.bpm || 100;
    const energy = track.energy || 50;
    const bpmFit = rangeScore(bpm, profile.bpmTarget);
    const energyFit = rangeScore(energy, profile.energyTarget);
    const sceneHits = (profile.scenes || []).filter((scene) => (track.scenes || []).includes(scene));
    const moodHits = (profile.moods || []).filter((mood) => (track.moods || []).includes(mood));
    const fitUses = track._fitUses || [];
    const useTags = track._useTags || [];

    let weight = sceneHits.length * 13 + moodHits.length * 12 + bpmFit * 14 + energyFit * 16;
    weight += Math.min(track.heat || 50, 95) * 0.12;
    if (profile.wantsSoft && track.vocal === "instrumental") weight += 8;

    const primaryUse = (profile.uses && profile.uses[0]) || "general";
    if (fitUses.includes(primaryUse)) weight += 10;

    const useReasons = useTags.map(t => `${t.icon} 适合${t.label}`);

    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: bpm,
      energy: energy,
      vocal: track.vocal,
      fit: clamp(Math.round(weight), 0, 99),
      useTags,
      fitUses,
      matchPoints: {
        scenes: sceneHits,
        moods: moodHits,
        bpm: bpmFit,
        energy: energyFit,
        vocal: track.vocal,
        heat: track.heat,
        structure: track.structure,
        platforms: track.platforms,
        download: track.download,
        hook: track.hook,
        reasons: [
          ...useReasons,
          sceneHits.length ? `场景匹配：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}` : null,
          moodHits.length ? `情绪匹配：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}` : null,
          bpmFit > 0.72 ? `BPM ${bpm} 符合节奏需求` : null,
          energyFit > 0.72 ? `能量 ${energy}/100 匹配画面强度` : null
        ].filter(Boolean).concat(track.reasons || [])
      }
    };
  }

  function getActiveAgents(profile) {
    const uses = (profile && profile.uses) || ["general"];
    const config = global.AppFinder.FINDER_CONFIG;
    return uses.map(u => ({
      key: u,
      name: (config[u] || config.general).name,
      icon: (config[u] || config.general).icon
    }));
  }

  global.AppAnalyst = {
    analyzeMatch,
    getActiveAgents
  };
})(window);
