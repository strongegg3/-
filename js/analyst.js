(function (global) {
  function analyzeMatch(track, profile) {
    const { rangeScore, clamp } = global.AppFinder;
    const bpmFit = rangeScore(track.bpm, profile.bpmTarget);
    const energyFit = rangeScore(track.energy, profile.energyTarget);
    const sceneHits = profile.scenes.filter((scene) => track.scenes.includes(scene));
    const moodHits = profile.moods.filter((mood) => track.moods.includes(mood));
    let weight = sceneHits.length * 13 + moodHits.length * 12 + bpmFit * 14 + energyFit * 16;
    weight += Math.min(track.heat, 95) * 0.12;
    if (profile.wantsSoft && track.vocal === "instrumental") weight += 8;
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      energy: track.energy,
      vocal: track.vocal,
      fit: clamp(Math.round(weight), 0, 99),
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
          sceneHits.length ? `场景匹配：${sceneHits.map((k) => global.AppProfile.nameOf(k)).join("、")}` : null,
          moodHits.length ? `情绪匹配：${moodHits.map((k) => global.AppProfile.nameOf(k)).join("、")}` : null,
          bpmFit > 0.72 ? `BPM ${track.bpm} 符合节奏需求` : null,
          energyFit > 0.72 ? `能量 ${track.energy}/100 匹配画面强度` : null
        ].filter(Boolean).concat(track.reasons || [])
      }
    };
  }

  global.AppAnalyst = {
    analyzeMatch
  };
})(window);
