/**
 * app.js — 五十音 · 科學記憶 主控制器 (v4.0 Apple HIG Edition)
 * 設計準則：Clarity（清晰階層）· Deference（內容至上）· Depth（流暢景深）· Continuity（無縫接續）
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const RING_CIRCUMFERENCE = 144.51; // 2 * Math.PI * 23

  const ICON_SPEAKER_LG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const ICON_SPEAKER_SM = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const ICON_CHECK_SM = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
  const ICON_CHECK_LG = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;

  const UI = {
    activeTab: 'home',
    selectedChapterIdx: 0,
    chartScript: 'h',
    chartSet: 'base',

    // 手寫練習狀態
    writePoolType: 'current',
    writeBlindMode: false,
    writeList: [],
    writeIdx: 0,

    // 全螢幕學習／測驗視窗狀態
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

    // 即時本機自動儲存狀態指示
    window.KanaEngine.onSave(() => {
      const pill = $('saveStatusPill');
      const txt = $('saveStatusText');
      if (!pill || !txt) return;
      pill.classList.add('saving');
      txt.textContent = '進度已自動記憶';
      setTimeout(() => {
        pill.classList.remove('saving');
      }, 600);
    });

    // 初始化雙高解析度手寫畫布
    learnPad = window.KanaPad.create($('learnTraceCanvas'), {
      showGhost: true,
      onStrokeChange: (cur, exp) => {
        $('learnTraceStrokes').textContent = exp ? `${cur} / ${exp} 畫` : `${cur} 畫`;
      }
    });

    dojoPad = window.KanaPad.create($('dojoCanvas'), {
      showGhost: true,
      onStrokeChange: (cur, exp) => {
        $('dojoStrokeInfo').textContent = exp ? `筆畫 ${cur} / ${exp}` : `筆畫 ${cur}`;
      }
    });

    // 預設定位至下一堂推薦課程所在章節
    const nextLesson = window.KanaEngine.getNextRecommendedLesson();
    const chIdx = window.KanaDB.CHAPTERS.findIndex(ch => ch.lessons.some(l => l.id === nextLesson.id));
    UI.selectedChapterIdx = chIdx >= 0 ? chIdx : 0;

    bindGlobalEvents();
    refreshAllViews();
    loadWritePool('current');

    // 註冊最新版 Service Worker（Network-first 確保更新即時生效且支援離線開啟）
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js?v=4.0').catch(() => {});
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
    if (!item.word) return `<strong lang="ja">${escapeHtml(item.kana)}</strong> · ${escapeHtml(item.romaji)}`;
    const [jp, rom, zh] = item.word;
    if (!jp) return escapeHtml(zh);
    const idx = jp.indexOf(item.kana);
    let jpHtml = escapeHtml(jp);
    if (idx >= 0) {
      jpHtml = escapeHtml(jp.slice(0, idx))
        + `<span class="hl">${escapeHtml(item.kana)}</span>`
        + escapeHtml(jp.slice(idx + item.kana.length));
    }
    return `<span lang="ja">${jpHtml}</span> · ${escapeHtml(rom)}（${escapeHtml(zh)}）`;
  }

  async function copyTextSafe(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  // ==================== Apple Continuity 斷點續學快照 ====================
  function persistContinuitySnapshot() {
    const s = UI.session;
    if (!s || s.phase === 'result') {
      window.KanaEngine.clearContinuitySession();
      return;
    }

    const effectiveQIdx = s.phase === 'quiz' && s.answeredCurrent ? s.qIdx + 1 : s.qIdx;
    if (s.phase === 'quiz' && effectiveQIdx >= s.questions.length) {
      window.KanaEngine.clearContinuitySession();
      return;
    }

    window.KanaEngine.saveContinuitySession({
      mode: s.mode,
      lessonId: s.lesson ? s.lesson.id : null,
      title: s.title,
      phase: s.phase,
      learnCharIds: (s.learnChars || []).map(c => c.id),
      learnIdx: s.learnIdx || 0,
      qIdx: effectiveQIdx,
      correctFirstTry: s.correctFirstTry || 0,
      totalInitialQuestions: s.totalInitialQuestions || 0,
      combo: s.combo || 0,
      questions: (s.questions || []).map(q => ({
        itemId: q.item.id,
        type: q.type,
        choiceIds: q.choices.map(c => c.id),
        wordMasked: q.wordMasked || null,
        retried: !!q.retried
      }))
    });
  }

  function resumeContinuitySession() {
    const snap = window.KanaEngine.getContinuitySession();
    if (!snap) return;

    const learnChars = (snap.learnCharIds || [])
      .map(id => window.KanaDB.BY_ID[id])
      .filter(Boolean);

    if (!learnChars.length) {
      window.KanaEngine.clearContinuitySession();
      renderHomeView();
      return;
    }

    const questions = (snap.questions || [])
      .map(q => {
        const item = window.KanaDB.BY_ID[q.itemId];
        const choices = (q.choiceIds || []).map(cid => window.KanaDB.BY_ID[cid]).filter(Boolean);
        if (!item || choices.length < 2) return null;
        return {
          item,
          type: q.type,
          choices,
          wordMasked: q.wordMasked,
          retried: !!q.retried
        };
      })
      .filter(Boolean);

    UI.session = {
      mode: snap.mode || 'lesson',
      lesson: snap.lessonId ? window.KanaDB.LESSON_BY_ID[snap.lessonId] : null,
      title: snap.title || '練習',
      phase: snap.phase === 'quiz' && questions.length ? 'quiz' : 'learn',
      learnChars,
      learnIdx: Math.min(Math.max(0, snap.learnIdx || 0), learnChars.length - 1),
      questions,
      qIdx: Math.min(Math.max(0, snap.qIdx || 0), Math.max(0, questions.length - 1)),
      correctFirstTry: snap.correctFirstTry || 0,
      totalInitialQuestions: snap.totalInitialQuestions || questions.length,
      combo: snap.combo || 0,
      answeredCurrent: false
    };

    $('sessionOverlay').classList.remove('hidden');
    $('sessionResultBody').classList.add('hidden');

    if (UI.session.phase === 'learn') {
      $('sessionLearnBody').classList.remove('hidden');
      $('sessionQuizBody').classList.add('hidden');
      renderLearnStep();
    } else {
      $('sessionLearnBody').classList.add('hidden');
      $('sessionQuizBody').classList.remove('hidden');
      renderCurrentQuizQuestion();
    }
  }

  // ==================== 全域事件綁定 ====================
  function bindGlobalEvents() {
    // 頂部導覽列：外觀模式與黑體／明體切換
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
      showToast(next === 'mincho' ? '已切換為明體（書籍與菜單字形）' : '已切換為黑體（介面與招牌字形）');
    });

    // iOS 底部 4 分頁導覽列
    document.querySelectorAll('.ios-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Apple Continuity 斷點續學橫幅
    $('btnContinuityResume').addEventListener('click', resumeContinuitySession);
    $('btnContinuityDismiss').addEventListener('click', () => {
      window.KanaEngine.clearContinuitySession();
      renderHomeView();
    });

    // 首頁主行動與 Bento 特訓
    $('btnHeroStart').addEventListener('click', () => {
      const lesson = window.KanaEngine.getNextRecommendedLesson();
      startGuidedLesson(lesson);
    });

    $('btnSmartReview').addEventListener('click', () => {
      const items = window.KanaEngine.getSmartReviewItems(12);
      if (items.length < 3) {
        showToast('先完成第 1 課，系統即會自動排程複習');
        startGuidedLesson(window.KanaEngine.getNextRecommendedLesson());
        return;
      }
      startQuizOnlySession(items, 'review', '智慧複習');
    });

    $('btnConfusableBlitz').addEventListener('click', startConfusableBlitz);

    // 五十音圖 Segmented Control
    $('chartScriptTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-script]');
      if (!btn) return;
      UI.chartScript = btn.dataset.script;
      $('chartScriptTabs').querySelectorAll('.seg-opt').forEach(b => b.classList.toggle('active', b === btn));
      renderGojuonChart();
    });

    $('chartSetTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-set]');
      if (!btn) return;
      UI.chartSet = btn.dataset.set;
      $('chartSetTabs').querySelectorAll('.seg-opt').forEach(b => b.classList.toggle('active', b === btn));
      renderGojuonChart();
    });

    // 手寫工作坊控制項
    $('writePoolTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-pool]');
      if (!btn) return;
      $('writePoolTabs').querySelectorAll('.seg-opt').forEach(b => b.classList.toggle('active', b === btn));
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

    // 進度分頁：弱點練習、一鍵跨裝置同步碼、備份與重置
    $('btnDrillWeakest').addEventListener('click', () => {
      const items = window.KanaEngine.getSmartReviewItems(10);
      if (items.length < 2) {
        showToast('完成第 1 課測驗後即可啟動專項練習');
        return;
      }
      startQuizOnlySession(items, 'review', '弱點專項練習');
    });

    $('btnCopySyncCode').addEventListener('click', async () => {
      const code = window.KanaEngine.generateSyncCode();
      const copied = await copyTextSafe(code);
      if (copied) {
        showToast('已複製進度同步碼，可貼至另一台裝置');
      } else {
        $('syncCodeInput').value = code;
        $('syncModalBackdrop').classList.remove('hidden');
        $('syncCodeInput').focus();
        $('syncCodeInput').select();
        showToast('請長按複製視窗內的同步碼');
      }
    });

    $('btnPasteSyncCode').addEventListener('click', () => {
      $('syncCodeInput').value = '';
      $('syncModalBackdrop').classList.remove('hidden');
      setTimeout(() => $('syncCodeInput').focus(), 50);
    });

    $('btnSyncCancel').addEventListener('click', () => {
      $('syncModalBackdrop').classList.add('hidden');
    });

    $('syncModalBackdrop').addEventListener('click', e => {
      if (e.target.id === 'syncModalBackdrop') {
        $('syncModalBackdrop').classList.add('hidden');
      }
    });

    $('btnSyncConfirm').addEventListener('click', () => {
      const raw = $('syncCodeInput').value.trim();
      if (!raw) {
        showToast('請先貼上 KANA4- 開頭的同步碼');
        return;
      }
      try {
        const ok = window.KanaEngine.restoreFromSyncCode(raw);
        if (ok) {
          window.KanaEngine.clearContinuitySession();
          $('syncModalBackdrop').classList.add('hidden');
          refreshAllViews();
          loadWritePool(UI.writePoolType);
          showToast('進度已成功同步至此裝置');
        } else {
          showToast('同步碼格式不正確，請確認完整複製');
        }
      } catch (_) {
        showToast('同步碼無法解析，請確認完整複製');
      }
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
            window.KanaEngine.clearContinuitySession();
            refreshAllViews();
            loadWritePool(UI.writePoolType);
            showToast('進度備份已還原');
          } else {
            showToast('備份檔格式不正確');
          }
        } catch (_) {
          showToast('無法讀取該備份檔');
        }
      };
      reader.readAsText(file);
    });

    $('btnResetProgress').addEventListener('click', () => {
      if (confirm('確定要重置所有學習紀錄嗎？此操作將清空本機記憶排程。')) {
        window.KanaEngine.resetAllProgress();
        refreshAllViews();
        loadWritePool('current');
        showToast('學習紀錄已重置');
      }
    });

    // 全螢幕學習 Sheet 控制
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

    // Kana Inspector Bottom Sheet 關閉
    $('btnSheetClose').addEventListener('click', closeDetailSheet);
    $('detailSheetBackdrop').addEventListener('click', e => {
      if (e.target.id === 'detailSheetBackdrop') closeDetailSheet();
    });

    // 視窗尺寸變更時重算畫布解析度
    window.addEventListener('resize', () => {
      if (UI.activeTab === 'write' && dojoPad) dojoPad.resize();
      if (UI.session && UI.session.phase === 'learn' && learnPad) learnPad.resize();
    });
  }

  function switchTab(tabId) {
    UI.activeTab = tabId;
    document.querySelectorAll('.ios-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.ios-page').forEach(p => p.classList.toggle('active', p.id === `page-${tabId}`));
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

  // ==================== TAB 1：渲染學習首頁（Apple HIG） ====================
  function renderHomeView() {
    const stats = window.KanaEngine.getOverviewStats();
    const state = window.KanaEngine.getState();
    const nextLesson = window.KanaEngine.getNextRecommendedLesson();
    const nextIdx = window.KanaDB.ALL_LESSONS.findIndex(l => l.id === nextLesson.id) + 1;

    $('headerStreak').textContent = stats.streak;
    $('courseDoneSummary').textContent = `${stats.doneLessonsCount} / ${stats.totalLessonsCount} 課`;

    // 檢查並渲染 Apple Continuity 斷點續學橫幅
    const snap = window.KanaEngine.getContinuitySession();
    if (snap && Array.isArray(snap.learnCharIds) && snap.learnCharIds.length > 0) {
      $('continuityBanner').classList.remove('hidden');
      $('continuityTitle').textContent = `接續「${snap.title || '上次練習'}」`;
      $('continuitySub').textContent = snap.phase === 'learn'
        ? `字源與描摹 · 第 ${Math.min((snap.learnIdx || 0) + 1, snap.learnCharIds.length)} / ${snap.learnCharIds.length} 字`
        : `提取測驗 · 第 ${Math.min((snap.qIdx || 0) + 1, Math.max(1, (snap.questions || []).length))} / ${Math.max(1, (snap.questions || []).length)} 題`;
    } else {
      $('continuityBanner').classList.add('hidden');
    }

    // Apple Fitness 圓環進度計算
    const goalRatio = Math.min(1, stats.todayCount / Math.max(1, stats.dailyGoal));
    const ringEl = $('dailyRingCircle');
    ringEl.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    ringEl.style.strokeDashoffset = String((RING_CIRCUMFERENCE * (1 - goalRatio)).toFixed(2));
    $('dailyGoalBadge').textContent = `${stats.todayCount}/${stats.dailyGoal}`;

    // Hero 推薦課程卡片
    const scriptBadge = nextLesson.script === 'h' ? '平假名' : '片假名';
    $('heroLessonTitle').textContent = `第 ${nextIdx} 課 · ${scriptBadge} ${nextLesson.title}`;
    $('heroLessonDesc').textContent = nextLesson.tip || '漢字字源橋接 · 聽覺詞彙連結 · 手指描摹';
    $('btnHeroStartLabel').textContent = state.doneLessons.length === 0
      ? '開始第 1 課（3 分鐘）'
      : `繼續第 ${nextIdx} 課（${nextLesson.chars.length} 字）`;

    const strip = $('heroKanaStrip');
    strip.innerHTML = '';
    nextLesson.chars.slice(0, 6).forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'hero-kana-pill';
      btn.title = '點選試聽發音';
      btn.innerHTML = `<span class="k" lang="ja">${escapeHtml(it.kana)}</span><span class="r">${escapeHtml(it.romaji)}</span>`;
      btn.addEventListener('click', () => window.KanaEngine.speakItem(it, true));
      strip.appendChild(btn);
    });

    $('homeHiraCount').textContent = `${stats.hiraBaseLearned} / ${stats.hiraBaseTotal}`;
    $('homeHiraBar').style.width = `${Math.round((stats.hiraBaseLearned / stats.hiraBaseTotal) * 100)}%`;
    $('homeKataCount').textContent = `${stats.kataBaseLearned} / ${stats.kataBaseTotal}`;
    $('homeKataBar').style.width = `${Math.round((stats.kataBaseLearned / stats.kataBaseTotal) * 100)}%`;

    // Bento 智慧複習狀態
    const dueBadge = $('dueBadgeCount');
    if (stats.dueCount > 0) {
      dueBadge.textContent = stats.dueCount;
      dueBadge.classList.remove('hidden');
      $('smartReviewSub').textContent = `${stats.dueCount} 字到達最佳複習點`;
    } else {
      dueBadge.classList.add('hidden');
      $('smartReviewSub').textContent = stats.learnedCount > 0
        ? `已學 ${stats.learnedCount} 字 · 隨時鞏固`
        : '依遺忘曲線排程';
    }

    // 章節 iOS Segmented Control
    const chTabs = $('chapterTabs');
    chTabs.innerHTML = '';
    window.KanaDB.CHAPTERS.forEach((ch, idx) => {
      const doneInCh = ch.lessons.filter(l => state.doneLessons.includes(l.id)).length;
      const btn = document.createElement('button');
      btn.className = 'seg-opt' + (idx === UI.selectedChapterIdx ? ' active' : '');
      btn.textContent = `${ch.title} ${doneInCh}/${ch.lessons.length}`;
      btn.addEventListener('click', () => {
        UI.selectedChapterIdx = idx;
        renderHomeView();
      });
      chTabs.appendChild(btn);
    });

    const activeChapter = window.KanaDB.CHAPTERS[UI.selectedChapterIdx] || window.KanaDB.CHAPTERS[0];
    $('chapterSubtitle').textContent = activeChapter.subtitle;

    // iOS Inset Grouped List 課程列表
    const listEl = $('lessonList');
    listEl.innerHTML = '';
    activeChapter.lessons.forEach((lesson) => {
      const globalNum = window.KanaDB.ALL_LESSONS.indexOf(lesson) + 1;
      const isDone = state.doneLessons.includes(lesson.id);
      const isNext = !isDone && lesson.id === nextLesson.id;

      let sumLevel = 0;
      lesson.chars.forEach(c => {
        const card = window.KanaEngine.getCard(c.id);
        if (card) sumLevel += card.level;
      });
      const masteryPct = Math.round((sumLevel / (lesson.chars.length * window.KanaEngine.MAX_LEVEL)) * 100);
      const kanaPreview = lesson.chars.map(c => c.kana).join('  ');

      const rowEl = document.createElement('div');
      rowEl.className = 'ios-list-row' + (isDone ? ' is-done' : '') + (isNext ? ' is-next' : '');
      rowEl.innerHTML = `
        <div class="row-status-badge">${isDone ? ICON_CHECK_SM : globalNum}</div>
        <div class="row-main">
          <div class="row-title-line">
            <span class="row-title">${escapeHtml(lesson.title)}</span>
            ${masteryPct > 0 ? `<span class="row-pct">${masteryPct}%</span>` : ''}
          </div>
          <div class="row-kanas" lang="ja">${escapeHtml(kanaPreview)}</div>
        </div>
        <div class="row-actions">
          <button class="row-pill-quiz" data-action="quiz">測驗</button>
          <button class="row-pill-learn" data-action="learn">${isDone ? '複習' : '學習'}</button>
        </div>
      `;

      rowEl.querySelector('[data-action="learn"]').addEventListener('click', () => startGuidedLesson(lesson));
      rowEl.querySelector('[data-action="quiz"]').addEventListener('click', () => {
        startQuizOnlySession(lesson.chars, 'lesson', `${lesson.title} 測驗`, lesson.id);
      });

      listEl.appendChild(rowEl);
    });
  }

  // ==================== 易混淆雙胞胎特訓 ====================
  function startConfusableBlitz() {
    const state = window.KanaEngine.getState();
    let pool = window.KanaDB.ITEMS.filter(it => it.confusables.length > 0 && state.cards[it.id]);
    if (pool.length < 6) {
      const classicKanas = ['あ', 'お', 'き', 'さ', 'ち', 'は', 'ほ', 'ま', 'る', 'ろ', 'ぬ', 'め', 'シ', 'ツ', 'ソ', 'ン'];
      pool = classicKanas.map(k => window.KanaDB.BY_KANA[k]).filter(Boolean);
    }
    startQuizOnlySession(pool, 'confusable', '易混淆特訓');
  }

  // ==================== 全螢幕微課程與主動提取引擎 ====================
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
    if (UI.session && UI.session.phase !== 'result') {
      persistContinuitySnapshot();
    }
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

    const totalSteps = s.learnChars.length * 2;
    const pct = Math.round(((s.learnIdx + 1) / totalSteps) * 100);
    $('sessionProgressBar').style.width = `${pct}%`;
    $('sessionStepLabel').textContent = `${s.learnIdx + 1} / ${s.learnChars.length}`;

    if (s.learnIdx === 0 && s.lesson && s.lesson.tip) {
      $('lessonTipBanner').textContent = s.lesson.tip;
      $('lessonTipBanner').classList.remove('hidden');
    } else {
      $('lessonTipBanner').classList.add('hidden');
    }

    $('encodeKana').textContent = item.kana;
    $('encodeRomaji').textContent = item.romaji;

    const originLabelEl = $('encodeEtymBox').querySelector('.origin-label');
    if (item.lore) {
      $('encodeKanji').textContent = item.lore[0];
      if (originLabelEl) originLabelEl.textContent = item.script === 'h' ? '漢字草書來源' : '漢字偏旁來源';
    } else {
      $('encodeKanji').textContent = item.pair;
      if (originLabelEl) originLabelEl.textContent = '對應平片假名';
    }
    $('encodePairTag').textContent = item.script === 'h' ? `片假名 ${item.pair}` : `平假名 ${item.pair}`;

    $('encodeWordDisplay').innerHTML = formatWordHighlight(item);

    let cuesHtml = '';
    if (item.lore) {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">漢字字源</span><span>${escapeHtml(item.lore[1])}</span></div>`;
    } else if (item.set === 'daku') {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">發音規則</span><span>清音右上加濁點「゛」或半濁點「゜」，字形無須重背。</span></div>`;
    } else {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">拼音規則</span><span>い段假名結合小字 ゃ / ゅ / ょ 拼為單一音節。</span></div>`;
    }

    if (item.mnemo) {
      cuesHtml += `<div class="cue-row"><span class="cue-tag">視覺聯想</span><span>${escapeHtml(item.mnemo[1])}</span></div>`;
    }

    if (item.contrastTip) {
      cuesHtml += `<div class="cue-row warn"><span class="cue-tag">易混辨析</span><span>${escapeHtml(item.contrastTip)}</span></div>`;
    }
    $('encodeCues').innerHTML = cuesHtml;

    $('btnLearnPrev').disabled = s.learnIdx === 0;
    $('btnLearnNext').textContent = s.learnIdx === s.learnChars.length - 1 ? '進入提取測驗' : '下一個';

    persistContinuitySnapshot();

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
    const pct = baseOffset + Math.round((s.qIdx / Math.max(1, s.questions.length)) * span);
    $('sessionProgressBar').style.width = `${Math.min(98, pct)}%`;
    $('sessionStepLabel').textContent = `${s.qIdx + 1} / ${s.questions.length}`;

    $('quizFeedbackDrawer').classList.add('hidden');
    $('quizHintBox').classList.add('hidden');
    $('btnQuizHint').classList.remove('hidden');

    if (s.combo >= 2) {
      $('quizComboPill').textContent = `連續答對 ${s.combo}`;
      $('quizComboPill').classList.remove('hidden');
    } else {
      $('quizComboPill').classList.add('hidden');
    }

    const stim = $('quizStimulusCard');
    const item = q.item;

    if (q.type === 'kana-to-romaji') {
      $('quizTypeBadge').textContent = q.retried ? '錯題重測 · 看字辨音' : '視覺提取 · 看字辨音';
      stim.innerHTML = `
        <div class="q-instruction">選出這個假名的羅馬拼音</div>
        <div class="q-giant-kana" lang="ja">${escapeHtml(item.kana)}</div>
      `;
    } else if (q.type === 'romaji-to-kana') {
      const scriptName = item.script === 'h' ? '平假名' : '片假名';
      $('quizTypeBadge').textContent = q.retried ? '錯題重測 · 辨識字形' : '逆向提取 · 選出正確字形';
      stim.innerHTML = `
        <div class="q-instruction">選出發音為下列拼音的${scriptName}</div>
        <div class="q-giant-romaji">${escapeHtml(item.romaji)}</div>
      `;
    } else if (q.type === 'audio-to-kana') {
      const wordClue = item.word && item.word[2] ? `詞彙線索：${escapeHtml(item.word[2])}（${escapeHtml(item.word[1])}）` : '點選按鈕可重播發音';
      $('quizTypeBadge').textContent = '聽覺錨點 · 聽音辨字';
      stim.innerHTML = `
        <div class="q-instruction">聆聽日語發音，選出對應假名</div>
        <button class="q-audio-btn" id="btnStimAudioReplay" aria-label="重播發音">${ICON_SPEAKER_LG}</button>
        <div class="q-word-sub">${wordClue}</div>
      `;
      stim.querySelector('#btnStimAudioReplay').addEventListener('click', () => {
        window.KanaEngine.speakItem(item, true);
      });
      setTimeout(() => window.KanaEngine.speakItem(item, true), 80);
    } else if (q.type === 'word-fill') {
      const [, rom, zh] = item.word;
      $('quizTypeBadge').textContent = '語境提取 · 單字填空';
      stim.innerHTML = `
        <div class="q-instruction">選出缺少的假名完成單字</div>
        <div class="q-word-box" lang="ja">${escapeHtml(q.wordMasked)}</div>
        <div class="q-word-sub">${escapeHtml(rom)} · ${escapeHtml(zh)}</div>
      `;
      setTimeout(() => window.KanaEngine.speak(item.word[0], 0.85), 80);
    }

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

    persistContinuitySnapshot();
  }

  function showQuizEtymologyHint() {
    const s = UI.session;
    if (!s || !s.currentQuestion) return;
    const it = s.currentQuestion.item;
    let hintText = '';
    if (it.lore) {
      hintText = `漢字字源：「${it.lore[0]}」— ${it.lore[1]}`;
    } else if (it.mnemo) {
      hintText = it.mnemo[1];
    } else {
      hintText = `對應平片假名：${it.pair}`;
    }
    const box = $('quizHintBox');
    box.textContent = hintText;
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
      $('fbTitle').textContent = `正確 · ${target.kana} (${target.romaji})`;
      let detail = formatWordHighlight(target);
      if (target.lore) {
        detail += `<br>漢字字源：<strong>${escapeHtml(target.lore[0])}</strong>（${escapeHtml(target.lore[1])}）`;
      }
      $('fbDetail').innerHTML = detail;
    } else {
      s.combo = 0;
      drawer.classList.add('is-bad');
      const wrongLabel = showRomajiOnButton
        ? `${chosenItem.romaji}（${chosenItem.kana}）`
        : `${chosenItem.kana}（${chosenItem.romaji}）`;
      $('fbTitle').textContent = `正解為「${target.kana} (${target.romaji})」`;

      let fixHtml = `剛才選了 <strong>${escapeHtml(wrongLabel)}</strong>。<br>`;
      if (target.contrastTip) {
        fixHtml += `<strong>辨析關鍵：</strong>${escapeHtml(target.contrastTip)}`;
      } else if (target.lore) {
        fixHtml += `<strong>字源記憶：</strong>源自「${escapeHtml(target.lore[0])}」— ${escapeHtml(target.lore[1])}`;
      }
      $('fbDetail').innerHTML = fixHtml;

      // 精通學習閉環：答錯題自動排入本輪末尾重測一次
      if (!q.retried) {
        s.questions.push({
          ...q,
          choices: q.choices.slice().sort(() => Math.random() - 0.5),
          retried: true
        });
      }
    }

    persistContinuitySnapshot();
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

    window.KanaEngine.clearContinuitySession();
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

    $('resultEmoji').innerHTML = ICON_CHECK_LG;
    $('resultHeadline').textContent = s.lesson ? `完成「${s.lesson.title}」` : `完成「${s.title}」`;
    $('resultSubtitle').textContent = '進度已自動儲存並排入艾賓浩斯長期記憶複習';
    $('resAccVal').textContent = `${acc}%`;

    const uniqueItems = Array.from(new Set(s.learnChars));
    $('resCountVal').textContent = `${uniqueItems.length} 字`;

    $('resultCharsList').innerHTML = uniqueItems.map(it => {
      const c = window.KanaEngine.getCard(it.id);
      const lv = c ? c.level : 1;
      return `<span class="char-chip" lang="ja">${escapeHtml(it.kana)}<small>Lv.${lv}</small></span>`;
    }).join('');
  }

  // ==================== TAB 2：五十音矩陣與字卡檢視器 ====================
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
          <span class="cell-dot"></span>
        `;
        btn.addEventListener('click', () => openKanaDetailSheet(item));
        grid.appendChild(btn);
      });
    });
  }

  function openKanaDetailSheet(item) {
    window.KanaEngine.speakItem(item, true);
    const card = window.KanaEngine.getCard(item.id);
    const lvLabel = !card ? '尚未學習' : `記憶階段 Lv.${card.level} / 6 · 答對 ${card.ok} 次`;

    let confHtml = '';
    if (item.confusables && item.confusables.length) {
      const pills = item.confusables.map(ck => {
        const twin = window.KanaDB.BY_KANA[ck];
        if (!twin) return '';
        return `<button class="cand-pill" data-twin="${escapeHtml(twin.kana)}" lang="ja">${escapeHtml(twin.kana)} (${escapeHtml(twin.romaji)})</button>`;
      }).join('');
      confHtml = `
        <div style="background: var(--sys-orange-soft); border-radius: 14px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; line-height: 1.5;">
          <div><strong>易混淆字形對比：</strong>${escapeHtml(item.contrastTip || '留意筆畫收尾差異')}</div>
          <div class="verdict-cands">${pills}</div>
        </div>
      `;
    }

    const box = $('detailSheetContent');
    box.innerHTML = `
      <div style="padding-right: 36px; margin-bottom: 6px;">
        <span class="ios-eyebrow">${escapeHtml(lvLabel)}</span>
        <div style="font-size: 13px; color: var(--sys-label-2);">對應平片假名：<strong lang="ja">${escapeHtml(item.pair)}</strong></div>
      </div>

      <div class="sheet-font-compare">
        <div class="font-box">
          <span class="f-label">黑體（介面／招牌）</span>
          <span class="f-gothic" lang="ja">${escapeHtml(item.kana)}</span>
        </div>
        <div class="font-box">
          <span class="f-label">明體（書籍／菜單）</span>
          <span class="f-mincho" lang="ja">${escapeHtml(item.kana)}</span>
        </div>
      </div>

      <button class="ios-audio-row" id="btnSheetSpeak">
        <div class="audio-icon-circle">${ICON_SPEAKER_SM}</div>
        <div class="audio-word-body">
          <strong>${escapeHtml(item.romaji)}</strong> · ${formatWordHighlight(item)}
        </div>
        <span class="audio-action-label">發音</span>
      </button>

      <div class="ios-spec-list">
        ${item.lore ? `<div class="cue-row"><span class="cue-tag">漢字字源</span><span>源自「<strong>${escapeHtml(item.lore[0])}</strong>」：${escapeHtml(item.lore[1])}</span></div>` : ''}
        ${item.mnemo ? `<div class="cue-row"><span class="cue-tag">視覺聯想</span><span>${escapeHtml(item.mnemo[1])}</span></div>` : ''}
      </div>
      ${confHtml}

      <button class="ios-btn-primary" id="btnSheetGoWrite">
        前往手寫練習「${escapeHtml(item.kana)}」
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

  // ==================== TAB 3：手寫工作坊與離線筆跡辨識 ====================
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
      const classic = ['あ', 'お', 'き', 'さ', 'ち', 'は', 'ほ', 'ま', 'る', 'ろ', 'ぬ', 'め', 'シ', 'ツ', 'ソ', 'ン', 'ク', 'ワ', 'タ'];
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
    $('writeWordInfo').textContent = item.word && item.word[0]
      ? `${item.word[0]} · ${item.word[2]}`
      : (item.script === 'h' ? '平假名' : '片假名');
    $('dojoEtymHint').textContent = item.lore ? `字源：${item.lore[0]}` : `對應：${item.pair}`;
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
      box.classList.add('hidden');
      showToast('請先在畫布中寫出假名');
      return;
    }

    const strokeNote = (res.expectedStrokes && res.strokeCount !== res.expectedStrokes)
      ? `（標準筆畫為 ${res.expectedStrokes} 畫，目前為 ${res.strokeCount} 畫）`
      : `（${res.strokeCount} 畫筆順吻合）`;

    if (res.passed) {
      window.KanaEngine.recordAnswer(item.id, true);
      window.KanaEngine.playTone('correct');
      window.KanaEngine.speakItem(item, true);
      dojoPad.setGhost(true);
      box.classList.add('ok');
      box.innerHTML = `
        <div><strong>字形結構契合度 ${res.scorePct}%</strong> ${escapeHtml(strokeNote)}</div>
        <div style="margin-top: 8px;">
          <button class="ios-text-btn" id="btnVerdictNext">繼續練習下一字 →</button>
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
        ? `筆跡較接近「<strong lang="ja">${escapeHtml(res.best.item.kana)} (${escapeHtml(res.best.item.romaji)})</strong>」`
        : '字形比例稍微偏移';
      const tip = item.contrastTip ? `<div style="margin-top: 4px;">提示：${escapeHtml(item.contrastTip)}</div>` : '';

      const candsHtml = res.top3.map(r =>
        `<span class="cand-pill" lang="ja">${escapeHtml(r.item.kana)} ${Math.round(Math.min(99, r.score * 122))}%</span>`
      ).join('');

      box.innerHTML = `
        <div>${topGuess} ${escapeHtml(strokeNote)}</div>
        ${tip}
        <div class="verdict-cands">${candsHtml}</div>
        <div style="margin-top: 10px; display: flex; gap: 14px;">
          <button class="ios-text-btn" id="btnRetryWrite">清除重寫</button>
          <button class="ios-text-btn muted" id="btnForcePass">標記為通過</button>
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
        showToast('已記錄通過');
      });
    }
  }

  // ==================== TAB 4：記憶穩定度與跨裝置同步 ====================
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
      { label: '長期 (21天+)', count: stats.stageLong, cls: 'green' }
    ];

    $('memoryStageBars').innerHTML = stages.map(st => {
      const w = stats.learnedCount > 0 ? Math.round((st.count / maxBase) * 100) : 0;
      return `
        <div class="mem-row">
          <span>${st.label}</span>
          <div class="ios-track"><div class="ios-fill ${st.cls}" style="width:${w}%"></div></div>
          <strong>${st.count} 字</strong>
        </div>
      `;
    }).join('');

    const weakBox = $('weakListContainer');
    if (stats.weakItems.length === 0) {
      weakBox.innerHTML = `<span class="ios-caption">完成單元測驗後，系統將自動標記需要強化的假名。</span>`;
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
