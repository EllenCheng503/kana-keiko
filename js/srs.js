window.SRS = {
  cards: {},

  initCards: function(kanaArray) {
    this.load();
    let isChanged = false;
    
    kanaArray.forEach(k => {
      if (!this.cards[k.char]) {
        this.cards[k.char] = {
          id: k.char,
          type: k.type,
          row: k.row,
          reps: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: null,
          lastReviewed: null,
          totalReviews: 0,
          correctCount: 0,
          mastery: 0
        };
        isChanged = true;
      }
    });

    if (isChanged) {
      this.save();
    }
  },

  getCard: function(id) {
    return this.cards[id] || null;
  },

  getAllCards: function() {
    return this.cards;
  },

  reviewCard: function(id, quality) {
    const card = this.cards[id];
    if (!card) return null;

    this._calculateSM2(card, quality);

    card.totalReviews++;
    if (quality >= 3) {
      card.correctCount++;
    }

    // Set lastReviewed to current time in ISO format
    card.lastReviewed = new Date().toISOString();

    // Update mastery based on rules:
    // 0 = new (never reviewed, but since totalReviews > 0 now, it's at least 1)
    // 1 = learning (reps < 3)
    // 2 = reviewing (reps >= 3 && interval < 21)
    // 3 = mastered (reps >= 3 && interval >= 21)
    if (card.reps >= 3 && card.interval >= 21) {
      card.mastery = 3;
    } else if (card.reps >= 3 && card.interval < 21) {
      card.mastery = 2;
    } else {
      card.mastery = 1;
    }

    this.save();
    return card;
  },

  getDueCards: function() {
    const now = new Date();
    const cards = Object.values(this.cards);
    
    const due = cards.filter(c => c.dueDate && new Date(c.dueDate) <= now);
    
    // Sort: overdue first, then by easeFactor ascending
    due.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.easeFactor - b.easeFactor;
    });

    return due;
  },

  getNewCards: function(rowId) {
    return Object.values(this.cards).filter(c => c.row === rowId && c.mastery === 0);
  },

  getStats: function() {
    const cards = Object.values(this.cards);
    const totalCards = cards.length;
    let learned = 0;
    let mastered = 0;
    let reviewedToday = 0;
    
    let totalRev = 0;
    let correctCount = 0;
    
    let hiraganaTotal = 0, hiraganaLearned = 0;
    let katakanaTotal = 0, katakanaLearned = 0;

    // Use local time prefix for date matching
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const todayStr = (new Date(now.getTime() - offset)).toISOString().split('T')[0];

    cards.forEach(c => {
      if (c.mastery >= 1) learned++;
      if (c.mastery === 3) mastered++;
      
      // Check if lastReviewed matches today's date prefix
      if (c.lastReviewed) {
         const lastReviewLocal = (new Date(new Date(c.lastReviewed).getTime() - offset)).toISOString().split('T')[0];
         if (lastReviewLocal === todayStr) {
             reviewedToday++;
         }
      }

      totalRev += c.totalReviews;
      correctCount += c.correctCount;

      if (c.type === 'hiragana') {
        hiraganaTotal++;
        if (c.mastery >= 1) hiraganaLearned++;
      } else if (c.type === 'katakana') {
        katakanaTotal++;
        if (c.mastery >= 1) katakanaLearned++;
      }
    });

    const dueToday = this.getDueCards().length;
    const accuracy = totalRev > 0 ? (correctCount / totalRev) : 0;
    const hiraganaProgress = hiraganaTotal > 0 ? (hiraganaLearned / hiraganaTotal) : 0;
    const katakanaProgress = katakanaTotal > 0 ? (katakanaLearned / katakanaTotal) : 0;

    return {
      totalCards,
      learned,
      mastered,
      dueToday,
      reviewedToday,
      accuracy,
      hiraganaProgress,
      katakanaProgress
    };
  },

  isRowUnlocked: function(rowId) {
    const ROW_ORDER = ['vowel', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w'];
    const idx = ROW_ORDER.indexOf(rowId);
    
    // First row or unknown row is always unlocked
    if (idx <= 0) return true;
    
    const prevRow = ROW_ORDER[idx - 1];
    const prevRowMasteredCount = Object.values(this.cards).filter(c => c.row === prevRow && c.mastery >= 1).length;
    
    return prevRowMasteredCount >= 3;
  },

  save: function() {
    localStorage.setItem('kana-master-srs', JSON.stringify(this.cards));
  },

  load: function() {
    const data = localStorage.getItem('kana-master-srs');
    if (data) {
      try {
        this.cards = JSON.parse(data);
      } catch(e) {
        console.error("Failed to load SRS data", e);
        this.cards = {};
      }
    }
  },

  _calculateSM2: function(card, quality) {
    // SM-2 Algorithm calculation
    if (quality < 3) {
      card.reps = 0;
      card.interval = 1;
    } else {
      if (card.reps === 0) {
        card.interval = 1;
      } else if (card.reps === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      card.reps += 1;
    }

    card.easeFactor = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Calculate due date
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + card.interval);
    card.dueDate = nextDue.toISOString();
  }
};
