/**
 * app.js — かな科学 主控制器 (v3.0)
 * 科學微課程閉環：漢字字源 × 熟悉單字聽感 × 手指描紅 × 易混淆交錯提取 × 艾賓浩斯記憶排程
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const UI = {
    activeTab: 'home',
    selectedChapterIdx: 0,
    chartScript: 'h',
    chartSet: 'base',

    // 手寫道場狀態
    writePoolType: 'current',
    writeBlindMode: false,
    writeList: [],
    writeIdx: 0,

    // 沉浸式學習／測驗階段狀態
    session: null
  };

  let learnPad = null;
  let dojoPad = null;
  let toastTimer = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    window.KanaEngine.load();
    applyUserSettings();

    if (!window.KanaEngine.isStorageWorking()) {
      $('storageAlert').classList.remove('hidden');
    }

    // 綁定自動儲存視覺回饋
    window.KanaEngine.onSave(() => {
      const pill = $('saveStatusPill');
      const txt = $('saveStatusText');
      if (!pill || !txt) return;
      pill.classList.add('saving');
      txt.textContent = '進度已儲存 ✓';
      setTimeout(() => {
        pill.classList.remove('saving');
      }, 450);
    });

    // 初始化兩個書道手寫畫布
    learnPad = window.KanaPad.create($('learnTraceCanvas'), {
      showGhost: true,
      onStrokeChange: (cur, exp) => {
        $('learnTraceStrokes').textContent = exp ? `${cur} / ${exp} 畫` : `${cur} 畫`;
      }
    });

    dojoPad = window.KanaPad.create($('dojoCanvas'), {
      showGhost: true,
      onStrokeChange: (cur, exp) => {
        $('dojoStrokeInfo').textContent = exp ? `筆畫：${cur} / ${exp} 畫` : `筆畫：${cur} 畫`;
      }
    });

    // 預設選中推薦課程所在的章節
    const nextLesson = window.KanaEngine.getNextRecommendedLesson();
    const chIdx = window.KanaDB.CHAPTERS.findIndex(ch => ch.lessons.some(l => l.id === nextLesson.id));
    UI.selectedChapterIdx = chIdx >= 0 ? chIdx : 0;

    bindGlobalEvents();
    refreshAllViews();
    loadWritePool('current');

    // 註冊最新版 Service Worker，確保離線可用且自動清除舊快取
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js?v=3.0').catch(() => {});
    }
  }

  function applyUserSettings() {
    const settings = window.KanaEngine.getSettings();
    const isDark = settings.theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    $('iconMoon').classList.toggle('hidden', isDark);
    $('iconSun').classList.toggle('hidden', !isDark);

    const isMincho = settings.fontStyle === 'mincho';
    document.body.classList.toggle('font-mincho', isMincho);
    $('fontToggleLabel').textContent = isMincho ? '明體' : '黑體';
    $('btnFontToggle').classList.toggle('active', isMincho);
  }

  function showToast(msg) {
    const el = $('appToast');
    el.textContent = msg;
    el.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function formatWordHighlight(item) {
    if (!item.word) return `<strong>${escapeHtml(item.kana)}</strong> (${escapeHtml(item.romaji)})`;
    const [jp, rom, zh, emo] = item.word;
    if (!jp) return `${emo || ''} ${escapeHtml(zh)}`;
    const idx = jp.indexOf(item.kana);
    let jpHtml = escapeHtml(jp);
    if (idx >= 0) {
      jpHtml = escapeHtml(jp.slice(0, idx))
        + `<span class="hl">${escapeHtml(item.kana)}</span>`
        + escapeHtml(jp.slice(idx + item.kana.length));
    }
    return `${emo || ''} <span lang="ja">${jpHtml}</span> · ${escapeHtml(rom)}（${escapeHtml(zh)}）`;
  }

  // ==================== 事件綁定 ====================
  function bindGlobalEvents() {
    // 頂部：字體與深色切換
    $('btnThemeToggle').addEventListener('click', () => {
      const cur = window.KanaEngine.getSettings().theme;
      window.KanaEngine.updateSetting('theme', cur === 'dark' ? 'light' : 'dark');
      applyUserSettings();
      if (dojoPad) dojoPad.redraw();
      if (learnPad) learnPad.redraw();
    });

    $('btnFontToggle').addEventListener('click', () => {
      const cur = window.KanaEngine.getSettings().fontStyle;
      const next = cur === 'mincho' ? 'gothic' : 'mincho';
      window.KanaEngine.updateSetting('fontStyle', next);
      applyUserSettings();
      if (dojoPad) dojoPad.redraw();
      if (learnPad) learnPad.redraw();
      showToast(next === 'mincho' ? '已切換為「明體」（菜單與書籍字體）' : '已切換為「黑體」（手機與招牌字體）');
    });

    // 底部 4 分頁導覽
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 首頁主行動與快捷特訓
    $('btnHeroStart').addEventListener('click', () => {
      const lesson = window.KanaEngine.getNextRecommendedLesson();
      startGuidedLesson(lesson);
    });

    $('btnSmartReview').addEventListener('click', () => {
      const items = window.KanaEngine.getSmartReviewItems(12);
      if (items.length < 3) {
        showToast('先完成第 1 堂微課程，就能啟動個人化弱點複習！');
        startGuidedLesson(window.KanaEngine.getNextRecommendedLesson());
        return;
      }
      startQuizOnlySession(items, 'review', '智慧弱點複習');
    });

    $('btnConfusableBlitz').addEventListener('click', startConfusableBlitz);

    // 五十音表切換
    $('chartScriptTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-script]');
      if (!btn) return;
      UI.chartScript = btn.dataset.script;
      $('chartScriptTabs').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderGojuonChart();
    });

    $('chartSetTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-set]');
      if (!btn) return;
      UI.chartSet = btn.dataset.set;
      $('chartSetTabs').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderGojuonChart();
    });

    // 手寫道場控制項
    $('writePoolTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-pool]');
      if (!btn) return;
      $('writePoolTabs').querySelectorAll('.seg-pill').forEach(b => b.classList.toggle('active', b === btn));
      loadWritePool(btn.dataset.pool);
    });

    $('btnModeTrace').addEventListener('click', () => setWriteBlindMode(false));
    $('btnModeBlind').addEventListener('click', () => setWriteBlindMode(true));
    $('btnWriteSpeak').addEventListener('click', () => {
      const it = UI.writeList[UI.writeIdx];
      if (it) window.KanaEngine.speakItem(it, true);
    });
    $('btnWritePeek').addEventListener('click', () => dojoPad.peekGhost(1300));
    $('btnDojoUndo').addEventListener('click', () => dojoPad.undo());
    $('btnDojoClear').addEventListener('click', () => {
      dojoPad.clear();
      $('dojoVerdict').classList.add('hidden');
    });
    $('btnDojoCheck').addEventListener('click', evaluateDojoWriting);
    $('btnWritePrev').addEventListener('click', () => {
      if (!UI.writeList.length) return;
      UI.writeIdx = (UI.writeIdx - 1 + UI.writeList.length) % UI.writeList.length;
      renderDojoCurrent();
    });
    $('btnWriteNext').addEventListener('click', () => {
      if (!UI.writeList.length) return;
      UI.writeIdx = (UI.writeIdx + 1) % UI.writeList.length;
      renderDojoCurrent();
    });

    // 記憶數據與備份
    $('btnDrillWeakest').addEventListener('click', () => {
      const items = window.KanaEngine.getSmartReviewItems(10);
      if (items.length < 2) {
        showToast('目前還沒有弱點紀錄，先學一課試試看吧！');
        return;
      }
      startQuizOnlySession(items, 'review', '弱點專項擊破');
    });

    $('btnExportBackup').addEventListener('click', () => {
      window.KanaEngine.exportBackupJSON();
      showToast('已下載進度備份檔 (.json)');
    });

    $('btnImportBackup').addEventListener('click', () => $('fileImportInput').click());
    $('fileImportInput').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const ok = window.KanaEngine.importBackupJSON(reader.result);
          if (ok) {
            refreshAllViews();
            loadWritePool(UI.writePoolType);
            showToast('✅ 進度備份還原成功！');
          } else {
            showToast('⚠️ 備份檔格式不正確');
          }
        } catch (_) {
          showToast('⚠️ 無法讀取該備份檔');
        }
      };
      reader.readAsText(file);
    });

    $('btnResetProgress').addEventListener('click', () => {
      if (confirm('確定要清空所有學習紀錄從頭開始嗎？建議可先匯出備份檔。')) {
        window.KanaEngine.resetAllProgress();
        refreshAllViews();
        loadWritePool('current');
        showToast('學習紀錄已重置');
      }
    });

    // 沉浸式課程／測驗視窗按鈕
    $('btnSessionClose').addEventListener('click', closeSessionOverlay);
    $('btnSkipToQuiz').addEventListener('click', () => {
      if (UI.session && UI.session.lesson) {
        beginQuizPhase(UI.session.lesson.chars, 'lesson');
      }
    });
    $('btnEncodeSpeak').addEventListener('click', () => {
      if (UI.session && UI.session.phase === 'learn') {
        const it = UI.session.learnChars[UI.session.learnIdx];
        window.KanaEngine.speakItem(it, true);
      }
    });
    $('btnLearnTraceClear').addEventListener('click', () => learnPad.clear());
    $('btnLearnPrev').addEventListener('click', () => {
      if (!UI.session || UI.session.learnIdx <= 0) return;
      UI.session.learnIdx--;
      renderLearnStep();
    });
    $('btnLearnNext').addEventListener('click', () => {
      if (!UI.session) return;
      if (UI.session.learnIdx < UI.session.learnChars.length - 1) {
        UI.session.learnIdx++;
        renderLearnStep();
      } else {
        beginQuizPhase(UI.session.learnChars, 'lesson');
      }
    });

    $('btnQuizHint').addEventListener('click', showQuizEtymologyHint);
    $('btnFbSpeak').addEventListener('click', () => {
      if (UI.session && UI.session.currentQuestion) {
        window.KanaEngine.speakItem(UI.session.currentQuestion.item, true);
      }
    });
    $('btnQuizContinue').addEventListener('click', nextQuizStep);
    $('btnResultHome').addEventListener('click', closeSessionOverlay);
    $('btnResultNextAction').addEventListener('click', () => {
      const nextLesson = window.KanaEngine.getNextRecommendedLesson();
      startGuidedLesson(nextLesson);
    });

    // Bottom Sheet 關閉
    $('btnSheetClose').addEventListener('click', closeDetailSheet);
    $('detailSheetBackdrop').addEventListener('click', e => {
      if (e.target.id === 'detailSheetBackdrop') closeDetailSheet();
    });

    // 視窗大小變更時重算畫布
    window.addEventListener('resize', () => {
      if (UI.activeTab === 'write' && dojoPad) dojoPad.resize();
      if (UI.session && UI.session.phase === 'learn' && learnPad) learnPad.resize();
    });
  }

  function switchTab(tabId) {
    UI.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.toggle('active', p.id === `page-${tabId}`));
    $('mainScroll').scrollTop = 0;

    if (tabId === 'home') renderHomeView();
    if (tabId === 'chart') renderGojuonChart();
    if (tabId === 'write') {
      setTimeout(() => dojoPad.resize(), 30);
    }
    if (tabId === 'stats') renderStatsView();
  }

  function refreshAllViews() {
    const stats = window.KanaEngine.getOverviewStats();
    $('headerStreak').textContent = stats.streak;
    renderHomeView();
    renderGojuonChart();
    renderStatsView();
  }

  // ==================== TAB 1：渲染學習路徑首頁 ====================
  function renderHomeView() {
    const stats = window.KanaEngine.getOverviewStats();
    const state = window.KanaEngine.getState();
    const nextLesson = window.KanaEngine.getNextRecommendedLesson();
    const nextIdx = window.KanaDB.ALL_LESSONS.findIndex(l => l.id === nextLesson.id) + 1;

    $('headerStreak').textContent = stats.streak;
    $('dailyGoalBadge').textContent = `今日 ${stats.todayCount} / ${stats.dailyGoal} 題`;

    const scriptBadge = nextLesson.script === 'h' ? '平假名' : '片假名';
    $('heroLessonTitle').textContent = `第 ${nextIdx} 課 · ${scriptBadge} ${nextLesson.title}`;
    $('btnHeroStartLabel').textContent = state.doneLessons.length === 0
      ? '開始第 1 堂 3 分鐘科學課'
      : `繼續第 ${nextIdx} 課（${nextLesson.chars.length} 字）`;

    // 渲染英雄卡本課 5 字預覽（點擊單顆可直接聽發音！）
    const strip = $('heroKanaStrip');
    strip.innerHTML = '';
    nextLesson.chars.slice(0, 6).forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'hero-kana-pill';
      btn.title = '點擊試聽發音';
      btn.innerHTML = `<span class="k" lang="ja">${escapeHtml(it.kana)}</span><span class="r">${escapeHtml(it.romaji)}</span>`;
      btn.addEventListener('click', () => window.KanaEngine.speakItem(it, true));
      strip.appendChild(btn);
    });

    $('homeHiraCount').textContent = `${stats.hiraBaseLearned} / ${stats.hiraBaseTotal}`;
    $('homeHiraBar').style.width = `${Math.round((stats.hiraBaseLearned / stats.hiraBaseTotal) * 100)}%`;
    $('homeKataCount').textContent = `${stats.kataBaseLearned} / ${stats.kataBaseTotal}`;
    $('homeKataBar').style.width = `${Math.round((stats.kataBaseLearned / stats.kataBaseTotal) * 100)}%`;

    // 智慧弱點複習狀態
    const dueBadge = $('dueBadgeCount');
    if (stats.dueCount > 0) {
      dueBadge.textContent = stats.dueCount;
      dueBadge.classList.remove('hidden');
      $('smartReviewSub').textContent = `${stats.dueCount} 個字到達最佳複習時間點`;
    } else {
      dueBadge.classList.add('hidden');
      $('smartReviewSub').textContent = stats.learnedCount > 0
        ? `已學 ${stats.learnedCount} 字 · 隨時抽考弱點`
        : '學完第 1 課自動啟用';
    }

    $('courseDoneSummary').textContent = `${stats.doneLessonsCount} / ${stats.totalLessonsCount} 課完成`;

    // 章節切換標籤
    const chTabs = $('chapterTabs');
    chTabs.innerHTML = '';
    window.KanaDB.CHAPTERS.forEach((ch, idx) => {
      const doneInCh = ch.lessons.filter(l => state.doneLessons.includes(l.id)).length;
      const btn = document.createElement('button');
      btn.className = 'seg-pill' + (idx === UI.selectedChapterIdx ? ' active' : '');
      btn.textContent = `${ch.title} (${doneInCh}/${ch.lessons.length})`;
      btn.addEventListener('click', () => {
        UI.selectedChapterIdx = idx;
        renderHomeView();
      });
      chTabs.appendChild(btn);
    });

    const activeChapter = window.KanaDB.CHAPTERS[UI.selectedChapterIdx] || window.KanaDB.CHAPTERS[0];
    $('chapterSubtitle').textContent = activeChapter.subtitle;

    // 渲染單元清單
    const listEl = $('lessonList');
    listEl.innerHTML = '';
    activeChapter.lessons.forEach((lesson) => {
      const globalNum = window.KanaDB.ALL_LESSONS.indexOf(lesson) + 1;
      const isDone = state.doneLessons.includes(lesson.id);
      const isNext = lesson.id === nextLesson.id;

      let sumLevel = 0;
      lesson.chars.forEach(c => {
        const card = window.KanaEngine.getCard(c.id);
        if (card) sumLevel += card.level;
      });
      const masteryPct = Math.round((sumLevel / (lesson.chars.length * window.KanaEngine.MAX_LEVEL)) * 100);

      const cardEl = document.createElement('div');
      cardEl.className = 'lesson-card' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '');

      const chipsHtml = lesson.chars.map(c => {
        const cd = window.KanaEngine.getCard(c.id);
        const cls = !cd ? '' : (cd.level >= 4 ? ' mastered' : ' learned');
        return `<span class="char-chip${cls}" lang="ja">${escapeHtml(c.kana)}<small>${escapeHtml(c.romaji)}</small></span>`;
      }).join('');

      cardEl.innerHTML = `
        <div class="lesson-top">
          <div class="lesson-badge-group">
            <span class="step-dot">${isDone ? '✓' : globalNum}</span>
            <span class="lesson-name">${escapeHtml(lesson.title)}</span>
          </div>
          <span class="lesson-mastery-pct">記憶度 ${masteryPct}%</span>
        </div>
        <div class="lesson-chars-preview">${chipsHtml}</div>
        <div class="lesson-actions">
          <button class="lesson-btn-learn" data-action="learn">${isDone ? '複習字源與描紅' : (isNext ? '▶ 開始學習本課' : '學習本課')}</button>
          <button class="lesson-btn-quiz" data-action="quiz">直接測驗</button>
        </div>
      `;

      cardEl.querySelector('[data-action="learn"]').addEventListener('click', () => startGuidedLesson(lesson));
      cardEl.querySelector('[data-action="quiz"]').addEventListener('click', () => {
        startQuizOnlySession(lesson.chars, 'lesson', `${lesson.title} 測驗`, lesson.id);
      });

      listEl.appendChild(cardEl);
    });
  }

  // ==================== 易混淆字秒殺特訓 ====================
  function startConfusableBlitz() {
    const state = window.KanaEngine.getState();
    // 優先挑學習者已接觸過的易混淆字；若剛開始學，精選最經典必考平片假名雙胞胎
    let pool = window.KanaDB.ITEMS.filter(it => it.confusables.length > 0 && state.cards[it.id]);
    if (pool.length < 6) {
      const classicKanas = ['あ','お','き','さ','ち','は','ほ','ま','る','ろ','ぬ','め','シ','ツ','ソ','ン'];
      pool = classicKanas.map(k => window.KanaDB.BY_KANA[k]).filter(Boolean);
    }
    startQuizOnlySession(pool, 'confusable', '易混淆字對決特訓');
  }

  // ==================== 沉浸式微課程與測驗引擎 ====================
  function startGuidedLesson(lesson) {
    UI.session = {
      mode: 'lesson',
      lesson,
      title: lesson.title,
      phase: 'learn',
      learnChars: lesson.chars,
      learnIdx: 0,
      questions: [],
      qIdx: 0,
      correctFirstTry: 0,
      totalInitialQuestions: 0,
      combo: 0,
      answeredCurrent: false
    };

    $('sessionOverlay').classList.remove('hidden');
    $('sessionLearnBody').classList.remove('hidden');
    $('sessionQuizBody').classList.add('hidden');
    $('sessionResultBody').classList.add('hidden');

    renderLearnStep();
  }

  function startQuizOnlySession(items, quizMode, title, lessonId = null) {
    UI.session = {
      mode: quizMode,
      lesson: lessonId ? window.KanaDB.LESSON_BY_ID[lessonId] : null,
      title,
      phase: 'quiz',
      learnChars: items,
      learnIdx: 0,
      questions: [],
      qIdx: 0,
      correctFirstTry: 0,
      totalInitialQuestions: 0,
      combo: 0,
      answeredCurrent: false
    };

    $('sessionOverlay').classList.remove('hidden');
    $('sessionLearnBody').classList.add('hidden');
    $('sessionResultBody').classList.add('hidden');
    beginQuizPhase(items, quizMode === 'confusable' ? 'confusable' : (quizMode === 'lesson' ? 'lesson' : 'review'));
  }

  function closeSessionOverlay() {
    UI.session = null;
    $('sessionOverlay').classList.add('hidden');
    refreshAllViews();
    loadWritePool(UI.writePoolType);
  }

  function renderLearnStep() {
    const s = UI.session;
    if (!s) return;
    const item = s.learnChars[s.learnIdx];
    window.KanaEngine.markIntroduced(item.id);

    const totalSteps = s.learnChars.length * 2; // 建檔佔前 50% 進度條
    const pct = Math.round(((s.learnIdx + 1) / totalSteps) * 100);
    $('sessionProgressBar').style.width = `${pct}%`;
    $('sessionStepLabel').textContent = `${s.learnIdx + 1} / ${s.learnChars.length}`;

    if (s.learnIdx === 0 && s.lesson && s.lesson.tip) {
      $('lessonTipBanner').textContent = '💡 ' + s.lesson.tip;
      $('lessonTipBanner').classList.remove('hidden');
    } else {
      $('lessonTipBanner').classList.add('hidden');
    }

    $('encodeKana').textContent = item.kana;
    $('encodeRomaji').textContent = item.romaji;

    if (item.lore) {
      $('encodeKanji').textContent = item.lore[0];
      $('encodeEtymBox').querySelector('.etym-caption').textContent = item.script === 'h' ? '漢字草書來源' : '漢字偏旁來源';
    } else {
      $('encodeKanji').textContent = item.pair;
      $('encodeEtymBox').querySelector('.etym-caption').textContent = '對應平片假名';
    }
    $('encodePairTag').textContent = item.script === 'h' ? `對應片假名：${item.pair}` : `對應平假名：${item.pair}`;

    $('encodeWordDisplay').innerHTML = formatWordHighlight(item);

    // 三重認知線索卡
    let cuesHtml = '';
    if (item.lore) {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">字源</span><span>${escapeHtml(item.lore[1])}</span></div>`;
    } else if (item.set === 'daku') {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">規則</span><span>清音右上加濁點「゛」或半濁點「゜」，字形不必重背！</span></div>`;
    } else {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">規則</span><span>い段假名＋小字 ゃ/ゅ/ょ 合成單一音節。</span></div>`;
    }

    if (item.mnemo) {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">聯想</span><span>${item.mnemo[0]} ${escapeHtml(item.mnemo[1])}</span></div>`;
    }

    if (item.contrastTip) {
      cuesHtml += `<div class="cue-row warn"><span class="cue-tag">防混雷達</span><span>${escapeHtml(item.contrastTip)}</span></div>`;
    }
    $('encodeCues').innerHTML = cuesHtml;

    $('btnLearnPrev').disabled = s.learnIdx === 0;
    $('btnLearnNext').textContent = s.learnIdx === s.learnChars.length - 1
      ? '建檔完成！進入提取測驗 →'
      : '記住了，下一個 →';

    setTimeout(() => {
      learnPad.setTarget(item, true);
    }, 20);

    if (window.KanaEngine.getSettings().autoSpeak) {
      window.KanaEngine.speakItem(item, true);
    }
  }

  // ==================== 階段 B：漸進式主動提取測驗 ====================
  function beginQuizPhase(items, deckMode) {
    const s = UI.session;
    if (!s) return;
    s.phase = 'quiz';
    s.questions = window.KanaEngine.buildQuizDeck(items, deckMode);
    s.qIdx = 0;
    s.totalInitialQuestions = s.questions.length;
    s.correctFirstTry = 0;
    s.combo = 0;

    $('sessionLearnBody').classList.add('hidden');
    $('sessionResultBody').classList.add('hidden');
    $('sessionQuizBody').classList.remove('hidden');

    renderCurrentQuizQuestion();
  }

  function renderCurrentQuizQuestion() {
    const s = UI.session;
    if (!s || s.qIdx >= s.questions.length) {
      finishSession();
      return;
    }

    const q = s.questions[s.qIdx];
    s.currentQuestion = q;
    s.answeredCurrent = false;

    const baseOffset = s.mode === 'lesson' ? 50 : 0;
    const span = s.mode === 'lesson' ? 50 : 100;
    const pct = baseOffset + Math.round(((s.qIdx) / Math.max(1, s.questions.length)) * span);
    $('sessionProgressBar').style.width = `${Math.min(98, pct)}%`;
    $('sessionStepLabel').textContent = `${s.qIdx + 1} / ${s.questions.length}`;

    $('quizFeedbackDrawer').classList.add('hidden');
    $('quizHintBox').classList.add('hidden');
    $('btnQuizHint').classList.remove('hidden');

    // 連對徽章
    if (s.combo >= 2) {
      $('quizComboPill').textContent = `連對 🔥 ${s.combo}`;
      $('quizComboPill').classList.remove('hidden');
    } else {
      $('quizComboPill').classList.add('hidden');
    }

    // 題型標題與題幹渲染
    const stim = $('quizStimulusCard');
    const item = q.item;

    if (q.type === 'kana-to-romaji') {
      $('quizTypeBadge').textContent = q.retried ? '錯題強化重測 · 看字辨音' : '視覺提取 · 看字辨音';
      stim.innerHTML = `
        <div class="q-instruction">這個假名的發音是？</div>
        <div class="q-giant-kana" lang="ja">${escapeHtml(item.kana)}</div>
      `;
    } else if (q.type === 'romaji-to-kana') {
      const scriptName = item.script === 'h' ? '平假名' : '片假名';
      $('quizTypeBadge').textContent = q.retried ? '錯題強化重測 · 聽音選字' : '逆向提取 · 選出正確字形';
      stim.innerHTML = `
        <div class="q-instruction">選出發音為下列拼音的「${scriptName}」</div>
        <div class="q-giant-romaji">${escapeHtml(item.romaji)}</div>
      `;
    } else if (q.type === 'audio-to-kana') {
      const wordClue = item.word && item.word[2] ? `（單字提示：${item.word[3] || ''} ${escapeHtml(item.word[2])}）` : '';
      $('quizTypeBadge').textContent = '聽覺錨點 · 聽發音辨假名';
      stim.innerHTML = `
        <div class="q-instruction">聽日語發音，選出對應的假名</div>
        <button class="q-audio-btn" id="btnStimAudioReplay" aria-label="重播發音">🔊</button>
        <div class="q-word-sub">${wordClue || '點擊喇叭可重聽'}</div>
      `;
      stim.querySelector('#btnStimAudioReplay').addEventListener('click', () => {
        window.KanaEngine.speakItem(item, true);
      });
      setTimeout(() => window.KanaEngine.speakItem(item, true), 80);
    } else if (q.type === 'word-fill') {
      const [, rom, zh, emo] = item.word;
      $('quizTypeBadge').textContent = '詞彙實戰 · 單字填空';
      stim.innerHTML = `
        <div class="q-instruction">填入正確假名完成你熟悉的單字</div>
        <div class="q-word-box" lang="ja">${emo || ''} ${escapeHtml(q.wordMasked)}</div>
        <div class="q-word-sub">${escapeHtml(rom)} · ${escapeHtml(zh)}</div>
      `;
      setTimeout(() => window.KanaEngine.speak(item.word[0], 0.85), 80);
    }

    // 渲染 4 個選項
    const grid = $('quizChoicesGrid');
    grid.innerHTML = '';
    const showRomajiOnButton = q.type === 'kana-to-romaji';

    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice-tile' + (showRomajiOnButton ? ' romaji-choice' : '');
      if (!showRomajiOnButton) btn.setAttribute('lang', 'ja');
      btn.textContent = showRomajiOnButton ? choice.romaji : choice.kana;
      btn.addEventListener('click', () => handleChoiceSelect(choice, btn));
      grid.appendChild(btn);
    });
  }

  function showQuizEtymologyHint() {
    const s = UI.session;
    if (!s || !s.currentQuestion) return;
    const it = s.currentQuestion.item;
    let hintText = '';
    if (it.lore) {
      hintText = `漢字字源：「${it.lore[0]}」— ${it.lore[1]}`;
    } else if (it.mnemo) {
      hintText = `${it.mnemo[0]} ${it.mnemo[1]}`;
    } else {
      hintText = `對應字形提示：${it.pair}`;
    }
    const box = $('quizHintBox');
    box.textContent = '💡 ' + hintText;
    box.classList.remove('hidden');
    $('btnQuizHint').classList.add('hidden');
  }

  function handleChoiceSelect(chosenItem, btnEl) {
    const s = UI.session;
    if (!s || s.answeredCurrent) return;
    s.answeredCurrent = true;

    const q = s.currentQuestion;
    const target = q.item;
    const isCorrect = chosenItem.id === target.id;
    const showRomajiOnButton = q.type === 'kana-to-romaji';

    // 標記按鈕顏色
    Array.from($('quizChoicesGrid').children).forEach((b, idx) => {
      const cItem = q.choices[idx];
      if (cItem.id === target.id) b.classList.add('correct');
      else if (b === btnEl && !isCorrect) b.classList.add('wrong');
      b.disabled = true;
    });

    window.KanaEngine.recordAnswer(target.id, isCorrect);
    window.KanaEngine.playTone(isCorrect ? 'correct' : 'wrong');
    window.KanaEngine.speakItem(target, true);

    const drawer = $('quizFeedbackDrawer');
    drawer.classList.remove('hidden', 'is-ok', 'is-bad');
    $('btnQuizHint').classList.add('hidden');
    $('quizHintBox').classList.add('hidden');

    if (isCorrect) {
      if (!q.retried) s.correctFirstTry++;
      s.combo++;
      drawer.classList.add('is-ok');
      $('fbTitle').textContent = `✓ 正確！ ${target.kana} = ${target.romaji}`;
      let detail = formatWordHighlight(target);
      if (target.lore) detail += `<br>漢字來源：<strong>${escapeHtml(target.lore[0])}</strong>（${escapeHtml(target.lore[1])}）`;
      $('fbDetail').innerHTML = detail;
    } else {
      s.combo = 0;
      drawer.classList.add('is-bad');
      const wrongLabel = showRomajiOnButton ? `${chosenItem.romaji}（${chosenItem.kana}）` : `${chosenItem.kana}（${chosenItem.romaji}）`;
      $('fbTitle').textContent = `正解是「${target.kana} (${target.romaji})」`;

      let fixHtml = `你剛剛選到了 <strong>${escapeHtml(wrongLabel)}</strong>。<br>`;
      if (target.contrastTip) {
        fixHtml += `⚡ <strong>分辨關鍵：</strong>${escapeHtml(target.contrastTip)}`;
      } else if (target.lore) {
        fixHtml += `💡 <strong>字源秒記：</strong>源自「${escapeHtml(target.lore[0])}」— ${escapeHtml(target.lore[1])}`;
      }
      $('fbDetail').innerHTML = fixHtml;

      // 精通學習法：答錯的題目自動排入本輪尾端重測一次，確保真正學會才下課
      if (!q.retried) {
        s.questions.push({
          ...q,
          choices: q.choices.slice().sort(() => Math.random() - 0.5),
          retried: true
        });
      }
    }
  }

  function nextQuizStep() {
    const s = UI.session;
    if (!s) return;
    s.qIdx++;
    renderCurrentQuizQuestion();
  }

  function finishSession() {
    const s = UI.session;
    if (!s) return;
    s.phase = 'result';

    if (s.lesson) {
      window.KanaEngine.markLessonComplete(s.lesson.id);
    }
    window.KanaEngine.playTone('complete');

    $('sessionProgressBar').style.width = '100%';
    $('sessionStepLabel').textContent = '完成';
    $('sessionLearnBody').classList.add('hidden');
    $('sessionQuizBody').classList.add('hidden');
    $('sessionResultBody').classList.remove('hidden');

    const acc = s.totalInitialQuestions > 0
      ? Math.round((s.correctFirstTry / s.totalInitialQuestions) * 100)
      : 100;

    $('resultEmoji').textContent = acc >= 85 ? '🎉' : '💪';
    $('resultHeadline').textContent = s.lesson ? `完成「${s.lesson.title}」！` : `完成「${s.title}」！`;
    $('resultSubtitle').textContent = '所有練習進度已自動寫入你的艾賓浩斯長期記憶排程';
    $('resAccVal').textContent = `${acc}%`;

    const uniqueItems = Array.from(new Set(s.learnChars));
    $('resCountVal').textContent = `${uniqueItems.length} 字`;

    const charsBox = $('resultCharsList');
    charsBox.innerHTML = uniqueItems.map(it => {
      const c = window.KanaEngine.getCard(it.id);
      const lv = c ? c.level : 1;
      return `<span class="char-chip mastered" lang="ja">${escapeHtml(it.kana)} <small>Lv.${lv}</small></span>`;
    }).join('');
  }

  // ==================== TAB 2：互動五十音圖與詳情彈窗 ====================
  function renderGojuonChart() {
    const grid = $('gojuonGrid');
    const rows = window.KanaDB.ROWS[UI.chartSet];
    const isYoon = UI.chartSet === 'yoon';
    grid.classList.toggle('cols-3', isYoon);
    grid.innerHTML = '';

    rows.forEach(([, cells]) => {
      cells.forEach(cell => {
        if (!cell) {
          const empty = document.createElement('div');
          empty.className = 'kana-cell empty';
          grid.appendChild(empty);
          return;
        }
        const kana = UI.chartScript === 'h' ? cell[0] : cell[1];
        const item = window.KanaDB.BY_KANA[kana];
        if (!item) return;

        const card = window.KanaEngine.getCard(item.id);
        let stageCls = '';
        if (card) {
          if (card.level <= 2) stageCls = ' stage-1';
          else if (card.level <= 4) stageCls = ' stage-2';
          else stageCls = ' stage-3';
        }

        const btn = document.createElement('button');
        btn.className = 'kana-cell' + stageCls;
        btn.innerHTML = `
          ${item.lore ? `<span class="cell-etym">${escapeHtml(item.lore[0])}</span>` : ''}
          <span class="cell-k" lang="ja">${escapeHtml(item.kana)}</span>
          <span class="cell-r">${escapeHtml(item.romaji)}</span>
          <span class="cell-bar"></span>
        `;
        btn.addEventListener('click', () => openKanaDetailSheet(item));
        grid.appendChild(btn);
      });
    });
  }

  function openKanaDetailSheet(item) {
    window.KanaEngine.speakItem(item, true);
    const card = window.KanaEngine.getCard(item.id);
    const lvLabel = !card ? '尚未學習' : `記憶等級 Lv.${card.level} / 6（正確 ${card.ok} 次）`;

    let confHtml = '';
    if (item.confusables && item.confusables.length) {
      const pills = item.confusables.map(ck => {
        const twin = window.KanaDB.BY_KANA[ck];
        if (!twin) return '';
        return `<button class="cand-pill" data-twin="${escapeHtml(twin.kana)}" lang="ja">${escapeHtml(twin.kana)} (${escapeHtml(twin.romaji)})</button>`;
      }).join('');
      confHtml = `
        <div class="cue-row warn" style="margin-top:8px; flex-direction:column;">
          <div><strong>⚠️ 易混淆對比：</strong>${escapeHtml(item.contrastTip || '注意筆畫細節差異')}</div>
          <div class="verdict-cands">${pills}</div>
        </div>
      `;
    }

    const box = $('detailSheetContent');
    box.innerHTML = `
      <div style="margin-bottom:10px;">
        <span class="science-tag">${escapeHtml(lvLabel)}</span>
        <span class="muted-note" style="margin-left:8px;">對應字：${escapeHtml(item.pair)}</span>
      </div>

      <div class="sheet-font-compare">
        <div class="font-box">
          <span class="f-label">黑體（手機／招牌）</span>
          <span class="f-gothic" lang="ja">${escapeHtml(item.kana)}</span>
        </div>
        <div class="font-box">
          <span class="f-label">明體（書籍／菜單）</span>
          <span class="f-mincho" lang="ja">${escapeHtml(item.kana)}</span>
        </div>
      </div>

      <button class="audio-anchor-bar" id="btnSheetSpeak">
        <span class="speaker-circle">🔊</span>
        <div class="audio-word-text">
          <strong>${escapeHtml(item.romaji)}</strong> · ${formatWordHighlight(item)}
        </div>
        <span class="tap-replay">播放</span>
      </button>

      <div class="cognitive-cues">
        ${item.lore ? `<div class="cue-row"><span class="cue-tag">漢字字源</span><span>源自「<strong>${escapeHtml(item.lore[0])}</strong>」：${escapeHtml(item.lore[1])}</span></div>` : ''}
        ${item.mnemo ? `<div class="cue-row"><span class="cue-tag">記憶口訣</span><span>${item.mnemo[0]} ${escapeHtml(item.mnemo[1])}</span></div>` : ''}
      </div>
      ${confHtml}

      <button class="primary-cta" id="btnSheetGoWrite" style="margin-top:14px;">
        ✍️ 去手寫道場描寫「${escapeHtml(item.kana)}」
      </button>
    `;

    box.querySelector('#btnSheetSpeak').addEventListener('click', () => window.KanaEngine.speakItem(item, true));
    box.querySelectorAll('[data-twin]').forEach(b => {
      b.addEventListener('click', () => {
        const twin = window.KanaDB.BY_KANA[b.dataset.twin];
        if (twin) openKanaDetailSheet(twin);
      });
    });
    box.querySelector('#btnSheetGoWrite').addEventListener('click', () => {
      closeDetailSheet();
      UI.writeList = [item, ...window.KanaDB.ITEMS.filter(x => x.script === item.script && x.set === item.set && x.id !== item.id)];
      UI.writeIdx = 0;
      switchTab('write');
      renderDojoCurrent();
    });

    $('detailSheetBackdrop').classList.remove('hidden');
  }

  function closeDetailSheet() {
    $('detailSheetBackdrop').classList.add('hidden');
  }

  // ==================== TAB 3：手寫道場與離線筆跡辨識 ====================
  function loadWritePool(poolType) {
    UI.writePoolType = poolType;
    if (poolType === 'current') {
      const lesson = window.KanaEngine.getNextRecommendedLesson();
      UI.writeList = lesson.chars.slice();
    } else if (poolType === 'h-base') {
      UI.writeList = window.KanaDB.ITEMS.filter(it => it.script === 'h' && it.set === 'base');
    } else if (poolType === 'k-base') {
      UI.writeList = window.KanaDB.ITEMS.filter(it => it.script === 'k' && it.set === 'base');
    } else if (poolType === 'confuse') {
      const classic = ['あ','お','き','さ','ち','は','ほ','ま','る','ろ','ぬ','め','シ','ツ','ソ','ン','ク','ワ','タ'];
      UI.writeList = classic.map(k => window.KanaDB.BY_KANA[k]).filter(Boolean);
    }
    UI.writeIdx = 0;
    renderDojoCurrent();
  }

  function setWriteBlindMode(isBlind) {
    UI.writeBlindMode = isBlind;
    $('btnModeTrace').classList.toggle('active', !isBlind);
    $('btnModeBlind').classList.toggle('active', isBlind);
    dojoPad.setGhost(!isBlind);
    $('dojoVerdict').classList.add('hidden');
  }

  function renderDojoCurrent() {
    if (!UI.writeList.length) return;
    const item = UI.writeList[UI.writeIdx];
    $('writeRomaji').textContent = item.romaji;
    $('writeWordInfo').innerHTML = item.word && item.word[0]
      ? `${item.word[3] || ''} ${escapeHtml(item.word[2])} (${escapeHtml(item.word[1])})`
      : (item.script === 'h' ? '平假名' : '片假名');
    $('dojoEtymHint').textContent = item.lore ? `漢字來源：${item.lore[0]}` : `對應：${item.pair}`;
    $('writePosText').textContent = `${UI.writeIdx + 1} / ${UI.writeList.length}`;
    $('dojoVerdict').classList.add('hidden');

    dojoPad.setTarget(item, !UI.writeBlindMode);
  }

  function evaluateDojoWriting() {
    const item = UI.writeList[UI.writeIdx];
    if (!item) return;

    const res = window.KanaPad.recognize(dojoPad, item);
    const box = $('dojoVerdict');
    box.classList.remove('hidden', 'ok', 'retry');

    if (res.empty) {
      showToast('請先在格線中寫出假名喔！');
      return;
    }

    const strokeNote = (res.expectedStrokes && res.strokeCount !== res.expectedStrokes)
      ? `（提醒：標準筆順為 ${res.expectedStrokes} 畫，你寫了 ${res.strokeCount} 畫）`
      : `（筆畫數 ${res.strokeCount} 畫正確！）`;

    if (res.passed) {
      window.KanaEngine.recordAnswer(item.id, true);
      window.KanaEngine.playTone('correct');
      window.KanaEngine.speakItem(item, true);
      dojoPad.setGhost(true);
      box.classList.add('ok');
      box.innerHTML = `
        <strong>✨ 太準了！字形契合度 ${res.scorePct}%</strong> ${escapeHtml(strokeNote)}
        <div style="margin-top:6px;">
          <button class="small-action-btn" id="btnVerdictNext">練習下一個字 →</button>
        </div>
      `;
      box.querySelector('#btnVerdictNext').addEventListener('click', () => {
        UI.writeIdx = (UI.writeIdx + 1) % UI.writeList.length;
        renderDojoCurrent();
      });
    } else {
      window.KanaEngine.playTone('wrong');
      dojoPad.setGhost(true);
      box.classList.add('retry');

      const topGuess = res.best && res.best.item.id !== item.id
        ? `系統看你的筆跡比較像「<strong lang="ja">${escapeHtml(res.best.item.kana)} (${escapeHtml(res.best.item.romaji)})</strong>」。`
        : '結構位置稍微偏了一點點。';
      const tip = item.contrastTip ? `<div style="margin-top:4px;">💡 ${escapeHtml(item.contrastTip)}</div>` : '';

      const candsHtml = res.top3.map(r =>
        `<span class="cand-pill" lang="ja">${escapeHtml(r.item.kana)} ${Math.round(Math.min(99, r.score * 122))}%</span>`
      ).join('');

      box.innerHTML = `
        <div>🤔 ${topGuess} ${escapeHtml(strokeNote)}</div>
        ${tip}
        <div class="verdict-cands">${candsHtml}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="tiny-btn" id="btnRetryWrite">擦掉重寫一次</button>
          <button class="tiny-btn" id="btnForcePass">我確定寫對了 ✓</button>
        </div>
      `;
      box.querySelector('#btnRetryWrite').addEventListener('click', () => {
        dojoPad.clear();
        dojoPad.setGhost(!UI.writeBlindMode);
        box.classList.add('hidden');
      });
      box.querySelector('#btnForcePass').addEventListener('click', () => {
        window.KanaEngine.recordAnswer(item.id, true);
        UI.writeIdx = (UI.writeIdx + 1) % UI.writeList.length;
        renderDojoCurrent();
        showToast('已記錄通過！');
      });
    }
  }

  // ==================== TAB 4：記憶科學儀表板 ====================
  function renderStatsView() {
    const stats = window.KanaEngine.getOverviewStats();
    $('statLearnedTotal').textContent = stats.learnedCount;
    $('statAccTotal').textContent = stats.accuracy !== null ? `${stats.accuracy}%` : '--%';
    $('statReviewsTotal').textContent = stats.totalReviews;

    const maxBase = Math.max(1, stats.learnedCount);
    const stages = [
      { label: '初識 (10分)', count: stats.stageNew, cls: '' },
      { label: '短期 (1天)', count: stats.stageShort, cls: 'indigo' },
      { label: '鞏固 (3-7天)', count: stats.stageMid, cls: 'indigo' },
      { label: '長期 (21天+)', count: stats.stageLong, cls: 'emerald' }
    ];

    $('memoryStageBars').innerHTML = stages.map(st => {
      const w = stats.learnedCount > 0 ? Math.round((st.count / maxBase) * 100) : 0;
      return `
        <div class="mem-row">
          <span>${st.label}</span>
          <div class="bar-track"><div class="bar-fill ${st.cls}" style="width:${w}%"></div></div>
          <strong>${st.count} 字</strong>
        </div>
      `;
    }).join('');

    const weakBox = $('weakListContainer');
    if (stats.weakItems.length === 0) {
      weakBox.innerHTML = `<span class="muted-note">完成課程測驗後，系統會自動分析你最容易認錯的假名並顯示在這裡。</span>`;
    } else {
      weakBox.innerHTML = '';
      stats.weakItems.slice(0, 8).forEach(({ item, card }) => {
        const btn = document.createElement('button');
        btn.className = 'weak-chip';
        btn.innerHTML = `
          <span class="wk" lang="ja">${escapeHtml(item.kana)}</span>
          <span class="wr">${escapeHtml(item.romaji)} · Lv.${card.level}</span>
        `;
        btn.addEventListener('click', () => openKanaDetailSheet(item));
        weakBox.appendChild(btn);
      });
    }
  }
})();
