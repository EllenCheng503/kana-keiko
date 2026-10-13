window.Progress = {
  data: {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    earnedAchievements: []
  },

  _getTodayStr: function() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return (new Date(now.getTime() - offset)).toISOString().split('T')[0];
  },

  addXP: function(amount) {
    this.load();
    this.data.xp += amount;
    
    let currentLevel = this.data.level;
    let nextLevelXP = Math.floor(100 * Math.pow(currentLevel, 1.5));
    let levelUp = false;
    
    while (this.data.xp >= nextLevelXP) {
      currentLevel++;
      this.data.level = currentLevel;
      levelUp = true;
      nextLevelXP = Math.floor(100 * Math.pow(currentLevel, 1.5));
    }
    
    this.save();
    return { xp: this.data.xp, levelUp: levelUp, newLevel: currentLevel };
  },

  getLevel: function() {
    this.load();
    const currentLevelXP = this.data.level > 1 ? Math.floor(100 * Math.pow(this.data.level - 1, 1.5)) : 0;
    const nextLevelXP = Math.floor(100 * Math.pow(this.data.level, 1.5));
    const xpInLevel = this.data.xp - currentLevelXP;
    const xpMax = nextLevelXP - currentLevelXP;
    return {
      level: this.data.level,
      xp: this.data.xp,
      xpInLevel: Math.max(0, xpInLevel),
      xpMax: xpMax,
      nextLevelXP: nextLevelXP,
      progressToNext: xpMax > 0 ? xpInLevel / xpMax : 0
    };
  },

  getStreak: function() {
    this.load();
    return this.data.streak;
  },

  updateStreak: function() {
    this.load();
    const today = this._getTodayStr();
    
    if (!this.data.lastActiveDate) {
      this.data.streak = 1;
      this.data.lastActiveDate = today;
    } else if (this.data.lastActiveDate !== today) {
      const last = new Date(this.data.lastActiveDate);
      const current = new Date(today);
      const diffTime = Math.abs(current - last);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        this.data.streak += 1;
      } else if (diffDays > 1) {
        this.data.streak = 1;
      }
      this.data.lastActiveDate = today;
    }
    
    this.save();
    return this.data.streak;
  },

  checkAchievements: function() {
    this.load();
    const all = this.getAllAchievements();
    const newEarned = [];
    
    const srsStats = window.SRS ? window.SRS.getStats() : { accuracy: 0, totalCards: 0, learned: 0 };
    srsStats.streak = this.data.streak;
    
    let totalRevs = 0;
    if (window.SRS) {
        Object.values(window.SRS.getAllCards()).forEach(c => totalRevs += c.totalReviews);
    }
    srsStats.totalReviews = totalRevs;

    all.forEach(ach => {
      if (!ach.earned) {
        let satisfied = false;
        try {
            satisfied = ach.condition(srsStats);
        } catch(e) {}
        
        if (satisfied) {
          this.data.earnedAchievements.push(ach.id);
          newEarned.push(ach);
        }
      }
    });
    
    if (newEarned.length > 0) {
      this.save();
    }
    
    return newEarned;
  },

  getAllAchievements: function() {
    const cards = window.SRS ? Object.values(window.SRS.getAllCards()) : [];
    const session = this.getSessionStats();
    
    const isRowMastered = (row, type) => {
        const rowCards = cards.filter(c => c.row === row && (!type || c.type === type));
        return rowCards.length > 0 && rowCards.every(c => c.mastery >= 1);
    };

    const hasHalfHiragana = () => {
        const hCards = cards.filter(c => c.type === 'hiragana');
        const hLearned = hCards.filter(c => c.mastery >= 1);
        return hCards.length > 0 && (hLearned.length >= hCards.length / 2);
    };
    
    const hasAllHiragana = () => {
        const hCards = cards.filter(c => c.type === 'hiragana');
        const hLearned = hCards.filter(c => c.mastery >= 1);
        return hCards.length > 0 && (hLearned.length === hCards.length);
    };

    const hasFirstKatakana = () => {
        const kLearned = cards.filter(c => c.type === 'katakana' && c.mastery >= 1);
        return kLearned.length > 0;
    };

    const hasAllKatakana = () => {
        const kCards = cards.filter(c => c.type === 'katakana');
        const kLearned = kCards.filter(c => c.mastery >= 1);
        return kCards.length > 0 && (kLearned.length === kCards.length);
    };

    const isKanaMaster = () => {
        const learned = cards.filter(c => c.mastery >= 1);
        return cards.length > 0 && (learned.length === cards.length);
    };

    const ACHIEVEMENTS = [
      { id: 'first_step', name: '第一步', desc: '完成第一次複習', icon: '👣', condition: stats => stats.totalReviews >= 1 },
      { id: 'vowel_master', name: '母音達人', desc: '掌握所有母音(あいうえお)', icon: '🗣️', condition: () => isRowMastered('vowel') },
      { id: 'ka_ninja', name: 'か行忍者', desc: '掌握整個か行', icon: '🥷', condition: () => isRowMastered('k') },
      { id: 'half_hiragana', name: '平假名過半', desc: '學會一半以上的平假名', icon: '📖', condition: () => hasHalfHiragana() },
      { id: 'all_hiragana', name: '平假名制霸', desc: '掌握所有平假名', icon: '🏆', condition: () => hasAllHiragana() },
      { id: 'first_katakana', name: '片假名初探', desc: '開始學習片假名', icon: '✨', condition: () => hasFirstKatakana() },
      { id: 'all_katakana', name: '片假名制霸', desc: '掌握所有片假名', icon: '👑', condition: () => hasAllKatakana() },
      { id: 'kana_master', name: '假名大師', desc: '掌握所有五十音', icon: '🎌', condition: () => isKanaMaster() },
      { id: 'streak_3', name: '三日不懈', desc: '連續學習3天', icon: '🔥', condition: stats => stats.streak >= 3 },
      { id: 'streak_7', name: '七日達人', desc: '連續學習7天', icon: '💪', condition: stats => stats.streak >= 7 },
      { id: 'streak_30', name: '月之修行者', desc: '連續學習30天', icon: '🌙', condition: stats => stats.streak >= 30 },
      { id: 'speed_demon', name: '閃電反應', desc: '一次測驗全部答對', icon: '⚡', condition: () => session.reviewCount > 0 && session.reviewCount === session.correctCount },
      { id: 'century', name: '百次複習', desc: '累計複習100次', icon: '💯', condition: stats => stats.totalReviews >= 100 },
      { id: 'accuracy_90', name: '精準射手', desc: '總正確率達到90%', icon: '🎯', condition: stats => stats.totalReviews >= 20 && stats.accuracy >= 0.9 },
    ];

    return ACHIEVEMENTS.map(a => ({
        ...a,
        earned: this.data.earnedAchievements.includes(a.id)
    }));
  },

  getSessionStats: function() {
    const today = this._getTodayStr();
    const key = 'kana-master-session-' + today;
    let stats = localStorage.getItem(key);
    
    if (stats) {
      return JSON.parse(stats);
    } else {
      return {
        date: today,
        reviewCount: 0,
        correctCount: 0,
        xpEarned: 0,
        startTime: new Date().toISOString()
      };
    }
  },

  _saveSessionStats: function(stats) {
    const key = 'kana-master-session-' + stats.date;
    localStorage.setItem(key, JSON.stringify(stats));
  },

  recordReview: function(correct) {
    let session = this.getSessionStats();
    session.reviewCount++;
    if (correct) session.correctCount++;
    
    let xpGain = correct ? 10 : 2;
    let streakBonus = Math.min(25, this.getStreak() * 5);
    xpGain += streakBonus;
    
    session.xpEarned += xpGain;
    this._saveSessionStats(session);
    
    this.updateStreak();
    const xpResult = this.addXP(xpGain);
    const achievements = this.checkAchievements();
    
    return {
      xpResult: xpResult,
      xpEarned: xpGain,
      achievements: achievements
    };
  },

  save: function() {
    localStorage.setItem('kana-master-progress', JSON.stringify(this.data));
  },

  load: function() {
    const saved = localStorage.getItem('kana-master-progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.data = { ...this.data, ...parsed };
      } catch (e) {
        console.error("Failed to load progress data", e);
      }
    }
  }
};
