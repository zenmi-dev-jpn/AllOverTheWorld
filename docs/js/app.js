/* ラベルメーカー (Niimbot 50x30mm) — メインロジック */
(() => {
  'use strict';

  let MM_W = 50;
  let MM_H = 30;
  const MM_TO_PX = 10; // 編集キャンバスの解像度: 1mm = 10px

  const canvas = new fabric.Canvas('labelCanvas', {
    width: MM_W * MM_TO_PX,
    height: MM_H * MM_TO_PX,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
  });

  // 「掴んでいるものが分かりにくい」への対応: 選択枠・ハンドルを大きく高コントラストにする
  // （小さいラベル面をスマホで拡大縮小して編集するため、既定のfabricスタイルでは見づらい）
  fabric.Object.prototype.set({
    borderColor: '#2563eb',
    borderScaleFactor: 2,
    cornerColor: '#2563eb',
    cornerStrokeColor: '#ffffff',
    cornerSize: 16,
    transparentCorners: false,
    cornerStyle: 'circle',
    padding: 4,
  });
  canvas.selectionColor = 'rgba(37, 99, 235, 0.08)';
  canvas.selectionBorderColor = '#2563eb';
  canvas.selectionLineWidth = 1.5;

  // 印刷時に見切れないよう、キャンバス外にはみ出す移動を軽く制限
  canvas.on('object:moving', (e) => {
    const obj = e.target;
    obj.setCoords();
  });

  function px2mm(px) { return px / MM_TO_PX; }
  function mm2px(mm) { return mm * MM_TO_PX; }

  // Canvas(2D)へのテキスト描画は、Webフォント(@font-face)の読み込み完了を自動では待ってくれない。
  // 読み込み前に描画するとフォールバック書体のまま固まってしまうため、明示的にロードしてから
  // 描き直す。document.fonts が使えないブラウザでは何もしない（フォールバック表示のまま）。
  if (document.fonts && document.fonts.load) {
    const preloads = [
      '400 16px "Noto Sans JP"', '700 16px "Noto Sans JP"',
      '400 16px "Noto Serif JP"', '700 16px "Noto Serif JP"',
      '400 16px "M PLUS Rounded 1c"', '700 16px "M PLUS Rounded 1c"',
      '400 16px "Yusei Magic"',
    ];
    Promise.all(preloads.map((f) => document.fonts.load(f).catch(() => {})))
      .then(() => canvas.requestRenderAll());
  }

  // 画面幅に合わせてキャンバスの表示サイズだけを縮小（内部の描画解像度・mm座標はそのまま）
  function fitCanvasToWrapper() {
    const wrap = document.querySelector('.canvas-wrap');
    if (!wrap) return;
    const style = getComputedStyle(wrap);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const available = wrap.clientWidth - padX;
    const nativeW = MM_W * MM_TO_PX;
    const nativeH = MM_H * MM_TO_PX;
    const scale = Math.max(0.3, Math.min(1, available / nativeW));
    canvas.setDimensions({ width: nativeW * scale, height: nativeH * scale }, { cssOnly: true });
  }
  window.addEventListener('resize', fitCanvasToWrapper);

  // ---------- 用紙の向き（横/縦） ----------

  function setOrientation(w, h) {
    if (MM_W === w && MM_H === h) return;
    const hadObjects = canvas.getObjects().length > 0;
    MM_W = w;
    MM_H = h;
    canvas.setDimensions({ width: MM_W * MM_TO_PX, height: MM_H * MM_TO_PX });
    canvas.requestRenderAll();
    fitCanvasToWrapper();

    document.querySelectorAll('.orient-btn').forEach((btn) => {
      btn.classList.toggle('active', parseFloat(btn.dataset.w) === w && parseFloat(btn.dataset.h) === h);
    });
    const hintSize = document.getElementById('hintSize');
    if (hintSize) hintSize.textContent = `${w}mm × ${h}mm`;

    if (hadObjects) {
      showToast('用紙の向きを変更しました。はみ出した部分は位置を調整してください');
    }
  }

  document.getElementById('orientToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.orient-btn');
    if (!btn) return;
    setOrientation(parseFloat(btn.dataset.w), parseFloat(btn.dataset.h));
  });

  function centerPosition(w, h) {
    return {
      left: Math.max(0, (canvas.getWidth() - w) / 2),
      top: Math.max(0, (canvas.getHeight() - h) / 2),
    };
  }

  // ---------- レイヤー一覧 ----------

  let layerIdCounter = 0;
  function assignLayerId(obj) {
    if (!obj.__layerId) obj.__layerId = 'layer' + (++layerIdCounter);
    return obj;
  }

  function objectIcon(obj) {
    switch (obj.type) {
      case 'textbox': return 'T';
      case 'rect': return '▭';
      case 'circle': return '◯';
      case 'line': return '╱';
      case 'image': return '🖼';
      default: return '?';
    }
  }

  function objectLabel(obj) {
    if (obj.type === 'textbox') {
      const t = (obj.text || '').replace(/\s+/g, ' ').trim();
      return t ? t.slice(0, 16) : '(空のテキスト)';
    }
    switch (obj.type) {
      case 'rect': return '四角形';
      case 'circle': return '円';
      case 'line': return '線';
      case 'image': return '画像';
      default: return obj.type;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function updateLayersList() {
    const list = document.getElementById('layersList');
    if (!list) return;
    const objs = canvas.getObjects();
    const activeSet = new Set(canvas.getActiveObjects());

    if (!objs.length) {
      list.innerHTML = '<p class="empty-msg">オブジェクトがありません</p>';
      return;
    }

    list.innerHTML = '';
    for (let i = objs.length - 1; i >= 0; i--) {
      const obj = objs[i];
      assignLayerId(obj);
      const row = document.createElement('div');
      row.className = 'layer-row' + (activeSet.has(obj) ? ' active' : '');
      row.innerHTML = `
        <span class="layer-icon">${escapeHtml(objectIcon(obj))}</span>
        <span class="layer-label">${escapeHtml(objectLabel(obj))}</span>
        <span class="layer-actions">
          <button type="button" data-act="up" title="前面へ">▲</button>
          <button type="button" data-act="down" title="背面へ">▼</button>
          <button type="button" data-act="del" title="削除">✕</button>
        </span>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
      });
      row.querySelector('[data-act="up"]').addEventListener('click', () => {
        canvas.bringForward(obj);
        canvas.requestRenderAll();
        updateLayersList();
        pushHistory();
      });
      row.querySelector('[data-act="down"]').addEventListener('click', () => {
        canvas.sendBackwards(obj);
        canvas.requestRenderAll();
        updateLayersList();
        pushHistory();
      });
      row.querySelector('[data-act="del"]').addEventListener('click', () => {
        canvas.remove(obj);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      });
      list.appendChild(row);
    }
  }

  // ---------- 元に戻す / やり直す ----------

  let historyStack = [];
  let historyIndex = -1;
  let suspendHistory = false;
  let historyDebounceTimer = null;

  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');

  function updateUndoRedoButtons() {
    btnUndo.disabled = historyIndex <= 0;
    btnRedo.disabled = historyIndex >= historyStack.length - 1;
  }

  function pushHistory() {
    if (suspendHistory) return;
    clearTimeout(historyDebounceTimer);
    const state = JSON.stringify(canvas.toJSON());
    if (historyStack[historyIndex] === state) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(state);
    if (historyStack.length > 60) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoButtons();
  }

  function scheduleHistoryPush() {
    if (suspendHistory) return;
    clearTimeout(historyDebounceTimer);
    historyDebounceTimer = setTimeout(pushHistory, 500);
  }

  function loadHistoryState(state) {
    suspendHistory = true;
    canvas.loadFromJSON(state, () => {
      canvas.getObjects().forEach((o) => assignLayerId(o));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      fitCanvasToWrapper();
      updatePropsPanel();
      updateLayersList();
      suspendHistory = false;
      updateUndoRedoButtons();
    });
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    loadHistoryState(historyStack[historyIndex]);
  }
  function redo() {
    if (historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    loadHistoryState(historyStack[historyIndex]);
  }

  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || isEditingText()) return;
    const key = e.key.toLowerCase();
    if (!(e.ctrlKey || e.metaKey)) return;
    if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    else if (key === 'z') { e.preventDefault(); undo(); }
    else if (key === 'y') { e.preventDefault(); redo(); }
  });

  // 書き出し直前に「未確定の編集」を確定させる。これをしないと:
  // ・テキスト編集中（特に日本語IME変換中）にそのままPDF保存すると、直前の入力が反映されないことがある
  // ・複数選択したまま保存すると、選択グループ内の一時的な相対座標のままPDFに出力され位置がずれる
  function commitPendingEdits() {
    const active = canvas.getActiveObject();
    if (active && active.isEditing && typeof active.exitEditing === 'function') {
      active.exitEditing();
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  canvas.on('object:added', () => { updateLayersList(); pushHistory(); });
  canvas.on('object:removed', () => { updateLayersList(); pushHistory(); });
  canvas.on('object:modified', () => { pushHistory(); });
  canvas.on('text:editing:exited', () => { pushHistory(); });

  // ---------- オブジェクト追加 ----------

  document.getElementById('addText').addEventListener('click', () => {
    const pos = centerPosition(150, 30);
    const obj = new fabric.Textbox('テキスト', {
      ...pos,
      width: 150,
      fontSize: 14,
      fontFamily: "'Noto Sans JP', sans-serif",
      fill: '#000000',
      lineHeight: 1.1,
      editable: true,
    });
    canvas.add(obj).setActiveObject(obj);
    canvas.requestRenderAll();
  });

  document.getElementById('addRect').addEventListener('click', () => {
    const pos = centerPosition(100, 60);
    const obj = new fabric.Rect({
      ...pos,
      width: 100,
      height: 60,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
    });
    canvas.add(obj).setActiveObject(obj);
    canvas.requestRenderAll();
  });

  document.getElementById('addCircle').addEventListener('click', () => {
    const r = 40;
    const pos = centerPosition(r * 2, r * 2);
    const obj = new fabric.Circle({
      ...pos,
      radius: r,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
    });
    canvas.add(obj).setActiveObject(obj);
    canvas.requestRenderAll();
  });

  document.getElementById('addLine').addEventListener('click', () => {
    const y = canvas.getHeight() / 2;
    const obj = new fabric.Line([50, y, canvas.getWidth() - 50, y], {
      stroke: '#000000',
      strokeWidth: 2,
    });
    canvas.add(obj).setActiveObject(obj);
    canvas.requestRenderAll();
  });

  const imageInput = document.getElementById('imageInput');
  document.getElementById('addImageBtn').addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target.result, (img) => {
        const maxW = canvas.getWidth() * 0.8;
        const maxH = canvas.getHeight() * 0.8;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        img.set({
          ...centerPosition(img.width * scale, img.height * scale),
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(img).setActiveObject(img);
        canvas.requestRenderAll();
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  });

  // ---------- 前面/背面/複製/削除 ----------

  document.getElementById('bringFront').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringToFront(obj);
    canvas.requestRenderAll();
    updateLayersList();
    pushHistory();
  });
  document.getElementById('sendBack').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendToBack(obj);
    canvas.requestRenderAll();
    updateLayersList();
    pushHistory();
  });
  document.getElementById('duplicateObj').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.clone((clone) => {
      clone.set({ left: obj.left + 10, top: obj.top + 10 });
      canvas.add(clone).setActiveObject(clone);
      canvas.requestRenderAll();
    });
  });
  document.getElementById('deleteObj').addEventListener('click', deleteSelected);

  function deleteSelected() {
    const objs = canvas.getActiveObjects();
    if (!objs.length) return;
    objs.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText()) {
      e.preventDefault();
      deleteSelected();
    }
  });

  function isEditingText() {
    const obj = canvas.getActiveObject();
    return obj && obj.isEditing;
  }

  // ---------- プロパティパネル ----------

  const propsEmpty = document.getElementById('propsEmpty');
  const textProps = document.getElementById('textProps');
  const shapeProps = document.getElementById('shapeProps');
  const commonTransform = document.getElementById('commonTransform');

  const propText = document.getElementById('propText');
  const propFont = document.getElementById('propFont');
  const propFontSize = document.getElementById('propFontSize');
  const propLineHeight = document.getElementById('propLineHeight');
  const propBold = document.getElementById('propBold');
  const propItalic = document.getElementById('propItalic');
  const propAlignL = document.getElementById('propAlignL');
  const propAlignC = document.getElementById('propAlignC');
  const propAlignR = document.getElementById('propAlignR');
  const propColor = document.getElementById('propColor');

  const propFill = document.getElementById('propFill');
  const propFillNone = document.getElementById('propFillNone');
  const propStroke = document.getElementById('propStroke');
  const propStrokeWidth = document.getElementById('propStrokeWidth');

  const propX = document.getElementById('propX');
  const propY = document.getElementById('propY');
  const propW = document.getElementById('propW');
  const propH = document.getElementById('propH');
  const propAngle = document.getElementById('propAngle');
  const propAngleReset = document.getElementById('propAngleReset');

  let syncing = false;

  const selectedLabel = document.getElementById('selectedLabel');

  canvas.on('selection:created', () => { updatePropsPanel(); updateLayersList(); });
  canvas.on('selection:updated', () => { updatePropsPanel(); updateLayersList(); });
  canvas.on('object:modified', updatePropsPanel);
  canvas.on('object:scaling', updatePropsPanel);
  canvas.on('object:moving', updatePropsPanel);
  canvas.on('selection:cleared', () => {
    propsEmpty.classList.remove('hidden');
    textProps.classList.add('hidden');
    shapeProps.classList.add('hidden');
    commonTransform.classList.add('hidden');
    selectedLabel.classList.add('hidden');
    updateLayersList();
  });

  function updatePropsPanel() {
    const obj = canvas.getActiveObject();
    if (!obj || canvas.getActiveObjects().length > 1) {
      propsEmpty.classList.toggle('hidden', !!obj);
      textProps.classList.add('hidden');
      shapeProps.classList.add('hidden');
      commonTransform.classList.toggle('hidden', !obj);
      if (obj && canvas.getActiveObjects().length > 1) {
        selectedLabel.textContent = `${canvas.getActiveObjects().length}個を選択中`;
        selectedLabel.classList.remove('hidden');
      } else {
        selectedLabel.classList.add('hidden');
      }
      return;
    }
    syncing = true;
    propsEmpty.classList.add('hidden');
    commonTransform.classList.remove('hidden');
    selectedLabel.innerHTML = `<span class="icon">${escapeHtml(objectIcon(obj))}</span><span>${escapeHtml(objectLabel(obj))}</span>`;
    selectedLabel.classList.remove('hidden');

    const isText = obj.type === 'textbox';
    const isLine = obj.type === 'line';
    const isShape = obj.type === 'rect' || obj.type === 'circle' || isLine;

    textProps.classList.toggle('hidden', !isText);
    shapeProps.classList.toggle('hidden', !isShape);

    if (isText) {
      propText.value = obj.text;
      propFont.value = obj.fontFamily;
      propFontSize.value = Math.round(obj.fontSize);
      propLineHeight.value = obj.lineHeight;
      propBold.classList.toggle('active', obj.fontWeight === 'bold');
      propItalic.classList.toggle('active', obj.fontStyle === 'italic');
      propAlignL.classList.toggle('active', obj.textAlign === 'left');
      propAlignC.classList.toggle('active', obj.textAlign === 'center');
      propAlignR.classList.toggle('active', obj.textAlign === 'right');
      propColor.value = obj.fill || '#000000';
    }

    if (isShape) {
      const fillNone = !obj.fill || obj.fill === 'transparent';
      propFillNone.checked = fillNone;
      propFill.value = fillNone ? '#000000' : obj.fill;
      propFill.disabled = fillNone || isLine;
      propStroke.value = obj.stroke || '#000000';
      propStrokeWidth.value = obj.strokeWidth || 0;
      document.getElementById('propFill').closest('label').style.display = isLine ? 'none' : '';
      document.getElementById('propFillNone').closest('.checkbox-inline').style.display = isLine ? 'none' : '';
    }

    propX.value = px2mm(obj.left).toFixed(1);
    propY.value = px2mm(obj.top).toFixed(1);
    propW.value = px2mm(obj.width * obj.scaleX).toFixed(1);
    propH.value = px2mm(obj.height * obj.scaleY).toFixed(1);
    propAngle.value = Math.round(obj.angle || 0);

    syncing = false;
  }

  function withActive(fn) {
    return (e) => {
      if (syncing) return;
      const obj = canvas.getActiveObject();
      if (!obj) return;
      fn(obj, e);
      obj.setCoords();
      canvas.requestRenderAll();
      updateLayersList();
      scheduleHistoryPush();
    };
  }

  propText.addEventListener('input', withActive((obj) => obj.set('text', propText.value)));
  propFont.addEventListener('change', withActive((obj) => obj.set('fontFamily', propFont.value)));
  propFontSize.addEventListener('input', withActive((obj) => obj.set('fontSize', parseFloat(propFontSize.value) || 1)));
  propLineHeight.addEventListener('input', withActive((obj) => obj.set('lineHeight', parseFloat(propLineHeight.value) || 1)));
  propColor.addEventListener('input', withActive((obj) => obj.set('fill', propColor.value)));

  propBold.addEventListener('click', withActive((obj) => {
    const next = obj.fontWeight === 'bold' ? 'normal' : 'bold';
    obj.set('fontWeight', next);
    propBold.classList.toggle('active', next === 'bold');
  }));
  propItalic.addEventListener('click', withActive((obj) => {
    const next = obj.fontStyle === 'italic' ? 'normal' : 'italic';
    obj.set('fontStyle', next);
    propItalic.classList.toggle('active', next === 'italic');
  }));
  propAlignL.addEventListener('click', withActive((obj) => { obj.set('textAlign', 'left'); updatePropsPanel(); }));
  propAlignC.addEventListener('click', withActive((obj) => { obj.set('textAlign', 'center'); updatePropsPanel(); }));
  propAlignR.addEventListener('click', withActive((obj) => { obj.set('textAlign', 'right'); updatePropsPanel(); }));

  propFill.addEventListener('input', withActive((obj) => obj.set('fill', propFill.value)));
  propFillNone.addEventListener('change', withActive((obj) => {
    obj.set('fill', propFillNone.checked ? 'transparent' : propFill.value);
    propFill.disabled = propFillNone.checked;
  }));
  propStroke.addEventListener('input', withActive((obj) => obj.set('stroke', propStroke.value)));
  propStrokeWidth.addEventListener('input', withActive((obj) => obj.set('strokeWidth', parseFloat(propStrokeWidth.value) || 0)));

  propX.addEventListener('input', withActive((obj) => obj.set('left', mm2px(parseFloat(propX.value) || 0))));
  propY.addEventListener('input', withActive((obj) => obj.set('top', mm2px(parseFloat(propY.value) || 0))));
  propW.addEventListener('input', withActive((obj) => {
    const mm = parseFloat(propW.value) || 1;
    obj.set('scaleX', mm2px(mm) / obj.width);
  }));
  propH.addEventListener('input', withActive((obj) => {
    const mm = parseFloat(propH.value) || 1;
    obj.set('scaleY', mm2px(mm) / obj.height);
  }));

  propAngle.addEventListener('input', withActive((obj) => obj.set('angle', parseFloat(propAngle.value) || 0)));
  propAngleReset.addEventListener('click', withActive((obj) => obj.set('angle', 0)));

  canvas.on('text:changed', () => {
    if (!syncing) propText.value = canvas.getActiveObject().text;
    updateLayersList();
    scheduleHistoryPush();
  });

  // ---------- 連続印刷（差し込み）データ ----------

  let batchRows = []; // [{col: value, ...}, ...]
  let batchHeaders = [];

  const batchDataEl = document.getElementById('batchData');
  const batchStatus = document.getElementById('batchStatus');
  const placeholderList = document.getElementById('placeholderList');
  const exportBatchBtn = document.getElementById('exportBatch');

  function parseTable(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delim).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(delim);
      const row = {};
      headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
      return row;
    });
    return { headers, rows };
  }

  document.getElementById('parseBatch').addEventListener('click', () => {
    const { headers, rows } = parseTable(batchDataEl.value);
    batchHeaders = headers;
    batchRows = rows;
    if (!rows.length) {
      batchStatus.textContent = 'データがありません';
      exportBatchBtn.disabled = true;
      placeholderList.innerHTML = '';
      return;
    }
    batchStatus.textContent = `${rows.length}件を読み込みました`;
    exportBatchBtn.disabled = false;
    placeholderList.innerHTML = '';
    headers.forEach((h) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = `{{${h}}}`;
      chip.addEventListener('click', () => insertPlaceholder(h));
      placeholderList.appendChild(chip);
    });
  });

  function insertPlaceholder(col) {
    const token = `{{${col}}}`;
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'textbox') {
      const start = propText.selectionStart ?? propText.value.length;
      const end = propText.selectionEnd ?? propText.value.length;
      const val = propText.value;
      propText.value = val.slice(0, start) + token + val.slice(end);
      propText.dispatchEvent(new Event('input'));
      propText.focus();
      propText.selectionStart = propText.selectionEnd = start + token.length;
    } else {
      showToast('先にテキストを選択してください');
    }
  }

  function applyPlaceholders(text, row) {
    if (!row) return text;
    return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, key) => (key in row ? row[key] : m));
  }

  // ---------- PDF 書き出し ----------

  // テキストは日本語グリフを含みうるため、jsPDFの標準フォント(vector text)では文字化けする。
  // Fabricでレンダリングした高解像度ラスター画像として書き出すことで、フォント埋め込みなしに
  // エディタ表示と完全に一致する見た目を保証する（サーマルラベル印刷では十分な解像度）。
  const TEXT_EXPORT_MULTIPLIER = 3; // 10px/mm(編集解像度) x 3 = 30px/mm ≈ 760dpi 相当

  // 回転したオブジェクトの4隅（ローカル座標: 中心原点、-w/2..w/2）を、
  // 変換行列で絶対キャンバス座標に変換してmmにしたもの。ベクター図形の回転描画に使う。
  function rotatedCornersMm(obj) {
    const w = obj.width;
    const h = obj.height;
    const matrix = obj.calcTransformMatrix();
    const local = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
    return local.map((p) => {
      const abs = fabric.util.transformPoint(p, matrix);
      return { x: px2mm(abs.x), y: px2mm(abs.y) };
    });
  }

  function drawObjectToPdf(doc, obj, row) {
    if (obj.type === 'textbox' || obj.type === 'image') {
      let originalText = null;
      if (obj.type === 'textbox' && row) {
        originalText = obj.text;
        obj.set('text', applyPlaceholders(originalText, row));
        obj.setCoords();
      }
      const hasContent = obj.type === 'image' || obj.text.trim().length > 0;
      if (hasContent) {
        // toDataURL は現在の angle を画像に焼き込んで出力するため、
        // 配置先も「回転後」の軸並行バウンディングボックス(getBoundingRect)に合わせる。
        const rect = obj.getBoundingRect(true, true);
        const w = px2mm(rect.width);
        const h = px2mm(rect.height);
        if (w > 0 && h > 0) {
          const x = px2mm(rect.left);
          const y = px2mm(rect.top);
          const multiplier = obj.type === 'textbox' ? TEXT_EXPORT_MULTIPLIER : 1;
          const dataUrl = obj.toDataURL({ format: 'png', multiplier });
          doc.addImage(dataUrl, 'PNG', x, y, w, h);
        }
      }
      if (originalText !== null) {
        obj.set('text', originalText);
        obj.setCoords();
      }
      return;
    }

    if (obj.type === 'rect') {
      const hasFill = obj.fill && obj.fill !== 'transparent';
      const hasStroke = obj.stroke && obj.strokeWidth > 0;
      if (!hasFill && !hasStroke) return;
      if (hasFill) doc.setFillColor(obj.fill);
      if (hasStroke) { doc.setDrawColor(obj.stroke); doc.setLineWidth(px2mm(obj.strokeWidth)); }
      const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
      const [tl, tr, br, bl] = rotatedCornersMm(obj);
      doc.lines(
        [[tr.x - tl.x, tr.y - tl.y], [br.x - tr.x, br.y - tr.y], [bl.x - br.x, bl.y - br.y]],
        tl.x, tl.y, [1, 1], style, true
      );
      return;
    }

    if (obj.type === 'circle') {
      // 円は自身の中心を軸に回転するため、中心・半径とも角度の影響を受けない
      // （scaleXとscaleYが異なる「回転した楕円」は非対応の既知の制限）。
      const x = px2mm(obj.left);
      const y = px2mm(obj.top);
      const w = px2mm(obj.width * obj.scaleX);
      const h = px2mm(obj.height * obj.scaleY);
      const hasFill = obj.fill && obj.fill !== 'transparent';
      const hasStroke = obj.stroke && obj.strokeWidth > 0;
      if (!hasFill && !hasStroke) return;
      if (hasFill) doc.setFillColor(obj.fill);
      if (hasStroke) { doc.setDrawColor(obj.stroke); doc.setLineWidth(px2mm(obj.strokeWidth)); }
      const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
      doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, style);
      return;
    }

    if (obj.type === 'line') {
      // Line の x1..y2 はローカル(中心原点)座標。calcLinePoints + 変換行列で絶対座標に直す。
      // （回転していてもこの変換だけで正しい端点が求まる）
      const lp = obj.calcLinePoints();
      const matrix = obj.calcTransformMatrix();
      const p1 = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, matrix);
      const p2 = fabric.util.transformPoint({ x: lp.x2, y: lp.y2 }, matrix);
      doc.setDrawColor(obj.stroke || '#000000');
      doc.setLineWidth(px2mm(obj.strokeWidth || 1));
      doc.line(px2mm(p1.x), px2mm(p1.y), px2mm(p2.x), px2mm(p2.y));
      return;
    }
  }

  function buildPdf(rows) {
    const { jsPDF } = window.jspdf;
    // カスタムサイズは向きが自動判定されず崩れることがあるため、現在の縦横に合わせて明示する
    const pageOrientation = MM_W >= MM_H ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: [MM_W, MM_H], orientation: pageOrientation });
    const objects = canvas.getObjects();
    const dataRows = rows && rows.length ? rows : [null];

    dataRows.forEach((row, i) => {
      if (i > 0) doc.addPage([MM_W, MM_H], pageOrientation);
      objects.forEach((obj) => drawObjectToPdf(doc, obj, row));
    });
    return doc;
  }

  async function sharePdf(doc, filename) {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        showToast('共有シートを開きました');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    doc.save(filename);
    showToast('PDFを保存しました');
  }

  document.getElementById('exportSingle').addEventListener('click', () => {
    commitPendingEdits();
    const doc = buildPdf(null);
    doc.save('label.pdf');
    showToast('PDFを保存しました');
  });

  exportBatchBtn.disabled = true;
  exportBatchBtn.addEventListener('click', () => {
    if (!batchRows.length) { showToast('先にデータを読み込んでください'); return; }
    commitPendingEdits();
    const doc = buildPdf(batchRows);
    doc.save('labels-batch.pdf');
    showToast(`${batchRows.length}件のPDFを保存しました`);
  });

  document.getElementById('btnShare').addEventListener('click', () => {
    commitPendingEdits();
    if (batchRows.length) {
      const doc = buildPdf(batchRows);
      sharePdf(doc, 'labels-batch.pdf');
    } else {
      const doc = buildPdf(null);
      sharePdf(doc, 'label.pdf');
    }
  });

  document.getElementById('btnBatchToggle').addEventListener('click', () => {
    document.getElementById('batchPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    batchDataEl.focus();
  });

  // ---------- トースト ----------

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  // 初期状態
  updatePropsPanel();
  updateLayersList();
  updateUndoRedoButtons();
  fitCanvasToWrapper();
  pushHistory(); // 元に戻す操作の起点となる初期状態を記録
})();
