# 🇯🇵 假名大師 Kana Master

一款基於**學習科學**與**記憶科學**的日語五十音（平假名＋片假名）辨識與書寫學習網頁。

🆓 完全免費 · 📱 手機友善 · 🔒 離線可用 · 🧠 科學學習法

[👉 立即開始學習](https://你的GitHub帳號.github.io/kana-master/)

---

## ✨ 功能特色

### 🧠 基於學習科學
- **間隔重複系統 (SRS)** — SM-2 演算法自動排程複習，學得好的字延後，不熟的加強
- **主動回憶 (Active Recall)** — 不只被動看字，更要主動回想，強化記憶
- **四階段漸進測驗** — 多選辨識 → 聽力辨識 → 手寫練習
- **聰明干擾選項** — 測驗選項故意挑視覺相似的假名（如 さ/ち、シ/ツ）
- **錯誤即時重測** — 答錯的字 2~3 題後自動再出，加強弱項

### 📖 學習模式
- 大字體假名卡片，前後翻轉查看
- 每個假名配備**英文圖像記憶法** (Mnemonic)
- **語音朗讀** — 聽正確日語發音（Web Speech API）
- 逐行漸進解鎖，由簡入難

### ✅ 測驗模式（4 種）
| 模式 | 說明 |
|------|------|
| 假名→拼音 | 看假名，選正確羅馬拼音 |
| 拼音→假名 | 看/聽拼音，選正確假名 |
| 聽力辨識 | 聽發音，選正確假名 |
| 平↔片配對 | 平假名與片假名互相配對 |

### ✍️ 書寫練習
- 觸控友善的 Canvas 手寫板
- 筆畫計數與驗證
- 半透明參考字引導
- 清除與復原功能

### 🎮 遊戲化
- **五十音熱力圖** — 即時追蹤每個字的掌握程度
- **XP & 等級系統** — 答題累積經驗值升級
- **每日連勝** — 追蹤連續學習天數 🔥
- **成就徽章** — 14 個成就等你解鎖
- **音效回饋** — 答對/答錯即時音效

---

## 🚀 部署到 GitHub Pages

1. Fork 這個 repository
2. 到 **Settings > Pages**
3. Source 選擇 `main` branch，資料夾選 `/ (root)`
4. 點擊 **Save**
5. 幾分鐘後就能在 `https://你的帳號.github.io/kana-master/` 看到網頁

---

## 🛠 技術架構

| 項目 | 技術 |
|------|------|
| 前端 | 純 HTML5 + CSS3 + Vanilla JavaScript |
| 框架 | 無（零依賴） |
| 資料持久化 | localStorage |
| 語音 | Web Speech API |
| 書寫 | HTML5 Canvas + Touch Events |
| 音效 | Web Audio API |
| 部署 | GitHub Pages（靜態檔案） |
| 設計 | Mobile-first 響應式 |

### 檔案結構
```
kana-master/
├── index.html          # 主頁面（SPA）
├── css/
│   └── style.css       # 所有樣式（Mobile-first）
├── js/
│   ├── data.js         # 假名資料庫（92字＋記憶法）
│   ├── srs.js          # SM-2 間隔重複演算法
│   ├── progress.js     # XP、等級、連勝、成就
│   ├── quiz.js         # 四階段測驗引擎
│   ├── draw.js         # Canvas 書寫練習
│   └── app.js          # 主程式（路由、UI、音效）
└── README.md
```

---

## 📝 License

MIT License — 自由使用、修改、分享。

---

Made with ❤️ for Japanese learners 🇯🇵
