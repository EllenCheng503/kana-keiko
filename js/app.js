(function() {
    'use strict';

    // --- DOM ELEMENTS CACHE ---
    const DOM = {};

    // --- STATE VARIABLES ---
    let state = {
        currentScreen: 'home',
        learnMode: {
            cards: [],
            currentIndex: 0,
            isFlipped: false,
            isReview: false,
            currentRow: null
        },
        quizMode: {
            isActive: false,
            audioOnly: false
        },
        writeMode: {
            cards: [],
            currentIndex: 0
        },
        synth: window.speechSynthesis,
        voice: null
    };

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheDOM();
        bindEvents();
        initSpeechSynthesis();
        
        // Load data
        window.SRS.load();
        window.Progress.load();
        
        // Initialize if first time
        const stats = window.SRS.getStats();
        if (stats.totalCards === 0) {
            window.SRS.initCards(window.KanaData.HIRAGANA.concat(window.KanaData.KATAKANA));
            window.SRS.save();
        }

        // Welcome back or First time
        if (stats.learned > 0) {
            showToast('歡迎回來！進度已載入 ✅', 'success');
        }

        updateHeader();
        updateHome();
        switchScreen('home');

        // Check for onboarding
        if (stats.learned === 0) {
            showOnboardingModal();
        }
    }

    function cacheDOM() {
        const ids = [
            'app-header', 'headerStreak', 'headerStreakCount', 'btnThemeToggle',
            'home', 'homeLevelBadge', 'homeLevelNum', 'welcomeText', 'homeXPBar', 'homeXPText', 'homeStatsRow',
            'statDue', 'statDone', 'statAccuracy', 'statLearned', 'btnStartLearn', 'btnStartReview',
            'reviewDueText', 'btnStartQuiz', 'btnStartWrite', 'btnViewProgress', 'homeMiniGrid',
            'learn', 'rowSelector', 'learnCard', 'learnKana', 'learnRomaji', 'learnKanaBack', 'learnRomajiBack',
            'learnMnemonic', 'learnStrokeCount', 'btnSpeak', 'btnPrevKana', 'btnNextKana', 'learnCounter', 'srsButtons',
            'quiz', 'quizSetup', 'quizActive', 'quizResults', 'quizScope', 'quizCount', 'btnStartQuizGo',
            'quizProgressBar', 'quizCounter', 'quizScore', 'quizPrompt', 'quizKana', 'btnQuizSpeak', 'quizOptions',
            'quizFeedback', 'feedbackIcon', 'feedbackAnswer', 'feedbackMnemonic', 'btnQuizNext', 'resultsIcon',
            'resultsTitle', 'resultCorrect', 'resultWrong', 'resultAccuracy', 'resultXP', 'resultsMistakes',
            'mistakesList', 'resultsAchievements', 'achievementList', 'btnQuizRetry', 'btnQuizHome',
            'write', 'writeRomaji', 'writeRefChar', 'drawCanvas', 'currentStrokes', 'expectedStrokes',
            'btnClearCanvas', 'btnUndoStroke', 'btnShowHint', 'btnCheckWrite', 'btnPrevWrite', 'btnNextWrite',
            'writeCounter', 'writeRowSelector',
            'progress', 'progressLevelBadge', 'progressLevelNum', 'progressLevelTitle', 'progressXPBar',
            'progressXPText', 'progressStreak', 'progressTotalReviews', 'progressAccuracy', 'masteryGrid', 'achievementsGrid',
            'modal', 'modalBackdrop', 'modalContent', 'modalClose', 'modalBody',
            'toast', 'toastIcon', 'toastText', 'confettiContainer'
        ];

        ids.forEach(id => {
            DOM[id] = document.getElementById(id);
        });

        // Add dynamically created save indicator
        const saveIndicator = document.createElement('div');
        saveIndicator.id = 'saveIndicator';
        saveIndicator.className = 'hidden';
        saveIndicator.style.position = 'absolute';
        saveIndicator.style.top = '10px';
        saveIndicator.style.right = '60px';
        saveIndicator.style.background = 'var(--bg-color)';
        saveIndicator.style.padding = '4px 8px';
        saveIndicator.style.borderRadius = '12px';
        saveIndicator.style.fontSize = '0.8rem';
        saveIndicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        saveIndicator.style.zIndex = '1000';
        saveIndicator.style.transition = 'opacity 0.3s ease';
        saveIndicator.innerText = '☁️ 已儲存';
        document.body.appendChild(saveIndicator);
        DOM.saveIndicator = saveIndicator;
    }

    function bindEvents() {
        // Header
        if(DOM.btnThemeToggle) {
            DOM.btnThemeToggle.addEventListener('click', toggleTheme);
        }

        // Tab Bar Navigation
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', function() {
                const screen = this.dataset.screen;
                if (screen === 'quiz') {
                    switchScreen('quizSetup');
                } else if (screen === 'learn') {
                    setupLearnSelection();
                } else if (screen === 'write') {
                    setupWriteSelection();
                } else if (screen === 'progress') {
                    updateProgressScreen();
                    switchScreen('progress');
                } else {
                    updateHome();
                    switchScreen(screen);
                }
            });
        });

        // Navigation
        DOM.btnStartLearn.addEventListener('click', () => setupLearnSelection());
        DOM.btnStartReview.addEventListener('click', () => startReviewSession());
        DOM.btnStartQuiz.addEventListener('click', () => switchScreen('quizSetup'));
        DOM.btnStartWrite.addEventListener('click', () => setupWriteSelection());
        DOM.btnViewProgress.addEventListener('click', () => { updateProgressScreen(); switchScreen('progress'); });
        
        // Learn Screen
        DOM.learnCard.addEventListener('click', flipLearnCard);
        DOM.btnSpeak.addEventListener('click', (e) => { e.stopPropagation(); speakCurrentKana(); });
        DOM.btnNextKana.addEventListener('click', nextLearnCard);
        DOM.btnPrevKana.addEventListener('click', prevLearnCard);
        
        // SRS Buttons (delegation)
        DOM.srsButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.srs-btn');
            if (btn) {
                const quality = parseInt(btn.dataset.quality, 10);
                submitSRS(quality);
            }
        });

        // Quiz Screen
        DOM.btnStartQuizGo.addEventListener('click', startQuizMode);
        DOM.btnQuizNext.addEventListener('click', nextQuizQuestion);
        DOM.btnQuizSpeak.addEventListener('click', () => {
            const q = window.Quiz.getCurrentQuestion();
            if (q) speakJapanese(q.kana);
        });
        DOM.btnQuizRetry.addEventListener('click', () => switchScreen('quizSetup'));
        DOM.btnQuizHome.addEventListener('click', () => { updateHome(); switchScreen('home'); });

        // Write Screen
        DOM.btnClearCanvas.addEventListener('click', () => window.DrawingPad.clear());
        DOM.btnUndoStroke.addEventListener('click', () => window.DrawingPad.undo());
        DOM.btnShowHint.addEventListener('click', showWriteHint);
        DOM.btnCheckWrite.addEventListener('click', checkWriteCanvas);
        DOM.btnNextWrite.addEventListener('click', nextWriteCard);
        DOM.btnPrevWrite.addEventListener('click', prevWriteCard);

        // Modal
        DOM.modalClose.addEventListener('click', hideModal);
        DOM.modalBackdrop.addEventListener('click', hideModal);

        // Window resize for canvas
        window.addEventListener('resize', () => {
            if (state.currentScreen === 'write') {
                window.DrawingPad.resize();
            }
        });

        // Global keydown for shortcuts
        document.addEventListener('keydown', handleGlobalKeydown);
    }

    // --- SPEECH SYNTHESIS ---
    function initSpeechSynthesis() {
        if (!state.synth) return;
        
        const loadVoices = () => {
            const voices = state.synth.getVoices();
            state.voice = voices.find(v => v.lang.includes('ja')) || voices[0];
        };
        
        loadVoices();
        if (state.synth.onvoiceschanged !== undefined) {
            state.synth.onvoiceschanged = loadVoices;
        }
    }

    window.speakJapanese = function(text) {
        if (!state.synth || !text) return;
        
        // Cancel any ongoing speech
        state.synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        if (state.voice) utterance.voice = state.voice;
        utterance.rate = 0.9;
        
        state.synth.speak(utterance);
    };

    function speakCurrentKana() {
        const card = state.learnMode.cards[state.learnMode.currentIndex];
        if (card) {
            window.speakJapanese(card.char);
        }
    }

    // --- UTILITIES ---
    function switchScreen(screenId) {
        // Map quiz sub-screens to the main quiz screen
        const quizSubScreens = ['quizSetup', 'quizActive', 'quizResults'];
        const isQuizSub = quizSubScreens.includes(screenId);
        const mainScreenId = isQuizSub ? 'quiz' : screenId;

        // Hide all main screens
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });

        // Show the target main screen
        const screen = DOM[mainScreenId];
        if (screen) {
            screen.classList.remove('hidden');
            screen.classList.add('active');
        }

        // Handle quiz sub-screens
        if (isQuizSub) {
            quizSubScreens.forEach(sub => {
                if (DOM[sub]) DOM[sub].classList.add('hidden');
            });
            if (DOM[screenId]) DOM[screenId].classList.remove('hidden');
        }

        // Update tab bar active state
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.screen === mainScreenId);
        });
        
        state.currentScreen = screenId;
        window.scrollTo(0, 0);

        if (mainScreenId === 'home') {
            updateHeader();
            updateHome();
        } else if (mainScreenId === 'write') {
            setTimeout(() => {
                window.DrawingPad.resize();
            }, 50);
        }
    }

    function showToast(message, type = 'info') {
        DOM.toastText.innerText = message;
        DOM.toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';
        DOM.toastIcon.innerText = icon;

        if (state.toastTimeout) {
            clearTimeout(state.toastTimeout);
        }

        setTimeout(() => {
            DOM.toast.classList.remove('hidden');
        }, 10);

        state.toastTimeout = setTimeout(() => {
            DOM.toast.classList.add('hidden');
        }, 3000);
    }

    function showModal(contentHtml) {
        DOM.modalBody.innerHTML = contentHtml;
        DOM.modal.classList.remove('hidden');
        // Small delay to allow CSS transition if any
        setTimeout(() => DOM.modal.classList.add('active'), 10);
    }

    function hideModal() {
        DOM.modal.classList.remove('active');
        setTimeout(() => DOM.modal.classList.add('hidden'), 300);
    }

    function showSaveIndicator() {
        DOM.saveIndicator.classList.remove('hidden');
        DOM.saveIndicator.style.opacity = '1';
        setTimeout(() => {
            DOM.saveIndicator.style.opacity = '0';
            setTimeout(() => DOM.saveIndicator.classList.add('hidden'), 300);
        }, 1500);
    }

    function saveData() {
        window.SRS.save();
        window.Progress.save();
        showSaveIndicator();
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        // Save preference in localStorage
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('kanaMasterTheme', isDark ? 'dark' : 'light');
    }

    // --- HOME SCREEN ---
    function updateHeader() {
        const levelData = window.Progress.getLevel();
        const streak = window.Progress.getStreak();
        
        DOM.headerStreakCount.innerText = streak;
        // Optionally update top right level indicator if exists
    }

    function updateHome() {
        const stats = window.SRS.getStats();
        const levelData = window.Progress.getLevel();
        const dueCards = window.SRS.getDueCards();
        
        DOM.homeLevelNum.innerText = levelData.level;
        DOM.homeXPText.innerText = `${levelData.xpInLevel} / ${levelData.xpMax} XP`;
        DOM.homeXPBar.querySelector('.progress-fill').style.width = `${levelData.progressToNext}%`;
        
        DOM.statDue.innerText = dueCards.length;
        DOM.statDone.innerText = stats.learned;
        DOM.statAccuracy.innerText = stats.accuracy > 0 ? `${stats.accuracy}%` : '-';
        DOM.statLearned.innerText = stats.mastered;

        // Smarter Home Screen updates
        if (stats.learned === 0) {
            DOM.welcomeText.innerHTML = `
                <div class="card" style="text-align: center; margin-bottom: 20px; border: 2px solid var(--primary-color);">
                    <h2>開始你的五十音之旅！ 🇯🇵</h2>
                    <p>點擊「學習新假名」開始第一堂課！</p>
                </div>
            `;
        } else {
            DOM.welcomeText.innerHTML = `
                <h2>今日目標：${dueCards.length > 0 ? '完成所有復習！' : '學 5 個新假名！'}</h2>
            `;
        }

        if (dueCards.length > 0) {
            DOM.btnStartReview.classList.add('pulse');
            DOM.btnStartReview.innerHTML = `復習到期假名 <span class="badge" style="background: white; color: var(--primary-color); padding: 2px 6px; border-radius: 10px; margin-left: 5px;">${dueCards.length}</span>`;
        } else {
            DOM.btnStartReview.classList.remove('pulse');
            DOM.btnStartReview.innerHTML = '復習假名 (無到期)';
        }

        renderMiniGrid();
    }

    function renderMiniGrid() {
        const grid = DOM.homeMiniGrid;
        grid.innerHTML = '';
        const allCards = window.SRS.getAllCards();
        
        // Just show basic vowels for mini grid to save space, or a summary
        // Let's render a quick summary of rows unlocked
        window.KanaData.ROWS.forEach(row => {
            if (row.type === 'hiragana' && window.SRS.isRowUnlocked(row.id)) {
                const cell = document.createElement('div');
                cell.className = 'mini-grid-cell';
                cell.innerText = row.id === 'vowels' ? 'あ' : row.id;
                grid.appendChild(cell);
            }
        });
    }

    function showOnboardingModal() {
        const html = `
            <div style="text-align: center;">
                <h2>歡迎來到假名大師！🇳🇵</h2>
                <p>這個網頁會幫你從零開始學會日語五十音。</p>
                <ul style="text-align: left; margin: 20px 0; list-style: none; padding: 0;">
                    <li style="margin-bottom: 10px;">🎴 <b>閃卡學習</b>：科學的間隔重複 (SRS) 幫你牢記</li>
                    <li style="margin-bottom: 10px;">✍️ <b>書寫練習</b>：在畫布上練習正確筆順</li>
                    <li style="margin-bottom: 10px;">🏆 <b>進度追蹤</b>：賺取 XP，升級並解鎖成就</li>
                </ul>
                <button class="btn btn-primary btn-lg" onclick="window.appAPI.startFirstLesson()">開始學習！</button>
            </div>
        `;
        showModal(html);
    }

    // Expose for onboarding button
    window.appAPI = {
        startFirstLesson: () => {
            hideModal();
            setupLearnSelection();
        }
    };

    // --- LEARN SCREEN ---
    function setupLearnSelection() {
        // Build row selector
        DOM.rowSelector.innerHTML = '<option value="">選擇要學習的行...</option>';
        window.KanaData.ROWS.forEach(row => {
            // Simplified check: unlock next row if previous is somewhat learned
            // In a real app, SRS.isRowUnlocked would be used
            const option = document.createElement('option');
            option.value = row.id;
            option.innerText = `${row.type === 'hiragana' ? '平假名' : '片假名'} - ${row.label}行`;
            DOM.rowSelector.appendChild(option);
        });

        DOM.rowSelector.onchange = (e) => {
            const rowId = e.target.value;
            if (rowId) {
                startLearnSession(rowId);
            }
        };

        switchScreen('learn');
        
        // Hide card initially until row selected
        DOM.learnCard.classList.add('hidden');
        DOM.srsButtons.classList.add('hidden');
        DOM.learnCounter.innerText = '';
    }

    function startLearnSession(rowId) {
        const newCards = window.SRS.getNewCards(rowId);
        if (newCards.length === 0) {
            showToast('這一行沒有新卡片了！', 'warning');
            return;
        }

        state.learnMode.cards = newCards;
        state.learnMode.currentIndex = 0;
        state.learnMode.isReview = false;
        state.learnMode.currentRow = rowId;

        DOM.learnCard.classList.remove('hidden');
        renderLearnCard();
    }

    function startReviewSession() {
        const dueCards = window.SRS.getDueCards();
        if (dueCards.length === 0) {
            showToast('目前沒有需要復習的卡片！去學習新假名吧。', 'success');
            return;
        }

        // Shuffle due cards
        dueCards.sort(() => Math.random() - 0.5);

        state.learnMode.cards = dueCards;
        state.learnMode.currentIndex = 0;
        state.learnMode.isReview = true;

        switchScreen('learn');
        DOM.rowSelector.style.display = 'none';
        DOM.learnCard.classList.remove('hidden');
        renderLearnCard();
    }

    function renderLearnCard() {
        if (state.learnMode.currentIndex >= state.learnMode.cards.length) {
            finishLearnSession();
            return;
        }

        const card = state.learnMode.cards[state.learnMode.currentIndex];
        
        // Reset state
        state.learnMode.isFlipped = false;
        DOM.learnCard.classList.remove('flipped');
        DOM.srsButtons.classList.add('hidden');
        
        // Populate Front
        DOM.learnKana.innerText = card.char;
        
        // Populate Back
        DOM.learnKanaBack.innerText = card.char;
        DOM.learnRomajiBack.innerText = card.romaji;
        DOM.learnMnemonic.querySelector('.mnemonic-text').innerText = card.mnemonic || '無口訣';
        DOM.learnStrokeCount.innerText = `筆畫數: ${card.strokeCount}`;
        
        // Update Counter
        DOM.learnCounter.innerText = `${state.learnMode.currentIndex + 1} / ${state.learnMode.cards.length}`;

        // Guided learning features
        DOM.learnCard.classList.add('pulse'); // Pulse to encourage tapping
        
        // Auto-speak on show
        speakCurrentKana();
    }

    function flipLearnCard() {
        if (state.learnMode.isFlipped) return;
        
        state.learnMode.isFlipped = true;
        DOM.learnCard.classList.remove('pulse');
        DOM.learnCard.classList.add('flipped');
        DOM.srsButtons.classList.remove('hidden');

        // Show tooltip if it's the very first time
        const stats = window.SRS.getStats();
        if (stats.learned < 5) {
            showToast('記住這個字的樣子，然後按下方按鈕評估你記得多好', 'info');
        }
    }

    function submitSRS(quality) {
        if (!state.learnMode.isFlipped) return;

        const card = state.learnMode.cards[state.learnMode.currentIndex];
        
        // Record review in SRS
        window.SRS.reviewCard(card.id, quality);
        
        // Record in Progress (this internally adds XP)
        const isCorrect = quality >= 3;
        window.Progress.recordReview(isCorrect);
        
        // Show XP Popup
        showXPPopup(isCorrect ? 10 : 2);
        
        saveData();

        // Auto-advance with delay
        setTimeout(() => {
            nextLearnCard();
        }, 500);
    }

    function nextLearnCard() {
        state.learnMode.currentIndex++;
        renderLearnCard();
    }

    function prevLearnCard() {
        if (state.learnMode.currentIndex > 0) {
            state.learnMode.currentIndex--;
            renderLearnCard();
        }
    }

    function finishLearnSession() {
        DOM.learnCard.classList.add('hidden');
        DOM.srsButtons.classList.add('hidden');
        
        triggerConfetti();
        
        const html = `
            <div style="text-align: center;">
                <h2>太棒了！🎉</h2>
                <p>你已經完成了這組卡片的學習/復習。</p>
                <div style="margin: 20px 0;">
                    <p>繼續保持！</p>
                </div>
                <button class="btn btn-primary" onclick="document.getElementById('modalClose').click(); document.getElementById('btnStartQuizGo').click();">去測驗看看</button>
                <button class="btn btn-outline" onclick="document.getElementById('modalClose').click(); document.getElementById('btnStartWrite').click();">練習寫字</button>
            </div>
        `;
        showModal(html);
        updateHeader();
    }

    // --- QUIZ SCREEN ---
    function setupQuiz() {
        switchScreen('quizSetup');
    }

    function startQuizMode() {
        const mode = document.getElementById('quizModeSelect').value;
        const scope = document.getElementById('quizScopeSelect').value;
        const count = parseInt(document.getElementById('quizCountSelect').value, 10);

        state.quizMode.audioOnly = (mode === 'audio');

        const success = window.Quiz.start(mode, scope, count);
        if (!success) {
            showToast('沒有足夠的卡片來進行測驗，請先學習更多假名！', 'error');
            return;
        }

        switchScreen('quizActive');
        renderQuizQuestion();
    }

    function renderQuizQuestion() {
        const q = window.Quiz.getCurrentQuestion();
        if (!q) {
            finishQuiz();
            return;
        }

        const stateQuiz = window.Quiz.getState();
        DOM.quizCounter.innerText = `題目 ${stateQuiz.currentIndex + 1} / ${stateQuiz.total}`;
        DOM.quizScore.innerText = `分數: ${stateQuiz.score}`;
        DOM.quizProgressBar.querySelector('.progress-fill').style.width = `${((stateQuiz.currentIndex) / stateQuiz.total) * 100}%`;

        // Reset UI
        DOM.quizFeedback.classList.add('hidden');
        DOM.btnQuizNext.classList.add('hidden');
        DOM.quizOptions.innerHTML = '';
        DOM.quizOptions.className = 'quiz-options'; // reset layout classes if any

        if (state.quizMode.audioOnly) {
            DOM.quizKana.innerText = '🔊';
            DOM.quizKana.classList.add('bounce');
            DOM.btnQuizSpeak.style.display = 'block';
            speakJapanese(q.kana);
        } else {
            DOM.quizKana.innerText = q.prompt;
            DOM.quizKana.classList.remove('bounce');
            // Disable speak button if not testing audio, but keep it visible if they want to hear
            DOM.btnQuizSpeak.style.display = 'block';
            DOM.btnQuizSpeak.onclick = () => speakJapanese(q.kana);
        }

        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            if (q.type === 'romaji_to_kana' || q.type === 'audio_to_kana') {
                btn.classList.add('kana-option');
            }
            btn.innerText = opt;
            btn.onclick = () => handleQuizAnswer(opt, btn, q);
            DOM.quizOptions.appendChild(btn);
        });
    }

    function handleQuizAnswer(selected, btnElement, qInfo) {
        if (DOM.quizOptions.querySelector('.disabled')) return; // Already answered

        const result = window.Quiz.submitAnswer(selected);
        
        // Disable all options
        Array.from(DOM.quizOptions.children).forEach(child => {
            child.classList.add('disabled');
            if (child.innerText === result.correctAnswer) {
                child.classList.add('correct');
            }
        });

        if (result.isCorrect) {
            btnElement.classList.add('correct');
            DOM.feedbackIcon.innerText = '✅ 正確！';
            DOM.feedbackIcon.style.color = 'var(--success-color)';
            showXPPopup(5); // Small XP for quiz correct
        } else {
            btnElement.classList.add('wrong');
            DOM.feedbackIcon.innerText = '❌ 錯誤';
            DOM.feedbackIcon.style.color = 'var(--error-color)';
            DOM.quizKana.classList.add('shake');
            setTimeout(() => DOM.quizKana.classList.remove('shake'), 500);
        }

        DOM.feedbackAnswer.innerText = `正確答案是: ${result.correctAnswer}`;
        DOM.feedbackMnemonic.innerText = ``; // Could add mnemonic here if available

        DOM.quizFeedback.classList.remove('hidden');
        DOM.btnQuizNext.classList.remove('hidden');
        DOM.btnQuizNext.focus();
        
        window.Progress.recordReview(result.isCorrect);
        saveData();
    }

    function nextQuizQuestion() {
        window.Quiz.next();
        renderQuizQuestion();
    }

    function finishQuiz() {
        const stateQuiz = window.Quiz.getState();
        window.Quiz.finish(); // Resets quiz state internally

        switchScreen('quizResults');
        DOM.quizProgressBar.querySelector('.progress-fill').style.width = '100%';

        const accuracy = Math.round((stateQuiz.score / stateQuiz.total) * 100);
        
        DOM.resultCorrect.innerText = stateQuiz.score;
        DOM.resultWrong.innerText = stateQuiz.total - stateQuiz.score;
        DOM.resultAccuracy.innerText = `${accuracy}%`;
        
        let xpGained = 0;
        if (accuracy === 100) xpGained = 20; // Perfect bonus
        else if (accuracy >= 80) xpGained = 10; // Great bonus
        DOM.resultXP.innerText = xpGained > 0 ? `+${xpGained} XP 🎁` : '';
        
        // Only add bonus XP (per-question XP already added via recordReview)
        if (xpGained > 0) {
            window.Progress.addXP(xpGained);
        }
        saveData();

        if (accuracy >= 80) {
            DOM.resultsIcon.innerText = '🏆';
            DOM.resultsTitle.innerText = '測驗完成！太厲害了！';
            triggerConfetti();
        } else {
            DOM.resultsIcon.innerText = '💪';
            DOM.resultsTitle.innerText = '測驗完成！繼續加油！';
        }

        // Render mistakes
        DOM.mistakesList.innerHTML = '';
        if (stateQuiz.mistakes && stateQuiz.mistakes.length > 0) {
            DOM.resultsMistakes.classList.remove('hidden');
            stateQuiz.mistakes.forEach(m => {
                const li = document.createElement('li');
                li.innerText = `題目: ${m.prompt} | 你的答案: ${m.given} | 正確: ${m.correct}`;
                DOM.mistakesList.appendChild(li);
            });
        } else {
            DOM.resultsMistakes.classList.add('hidden');
        }
        
        updateHeader();
    }

    // --- WRITE SCREEN ---
    function setupWriteSelection() {
        DOM.writeRowSelector.innerHTML = '<option value="">選擇要練習的行...</option>';
        window.KanaData.ROWS.forEach(row => {
            const option = document.createElement('option');
            option.value = row.id;
            option.innerText = `${row.type === 'hiragana' ? '平假名' : '片假名'} - ${row.label}行`;
            DOM.writeRowSelector.appendChild(option);
        });

        DOM.writeRowSelector.onchange = (e) => {
            const rowId = e.target.value;
            if (rowId) {
                startWriteSession(rowId);
            }
        };

        switchScreen('write');
        
        DOM.drawCanvas.parentElement.style.opacity = '0.5';
        DOM.writeRomaji.innerText = '請選擇行';
        DOM.writeRefChar.innerText = '';
    }

    function startWriteSession(rowId) {
        // Just get all cards for this row from KanaData
        const row = window.KanaData.ROWS.find(r => r.id === rowId);
        const typeData = row.type === 'hiragana' ? window.KanaData.HIRAGANA : window.KanaData.KATAKANA;
        
        state.writeMode.cards = typeData.filter(k => k.row === rowId);
        state.writeMode.currentIndex = 0;

        DOM.drawCanvas.parentElement.style.opacity = '1';
        
        // Init canvas if not done
        if (!window.DrawingPad.ctx) {
            window.DrawingPad.init(DOM.drawCanvas);
        }

        renderWriteCard();
    }

    function renderWriteCard() {
        const card = state.writeMode.cards[state.writeMode.currentIndex];
        if (!card) return;

        window.DrawingPad.clear();
        DOM.writeRomaji.innerText = card.romaji;
        DOM.writeRefChar.innerText = ''; // Hide hint initially
        DOM.writeRefChar.classList.add('hidden');
        
        DOM.expectedStrokes.innerText = card.strokeCount;
        DOM.currentStrokes.innerText = '0';

        DOM.writeCounter.innerText = `${state.writeMode.currentIndex + 1} / ${state.writeMode.cards.length}`;

        // Add a "Skip/I wrote it" button dynamically if not exists
        if (!document.getElementById('btnSkipWrite')) {
            const skipBtn = document.createElement('button');
            skipBtn.id = 'btnSkipWrite';
            skipBtn.className = 'btn btn-outline';
            skipBtn.innerText = '跳過 / 已練習';
            skipBtn.onclick = () => {
                showToast('已跳過', 'info');
                nextWriteCard();
            };
            DOM.btnCheckWrite.parentNode.insertBefore(skipBtn, DOM.btnCheckWrite.nextSibling);
        }

        // Setup stroke counter update loop
        if (state.writeInterval) clearInterval(state.writeInterval);
        state.writeInterval = setInterval(() => {
            if (state.currentScreen === 'write') {
                DOM.currentStrokes.innerText = window.DrawingPad.getStrokeCount();
            }
        }, 500);
    }

    function showWriteHint() {
        const card = state.writeMode.cards[state.writeMode.currentIndex];
        DOM.writeRefChar.innerText = card.char;
        DOM.writeRefChar.classList.remove('hidden');
        window.DrawingPad.showGuide(card.char);
    }

    function checkWriteCanvas() {
        const card = state.writeMode.cards[state.writeMode.currentIndex];
        const strokes = window.DrawingPad.getStrokeCount();
        
        if (strokes === 0) {
            showToast('請先在畫布上寫字！', 'warning');
            return;
        }

        const strokeOk = window.DrawingPad.validateStrokeCount(card.strokeCount);
        const score = window.DrawingPad.getScore(card.strokeCount);

        let msg = '';
        if (score >= 80) {
            msg = '寫得很好！✨';
            showXPPopup(15);
            window.Progress.addXP(15);
            saveData();
            showToast(msg, 'success');
            setTimeout(nextWriteCard, 1000);
        } else if (strokeOk) {
            msg = '筆畫數正確，但形狀可以再更好一點。';
            showToast(msg, 'info');
        } else {
            msg = `筆畫數不對喔！預期 ${card.strokeCount} 畫，你寫了 ${strokes} 畫。`;
            showToast(msg, 'error');
            DOM.drawCanvas.classList.add('shake');
            setTimeout(() => DOM.drawCanvas.classList.remove('shake'), 500);
        }
    }

    function nextWriteCard() {
        if (state.writeMode.currentIndex < state.writeMode.cards.length - 1) {
            state.writeMode.currentIndex++;
            renderWriteCard();
        } else {
            showToast('這行練習完畢！', 'success');
            triggerConfetti();
        }
    }

    function prevWriteCard() {
        if (state.writeMode.currentIndex > 0) {
            state.writeMode.currentIndex--;
            renderWriteCard();
        }
    }

    // --- PROGRESS SCREEN ---
    function updateProgressScreen() {
        const levelData = window.Progress.getLevel();
        const stats = window.SRS.getStats();
        
        DOM.progressLevelNum.innerText = levelData.level;
        // Simple title logic
        let title = '見習生';
        if (levelData.level > 5) title = '初學者';
        if (levelData.level > 10) title = '熟練者';
        if (levelData.level > 20) title = '假名大師';
        DOM.progressLevelTitle.innerText = title;
        
        DOM.progressXPText.innerText = `${levelData.xpInLevel} / ${levelData.xpMax} XP`;
        DOM.progressXPBar.querySelector('.progress-fill').style.width = `${levelData.progressToNext}%`;
        
        DOM.progressStreak.innerText = `${window.Progress.getStreak()} 天`;
        DOM.progressTotalReviews.innerText = stats.totalCards; // Or total reviews if tracked
        DOM.progressAccuracy.innerText = stats.accuracy > 0 ? `${stats.accuracy}%` : '-';
        
        renderMasteryGrid();
        renderAchievements();
    }

    function renderMasteryGrid() {
        const grid = DOM.masteryGrid;
        grid.innerHTML = '';
        const allCards = window.SRS.getAllCards();
        
        // Hiragana
        const hTitle = document.createElement('h3');
        hTitle.innerText = '平假名熟練度';
        grid.appendChild(hTitle);
        
        const hContainer = document.createElement('div');
        hContainer.className = 'mini-grid';
        window.KanaData.HIRAGANA.forEach(k => {
            const cell = document.createElement('div');
            cell.className = 'mini-grid-cell';
            cell.innerText = k.char;
            
            const card = allCards[k.char];
            if (card) {
                cell.classList.add(`mastery-${card.mastery}`);
            } else {
                cell.classList.add('mastery-0');
                cell.style.opacity = '0.3';
            }
            hContainer.appendChild(cell);
        });
        grid.appendChild(hContainer);
    }

    function renderAchievements() {
        const grid = DOM.achievementsGrid;
        grid.innerHTML = '';
        const achievements = window.Progress.getAllAchievements();
        
        achievements.forEach(a => {
            const el = document.createElement('div');
            el.className = 'card';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '15px';
            el.style.marginBottom = '10px';
            el.style.opacity = a.unlocked ? '1' : '0.5';
            
            el.innerHTML = `
                <div style="font-size: 2rem;">${a.icon}</div>
                <div>
                    <h4 style="margin:0 0 5px 0;">${a.title}</h4>
                    <p style="margin:0; font-size: 0.9rem; color: var(--text-muted);">${a.desc}</p>
                </div>
            `;
            grid.appendChild(el);
        });
    }

    // --- ANIMATIONS & EFFECTS ---
    function triggerConfetti() {
        DOM.confettiContainer.innerHTML = '';
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';
            particle.style.left = `${Math.random() * 100}vw`;
            particle.style.animationDuration = `${Math.random() * 2 + 1}s`;
            particle.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            DOM.confettiContainer.appendChild(particle);
        }
        setTimeout(() => {
            DOM.confettiContainer.innerHTML = '';
        }, 3000);
    }

    function showXPPopup(amount) {
        const popup = document.createElement('div');
        popup.innerText = `+${amount} XP ✨`;
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.color = 'var(--accent-color)';
        popup.style.fontWeight = 'bold';
        popup.style.fontSize = '1.5rem';
        popup.style.zIndex = '9999';
        popup.style.pointerEvents = 'none';
        popup.style.textShadow = '0 2px 4px rgba(0,0,0,0.2)';
        popup.style.transition = 'all 1s ease-out';
        
        document.body.appendChild(popup);
        
        // Trigger reflow
        void popup.offsetWidth;
        
        popup.style.transform = 'translate(-50%, -150%)';
        popup.style.opacity = '0';
        
        setTimeout(() => popup.remove(), 1000);
    }

    function handleGlobalKeydown(e) {
        // Only if no modal is open
        if (!DOM.modal.classList.contains('hidden')) return;

        if (state.currentScreen === 'learn' && state.learnMode.isFlipped) {
            // Number keys 1-4 for SRS
            if (['1','2','3','4'].includes(e.key)) {
                let quality = 0;
                switch(e.key) {
                    case '1': quality = 0; break; // Again
                    case '2': quality = 2; break; // Hard
                    case '3': quality = 3; break; // Good
                    case '4': quality = 4; break; // Easy
                }
                submitSRS(quality);
            }
        } else if (state.currentScreen === 'learn' && !state.learnMode.isFlipped) {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                flipLearnCard();
            }
        }
    }

})();
