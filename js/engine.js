/**
 * engine.js — 記憶科學引擎 (SRS 遺忘曲線 + 弱點雷達 + 雙語音合成 + 資料永續化)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'kana-keiko-v3';
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const INTERVALS = [0, 10 * MIN, 12 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY];
  const MAX_LEVEL = 6;

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function yesterdayStr() {
    const d = new Date(Date.now() - DAY);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function defaultState() {
    return {
      version: 3,
      cards: {},       // { [item.id]: { level, due, seen, ok, fail, last } }
      doneLessons: [], // ['hb0', ...]
      streak: 0,
      lastStudyDate: '',
      todayDate: todayStr(),
      todayCount: 0,
      dailyGoal: 15,
      lastBackup: 0,
      settings: {
        autoSpeak: true,
        soundFx: true,
        fontStyle: 'gothic', // 'gothic' | 'mincho'
        theme: 'light'       // 'light' | 'dark'
      }
    };
  }

  let storageAvailable = true;
  let state = defaultState();
  let saveListeners = [];

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

  // 自動遷移舊版進度（確保曾經學過的字絕不遺失）
  function migrateLegacyProgress(target) {
    try {
      // 1) 舊版 kana-keiko 多帳號或單帳號格式
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

      // 2) 舊版 kana-master-srs 格式
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
      console.warn('Legacy migration skipped:', e);
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

    // 跨日重置今日計數，並檢查連勝是否中斷
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (!silent) {
        saveListeners.forEach(fn => { try { fn(); } catch (_) {} });
      }
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function onSave(fn) {
    saveListeners.push(fn);
  }

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

  // 初次在學習卡接觸某個假名（建立初步記憶痕跡）
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
      save(true);
    }
  }

  // 記錄測驗或手寫的主動提取結果
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
    if (!state.doneLessons.includes(lessonId)) {
      state.doneLessons.push(lessonId);
    }
    touchStudyActivity(0);
    save(false);
  }

  function getCard(itemId) {
    return state.cards[itemId] || null;
  }

  // 計算單字弱點指數（錯誤率權重最高 + 逾期天數 + 低熟練度）
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
    let stageNew = 0;    // Lv 1
    let stageShort = 0;  // Lv 2-3
    let stageMid = 0;    // Lv 4-5
    let stageLong = 0;   // Lv 6
    let dueCount = 0;
    let totalSeen = 0;
    let totalOk = 0;
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
      weakItems
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

  // 智慧干擾項生成：優先抓「長得像的易混淆字」＋「同課或已學過的字」，絕不亂湊無效選項
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

    // 1. 優先放入視覺易混淆雙胞胎
    shuffle(target.confusables || []).forEach(k => {
      const cand = window.KanaDB.BY_KANA[k];
      if (cand && cand.script === target.script) tryAdd(cand);
    });

    // 2. 放入本課其他字
    shuffle(contextChars).forEach(tryAdd);

    // 3. 放入已學過的同類假名
    const learnedSame = window.KanaDB.ITEMS.filter(
      it => it.script === target.script && it.set === target.set && state.cards[it.id]
    );
    shuffle(learnedSame).forEach(tryAdd);

    // 4. 兜底同組假名
    const fallback = window.KanaDB.ITEMS.filter(
      it => it.script === target.script && it.set === target.set
    );
    shuffle(fallback).forEach(tryAdd);

    return picked;
  }

  // 建立多模態科學測驗題組
  function buildQuizDeck(targetItems, mode = 'lesson') {
    const questions = [];
    const pool = targetItems.slice();

    if (mode === 'lesson') {
      // 每課 5 字，進行 2 輪交錯提取（第 1 輪：聽音/看字辨音；第 2 輪：單字實戰/看音辨字）
      const round1 = shuffle(pool).map((item, idx) => {
        const qType = (idx % 2 === 0) ? 'kana-to-romaji' : 'audio-to-kana';
        return makeQuestion(item, qType, pool);
      });
      const round2 = shuffle(pool).map((item) => {
        const hasWord = item.word && item.word[0] && item.word[0].includes(item.kana) && item.word[0].length > 1;
        const qType = hasWord ? 'word-fill' : 'romaji-to-kana';
        return makeQuestion(item, qType, pool);
      });
      questions.push(...round1, ...round2);
      // 避免連續兩題考同一個字
      if (questions.length > 2 && questions[round1.length - 1].item.id === questions[round1.length].item.id) {
        const last = questions.pop();
        questions.splice(round1.length, 0, last);
      }
    } else if (mode === 'confusable') {
      // 易混淆對決特訓
      shuffle(pool).slice(0, 14).forEach((item, idx) => {
        const qType = idx % 2 === 0 ? 'romaji-to-kana' : 'kana-to-romaji';
        questions.push(makeQuestion(item, qType, pool));
      });
    } else {
      // 智慧弱點複習：依熟練度自動混合題型
      pool.forEach((item, idx) => {
        const hasWord = item.word && item.word[0] && item.word[0].includes(item.kana) && item.word[0].length > 1;
        const types = ['kana-to-romaji', 'romaji-to-kana', 'audio-to-kana'];
        if (hasWord) types.push('word-fill');
        const qType = types[idx % types.length];
        questions.push(makeQuestion(item, qType, pool));
      });
    }

    return questions;
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
      type, // 'kana-to-romaji' | 'romaji-to-kana' | 'audio-to-kana' | 'word-fill'
      choices,
      wordMasked,
      retried: false
    };
  }

  function getSmartReviewItems(maxCount = 12) {
    const learned = window.KanaDB.ITEMS.filter(it => !!state.cards[it.id]);
    if (learned.length === 0) return [];
    const ranked = learned
      .map(it => ({ it, w: getWeaknessScore(it) }))
      .sort((a, b) => b.w - a.w)
      .slice(0, maxCount)
      .map(x => x.it);

    // 拉進最容易跟第一弱點混淆的同伴（如果已學過）做對比測試
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

  // ==================== 語音合成與微音效 ====================
  let jpVoice = null;
  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    const scan = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const jaVoices = voices.filter(v => /^ja([-_]|$)/i.test(v.lang));
      // 優先挑選非壓縮的高音質日語語音
      jpVoice = jaVoices.find(v => !/compact/i.test(v.name)) || jaVoices[0] || null;
    };
    scan();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = scan;
    }
    setTimeout(scan, 400);
    setTimeout(scan, 1500);
  }

  function speak(text, rate = 0.82) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      if (jpVoice) u.voice = jpVoice;
      u.rate = rate;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  // 同時朗讀「單一假名 ＋ 熟悉例詞」，讓語音引擎產生自然語調並連結聽覺詞彙
  function speakItem(item, withWord = true) {
    if (!('speechSynthesis' in window) || !item) return;
    try {
      window.speechSynthesis.cancel();
      const u1 = new SpeechSynthesisUtterance(item.kana);
      u1.lang = 'ja-JP';
      if (jpVoice) u1.voice = jpVoice;
      u1.rate = 0.78;
      u1.volume = 1;
      window.speechSynthesis.speak(u1);

      if (withWord && item.word && item.word[0] && item.kana !== 'を' && item.kana !== 'ヲ') {
        const u2 = new SpeechSynthesisUtterance(item.word[0]);
        u2.lang = 'ja-JP';
        if (jpVoice) u2.voice = jpVoice;
        u2.rate = 0.88;
        u2.volume = 1;
        window.speechSynthesis.speak(u2);
      }
    } catch (_) {}
  }

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
        [523.25, 659.25].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.075);
          gain.gain.setValueAtTime(0.001, now + i * 0.075);
          gain.gain.exponentialRampToValueAtTime(0.11, now + i * 0.075 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.075 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.075);
          osc.stop(now + i * 0.075 + 0.24);
        });
      } else if (type === 'wrong') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(175, now + 0.18);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'complete') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.001, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.32);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.34);
        });
      }
      if (navigator.vibrate) {
        navigator.vibrate(type === 'wrong' ? [25, 30, 25] : 10);
      }
    } catch (_) {}
  }

  // ==================== 備份匯出與還原 ====================
  function exportBackupJSON() {
    state.lastBackup = Date.now();
    save(true);
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kana-keiko-backup-${todayStr()}.json`;
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
    // 支援舊版多帳號格式備份檔匯入
    if (parsed && parsed.profiles && parsed.active) {
      state = defaultState();
      const src = parsed.profiles[parsed.active].data || {};
      if (src.cards) {
        Object.entries(src.cards).forEach(([id, c]) => {
          if (window.KanaDB.BY_ID[id]) {
            state.cards[id] = {
              level: Math.min(MAX_LEVEL, Math.max(1, c.l || 1)),
              due: c.d || Date.now(),
              seen: c.n || 1,
              ok: Math.max(0, (c.n || 1) - (c.w || 0)),
              fail: c.w || 0,
              last: Date.now()
            };
          }
        });
      }
      save(false);
      return true;
    }
    return false;
  }

  function resetAllProgress() {
    const keepSettings = Object.assign({}, state.settings);
    state = defaultState();
    state.settings = keepSettings;
    save(false);
  }

  initVoices();

  window.KanaEngine = {
    MAX_LEVEL,
    load,
    save,
    onSave,
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
    speak,
    speakItem,
    playTone,
    exportBackupJSON,
    importBackupJSON,
    resetAllProgress
  };
})();
