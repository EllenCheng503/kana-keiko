/**
 * quiz.js — Quiz Engine for Kana Master
 * Supports 4 quiz modes with smart distractor generation
 */

window.Quiz = (function() {
  'use strict';

  // Quiz state
  let state = {
    mode: 'kana-to-romaji',
    questions: [],
    currentIndex: 0,
    correct: 0,
    wrong: 0,
    xpEarned: 0,
    mistakes: [],       // {question, userAnswer, correctAnswer}
    mistakeQueue: [],    // indices to re-test
    isActive: false,
    startTime: null
  };

  /**
   * Generate quiz questions based on mode and settings
   */
  function generateQuestions(mode, scope, count) {
    const pool = getKanaPool(scope);
    if (pool.length < 4) {
      return null; // Not enough kana learned for a quiz
    }

    const shuffled = shuffleArray([...pool]);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    const questions = [];

    for (const kana of selected) {
      questions.push(createQuestion(kana, mode, pool));
    }

    return questions;
  }

  /**
   * Get available kana pool based on scope
   */
  function getKanaPool(scope) {
    const allH = window.KanaData.HIRAGANA;
    const allK = window.KanaData.KATAKANA;

    switch (scope) {
      case 'learned': {
        // Only kana that have been reviewed at least once
        const cards = window.SRS.getAllCards();
        const learnedIds = new Set();
        for (const id in cards) {
          if (cards[id].mastery >= 1) learnedIds.add(id);
        }
        return [...allH, ...allK].filter(k => learnedIds.has(k.char));
      }
      case 'hiragana':
        return [...allH];
      case 'katakana':
        return [...allK];
      case 'all':
        return [...allH, ...allK];
      default:
        return [...allH, ...allK];
    }
  }

  /**
   * Create a single question with smart distractors
   */
  function createQuestion(kana, mode, pool) {
    const sameTypePool = pool.filter(k => k.type === kana.type && k.char !== kana.char);

    switch (mode) {
      case 'kana-to-romaji':
        return {
          type: 'kana-to-romaji',
          stimulus: kana.char,
          stimulusType: 'kana',
          correctAnswer: kana.romaji,
          options: generateRomajiOptions(kana, sameTypePool),
          kanaData: kana
        };

      case 'romaji-to-kana':
        return {
          type: 'romaji-to-kana',
          stimulus: kana.romaji,
          stimulusType: 'romaji',
          correctAnswer: kana.char,
          options: generateKanaOptions(kana, sameTypePool),
          kanaData: kana
        };

      case 'listening':
        return {
          type: 'listening',
          stimulus: kana.romaji, // Will be spoken
          stimulusType: 'audio',
          correctAnswer: kana.char,
          options: generateKanaOptions(kana, sameTypePool),
          kanaData: kana
        };

      case 'kana-to-kana': {
        // Find the matching pair (hiragana <-> katakana)
        const allKana = [...window.KanaData.HIRAGANA, ...window.KanaData.KATAKANA];
        const pair = allKana.find(k =>
          k.romaji === kana.romaji && k.type !== kana.type
        );
        if (!pair) return createQuestion(kana, 'kana-to-romaji', pool);

        const pairPool = pool.filter(k => k.type === pair.type && k.char !== pair.char);
        return {
          type: 'kana-to-kana',
          stimulus: kana.char,
          stimulusType: 'kana',
          correctAnswer: pair.char,
          options: generateKanaOptions(pair, pairPool),
          kanaData: kana,
          pairData: pair
        };
      }

      default:
        return createQuestion(kana, 'kana-to-romaji', pool);
    }
  }

  /**
   * Generate romaji options with smart distractors
   */
  function generateRomajiOptions(kana, pool) {
    const correct = kana.romaji;
    const distractors = [];

    // First, try confusables
    if (kana.confusables && kana.confusables.length > 0) {
      for (const confChar of kana.confusables) {
        const confKana = pool.find(k => k.char === confChar);
        if (confKana && !distractors.includes(confKana.romaji) && confKana.romaji !== correct) {
          distractors.push(confKana.romaji);
        }
      }
    }

    // Fill remaining with same-row or random kana
    const sameRow = pool.filter(k => k.row === kana.row && k.romaji !== correct);
    for (const k of shuffleArray(sameRow)) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(k.romaji)) {
        distractors.push(k.romaji);
      }
    }

    // Fill any remaining slots with random
    const remaining = pool.filter(k => k.romaji !== correct && !distractors.includes(k.romaji));
    for (const k of shuffleArray(remaining)) {
      if (distractors.length >= 3) break;
      distractors.push(k.romaji);
    }

    return shuffleArray([correct, ...distractors.slice(0, 3)]);
  }

  /**
   * Generate kana character options with smart distractors
   */
  function generateKanaOptions(kana, pool) {
    const correct = kana.char;
    const distractors = [];

    // First, try confusables
    if (kana.confusables && kana.confusables.length > 0) {
      for (const confChar of kana.confusables) {
        if (pool.find(k => k.char === confChar) && !distractors.includes(confChar)) {
          distractors.push(confChar);
        }
      }
    }

    // Fill with same-row kana
    const sameRow = pool.filter(k => k.row === kana.row && k.char !== correct);
    for (const k of shuffleArray(sameRow)) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(k.char)) {
        distractors.push(k.char);
      }
    }

    // Fill remaining with random
    const remaining = pool.filter(k => k.char !== correct && !distractors.includes(k.char));
    for (const k of shuffleArray(remaining)) {
      if (distractors.length >= 3) break;
      distractors.push(k.char);
    }

    return shuffleArray([correct, ...distractors.slice(0, 3)]);
  }

  /**
   * Start a new quiz
   */
  function start(mode, scope, count) {
    const questions = generateQuestions(mode, scope, count);
    if (!questions || questions.length === 0) {
      return { error: '學習的假名還不夠多，至少需要學會 4 個才能開始測驗！' };
    }

    state = {
      mode: mode,
      questions: questions,
      currentIndex: 0,
      correct: 0,
      wrong: 0,
      xpEarned: 0,
      mistakes: [],
      mistakeQueue: [],
      isActive: true,
      startTime: Date.now()
    };

    return { success: true, totalQuestions: questions.length };
  }

  /**
   * Get current question
   */
  function getCurrentQuestion() {
    if (!state.isActive || state.currentIndex >= state.questions.length) {
      return null;
    }
    return {
      ...state.questions[state.currentIndex],
      index: state.currentIndex,
      total: state.questions.length,
      correct: state.correct,
      wrong: state.wrong
    };
  }

  /**
   * Submit an answer for the current question
   */
  function submitAnswer(answer) {
    const question = state.questions[state.currentIndex];
    const isCorrect = answer === question.correctAnswer;

    if (isCorrect) {
      state.correct++;
      state.xpEarned += 10;
      window.Progress.recordReview(true);

      // Update SRS if applicable
      const card = window.SRS.getCard(question.kanaData.char);
      if (card) {
        window.SRS.reviewCard(question.kanaData.char, 4); // Good
      }
    } else {
      state.wrong++;
      state.xpEarned += 2;
      window.Progress.recordReview(false);

      state.mistakes.push({
        stimulus: question.stimulus,
        userAnswer: answer,
        correctAnswer: question.correctAnswer,
        kanaData: question.kanaData
      });

      // Schedule a re-test 2-3 questions later
      const retestIndex = Math.min(
        state.currentIndex + 2 + Math.floor(Math.random() * 2),
        state.questions.length
      );
      // Insert a copy of this question
      if (retestIndex <= state.questions.length) {
        state.questions.splice(retestIndex, 0, createRetestQuestion(question));
      }

      // Update SRS
      const card = window.SRS.getCard(question.kanaData.char);
      if (card) {
        window.SRS.reviewCard(question.kanaData.char, 1); // Again
      }
    }

    return {
      isCorrect: isCorrect,
      correctAnswer: question.correctAnswer,
      mnemonic: question.kanaData.mnemonic,
      kana: question.kanaData.char,
      romaji: question.kanaData.romaji
    };
  }

  /**
   * Create a re-test question (simpler version for mistakes)
   */
  function createRetestQuestion(original) {
    return {
      ...original,
      isRetest: true
    };
  }

  /**
   * Move to next question
   */
  function next() {
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
      return finish();
    }
    return { hasNext: true };
  }

  /**
   * Finish the quiz and return results
   */
  function finish() {
    state.isActive = false;
    const total = state.correct + state.wrong;
    const accuracy = total > 0 ? state.correct / total : 0;
    const duration = Date.now() - state.startTime;

    // Save state (XP already added via recordReview during each question)
    window.Progress.save();
    window.SRS.save();

    // Check for new achievements
    const newAchievements = window.Progress.checkAchievements();

    // Determine result icon/title
    let icon, title;
    if (accuracy >= 0.9) {
      icon = '🏆';
      title = '太厲害了！';
    } else if (accuracy >= 0.7) {
      icon = '🎉';
      title = '做得好！';
    } else if (accuracy >= 0.5) {
      icon = '💪';
      title = '繼續加油！';
    } else {
      icon = '📚';
      title = '多練習幾次吧！';
    }

    return {
      hasNext: false,
      finished: true,
      results: {
        correct: state.correct,
        wrong: state.wrong,
        total: total,
        accuracy: accuracy,
        xpEarned: state.xpEarned,
        duration: duration,
        mistakes: state.mistakes,
        newAchievements: newAchievements,
        icon: icon,
        title: title
      }
    };
  }

  /**
   * Utility: shuffle array (Fisher-Yates)
   */
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Public API
  return {
    start: start,
    getCurrentQuestion: getCurrentQuestion,
    submitAnswer: submitAnswer,
    next: next,
    finish: finish,
    isActive: function() { return state.isActive; },
    getState: function() { return { ...state }; }
  };
})();
