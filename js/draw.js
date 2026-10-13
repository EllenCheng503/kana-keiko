/**
 * draw.js — Canvas Drawing Pad for Kana Writing Practice
 * Supports touch and mouse input with stroke tracking
 */

window.DrawingPad = (function() {
  'use strict';

  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let currentStroke = [];
  let strokes = [];       // Array of stroke arrays
  let lastPoint = null;

  // Settings
  const LINE_WIDTH = 6;
  const LINE_COLOR = '#1A1A2E';
  const LINE_COLOR_DARK = '#E8E8E8';
  const GUIDE_COLOR = 'rgba(200, 200, 200, 0.3)';
  const GRID_COLOR = 'rgba(200, 200, 200, 0.15)';

  /**
   * Initialize the drawing pad
   */
  function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Set up high-DPI canvas
    setupHiDPI();

    // Bind events
    bindEvents();

    // Draw initial grid
    clear();
  }

  /**
   * Setup high-DPI canvas for sharp rendering
   */
  function setupHiDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }

  /**
   * Bind touch and mouse events
   */
  function bindEvents() {
    // Touch events
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleEnd, { passive: false });

    // Mouse events (for desktop testing)
    canvas.addEventListener('mousedown', handleMouseStart);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseEnd);
    canvas.addEventListener('mouseleave', handleMouseEnd);

    // Prevent scrolling on canvas
    canvas.style.touchAction = 'none';
  }

  /**
   * Get point from touch event
   */
  function getTouchPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      t: Date.now()
    };
  }

  /**
   * Get point from mouse event
   */
  function getMousePoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now()
    };
  }

  // Touch handlers
  function handleStart(e) {
    e.preventDefault();
    const point = getTouchPoint(e);
    startStroke(point);
  }

  function handleMove(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const point = getTouchPoint(e);
    continueStroke(point);
  }

  function handleEnd(e) {
    e.preventDefault();
    endStroke();
  }

  // Mouse handlers
  function handleMouseStart(e) {
    const point = getMousePoint(e);
    startStroke(point);
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;
    const point = getMousePoint(e);
    continueStroke(point);
  }

  function handleMouseEnd() {
    endStroke();
  }

  /**
   * Start a new stroke
   */
  function startStroke(point) {
    isDrawing = true;
    currentStroke = [point];
    lastPoint = point;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = isDarkMode() ? LINE_COLOR_DARK : LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /**
   * Continue drawing the current stroke
   */
  function continueStroke(point) {
    if (!isDrawing || !lastPoint) return;

    // Smooth line using quadratic bezier
    const midX = (lastPoint.x + point.x) / 2;
    const midY = (lastPoint.y + point.y) / 2;

    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    ctx.stroke();

    currentStroke.push(point);
    lastPoint = point;
  }

  /**
   * End the current stroke
   */
  function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentStroke.length > 1) {
      strokes.push([...currentStroke]);
    }

    currentStroke = [];
    lastPoint = null;
    ctx.closePath();

    // Update stroke counter in UI
    updateStrokeCounter();
  }

  /**
   * Update the stroke counter display
   */
  function updateStrokeCounter() {
    const el = document.getElementById('currentStrokes');
    if (el) {
      el.textContent = strokes.length;
    }
  }

  /**
   * Clear the canvas
   */
  function clear() {
    strokes = [];
    currentStroke = [];
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGrid();
    updateStrokeCounter();
  }

  /**
   * Undo the last stroke
   */
  function undo() {
    if (strokes.length === 0) return;
    strokes.pop();
    redraw();
    updateStrokeCounter();
  }

  /**
   * Redraw all strokes
   */
  function redraw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGrid();

    for (const stroke of strokes) {
      if (stroke.length < 2) continue;

      ctx.beginPath();
      ctx.strokeStyle = isDarkMode() ? LINE_COLOR_DARK : LINE_COLOR;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke[0].x, stroke[0].y);

      for (let i = 1; i < stroke.length; i++) {
        const prev = stroke[i - 1];
        const curr = stroke[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      ctx.stroke();
      ctx.closePath();
    }
  }

  /**
   * Draw guide grid (cross lines)
   */
  function drawGrid() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  /**
   * Show a guide/hint character on the canvas
   */
  function showGuide(char) {
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) * 0.7;

    ctx.save();
    ctx.font = `${size}px 'Noto Sans JP', sans-serif`;
    ctx.fillStyle = isDarkMode() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, rect.width / 2, rect.height / 2);
    ctx.restore();
  }

  /**
   * Get all strokes data
   */
  function getStrokes() {
    return strokes;
  }

  /**
   * Get stroke count
   */
  function getStrokeCount() {
    return strokes.length;
  }

  /**
   * Validate stroke count against expected
   */
  function validateStrokeCount(expected) {
    const tolerance = 1; // Allow +/- 1 stroke
    return Math.abs(strokes.length - expected) <= tolerance;
  }

  /**
   * Validate that strokes cover a reasonable area (not just a dot)
   */
  function validateCoverage() {
    if (strokes.length === 0) return false;

    const allPoints = strokes.flat();
    if (allPoints.length < 5) return false;

    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rect = canvas.getBoundingClientRect();
    const areaRatio = ((maxX - minX) * (maxY - minY)) / (rect.width * rect.height);

    // Character should cover at least 5% of the canvas
    return areaRatio > 0.05;
  }

  /**
   * Get a similarity score between drawn strokes and expected character
   * Simple heuristic based on stroke count and coverage
   */
  function getScore(expectedStrokeCount) {
    let score = 0;

    // Stroke count accuracy (0-50 points)
    const strokeDiff = Math.abs(strokes.length - expectedStrokeCount);
    if (strokeDiff === 0) score += 50;
    else if (strokeDiff === 1) score += 30;
    else if (strokeDiff === 2) score += 10;

    // Coverage (0-30 points)
    if (validateCoverage()) score += 30;

    // Has enough points / not just taps (0-20 points)
    const totalPoints = strokes.reduce((sum, s) => sum + s.length, 0);
    if (totalPoints > 20) score += 20;
    else if (totalPoints > 10) score += 10;

    return Math.min(100, score);
  }

  /**
   * Check if dark mode is active
   */
  function isDarkMode() {
    return document.body.classList.contains('dark-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches &&
       !document.body.classList.contains('light-theme'));
  }

  /**
   * Resize handler
   */
  function resize() {
    if (!canvas) return;
    setupHiDPI();
    redraw();
  }

  // Public API
  return {
    init: init,
    clear: clear,
    undo: undo,
    showGuide: showGuide,
    getStrokes: getStrokes,
    getStrokeCount: getStrokeCount,
    validateStrokeCount: validateStrokeCount,
    validateCoverage: validateCoverage,
    getScore: getScore,
    resize: resize,
    redraw: redraw
  };
})();
