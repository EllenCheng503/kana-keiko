/**
 * handwriting.js — 高解析度書道手寫畫布 ＋ 離線字形雙向覆蓋率自動辨識引擎
 */
(function () {
  'use strict';

  const RN = 64;   // 正規化比對網格大小
  const RS = 256;  // 模板渲染畫布大小
  const TPL_CACHE = {};
  const WORK_CANVAS = {};

  function getWorkCtx(key, size) {
    if (!WORK_CANVAS[key]) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      WORK_CANVAS[key] = { c, x: c.getContext('2d', { willReadFrequently: true }) };
    }
    return WORK_CANVAS[key];
  }

  function normalizeMask(srcCanvas, size) {
    const sx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const d = sx.getImageData(0, 0, size, size).data;
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (d[(y * size + x) * 4 + 3] > 38) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const pad = RN * 0.09;
    const avail = RN - pad * 2;
    const scale = Math.min(avail / bw, avail / bh);
    const dw = bw * scale;
    const dh = bh * scale;

    const n = getWorkCtx('norm', RN);
    n.x.clearRect(0, 0, RN, RN);
    n.x.drawImage(srcCanvas, minX, minY, bw, bh, (RN - dw) / 2, (RN - dh) / 2, dw, dh);
    const nd = n.x.getImageData(0, 0, RN, RN).data;
    const g = new Float32Array(RN * RN);
    for (let i = 0; i < RN * RN; i++) g[i] = nd[i * 4 + 3] / 255;
    return g;
  }

  function boxBlur(g, r) {
    const tmp = new Float32Array(RN * RN);
    const out = new Float32Array(RN * RN);
    for (let y = 0; y < RN; y++) {
      for (let x = 0; x < RN; x++) {
        let s = 0, n = 0;
        for (let i = -r; i <= r; i++) {
          const xx = x + i;
          if (xx >= 0 && xx < RN) { s += g[y * RN + xx]; n++; }
        }
        tmp[y * RN + x] = s / n;
      }
    }
    for (let x = 0; x < RN; x++) {
      for (let y = 0; y < RN; y++) {
        let s = 0, n = 0;
        for (let i = -r; i <= r; i++) {
          const yy = y + i;
          if (yy >= 0 && yy < RN) { s += tmp[yy * RN + x]; n++; }
        }
        out[y * RN + x] = s / n;
      }
    }
    let mx = 0;
    for (let i = 0; i < out.length; i++) if (out[i] > mx) mx = out[i];
    if (mx > 0) for (let i = 0; i < out.length; i++) out[i] /= mx;
    return out;
  }

  function prepareFeature(g) {
    return { g, b: boxBlur(boxBlur(g, 3), 3) };
  }

  function computeSimilarity(A, B) {
    let sa = 0, ca = 0, sb = 0, cb = 0;
    for (let i = 0; i < A.g.length; i++) {
      const a = A.g[i], b = B.g[i];
      if (a > 0.15) { ca += a; sa += a * B.b[i]; }
      if (b > 0.15) { cb += b; sb += b * A.b[i]; }
    }
    const covA = ca ? sa / ca : 0;
    const covB = cb ? sb / cb : 0;
    return (covA + covB) ? (2 * covA * covB) / (covA + covB) : 0;
  }

  function getTemplateFeature(kana) {
    if (TPL_CACHE[kana]) return TPL_CACHE[kana];
    const t = getWorkCtx('tpl', RS);
    t.x.clearRect(0, 0, RS, RS);
    t.x.fillStyle = '#000';
    const fontSize = kana.length > 1 ? RS * 0.54 : RS * 0.76;
    t.x.font = `500 ${fontSize}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    t.x.textAlign = 'center';
    t.x.textBaseline = 'middle';
    t.x.fillText(kana, RS / 2, RS / 2);
    const g = normalizeMask(t.c, RS);
    TPL_CACHE[kana] = g ? prepareFeature(g) : null;
    return TPL_CACHE[kana];
  }

  function buildUserInkFeature(strokes, width, height) {
    if (!strokes || strokes.length === 0 || width <= 0 || height <= 0) return null;
    const t = getWorkCtx('ink', RS);
    t.x.clearRect(0, 0, RS, RS);
    t.x.strokeStyle = '#000';
    t.x.fillStyle = '#000';
    t.x.lineCap = 'round';
    t.x.lineJoin = 'round';
    t.x.lineWidth = RS / 17;
    const k = RS / Math.max(width, height);

    strokes.forEach(st => {
      if (!st.length) return;
      if (st.length === 1) {
        t.x.beginPath();
        t.x.arc(st[0].x * k, st[0].y * k, RS / 34, 0, Math.PI * 2);
        t.x.fill();
        return;
      }
      t.x.beginPath();
      t.x.moveTo(st[0].x * k, st[0].y * k);
      for (let i = 1; i < st.length; i++) {
        const prev = st[i - 1];
        const cur = st[i];
        t.x.quadraticCurveTo(prev.x * k, prev.y * k, ((prev.x + cur.x) / 2) * k, ((prev.y + cur.y) / 2) * k);
      }
      t.x.lineTo(st[st.length - 1].x * k, st[st.length - 1].y * k);
      t.x.stroke();
    });

    const g = normalizeMask(t.c, RS);
    return g ? prepareFeature(g) : null;
  }

  function recognize(padInstance, targetItem) {
    const { strokes, width, height } = padInstance.getInkData();
    if (!strokes.length) return { empty: true };

    const userFeat = buildUserInkFeature(strokes, width, height);
    if (!userFeat) return { empty: true };

    const candidates = window.KanaDB.ITEMS.filter(
      it => it.script === targetItem.script && it.set === targetItem.set
    );
    const ranked = [];
    candidates.forEach(cand => {
      const tpl = getTemplateFeature(cand.kana);
      if (tpl) {
        ranked.push({ item: cand, score: computeSimilarity(userFeat, tpl) });
      }
    });
    ranked.sort((a, b) => b.score - a.score);

    const targetRankIdx = ranked.findIndex(r => r.item.id === targetItem.id);
    const mine = ranked[targetRankIdx] || { item: targetItem, score: 0 };
    const best = ranked[0];

    // 判定門檻：兼顧手寫自然變異與混淆字辨別
    const scorePct = Math.round(Math.min(99, mine.score * 122));
    const passed = (mine.score >= 0.40 && targetRankIdx <= 4) || (mine.score >= 0.33 && targetRankIdx === 0);

    return {
      empty: false,
      passed,
      score: mine.score,
      scorePct,
      rank: targetRankIdx + 1,
      best,
      top3: ranked.slice(0, 3),
      strokeCount: strokes.length,
      expectedStrokes: targetItem.strokes
    };
  }

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let strokes = [];
    let current = null;
    let targetItem = null;
    let showGhost = opts.showGhost !== false;
    let peekTimer = null;
    let logicalSize = 260;

    function resize() {
      const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
      const side = Math.max(180, Math.min(340, Math.floor(rect.width || 260)));
      logicalSize = side;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = side * dpr;
      canvas.height = side * dpr;
      canvas.style.width = side + 'px';
      canvas.style.height = side + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function isDark() {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function redraw() {
      const s = logicalSize;
      ctx.clearRect(0, 0, s, s);

      // 1. 米字/十字書道輔助格線
      ctx.save();
      ctx.strokeStyle = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(s / 2, 12); ctx.lineTo(s / 2, s - 12);
      ctx.moveTo(12, s / 2); ctx.lineTo(s - 12, s / 2);
      ctx.stroke();
      ctx.restore();

      // 2. 描紅淡色底字（若開啟描紅）
      if (showGhost && targetItem) {
        ctx.save();
        ctx.fillStyle = isDark() ? 'rgba(255,255,255,0.13)' : 'rgba(15,23,42,0.11)';
        const fontSize = targetItem.kana.length > 1 ? s * 0.48 : s * 0.68;
        const fontFamily = window.KanaEngine && window.KanaEngine.getSettings().fontStyle === 'mincho'
          ? '"Noto Serif JP", "Hiragino Mincho ProN", serif'
          : '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';
        ctx.font = `500 ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(targetItem.kana, s / 2, s / 2 + s * 0.02);
        ctx.restore();
      }

      // 3. 使用者筆跡
      const all = current ? [...strokes, current] : strokes;
      ctx.save();
      ctx.strokeStyle = isDark() ? '#F8FAFC' : '#1E293B';
      ctx.fillStyle = isDark() ? '#F8FAFC' : '#1E293B';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(6, s / 26);

      all.forEach(st => {
        if (!st || !st.length) return;
        if (st.length === 1) {
          ctx.beginPath();
          ctx.arc(st[0].x, st[0].y, Math.max(3, s / 52), 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(st[0].x, st[0].y);
        for (let i = 1; i < st.length; i++) {
          const prev = st[i - 1];
          const cur = st[i];
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
        }
        ctx.lineTo(st[st.length - 1].x, st[st.length - 1].y);
        ctx.stroke();
      });
      ctx.restore();

      if (opts.onStrokeChange) {
        opts.onStrokeChange(strokes.length, targetItem ? targetItem.strokes : null);
      }
    }

    function getPoint(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      current = [getPoint(e)];
      redraw();
    });

    canvas.addEventListener('pointermove', e => {
      if (!current) return;
      e.preventDefault();
      const pt = getPoint(e);
      const last = current[current.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1.8) {
        current.push(pt);
        redraw();
      }
    });

    function finishStroke(e) {
      if (!current) return;
      if (e) e.preventDefault();
      if (current.length > 0) strokes.push(current);
      current = null;
      redraw();
      if (opts.onStrokeEnd) opts.onStrokeEnd(strokes.length);
    }

    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);

    return {
      setTarget(item, ghostVisible) {
        targetItem = item;
        if (typeof ghostVisible === 'boolean') showGhost = ghostVisible;
        strokes = [];
        current = null;
        if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; }
        resize();
      },
      setGhost(v) {
        showGhost = !!v;
        redraw();
      },
      peekGhost(ms = 1200) {
        const prev = showGhost;
        showGhost = true;
        redraw();
        if (peekTimer) clearTimeout(peekTimer);
        peekTimer = setTimeout(() => {
          showGhost = prev;
          redraw();
        }, ms);
      },
      clear() {
        strokes = [];
        current = null;
        redraw();
      },
      undo() {
        if (!strokes.length) return;
        strokes.pop();
        redraw();
      },
      resize,
      redraw,
      getStrokeCount: () => strokes.length,
      getInkData: () => ({ strokes, width: logicalSize, height: logicalSize })
    };
  }

  window.KanaPad = {
    create,
    recognize
  };
})();
