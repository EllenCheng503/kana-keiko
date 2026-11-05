/**
 * engine.js — 記憶科學、自然真人感語音與永續儲存引擎 (v5.0 Apple HIG Edition)
 * - 真人感日語神經網路語音 MP3 播放器（支援「假名 ⋯ 自然呼吸停頓 ⋯ 單字」分段發音與語速切換）
 * - 即時本機自動儲存 (localStorage) ＋ 斷點續學快照 (Apple Continuity)
 * - 跨裝置短同步碼 (KANA4-...) ＋ JSON 備份雙重保障
 * - 艾賓浩斯 6 階記憶排程 ＋ 易混淆雙胞胎智慧干擾項生成
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'kana-keiko-v3';
  const SESSION_KEY = 'kana-keiko-continuity';
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const INTERVALS = [0, 10 * MIN, 12 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY];
  const MAX_LEVEL = 6;

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayStr() {
    const d = new Date(Date.now() - DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function defaultState() {
    return {
      version: 5,
      cards: {},       // { [item.id]: { level, due, seen, ok, fail, last } }
      doneLessons: [], // ['hb0', ...]
      streak: 0,
      lastStudyDate: '',
      todayDate: todayStr(),
      todayCount: 0,
      dailyGoal: 15,
      lastSavedAt: 0,
      settings: {
        autoSpeak: true,
        soundFx: true,
        speechSpeed: 'normal', // 'normal' | 'slow'
        fontStyle: 'gothic',   // 'gothic' | 'mincho'
        theme: 'light'         // 'light' | 'dark'
      }
    };
  }

  let storageAvailable = true;
  let state = defaultState();
  let saveListeners = [];
  let speechStageListeners = [];

  function checkStorage() {
    try {
      const k = '__kana_probe__';
      localStorage.setItem(k, '1');
      const ok = localStorage.getItem(k) === '1';
      localStorage.removeItem(k);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function migrateLegacyProgress(target) {
    try {
      ['kana-keiko', 'kana-keiko-v2', 'kana-keiko-v1'].forEach(key => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        let src = null;
        if (parsed && parsed.profiles && parsed.active && parsed.profiles[parsed.active]) {
          src = parsed.profiles[parsed.active].data;
        } else if (parsed && parsed.cards) {
          src = parsed;
        }
        if (src && src.cards) {
          Object.entries(src.cards).forEach(([id, c]) => {
            if (!target.cards[id] && window.KanaDB.BY_ID[id]) {
              target.cards[id] = {
                level: Math.min(MAX_LEVEL, Math.max(1, c.l || 1)),
                due: c.d || Date.now(),
                seen: c.n || 1,
                ok: Math.max(0, (c.n || 1) - (c.w || 0)),
                fail: c.w || 0,
                last: Date.now()
              };
            }
          });
          if (Array.isArray(src.done)) {
            src.done.forEach(lid => {
              if (!target.doneLessons.includes(lid)) target.doneLessons.push(lid);
            });
          }
          if ((src.streak || 0) > target.streak) target.streak = src.streak;
        }
      });

      const oldSrs = localStorage.getItem('kana-master-srs');
      if (oldSrs) {
        const cards = JSON.parse(oldSrs);
        Object.values(cards).forEach(c => {
          if (c && c.totalReviews > 0 && c.id) {
            const item = window.KanaDB.BY_KANA[c.id];
            if (item && !target.cards[item.id]) {
              target.cards[item.id] = {
                level: Math.min(MAX_LEVEL, Math.max(1, (c.mastery || 1) * 2)),
                due: c.dueDate ? new Date(c.dueDate).getTime() : Date.now(),
                seen: c.totalReviews || 1,
                ok: c.correctCount || 0,
                fail: Math.max(0, (c.totalReviews || 1) - (c.correctCount || 0)),
                last: c.lastReviewed ? new Date(c.lastReviewed).getTime() : Date.now()
              };
            }
          }
        });
      }
    } catch (e) {
      console.warn('Migration skipped:', e);
    }
  }

  function load() {
    storageAvailable = checkStorage();
    if (!storageAvailable) {
      state = defaultState();
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
        state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      } else {
        state = defaultState();
        migrateLegacyProgress(state);
        save(true);
      }
    } catch (e) {
      state = defaultState();
    }

    const t = todayStr();
    if (state.todayDate !== t) {
      state.todayDate = t;
      state.todayCount = 0;
      if (state.lastStudyDate && state.lastStudyDate !== t && state.lastStudyDate !== yesterdayStr()) {
        state.streak = 0;
      }
      save(true);
    }
  }

  function save(silent) {
    if (!storageAvailable) return;
    try {
      state.lastSavedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (!silent) {
        saveListeners.forEach(fn => { try { fn(state.lastSavedAt); } catch (_) {} });
      }
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function onSave(fn) {
    saveListeners.push(fn);
  }

  function onSpeechStage(fn) {
    speechStageListeners.push(fn);
  }

  function emitSpeechStage(stage, item) {
    speechStageListeners.forEach(fn => {
      try { fn(stage, item || null); } catch (_) {}
    });
  }

  // ==================== 斷點續學快照 (Apple Continuity) ====================
  function saveContinuitySession(snapshot) {
    if (!storageAvailable) return;
    try {
      if (!snapshot) {
        localStorage.removeItem(SESSION_KEY);
      } else {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          ...snapshot,
          savedAt: Date.now()
        }));
      }
    } catch (_) {}
  }

  function getContinuitySession() {
    if (!storageAvailable) return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (!snap || (Date.now() - (snap.savedAt || 0)) > 2 * DAY) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return snap;
    } catch (_) {
      return null;
    }
  }

  function clearContinuitySession() {
    if (!storageAvailable) return;
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  // ==================== 學習行為與 SRS 排程 ====================
  function touchStudyActivity(incrementCount = 1) {
    const t = todayStr();
    if (state.todayDate !== t) {
      state.todayDate = t;
      state.todayCount = 0;
    }
    state.todayCount += incrementCount;

    if (state.lastStudyDate !== t) {
      if (state.lastStudyDate === yesterdayStr()) {
        state.streak += 1;
      } else {
        state.streak = 1;
      }
      state.lastStudyDate = t;
    }
  }

  function markIntroduced(itemId) {
    if (!state.cards[itemId]) {
      state.cards[itemId] = {
        level: 1,
        due: Date.now() + INTERVALS[1],
        seen: 0,
        ok: 0,
        fail: 0,
        last: Date.now()
      };
      touchStudyActivity(0);
      save(false);
    }
  }

  function recordAnswer(itemId, isCorrect) {
    const now = Date.now();
    let c = state.cards[itemId];
    if (!c) {
      c = state.cards[itemId] = { level: 1, due: now, seen: 0, ok: 0, fail: 0, last: now };
    }
    c.seen += 1;
    c.last = now;
    if (isCorrect) {
      c.ok += 1;
      c.level = Math.min(MAX_LEVEL, (c.level || 0) + 1);
      c.due = now + INTERVALS[c.level];
    } else {
      c.fail += 1;
      c.level = Math.max(1, (c.level || 1) - 2);
      c.due = now + 5 * MIN;
    }
    touchStudyActivity(1);
    save(false);
    return c;
  }

  function markLessonComplete(lessonId) {
    if (lessonId && !state.doneLessons.includes(lessonId)) {
      state.doneLessons.push(lessonId);
    }
    touchStudyActivity(0);
    save(false);
  }

  function getCard(itemId) {
    return state.cards[itemId] || null;
  }

  function getWeaknessScore(item) {
    const c = state.cards[item.id];
    if (!c) return 0;
    const errRate = c.seen > 0 ? (c.fail / c.seen) : 0;
    const overdueDays = c.due <= Date.now() ? Math.min(7, (Date.now() - c.due) / DAY + 1) : 0;
    const unmastered = MAX_LEVEL - c.level;
    return errRate * 10 + unmastered * 1.6 + overdueDays * 1.4 + (c.fail >= 2 ? 2.5 : 0);
  }

  function getOverviewStats() {
    const allCards = Object.entries(state.cards);
    let stageNew = 0, stageShort = 0, stageMid = 0, stageLong = 0;
    let dueCount = 0, totalSeen = 0, totalOk = 0;
    const now = Date.now();

    allCards.forEach(([id, c]) => {
      if (!window.KanaDB.BY_ID[id]) return;
      if (c.level <= 1) stageNew++;
      else if (c.level <= 3) stageShort++;
      else if (c.level <= 5) stageMid++;
      else stageLong++;

      if (c.due <= now) dueCount++;
      totalSeen += c.seen || 0;
      totalOk += c.ok || 0;
    });

    const learnedItems = window.KanaDB.ITEMS.filter(it => !!state.cards[it.id]);
    const weakItems = learnedItems
      .map(it => ({ item: it, score: getWeaknessScore(it), card: state.cards[it.id] }))
      .sort((a, b) => b.score - a.score);

    const hiraBaseTotal = 46;
    const hiraBaseLearned = window.KanaDB.ITEMS.filter(it => it.script === 'h' && it.set === 'base' && state.cards[it.id]).length;
    const kataBaseTotal = 46;
    const kataBaseLearned = window.KanaDB.ITEMS.filter(it => it.script === 'k' && it.set === 'base' && state.cards[it.id]).length;

    return {
      learnedCount: learnedItems.length,
      dueCount,
      stageNew,
      stageShort,
      stageMid,
      stageLong,
      accuracy: totalSeen > 0 ? Math.round((totalOk / totalSeen) * 100) : null,
      totalReviews: totalSeen,
      streak: state.streak,
      todayCount: state.todayCount,
      dailyGoal: state.dailyGoal,
      doneLessonsCount: state.doneLessons.length,
      totalLessonsCount: window.KanaDB.ALL_LESSONS.length,
      hiraBaseLearned,
      hiraBaseTotal,
      kataBaseLearned,
      kataBaseTotal,
      weakItems,
      lastSavedAt: state.lastSavedAt
    };
  }

  function getNextRecommendedLesson() {
    for (const lesson of window.KanaDB.ALL_LESSONS) {
      if (!state.doneLessons.includes(lesson.id)) return lesson;
    }
    return window.KanaDB.ALL_LESSONS[0];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getSmartDistractors(target, contextChars = [], count = 3) {
    const picked = [];
    const usedRomaji = new Set([target.romaji]);
    const usedKana = new Set([target.kana]);

    const tryAdd = (cand) => {
      if (!cand || picked.length >= count) return;
      if (usedKana.has(cand.kana) || usedRomaji.has(cand.romaji)) return;
      usedKana.add(cand.kana);
      usedRomaji.add(cand.romaji);
      picked.push(cand);
    };

    shuffle(target.confusables || []).forEach(k => {
      const cand = window.KanaDB.BY_KANA[k];
      if (cand && cand.script === target.script) tryAdd(cand);
    });
    shuffle(contextChars).forEach(tryAdd);

    const learnedSame = window.KanaDB.ITEMS.filter(
      it => it.script === target.script && it.set === target.set && state.cards[it.id]
    );
    shuffle(learnedSame).forEach(tryAdd);

    const fallback = window.KanaDB.ITEMS.filter(
      it => it.script === target.script && it.set === target.set
    );
    shuffle(fallback).forEach(tryAdd);

    return picked;
  }

  function makeQuestion(item, type, contextPool) {
    const distractors = getSmartDistractors(item, contextPool, 3);
    const choices = shuffle([item, ...distractors]);
    let wordMasked = null;
    if (type === 'word-fill' && item.word && item.word[0]) {
      wordMasked = item.word[0].replace(item.kana, '＿');
    }
    return {
      item,
      type,
      choices,
      wordMasked,
      retried: false
    };
  }

  function buildQuizDeck(targetItems, mode = 'lesson') {
    const questions = [];
    const pool = targetItems.slice();

    if (mode === 'lesson') {
      const round1 = shuffle(pool).map((item, idx) =>
        makeQuestion(item, idx % 2 === 0 ? 'kana-to-romaji' : 'audio-to-kana', pool)
      );
      const round2 = shuffle(pool).map(item => {
        const hasWord = item.word && item.word[0] && item.word[0].includes(item.kana) && item.word[0].length > 1;
        return makeQuestion(item, hasWord ? 'word-fill' : 'romaji-to-kana', pool);
      });
      questions.push(...round1, ...round2);
      if (questions.length > 2 && questions[round1.length - 1].item.id === questions[round1.length].item.id) {
        const last = questions.pop();
        questions.splice(round1.length, 0, last);
      }
    } else if (mode === 'confusable') {
      shuffle(pool).slice(0, 14).forEach((item, idx) => {
        questions.push(makeQuestion(item, idx % 2 === 0 ? 'romaji-to-kana' : 'kana-to-romaji', pool));
      });
    } else {
      pool.forEach((item, idx) => {
        const hasWord = item.word && item.word[0] && item.word[0].includes(item.kana) && item.word[0].length > 1;
        const types = ['kana-to-romaji', 'romaji-to-kana', 'audio-to-kana'];
        if (hasWord) types.push('word-fill');
        questions.push(makeQuestion(item, types[idx % types.length], pool));
      });
    }
    return questions;
  }

  function getSmartReviewItems(maxCount = 12) {
    const learned = window.KanaDB.ITEMS.filter(it => !!state.cards[it.id]);
    if (learned.length === 0) return [];
    const ranked = learned
      .map(it => ({ it, w: getWeaknessScore(it) }))
      .sort((a, b) => b.w - a.w)
      .slice(0, maxCount)
      .map(x => x.it);

    const out = [...ranked];
    const seen = new Set(out.map(x => x.id));
    ranked.slice(0, 4).forEach(it => {
      (it.confusables || []).forEach(ck => {
        const twin = window.KanaDB.BY_KANA[ck];
        if (twin && state.cards[twin.id] && !seen.has(twin.id) && out.length < maxCount + 3) {
          seen.add(twin.id);
          out.push(twin);
        }
      });
    });
    return shuffle(out);
  }

  // ==================== 真人感神經網路日語語音引擎 (Studio Neural MP3 + 自然停頓) ====================
  const AUDIO_CACHE = new Map();
  let currentSpeechToken = 0;
  let activeAudioEl = null;
  let pauseTimerId = null;
  let jpVoice = null;

  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    const scan = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const jaVoices = voices.filter(v => /^ja([-_]|$)/i.test(v.lang));
      // 優先挑選神經網路／高音質日文語音，避開老舊機械音 Haruka Desktop
      jpVoice =
        jaVoices.find(v => /natural|online|neural/i.test(v.name)) ||
        jaVoices.find(v => /google|kyoko|o-ren|siri|hattori/i.test(v.name)) ||
        jaVoices.find(v => !/compact|haruka/i.test(v.name)) ||
        jaVoices[0] ||
        null;
    };
    scan();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = scan;
    }
    setTimeout(scan, 400);
    setTimeout(scan, 1500);
  }

  function getPlaybackSpeed() {
    return state.settings.speechSpeed === 'slow' ? 0.78 : 0.96;
  }

  function getInterWordPauseMs() {
    // 單音結束後額外留白，搭配音檔本身尾韻約 0.95 秒～1.25 秒的清晰老師停頓感
    return state.settings.speechSpeed === 'slow' ? 1050 : 750;
  }

  function stopSpeech() {
    currentSpeechToken += 1;
    if (pauseTimerId) {
      clearTimeout(pauseTimerId);
      pauseTimerId = null;
    }
    if (activeAudioEl) {
      try {
        activeAudioEl.onended = null;
        activeAudioEl.onerror = null;
        activeAudioEl.pause();
        activeAudioEl.currentTime = 0;
      } catch (_) {}
      activeAudioEl = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    emitSpeechStage(null, null);
  }

  function preloadAudioUrl(url) {
    if (!url || typeof Audio === 'undefined') return null;
    if (AUDIO_CACHE.has(url)) return AUDIO_CACHE.get(url);
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    if (AUDIO_CACHE.size > 80) {
      const firstKey = AUDIO_CACHE.keys().next().value;
      AUDIO_CACHE.delete(firstKey);
    }
    AUDIO_CACHE.set(url, a);
    return a;
  }

  function preloadLessonAudio(items) {
    if (!Array.isArray(items)) return;
    items.forEach(it => {
      if (!it) return;
      if (it.kanaAudio) preloadAudioUrl(it.kanaAudio);
      if (it.wordAudio) preloadAudioUrl(it.wordAudio);
    });
  }

  function playMp3Once(url, token) {
    return new Promise((resolve) => {
      if (!url || typeof Audio === 'undefined' || token !== currentSpeechToken) {
        resolve(false);
        return;
      }
      try {
        let audio = preloadAudioUrl(url);
        if (!audio) {
          resolve(false);
          return;
        }
        audio.pause();
        audio.currentTime = 0;
        const speed = getPlaybackSpeed();
        audio.playbackRate = speed;
        if ('preservesPitch' in audio) audio.preservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = true;

        activeAudioEl = audio;
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          audio.onended = null;
          audio.onerror = null;
          if (activeAudioEl === audio) activeAudioEl = null;
          resolve(ok);
        };

        audio.onended = () => done(true);
        audio.onerror = () => done(false);

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => done(false));
        }
      } catch (_) {
        resolve(false);
      }
    });
  }

  function fallbackBrowserSpeakOne(text, token) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !text || token !== currentSpeechToken) {
        resolve(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP';
        if (jpVoice) u.voice = jpVoice;
        u.rate = state.settings.speechSpeed === 'slow' ? 0.65 : 0.78;
        u.volume = 1;
        u.onend = () => resolve(true);
        u.onerror = () => resolve(false);
        window.speechSynthesis.speak(u);
      } catch (_) {
        resolve(false);
      }
    });
  }

  function waitPause(ms, token) {
    return new Promise((resolve) => {
      if (token !== currentSpeechToken) {
        resolve(false);
        return;
      }
      pauseTimerId = setTimeout(() => {
        pauseTimerId = null;
        resolve(token === currentSpeechToken);
      }, ms);
    });
  }

  async function speakKanaOnly(item) {
    if (!item) return;
    stopSpeech();
    const token = currentSpeechToken;
    emitSpeechStage('kana', item);
    const ok = await playMp3Once(item.kanaAudio, token);
    if (!ok && token === currentSpeechToken) {
      await fallbackBrowserSpeakOne(item.kana, token);
    }
    if (token === currentSpeechToken) emitSpeechStage(null, null);
  }

  async function speakWordOnly(item) {
    if (!item || !item.word || !item.word[0]) return;
    stopSpeech();
    const token = currentSpeechToken;
    emitSpeechStage('word', item);
    const ok = await playMp3Once(item.wordAudio, token);
    if (!ok && token === currentSpeechToken) {
      await fallbackBrowserSpeakOne(item.word[0], token);
    }
    if (token === currentSpeechToken) emitSpeechStage(null, null);
  }

  async function speak(text) {
    if (!text) return;
    stopSpeech();
    const token = currentSpeechToken;
    const wordUrl = window.KanaDB && window.KanaDB.getWordAudioUrl ? window.KanaDB.getWordAudioUrl(text) : null;
    const ok = await playMp3Once(wordUrl, token);
    if (!ok && token === currentSpeechToken) {
      await fallbackBrowserSpeakOne(text, token);
    }
  }

  async function speakItem(item, withWord = true) {
    if (!item) return;
    stopSpeech();
    const token = currentSpeechToken;

    emitSpeechStage('kana', item);
    const okKana = await playMp3Once(item.kanaAudio, token);
    if (!okKana && token === currentSpeechToken) {
      await fallbackBrowserSpeakOne(item.kana, token);
    }
    if (token !== currentSpeechToken) return;

    const shouldSpeakWord = withWord && item.word && item.word[0] && item.kana !== 'を' && item.kana !== 'ヲ';
    if (!shouldSpeakWord) {
      emitSpeechStage(null, null);
      return;
    }

    // 明確自然呼吸停頓：先讓耳朵消化單音「あ」，再溫和念出單字「あめ」
    emitSpeechStage('pause', item);
    const alive = await waitPause(getInterWordPauseMs(), token);
    if (!alive || token !== currentSpeechToken) return;

    emitSpeechStage('word', item);
    const okWord = await playMp3Once(item.wordAudio, token);
    if (!okWord && token === currentSpeechToken) {
      await fallbackBrowserSpeakOne(item.word[0], token);
    }
    if (token === currentSpeechToken) emitSpeechStage(null, null);
  }

  // ==================== Apple 溫潤聲學回饋 ====================
  let audioCtx = null;
  function playTone(type) {
    if (!state.settings.soundFx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      if (type === 'correct') {
        [587.33, 880.0].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.065);
          gain.gain.setValueAtTime(0.001, now + i * 0.065);
          gain.gain.exponentialRampToValueAtTime(0.075, now + i * 0.065 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.065);
          osc.stop(now + i * 0.065 + 0.24);
        });
      } else if (type === 'wrong') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(190, now + 0.16);
        gain.gain.setValueAtTime(0.065, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'complete') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.075);
          gain.gain.setValueAtTime(0.001, now + i * 0.075);
          gain.gain.exponentialRampToValueAtTime(0.085, now + i * 0.075 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.075 + 0.34);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.075);
          osc.stop(now + i * 0.075 + 0.36);
        });
      }
      if (navigator.vibrate) {
        navigator.vibrate(type === 'wrong' ? [18, 25, 18] : 8);
      }
    } catch (_) {}
  }

  // ==================== 跨裝置同步碼 ＋ JSON 備份 ====================
  function generateSyncCode() {
    const compact = {
      d: state.doneLessons,
      s: state.streak,
      l: state.lastStudyDate,
      c: {}
    };
    Object.entries(state.cards).forEach(([id, v]) => {
      compact.c[id] = [v.level, Math.round((v.due - Date.now()) / MIN), v.seen, v.ok, v.fail];
    });
    const bytes = new TextEncoder().encode(JSON.stringify(compact));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return 'KANA4-' + btoa(bin);
  }

  function restoreFromSyncCode(codeStr) {
    const clean = String(codeStr || '').trim();
    if (!clean.startsWith('KANA4-')) return false;
    const bin = atob(clean.slice(6));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const compact = JSON.parse(new TextDecoder().decode(bytes));
    if (!compact || typeof compact.c !== 'object') return false;

    const next = defaultState();
    next.settings = Object.assign({}, state.settings);
    next.doneLessons = Array.isArray(compact.d) ? compact.d : [];
    next.streak = compact.s || 0;
    next.lastStudyDate = compact.l || '';
    const now = Date.now();
    Object.entries(compact.c).forEach(([id, arr]) => {
      if (Array.isArray(arr) && window.KanaDB.BY_ID[id]) {
        next.cards[id] = {
          level: arr[0] || 1,
          due: now + (arr[1] || 0) * MIN,
          seen: arr[2] || 1,
          ok: arr[3] || 0,
          fail: arr[4] || 0,
          last: now
        };
      }
    });
    state = next;
    save(false);
    return true;
  }

  function exportBackupJSON() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kana-progress-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importBackupJSON(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (parsed && parsed.cards && typeof parsed.cards === 'object') {
      state = Object.assign(defaultState(), parsed);
      state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      save(false);
      return true;
    }
    return false;
  }

  function resetAllProgress() {
    const keepSettings = Object.assign({}, state.settings);
    state = defaultState();
    state.settings = keepSettings;
    clearContinuitySession();
    save(false);
  }

  initVoices();

  window.KanaEngine = {
    MAX_LEVEL,
    load,
    save,
    onSave,
    onSpeechStage,
    saveContinuitySession,
    getContinuitySession,
    clearContinuitySession,
    isStorageWorking: () => storageAvailable,
    getState: () => state,
    getSettings: () => state.settings,
    updateSetting: (k, v) => { state.settings[k] = v; save(true); },
    markIntroduced,
    recordAnswer,
    markLessonComplete,
    getCard,
    getWeaknessScore,
    getOverviewStats,
    getNextRecommendedLesson,
    getSmartDistractors,
    buildQuizDeck,
    getSmartReviewItems,
    stopSpeech,
    preloadLessonAudio,
    speak,
    speakKanaOnly,
    speakWordOnly,
    speakItem,
    playTone,
    generateSyncCode,
    restoreFromSyncCode,
    exportBackupJSON,
    importBackupJSON,
    resetAllProgress
  };
})();
