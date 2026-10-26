(() => {
  document.getElementById('fun-solver')?.remove();
  clearInterval(window.__funTimer);
  window.__funObs?.disconnect();

  /* ===== 0. Cấu hình ===== */
  const VERSION = '14.1';
  const UNLOCK_CODE = '1712'; // nhập code này ở ô dưới cùng để mở chức năng nâng cao
  const GEMINI_KEY = '';  // dán key Gemini vào đây, hoặc nhập trong bảng điều khiển
  const GEMINI_MODEL = 'gemini-3.5-flash'; // sửa được ngay trong bảng
  const GEMINI_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash']; // sửa được trong mục Nâng cao
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  const SEL_BOX = '.box--practice__content';
  const SEL_Q = '[class*="question-text"]';
  const SEL_A = '._29Lfm';
  const SEL_DRAG = '[aria-roledescription="draggable"],[aria-describedby^="DndDescribedBy"]';
  const SEL_DROP = '[id^="des_"]';
  const INPUT = 'input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=password]), textarea, [contenteditable="true"]';
  const NEXT_BTN = 'button._3p51M';
  const NEXT_TXT = /^(câu hỏi sau|câu hỏi tiếp theo|câu hỏi tiếp|tiếp tục|tiếp theo|kiểm tra|trả lời|xác nhận|check|next|continue)$/i;
  const SUBMIT_TXT = /^(kiểm tra|trả lời|xác nhận|check)$/i;
  const MAX_TRY = 5; // mặc định, chỉnh được trong mục Nâng cao

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let solveLock = false;

  /* ===== 1. Tiện ích đọc đề ===== */
  const LB = '\uE000', RB = '\uE001'; // giữ ngoặc nhọn của TẬP HỢP (\{ và \}) khỏi bị đổi thành ngoặc tròn
  const BB = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ' };
  const tex = s => s
    .replace(/\\(?:\{|lbrace)/g, LB).replace(/\\(?:\}|rbrace)/g, RB)
    .replace(/\\begin\{(?:cases|array)\}(?:\{[^{}]*\})?/g, '[hệ: ')
    .replace(/\\end\{(?:cases|array)\}/g, ' ]')
    .replace(/\\\\/g, ' ; ')
    .replace(/\\(?:left|right|displaystyle|quad|,|;|!)/g, '')
    .replace(/\\mathbb\{([NZQR])\}/g, (_, c) => BB[c])
    .replace(/\\notin\b/g, '∉').replace(/\\in\b/g, '∈')
    .replace(/\\subseteq\b/g, '⊆').replace(/\\subset\b/g, '⊂').replace(/\\supset\b/g, '⊃')
    .replace(/\\cup\b/g, '∪').replace(/\\cap\b/g, '∩').replace(/\\(?:emptyset|varnothing)\b/g, '∅')
    .replace(/\\(?:neq|ne)\b/g, '≠').replace(/\\(?:leq|le)\b/g, '≤').replace(/\\(?:geq|ge)\b/g, '≥')
    .replace(/\\Rightarrow\b/g, '⇒').replace(/\\Leftrightarrow\b/g, '⇔').replace(/\\(?:rightarrow|to)\b/g, '→')
    .replace(/\\approx\b/g, '≈').replace(/\\pm\b/g, '±').replace(/\\pi\b/g, 'π').replace(/\\infty\b/g, '∞')
    .replace(/\\(?:cdots|ldots|dots)\b/g, '…').replace(/\\circ\b/g, '°').replace(/\\angle\b/g, '∠')
    .replace(/\\parallel\b/g, '∥').replace(/\\perp\b/g, '⊥').replace(/\\(?:mid|vert)\b/g, '|')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)').replace(/\\%/g, '%')
    .replace(/\\(?:triangle|bigtriangleup)/g, 'Δ').replace(/\\(?:sim|backsim)/g, '∽')
    .replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/\\(?:overline|text|mathrm|mathbf|widehat)\{([^{}]*)\}/g, '$1')
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/[{}]/g, m => (m === '{' ? '(' : ')'))
    .replace(new RegExp(LB, 'g'), '{').replace(new RegExp(RB, 'g'), '}');

  /* ===== 2. Giao diện (Liquid Glass + Dynamic Island) ===== */
  const h = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };

  // biểu tượng SVG nét mảnh (dựng bằng DOM, không dùng innerHTML)
  const NS = 'http://www.w3.org/2000/svg';
  const ICO = {
    eye: [['path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    eyeoff: [['path', { d: 'M3 3l18 18' }], ['path', { d: 'M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.7C3.8 8.5 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.2' }], ['path', { d: 'M9.9 9.9a3 3 0 0 0 4.2 4.2' }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M21 21l-4.3-4.3' }]],
    flask: [['path', { d: 'M9 3h6M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21.4h11.4a2 2 0 0 0 1.7-3L14 9.2V3' }], ['path', { d: 'M7.5 14h9' }]],
    play: [['path', { d: 'M8 5v14l11-7z', class: 'f' }]],
    stop: [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 2.5, class: 'f' }]],
    redo: [['path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }], ['path', { d: 'M3 3v5h5' }]],
    sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
    moon: [['path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }]],
    half: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 3a9 9 0 0 1 0 18z', class: 'f' }]],
    minus: [['path', { d: 'M5 12h14' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    lock: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2.5 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]],
    unlock: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2.5 }], ['path', { d: 'M8 11V8a4 4 0 0 1 7.6-1.7' }]],
    chev: [['path', { d: 'M9 6l6 6-6 6' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 16v-5M12 8h.01' }]],
    spark: [['path', { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' }]],
  };
  const ico = (name, size = 14) => {
    const v = document.createElementNS(NS, 'svg');
    v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('width', size); v.setAttribute('height', size); v.setAttribute('class', 'ico');
    for (const [t, a] of ICO[name]) { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); v.append(e); }
    return v;
  };
  const setIco = (el, name, size) => el.replaceChildren(ico(name, size));
  const lab = (el, name, text, size = 13) => el.replaceChildren(ico(name, size), document.createTextNode(text));

  const host = h('div', { id: 'fun-solver' });
  const root = host.attachShadow({ mode: 'open' });
  root.append(h('style', { textContent: `
    :host{all:initial}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .p,.isl{--spring:cubic-bezier(.34,1.45,.64,1);--ease:cubic-bezier(.32,.72,0,1);--oc:rgba(140,155,185,.85)}
    .ico{display:block;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
    .ico .f{fill:currentColor;stroke:none}

    /* ================= LIQUID GLASS · sáng (mặc định) ================= */
    .p{
      --txt:rgba(8,22,52,.92);--mut:rgba(34,58,102,.68);--sep:rgba(28,78,150,.12);
      --fill:rgba(255,255,255,.28);
      --btn:linear-gradient(180deg,rgba(255,255,255,.80),rgba(255,255,255,.32));
      --btn-h:linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,255,255,.56));
      --card:linear-gradient(180deg,rgba(255,255,255,.70),rgba(255,255,255,.36));
      --field:rgba(255,255,255,.62);--hair:rgba(255,255,255,.88);--hi:#fff;--log-bg:rgba(255,255,255,.50);
      --orb-base:rgba(96,160,245,.34);
      --blue:#0a74ff;--ok:#0f9d45;--warn:#a86400;--err:#d93429;--info:#0a6fd6;--off:rgba(100,130,176,.36);
      --shadow:0 42px 84px -30px rgba(8,66,170,.52),0 16px 34px -16px rgba(8,60,150,.34),0 2px 6px rgba(8,60,150,.10);
      position:fixed;right:16px;bottom:16px;width:372px;max-width:calc(100vw - 24px);max-height:calc(100vh - 28px);
      z-index:2147483647;display:flex;flex-direction:column;isolation:isolate;overflow:hidden;
      font:12.5px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Rounded","Segoe UI",system-ui,Roboto,sans-serif;
      -webkit-font-smoothing:antialiased;color:var(--txt);
      border-radius:34px;
      background:
        radial-gradient(280px 210px at 0% 0%,rgba(255,244,208,.80),transparent 70%),
        radial-gradient(320px 260px at 100% 100%,rgba(92,198,255,.48),transparent 72%),
        linear-gradient(160deg,rgba(255,255,255,.52),rgba(208,238,253,.30) 46%,rgba(150,210,250,.36)),
        rgba(200,232,252,.20);
      -webkit-backdrop-filter:blur(36px) saturate(220%) brightness(1.04);backdrop-filter:blur(36px) saturate(220%) brightness(1.04);
      box-shadow:var(--shadow),
                 inset 0 1.5px 0 rgba(255,255,255,.98),inset 0 -1.5px 0 rgba(255,255,255,.60),
                 inset 1.5px 0 0 rgba(255,255,255,.40),inset -1.5px 0 0 rgba(255,255,255,.40),
                 inset 0 0 46px rgba(255,255,255,.28);
      transition:opacity .4s var(--ease),scale .6s var(--spring),box-shadow .3s,visibility 0s;
      animation:enter .65s var(--spring) backwards}

    /* ================= LIQUID GLASS · tối ================= */
    .p[data-th=dark]{
      --txt:rgba(255,255,255,.96);--mut:rgba(212,226,255,.68);--sep:rgba(255,255,255,.10);
      --fill:rgba(255,255,255,.07);
      --btn:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.05));
      --btn-h:linear-gradient(180deg,rgba(255,255,255,.32),rgba(255,255,255,.11));
      --card:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.05));
      --field:rgba(255,255,255,.10);--hair:rgba(255,255,255,.16);--hi:rgba(255,255,255,.34);--log-bg:rgba(2,10,34,.40);
      --orb-base:rgba(255,255,255,.10);
      --blue:#4aa3ff;--ok:#38d57e;--warn:#ffd25a;--err:#ff7b71;--info:#74d4ff;--off:rgba(128,150,196,.40);
      --shadow:0 42px 84px -26px rgba(0,8,40,.78),0 14px 30px -14px rgba(0,8,40,.48),0 2px 6px rgba(0,0,0,.25);
      background:
        radial-gradient(280px 210px at 0% 0%,rgba(120,170,255,.32),transparent 70%),
        radial-gradient(320px 260px at 100% 100%,rgba(112,80,220,.30),transparent 72%),
        linear-gradient(160deg,rgba(255,255,255,.17),rgba(255,255,255,.03) 46%,rgba(255,255,255,.07)),
        rgba(12,26,62,.52);
      box-shadow:var(--shadow),
                 inset 0 1.5px 0 rgba(255,255,255,.36),inset 0 -1px 0 rgba(255,255,255,.08),
                 inset 0 0 42px rgba(255,255,255,.05)}
    .p.drag{scale:1.012;--shadow:0 58px 110px -28px rgba(6,24,80,.55),0 22px 44px -14px rgba(6,24,80,.34)}
    .p[data-s=run],.isl[data-s=run]{--oc:#30d158}
    .p[data-s=busy],.isl[data-s=busy]{--oc:#ffbd0a}
    @keyframes enter{from{opacity:0;transform:translateY(16px) scale(.94)}}

    /* viền kính: ánh sáng đi qua mép, sáng ở góc trên-trái và dưới-phải, pha chút xanh/hồng tán sắc */
    .p::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;
      background:linear-gradient(142deg,#fff,rgba(130,195,255,.40) 16%,rgba(255,255,255,.06) 36%,rgba(255,255,255,.06) 64%,rgba(255,160,220,.38) 84%,rgba(255,255,255,.9));
      -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
      mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
    .p[data-th=dark]::after{background:linear-gradient(142deg,rgba(255,255,255,.9),rgba(140,190,255,.26) 16%,rgba(255,255,255,.04) 36%,rgba(255,255,255,.04) 64%,rgba(255,150,215,.26) 84%,rgba(255,255,255,.55))}
    /* vệt phản chiếu cong phía trên + dải sáng chéo */
    .p::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
      background:radial-gradient(120% 44% at 14% -12%,rgba(255,255,255,.80),transparent 62%),
                 linear-gradient(118deg,transparent 40%,rgba(255,255,255,.20) 47%,transparent 54%)}
    .p[data-th=dark]::before{background:radial-gradient(120% 44% at 14% -12%,rgba(255,255,255,.30),transparent 62%),
                 linear-gradient(118deg,transparent 40%,rgba(255,255,255,.07) 47%,transparent 54%)}
    /* đốm sáng chạy theo con trỏ */
    .spot{position:absolute;left:0;top:0;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;pointer-events:none;z-index:5;
      background:radial-gradient(circle,rgba(255,255,255,.34),rgba(255,255,255,.07) 46%,transparent 68%);mix-blend-mode:soft-light;
      opacity:0;transition:opacity .45s;will-change:transform}

    /* thu gọn: bảng co về đảo; rê chuột vào đảo thì bung ra ngay dưới đảo */
    .p.min{opacity:0;scale:.1;pointer-events:none;visibility:hidden;transition:opacity .3s var(--ease),scale .55s var(--ease),visibility 0s .55s}
    .p.pk{top:54px;left:50%;right:auto;bottom:auto;translate:-50% 0;max-height:calc(100vh - 68px);transform:none!important;transform-origin:50% 0!important}
    .p.min.peek{opacity:1;scale:1;visibility:visible;pointer-events:auto;transition:opacity .3s var(--ease),scale .6s var(--spring),visibility 0s}

    /* ---------- đầu bảng ---------- */
    .hd{position:relative;display:flex;align-items:center;gap:9px;padding:16px 10px 11px 16px;cursor:grab;user-select:none;touch-action:none;flex:none}
    .hd:active{cursor:grabbing}
    .orb{position:relative;flex:none;width:34px;height:34px;border-radius:50%;
      background:radial-gradient(circle at 32% 22%,rgba(255,255,255,.98),rgba(255,255,255,.20) 36%,transparent 60%),
                 radial-gradient(circle at 70% 84%,var(--oc),transparent 68%),var(--orb-base,rgba(255,255,255,.1));
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),inset 0 -5px 9px rgba(255,255,255,.18),0 7px 15px -5px var(--oc);transition:box-shadow .5s}
    .orb::before{content:"";position:absolute;inset:-3px;border-radius:50%;opacity:0;transition:opacity .3s;
      background:conic-gradient(from 0deg,transparent 0 50%,var(--oc));
      -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 1.5px));
      mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 1.5px))}
    .orb::after{content:"";position:absolute;inset:0;border-radius:50%;border:1.5px solid var(--oc);opacity:0}
    .p[data-s=run] .orb::after,.isl[data-s=run] .orb::after{animation:ring 2.6s var(--ease) infinite;will-change:transform,opacity}
    .p[data-s=busy] .orb::before,.isl[data-s=busy] .orb::before{opacity:1;animation:spin .9s linear infinite;will-change:transform}
    @keyframes ring{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.55);opacity:0}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .tt{display:grid;gap:1px;min-width:0;line-height:1.2}
    .ttl{display:flex;align-items:center;font-weight:780;font-size:16px;letter-spacing:.3px;white-space:nowrap}
    .sub{font-size:10.5px;color:var(--mut);white-space:nowrap}
    .sp{flex:1}
    /* nhãn FREE / PRO */
    .bdg{display:inline-flex;align-items:center;height:17px;padding:0 7px;margin-left:7px;border-radius:99px;
      font-size:9.5px;font-weight:800;letter-spacing:.7px;color:#fff;text-shadow:0 1px 1px rgba(0,90,35,.4);
      background:linear-gradient(180deg,rgba(255,255,255,.52),rgba(255,255,255,0) 55%),linear-gradient(180deg,#4be57f,#14ab4a);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 1px rgba(255,255,255,.22),0 5px 11px -3px rgba(20,171,74,.7);
      transition:background .4s,box-shadow .4s,color .4s}
    .bdg.pro{color:#4a2b00;text-shadow:0 1px 0 rgba(255,255,255,.45);
      background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,0) 55%),linear-gradient(180deg,#ffe07a,#ffa62b);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 0 0 1px rgba(255,255,255,.3),0 5px 11px -3px rgba(255,150,20,.7)}
    .chip{flex:none;display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:560;padding:4px 10px;border-radius:99px;white-space:nowrap;
      background:var(--btn);box-shadow:inset 0 0 0 1px var(--hair),inset 0 1px 0 var(--hi)}
    .chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--oc);box-shadow:0 0 8px var(--oc);transition:background .4s}

    /* ---------- nút ---------- */
    button{white-space:nowrap;font:inherit;color:var(--txt);cursor:pointer;border:0;border-radius:99px;padding:9px 14px;font-weight:600;
      display:inline-flex;align-items:center;justify-content:center;gap:6px;
      background:var(--btn);
      box-shadow:inset 0 0 0 1px var(--hair),inset 0 1px 0 var(--hi),0 6px 14px -9px rgba(20,70,160,.45);
      transition:transform .45s var(--spring),background .2s,box-shadow .2s,color .2s}
    button:hover{background:var(--btn-h)}
    button:active{transform:scale(.95);transition-duration:.12s}
    button:focus-visible,input:focus-visible,textarea:focus-visible,.isl:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
    .ib{width:28px;height:28px;padding:0;color:var(--mut);background:transparent;box-shadow:none}
    .ib:hover{color:var(--txt);background:var(--fill);box-shadow:inset 0 0 0 1px var(--hair)}
    .go{color:#fff;font-weight:650;padding:11px 14px;font-size:13px;text-shadow:0 1px 1px rgba(0,40,120,.35);
      background:linear-gradient(180deg,rgba(255,255,255,.44),rgba(255,255,255,0) 52%),linear-gradient(180deg,#4eabff,#0a62f0);
      box-shadow:inset 0 1.5px 0 rgba(255,255,255,.85),inset 0 0 0 1px rgba(255,255,255,.22),inset 0 -6px 12px -6px rgba(0,40,170,.5),0 12px 24px -10px rgba(10,100,255,.85)}
    .go:hover{background:linear-gradient(180deg,rgba(255,255,255,.50),rgba(255,255,255,0) 52%),linear-gradient(180deg,#68b9ff,#1a70f6)}
    .go.on{background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(255,255,255,0) 52%),linear-gradient(180deg,#ff7a70,#e93a2e);text-shadow:0 1px 1px rgba(120,10,0,.35);
      box-shadow:inset 0 1.5px 0 rgba(255,255,255,.8),inset 0 0 0 1px rgba(255,255,255,.2),inset 0 -6px 12px -6px rgba(150,10,0,.45),0 12px 24px -10px rgba(255,69,58,.8)}
    .go.on:hover{background:linear-gradient(180deg,rgba(255,255,255,.48),rgba(255,255,255,0) 52%),linear-gradient(180deg,#ff8c83,#f0463b)}
    .redo{color:var(--blue);background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.05)),rgba(10,116,255,.14);
      box-shadow:inset 0 0 0 1px rgba(10,116,255,.34),inset 0 1px 0 rgba(255,255,255,.6)}
    .redo:hover{background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.1)),rgba(10,116,255,.24)}
    .acts{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .acts button{padding-left:10px;padding-right:10px}
    .tools{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .tools button{padding:6px 10px;font-size:11px;font-weight:520;color:var(--mut);background:transparent;box-shadow:none}
    .tools button:hover{color:var(--txt);background:var(--fill);box-shadow:inset 0 0 0 1px var(--hair)}

    /* ---------- thân ---------- */
    .bw{position:relative;display:grid;grid-template-rows:1fr;min-height:0;flex:1}
    .bdi{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
    .bd{padding:0 14px 14px;display:grid;gap:11px}
    .blk{display:grid;gap:6px}
    .sec{padding:0 8px;font-size:11px;font-weight:640;color:var(--mut)}

    /* ---------- thống kê: một dải kính 4 ô ---------- */
    .stats{display:grid;grid-template-columns:repeat(4,1fr);border-radius:22px;overflow:hidden;
      background:var(--card);box-shadow:inset 0 0 0 1px var(--hair),inset 0 1.5px 0 var(--hi),0 10px 22px -16px rgba(10,60,150,.35)}
    .tile{padding:10px 4px 9px 13px}
    .tile+.tile{box-shadow:inset 1px 0 0 var(--sep)}
    .tile b{display:inline-block;font-size:21px;line-height:1.1;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums;transform-origin:left center}
    .tile span{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mut);margin-top:1px;white-space:nowrap}
    .tile span::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--c);box-shadow:0 0 6px var(--c)}
    .tile.ok{--c:var(--ok)}.tile.bad{--c:var(--err)}.tile.sk{--c:var(--warn)}.tile.ai{--c:var(--info)}
    .acc{display:grid;gap:5px;padding:0 8px;font-size:10px;color:var(--mut)}
    .acc .bar{height:5px;border-radius:99px;background:rgba(110,135,175,.24);overflow:hidden;box-shadow:inset 0 1px 2px rgba(10,50,120,.16)}
    .acc.has .bar{background:rgba(255,107,98,.5)}
    .acc .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#30d158,#78e89a);box-shadow:0 0 8px rgba(48,209,88,.6);transition:width .7s var(--ease)}

    /* ---------- nhóm (thẻ kính bo tròn như bảng Inspector) ---------- */
    .grp{background:var(--card);border-radius:22px;overflow:hidden;
      box-shadow:inset 0 0 0 1px var(--hair),inset 0 1.5px 0 var(--hi),0 10px 22px -16px rgba(10,60,150,.35)}
    .row{display:flex;align-items:center;gap:10px;padding:8px 14px;min-height:40px;transition:background .25s}
    .grp>.row~.row{border-top:1px solid var(--sep)}
    .row:focus-within{background:rgba(255,255,255,.22)}
    .row .lb{flex:none;width:54px;color:var(--mut);font-size:11.5px}
    input[type=password],input[type=text]{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--txt);font:inherit;padding:4px 0;caret-color:var(--blue)}
    ::placeholder{color:var(--mut);opacity:.7}
    input[type=number]{width:84px;background:var(--field);color:var(--txt);border:0;border-radius:99px;padding:5px 12px;font:inherit;text-align:right;
      box-shadow:inset 0 0 0 1px var(--hair),inset 0 2px 4px rgba(10,50,120,.10)}
    textarea{width:100%;resize:vertical;min-height:50px;background:var(--field);color:var(--txt);border:0;border-radius:16px;padding:10px 12px;font:inherit;font-size:11.5px;caret-color:var(--blue);
      box-shadow:inset 0 0 0 1px var(--hair),inset 0 2px 4px rgba(10,50,120,.10)}
    .fld{display:block;width:100%;flex:none;background:var(--field);border-radius:99px;padding:8px 13px;font-size:11.5px;
      box-shadow:inset 0 0 0 1px var(--hair),inset 0 2px 4px rgba(10,50,120,.10)}
    .num{justify-content:space-between}
    .lbl{font-size:10.5px;color:var(--mut);padding:9px 14px 6px}
    .advi>.row,.advi>.lbl{border-top:1px solid var(--sep)}
    .advi>.lbl+.pad{padding-top:0}
    .pad{padding:0 12px 12px}

    /* công tắc: thanh trượt kính, màu xanh như bảng Liquid Glass mẫu */
    .sw{cursor:pointer;padding:6px 14px;min-height:42px}
    .sw input{display:none}
    .k{position:relative;flex:none;width:46px;height:28px;border-radius:99px;background:var(--off);
      box-shadow:inset 0 1px 3px rgba(0,30,90,.28),inset 0 0 0 .5px rgba(255,255,255,.5);transition:background .3s,box-shadow .3s}
    .k::after{content:"";position:absolute;top:2px;left:2px;width:30px;height:24px;border-radius:99px;
      background:linear-gradient(180deg,#fff,#e9eef9);
      box-shadow:0 3px 8px rgba(0,30,90,.30),0 0 0 .5px rgba(0,0,0,.06),inset 0 -2px 3px rgba(100,120,170,.20);
      transition:transform .55s var(--spring),width .28s var(--ease)}
    .sw input:checked+.k{background:linear-gradient(180deg,#58b0ff,#0a74ff);box-shadow:inset 0 1px 3px rgba(0,30,120,.35),inset 0 0 0 .5px rgba(255,255,255,.5),0 0 14px -2px rgba(10,116,255,.55)}
    .sw input:checked+.k::after{transform:translateX(12px)}
    .sw:active .k::after{width:36px}
    .sw:active input:checked+.k::after{transform:translateX(6px)}
    .t{flex:1;min-width:0;font-weight:540;font-size:12.5px;line-height:1.3}
    .t small{display:block;color:var(--mut);font-size:10px;font-weight:400;line-height:1.3;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    /* mục gập (Nâng cao / Giới thiệu) */
    .disc{width:100%;justify-content:flex-start;gap:9px;padding:12px 14px;border-radius:0;background:transparent;box-shadow:none;font-weight:580;font-size:12.5px;color:var(--txt)}
    .disc:hover{background:rgba(255,255,255,.30)}
    .disc .di{display:grid;place-items:center;color:var(--mut)}
    .disc .tag{display:inline-flex;align-items:center;height:16px;padding:0 6px;border-radius:99px;font-size:9px;font-weight:800;letter-spacing:.6px;color:#4a2b00;
      background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,0) 55%),linear-gradient(180deg,#ffe07a,#ffa62b);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 3px 8px -3px rgba(255,150,20,.6)}
    .chev{display:grid;place-items:center;color:var(--mut);transition:transform .5s var(--spring)}
    .fold.open .chev{transform:rotate(90deg)}
    .fold.locked .disc .di{color:var(--mut);opacity:.85}
    .advb{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s var(--ease)}
    .fold.open .advb{grid-template-rows:1fr}
    .advi{min-height:0;overflow:hidden}
    .fold.open>.disc{border-bottom:1px solid var(--sep)}

    /* giới thiệu */
    .abt{padding:13px 14px 14px;display:grid;gap:11px;color:var(--mut);font-size:11.5px;line-height:1.55}
    .abh{display:flex;align-items:center;gap:8px;color:var(--txt);font-weight:720;font-size:13.5px;letter-spacing:.2px}
    .abh .ico{color:var(--blue)}
    .abl{display:grid;gap:7px}
    .abi{display:flex;gap:8px;align-items:flex-start}
    .abi .ico{margin-top:3px;color:var(--blue)}
    .abn{padding:9px 11px;border-radius:14px;color:var(--txt);font-size:11px;
      background:rgba(255,189,10,.15);box-shadow:inset 0 0 0 1px rgba(255,189,10,.30)}
    .abm{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--sep);font-size:10.8px}

    /* ---------- nhật ký ---------- */
    .lh{display:flex;align-items:center;justify-content:space-between;padding:0 2px 0 8px;font-size:11px;font-weight:640;color:var(--mut)}
    .lh>div{display:flex;gap:2px}
    .lh button{padding:3px 10px;font-size:10.5px;font-weight:520;color:var(--mut);background:transparent;box-shadow:none}
    .lh button:hover{color:var(--txt);background:var(--fill);box-shadow:inset 0 0 0 1px var(--hair)}
    .log{height:124px;overflow:auto;contain:layout paint;overscroll-behavior:contain;background:var(--log-bg);border-radius:20px;padding:8px 4px;
      font:10.8px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;box-shadow:inset 0 2px 8px rgba(10,50,120,.16),inset 0 0 0 1px var(--hair);
      scrollbar-width:thin;scrollbar-color:rgba(110,135,175,.4) transparent}
    .l{display:flex;gap:7px;padding:1px 10px;animation:ln .26s var(--ease) backwards}
    .l .tm{color:var(--mut);opacity:.7;flex:none}
    .l span:last-child{flex:1;word-break:break-word}
    .l.ok{color:var(--ok)}.l.wr{color:var(--warn)}.l.er{color:var(--err)}.l.in{color:var(--info)}
    @keyframes ln{from{opacity:0;transform:translateY(4px)}}

    /* ---------- ô nhập code (dưới cùng) ---------- */
    .ft{position:relative;flex:none;padding:11px 14px 14px;border-top:1px solid var(--sep);
      background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.20))}
    .codebar{display:flex;gap:8px;align-items:center}
    .cf{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:99px;color:var(--mut);
      background:var(--field);box-shadow:inset 0 0 0 1px var(--hair),inset 0 2px 4px rgba(10,50,120,.10);transition:box-shadow .25s}
    .cf:focus-within{box-shadow:inset 0 0 0 1.5px var(--blue),0 0 0 4px rgba(10,116,255,.18)}
    .cf input:focus-visible{outline:none}
    .cf.shake{animation:shake .42s}
    @keyframes shake{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
    .unl{height:38px;padding:0 17px;color:#fff;font-weight:640;font-size:12px;text-shadow:0 1px 1px rgba(0,40,120,.35);
      background:linear-gradient(180deg,rgba(255,255,255,.44),rgba(255,255,255,0) 52%),linear-gradient(180deg,#4eabff,#0a62f0);
      box-shadow:inset 0 1.5px 0 rgba(255,255,255,.85),inset 0 0 0 1px rgba(255,255,255,.22),inset 0 -6px 12px -6px rgba(0,40,170,.5),0 10px 20px -10px rgba(10,100,255,.85)}
    .unl:hover{background:linear-gradient(180deg,rgba(255,255,255,.50),rgba(255,255,255,0) 52%),linear-gradient(180deg,#68b9ff,#1a70f6)}
    .done{display:none;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:99px;color:var(--ok);font-weight:620;font-size:12px;
      background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.08)),rgba(48,209,88,.16);box-shadow:inset 0 0 0 1px rgba(48,209,88,.38)}
    .ft.ok .codebar{display:none}
    .ft.ok .done{display:flex}

    /* ================= DYNAMIC ISLAND (kính tối) ================= */
    .isl{position:fixed;top:10px;left:50%;translate:-50% 0;z-index:2147483647;
      display:flex;align-items:center;gap:9px;height:36px;width:36px;padding:0 8px;overflow:hidden;cursor:pointer;
      border-radius:99px;color:#fff;user-select:none;isolation:isolate;
      font:11.5px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,Roboto,sans-serif;-webkit-font-smoothing:antialiased;
      background:radial-gradient(80% 140% at 50% -70%,rgba(255,255,255,.22),transparent 62%),
                 radial-gradient(60% 120% at 50% 190%,var(--oc),transparent 70%),rgba(6,10,24,.86);
      -webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),inset 0 1px 0 rgba(255,255,255,.30),0 16px 34px -12px rgba(0,0,0,.7),0 8px 24px -14px var(--oc);
      opacity:0;scale:.25;visibility:hidden;pointer-events:none;filter:blur(6px);
      transition:width .7s var(--spring),height .7s var(--spring),border-radius .5s var(--ease),scale .55s var(--spring),opacity .22s,filter .35s,box-shadow .5s,visibility 0s .5s}
    .isl.show{opacity:1;scale:1;filter:blur(0);visibility:visible;pointer-events:auto;width:262px;
      transition:width .7s var(--spring),height .7s var(--spring),border-radius .5s var(--ease),scale .6s var(--spring) .08s,opacity .25s .08s,filter .4s .08s,box-shadow .5s,visibility 0s}
    .isl.show:active{scale:.97}
    .isl.show.ping{width:min(380px,calc(100vw - 24px));height:54px;border-radius:27px}
    .isl.open,.isl.show:hover{box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),inset 0 1px 0 rgba(255,255,255,.38),0 18px 38px -12px rgba(0,0,0,.75),0 10px 28px -12px var(--oc)}
    /* vệt sáng quét ngang khi có thông báo */
    .isl::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0;
      background:linear-gradient(105deg,transparent 32%,rgba(255,255,255,.26) 50%,transparent 68%);transform:translateX(-120%)}
    .isl.flash::before{animation:sheen 1.1s var(--ease)}
    @keyframes sheen{0%{opacity:1;transform:translateX(-120%)}100%{opacity:1;transform:translateX(120%)}}
    .isl .orb{width:20px;height:20px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),0 3px 8px -3px var(--oc);transition:width .5s var(--spring),height .5s var(--spring),box-shadow .5s}
    .isl.ping .orb{width:28px;height:28px}
    .isl .orb::before{inset:-2px}
    .itxt{flex:1;min-width:0;display:grid}
    .il{white-space:nowrap;overflow:hidden;text-overflow:clip;font-weight:620;letter-spacing:-.1px}
    .isub{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.62);font-size:10.5px;
      max-height:0;opacity:0;filter:blur(4px);transform:translateY(3px);
      transition:max-height .5s var(--ease),opacity .35s,filter .4s,transform .5s var(--spring)}
    .isl.ping .isub{max-height:15px;opacity:1;filter:blur(0);transform:none;transition-delay:.12s}
    .eq{flex:none;display:flex;align-items:center;gap:2px;height:14px;width:0;opacity:0;overflow:hidden;transition:width .4s var(--ease),opacity .3s}
    .eq i{width:2.2px;height:4px;border-radius:2px;background:var(--oc)}
    .isl[data-s=run] .eq,.isl[data-s=busy] .eq{width:17px;opacity:1}
    .isl[data-s=run] .eq i,.isl[data-s=busy] .eq i{animation:eq 1.1s ease-in-out infinite}
    .eq i:nth-child(2){animation-delay:-.3s!important}.eq i:nth-child(3){animation-delay:-.6s!important}.eq i:nth-child(4){animation-delay:-.9s!important}
    .isl[data-s=busy] .eq i{animation-duration:.55s}
    @keyframes eq{0%,100%{height:3px}50%{height:13px}}
    .icw{flex:none;display:flex;gap:4px}
    .ic{font-variant-numeric:tabular-nums;font-size:10.5px;font-weight:620;padding:3px 7px;border-radius:99px}
    .ic.ok{color:#86ffa8;background:rgba(48,209,88,.16);box-shadow:inset 0 0 0 1px rgba(48,209,88,.22)}
    .ic.bad{color:#ff9a93;background:rgba(255,107,98,.16);box-shadow:inset 0 0 0 1px rgba(255,107,98,.22)}
    .isl .ib2{flex:none;width:22px;height:22px;padding:0;color:#fff;
      background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 0 0 1px rgba(255,255,255,.08)}
    .isl .ib2:hover{background:linear-gradient(180deg,rgba(255,255,255,.36),rgba(255,255,255,.14))}

    @media (prefers-reduced-motion:reduce){
      .p,.p *,.p *::before,.p *::after,.isl,.isl *,.isl *::before,.isl *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}
    }
  ` }));

  const sw = (title, sub, on = true) => {
    const input = h('input', { type: 'checkbox', checked: on });
    const el = h('label', { className: 'row sw', title: sub }, h('span', { className: 't' }, title, h('small', { textContent: sub })), input, h('span', { className: 'k' }));
    return { el, input };
  };
  const swNext = sw('Tự bấm Trả lời / Câu hỏi sau', 'Chỉ bấm khi mọi ô đã được điền thật');
  const swEnter = sw('Nhấn Enter sau khi điền', 'Dành cho ô nhập đáp số', true);
  const swDbl = sw('Check kép (khuyên bật)', 'Hỏi AI 2 lần độc lập; lệch nhau thì hỏi lần 3 để phân xử', true);
  const swFb = sw('Cho phép model dự phòng (yếu hơn)', 'Tắt = hết quota là dừng, không điền bằng model yếu', false);
  const swRaw = sw('Gửi nguyên khối đề cho AI', 'Gửi toàn bộ câu hỏi (LaTeX gốc, bảng, mọi hình) để AI tự đọc', true);
  const swSure = sw('Chỉ tự nộp khi chắc chắn', 'AI lệch 2 lần hoặc câu có hình → chỉ điền, chờ bạn xem rồi tự bấm Trả lời', true);
  const swSub = sw('Tự nộp bài', 'Tắt = chỉ điền/chọn, bạn tự bấm Trả lời', true);
  const autoNext = swNext.input, enter = swEnter.input, fb = swFb.input, sure = swSure.input, raw = swRaw.input, dbl = swDbl.input, autoSubmit = swSub.input;

  // ----- cài đặt nâng cao (mở bằng code) -----
  const delay = h('input', { type: 'number', value: 2500, min: 100, step: 100 });
  const gapIn = h('input', { type: 'number', value: 1500, min: 300, step: 100 });
  const tryIn = h('input', { type: 'number', value: MAX_TRY, min: 1, max: 20, step: 1 });
  const fbIn = h('input', { type: 'text', spellcheck: false, className: 'fld', value: GEMINI_FALLBACKS.join(', '), placeholder: 'model1, model2' });
  const note = h('textarea', { placeholder: 'VD: làm tròn đến hàng phần trăm; đáp số viết dạng phân số...' });
  const maxTry = () => Math.min(20, Math.max(1, Math.round(+tryIn.value) || MAX_TRY));
  const advGap = () => Math.max(300, +gapIn.value || 1500);
  const fbList = () => fbIn.value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  const withNote = txt => (note.value.trim() ? txt + '\n\nGhi chú của người dùng: ' + note.value.trim() : txt);

  // cấu hình Gemini
  const keys = { gemini: GEMINI_KEY }, models = { gemini: GEMINI_MODEL };
  const cfg = { provider: 'gemini' };
  const curKey = () => (keys.gemini || '').trim();
  const curModel = () => (models.gemini || '').trim();
  const keyIn = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Dán Gemini API key', value: GEMINI_KEY });
  const modelIn = h('input', { type: 'text', spellcheck: false, value: GEMINI_MODEL });
  const keyEye = h('button', { className: 'ib', title: 'Hiện / ẩn key' });
  setIco(keyEye, 'eye', 14);
  keyIn.oninput = () => { keys.gemini = keyIn.value; };
  modelIn.oninput = () => { models.gemini = modelIn.value; };

  // Dynamic Island (hiện khi thu gọn)
  const islLbl = h('span', { className: 'il', textContent: 'Đã dừng' });
  const islSub = h('span', { className: 'isub' });
  const islOk = h('span', { className: 'ic ok', textContent: '✓ 0' });
  const islBad = h('span', { className: 'ic bad', textContent: '✗ 0' });
  const islBtn = h('button', { className: 'ib2', title: 'Bắt đầu / Dừng' });
  setIco(islBtn, 'play', 9);
  const isl = h('div', { className: 'isl', role: 'button', tabIndex: 0, title: 'Mở rộng bảng điều khiển' },
    h('div', { className: 'orb' }),
    h('div', { className: 'itxt' }, islLbl, islSub),
    h('span', { className: 'eq' }, h('i'), h('i'), h('i'), h('i')),
    h('span', { className: 'icw' }, islOk, islBad), islBtn);

  // thống kê: đúng / sai (đọc từ kết quả chấm của trang), cần xem, lượt AI
  const stats = { solved: 0, right: 0, wrong: 0, skipped: 0, ai: 0 };
  const nRight = h('b', { textContent: '0' }), nWrong = h('b', { textContent: '0' }), nSkip = h('b', { textContent: '0' }), nAI = h('b', { textContent: '0' });
  const shown = { right: 0, wrong: 0, skipped: 0, ai: 0 };
  const accBar = h('i'), accTxt = h('span', { textContent: 'Chưa có câu nào được chấm' });
  const acc = h('div', { className: 'acc' }, h('div', { className: 'bar' }, accBar), accTxt);
  const bump = el => el.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 440, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  const setStats = () => {
    for (const [k, el] of [['right', nRight], ['wrong', nWrong], ['skipped', nSkip], ['ai', nAI]])
      if (stats[k] !== shown[k]) { shown[k] = stats[k]; el.textContent = stats[k]; bump(el); }
    const tot = stats.right + stats.wrong, pct = tot ? Math.round(stats.right / tot * 100) : 0;
    acc.classList.toggle('has', tot > 0);
    accBar.style.width = (tot ? pct : 0) + '%';
    accTxt.textContent = tot ? `${pct}% chính xác · ${tot} câu đã chấm` : 'Chưa có câu nào được chấm';
    islOk.textContent = '✓ ' + stats.right; islBad.textContent = '✗ ' + stats.wrong;
  };
  const tile = (cls, n, label) => h('div', { className: 'tile ' + cls }, n, h('span', { textContent: label }));

  const chip = h('span', { className: 'chip', textContent: 'Đã dừng' });
  const bTheme = h('button', { className: 'ib', title: 'Giao diện: tự động theo nền trang' });
  const bMin = h('button', { className: 'ib', title: 'Thu gọn' });
  const close = h('button', { className: 'ib', title: 'Đóng' });
  setIco(bTheme, 'half', 14); setIco(bMin, 'minus', 14); setIco(close, 'x', 14);
  const badge = h('span', { className: 'bdg', textContent: 'FREE', title: 'Bản miễn phí' });
  const hd = h('div', { className: 'hd' },
    h('div', { className: 'orb' }),
    h('div', { className: 'tt' }, h('span', { className: 'ttl' }, 'VIOEDU', badge), h('span', { className: 'sub', textContent: 'by nhanvo' })),
    h('span', { className: 'sp' }), chip, bTheme, bMin, close);

  const bRun = h('button', { className: 'go' });
  const bRedo = h('button', { className: 'redo', title: 'Xoá kết quả cũ của câu đang hiển thị và gửi lại cho AI giải lại' });
  const bScan = h('button', { title: 'Đếm câu hỏi, đáp án, ô nhập, ô chọn, mảnh kéo trên trang' });
  const bDbg = h('button', { title: 'In cấu trúc câu hiện tại (gửi lại khi script không giải được)' });
  lab(bRun, 'play', 'Bắt đầu'); lab(bRedo, 'redo', 'Giải lại câu này'); lab(bScan, 'search', 'Quét trang', 12); lab(bDbg, 'flask', 'Dò cấu trúc', 12);
  const bClear = h('button', { title: 'Xoá nhật ký', textContent: 'Xoá' });
  const bCopy = h('button', { title: 'Sao chép nhật ký', textContent: 'Sao chép' });
  const log = h('div', { className: 'log' });

  // Nâng cao: khoá cho tới khi nhập đúng code
  const advLock = h('span', { className: 'di' }, ico('lock', 14));
  const advBtn = h('button', { className: 'disc', title: 'Nhập code ở ô dưới cùng để mở' }, advLock, h('span', { textContent: 'Nâng cao' }), h('span', { className: 'tag', textContent: 'PRO' }), h('span', { className: 'sp' }), h('span', { className: 'chev' }, ico('chev', 14)));
  const adv = h('div', { className: 'fold grp locked' }, advBtn,
    h('div', { className: 'advb' }, h('div', { className: 'advi' },
      swEnter.el,
      h('label', { className: 'row num' }, h('span', { textContent: 'Chu kỳ quét (ms)' }), delay),
      h('label', { className: 'row num' }, h('span', { textContent: 'Chờ trước khi sang câu (ms)' }), gapIn),
      h('label', { className: 'row num' }, h('span', { textContent: 'Số lần thử tối đa mỗi câu' }), tryIn),
      h('div', { className: 'lbl', textContent: 'Model dự phòng (cách nhau bằng dấu phẩy)' }),
      h('div', { className: 'pad' }, fbIn),
      h('div', { className: 'lbl', textContent: 'Ghi chú thêm cho AI (gửi kèm mọi câu)' }),
      h('div', { className: 'pad' }, note))));

  // Giới thiệu
  const feat = t => h('div', { className: 'abi' }, ico('check', 12), h('span', { textContent: t }));
  const aboutBtn = h('button', { className: 'disc' }, h('span', { className: 'di' }, ico('info', 14)), h('span', { textContent: 'Giới thiệu' }), h('span', { className: 'sp' }), h('span', { className: 'chev' }, ico('chev', 14)));
  const about = h('div', { className: 'fold grp' }, aboutBtn,
    h('div', { className: 'advb' }, h('div', { className: 'advi' }, h('div', { className: 'abt' },
      h('div', { className: 'abh' }, ico('spark', 15), 'VIOEDU'),
      h('div', { textContent: 'Trợ lý làm bài tự động: đọc đề ngay trên trang, nhờ Gemini giải, rồi tự điền hoặc chọn đáp án và chuyển sang câu tiếp theo.' }),
      h('div', { className: 'abl' },
        feat('Hỗ trợ trắc nghiệm, điền ô, kéo thả và ô chọn thả xuống'),
        feat('Gửi nguyên khối đề (LaTeX, bảng, hình) để AI đọc đủ dữ kiện'),
        feat('Check kép: hỏi AI 2 lần, lệch nhau thì hỏi lần 3'),
        feat('Chỉ tự nộp khi chắc chắn, câu còn nghi ngờ để bạn kiểm tra'),
        feat('Thống kê đúng/sai theo kết quả chấm của trang')),
      h('div', { className: 'abn', textContent: 'AI vẫn có thể sai. Hãy xem lại những câu quan trọng trước khi nộp.' }),
      h('div', { className: 'abm' }, h('span', { textContent: 'Bản FREE: đầy đủ phần giải bài' }), h('span', { textContent: 'Nhập code ở dưới cùng để mở Nâng cao' })),
      h('div', { className: 'abm' }, h('span', { textContent: 'Tác giả: nhanvo' }), h('span', { textContent: 'Phiên bản ' + VERSION }))))));
  aboutBtn.onclick = () => about.classList.toggle('open');

  // ô nhập code (dưới cùng)
  const codeIn = h('input', { type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'Nhập code để mở Nâng cao' });
  const codeField = h('label', { className: 'cf' }, ico('lock', 14), codeIn);
  const bUnlock = h('button', { className: 'unl', textContent: 'Mở khoá' });
  const ft = h('div', { className: 'ft' },
    h('div', { className: 'codebar' }, codeField, bUnlock),
    h('div', { className: 'done' }, ico('check', 14), h('span', { textContent: 'Đã mở khoá chức năng nâng cao' })));

  const spot = h('div', { className: 'spot' });
  const panel = h('div', { className: 'p' }, spot, hd,
    h('div', { className: 'bw' }, h('div', { className: 'bdi' }, h('div', { className: 'bd' },
      h('div', { className: 'stats' }, tile('ok', nRight, 'Đúng'), tile('bad', nWrong, 'Sai'), tile('sk', nSkip, 'Cần xem'), tile('ai', nAI, 'Lượt AI')),
      acc,
      h('div', { className: 'blk' }, h('div', { className: 'sec', textContent: 'Kết nối Gemini' }),
        h('div', { className: 'grp' },
          h('div', { className: 'row' }, h('span', { className: 'lb', textContent: 'API key' }), keyIn, keyEye),
          h('div', { className: 'row' }, h('span', { className: 'lb', textContent: 'Model' }), modelIn))),
      h('div', { className: 'acts' }, bRun, bRedo),
      h('div', { className: 'tools' }, bScan, bDbg),
      h('div', { className: 'blk' }, h('div', { className: 'sec', textContent: 'Chế độ giải' }),
        h('div', { className: 'grp' }, swRaw.el, swDbl.el, swSure.el, swSub.el, swNext.el, swFb.el)),
      adv,
      about,
      h('div', { className: 'blk' },
        h('div', { className: 'lh' }, h('span', { textContent: 'Nhật ký' }), h('div', {}, bCopy, bClear)),
        log)))),
    ft);
  root.append(panel, isl);
  document.body.append(host);

  // đốm sáng kính chạy theo con trỏ
  let spotRaf = 0, spx = 0, spy = 0;
  panel.addEventListener('pointermove', e => {
    const r = panel.getBoundingClientRect();
    spx = e.clientX - r.left; spy = e.clientY - r.top;
    spot.style.opacity = 1;
    if (!spotRaf) spotRaf = requestAnimationFrame(() => { spotRaf = 0; spot.style.transform = `translate3d(${spx}px,${spy}px,0)`; });
  });
  panel.addEventListener('pointerleave', () => { spot.style.opacity = 0; });

  // giao diện sáng/tối: tự động theo màu nền của trang, hoặc chọn tay
  let thMode = 'auto';
  const pageIsLight = () => {
    for (const el of [document.body, document.documentElement]) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 > 0.6;
    }
    return true;
  };
  const applyTheme = () => {
    panel.dataset.th = thMode === 'auto' ? (pageIsLight() ? 'light' : 'dark') : thMode;
    setIco(bTheme, { auto: 'half', light: 'sun', dark: 'moon' }[thMode], 14);
    bTheme.title = { auto: 'Giao diện: tự động theo nền trang', light: 'Giao diện: kính sáng', dark: 'Giao diện: kính tối' }[thMode];
  };
  bTheme.onclick = () => { thMode = { auto: 'light', light: 'dark', dark: 'auto' }[thMode]; applyTheme(); };
  applyTheme();

  const setStatus = st => {
    panel.dataset.s = st; isl.dataset.s = st;
    chip.textContent = { stop: 'Đã dừng', run: 'Đang chạy', busy: 'AI đang giải…' }[st];
    islLbl.textContent = chip.textContent;
    setIco(islBtn, st === 'stop' ? 'play' : 'stop', 9);
    lab(bRun, st === 'stop' ? 'play' : 'stop', st === 'stop' ? 'Bắt đầu' : 'Dừng');
    bRun.classList.toggle('on', st !== 'stop');
  };
  setStatus('stop');

  // đảo động "báo tin" khi đang thu gọn: nở ra vài giây rồi co lại
  let pingT = 0;
  const ping = t => {
    if (!panel.classList.contains('min')) return;
    islSub.textContent = t;
    isl.classList.remove('flash'); void isl.offsetWidth; isl.classList.add('flash');
    isl.classList.add('ping');
    clearTimeout(pingT);
    pingT = setTimeout(() => { isl.classList.remove('ping'); }, 3400);
  };

  const say = t => {
    const cls = /^✅/.test(t) ? 'ok' : /^(⚠|🚫|❓)/.test(t) ? 'er' : /^(⏳|ℹ|↻|⏸)/.test(t) ? 'wr' : /^(⏭|▶|⏹|🔍|📦|📋|✔|🔁|🔓|🔒)/.test(t) ? 'in' : '';
    const tm = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const row = h('div', { className: 'l ' + cls }, h('span', { className: 'tm', textContent: tm }), h('span', { textContent: t }));
    row.dataset.t = tm + ' ' + t;
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 24; // chỉ tự cuộn khi đang ở cuối
    log.append(row);
    while (log.childElementCount > 300) log.firstElementChild.remove();
    if (stick) log.scrollTop = log.scrollHeight;
    if (/^(✅|⚠|🚫|❓|⏸)/.test(t)) ping(t.slice(0, 80));
  };

  // ----- mở khoá chức năng nâng cao bằng code -----
  let unlocked = false;
  const LS_KEY = 'vioedu_pro';
  const lsGet = () => { try { return localStorage.getItem(LS_KEY); } catch { return null; } };
  const lsSet = () => { try { localStorage.setItem(LS_KEY, '1'); } catch { /* trình duyệt chặn lưu thì bỏ qua */ } };
  const shake = () => { codeField.classList.remove('shake'); void codeField.offsetWidth; codeField.classList.add('shake'); };
  const unlock = quiet => {
    unlocked = true;
    adv.classList.remove('locked'); ft.classList.add('ok');
    badge.textContent = 'PRO'; badge.classList.add('pro'); badge.title = 'Đã mở khoá chức năng nâng cao';
    advLock.replaceChildren(ico('unlock', 14));
    advBtn.title = 'Cài đặt nâng cao';
    if (!quiet) {
      lsSet();
      adv.classList.add('open');
      setTimeout(() => adv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 160);
      say('🔓 Đã mở khoá chức năng nâng cao (mục "Nâng cao" phía trên)');
    }
  };
  const submitCode = () => {
    const v = codeIn.value.trim();
    if (!v) { codeIn.focus(); return; }
    if (v === UNLOCK_CODE) { codeIn.value = ''; unlock(false); return; }
    shake(); codeIn.select(); say('⚠ Code không đúng');
  };
  bUnlock.onclick = submitCode;
  codeIn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submitCode(); } };
  advBtn.onclick = () => {
    if (!unlocked) { say('🔒 Chức năng nâng cao đang khoá - nhập code ở ô dưới cùng để mở'); codeIn.focus(); shake(); return; }
    adv.classList.toggle('open');
  };

  // thu gọn = bảng co về đảo động giữa-trên màn hình; bấm đảo = bung lại; rê chuột vào đảo = xem nhanh bảng ngay dưới đảo
  let peekT = 0, pkT = 0;
  const minUI = (plus, title) => { setIco(bMin, plus ? 'plus' : 'minus', 14); bMin.title = title; };
  const setPeekUI = on => { const m = panel.classList.contains('min'); minUI(on || m, on ? 'Ghim / Mở rộng' : (m ? 'Mở rộng' : 'Thu gọn')); };
  bMin.onclick = () => {
    const m = !panel.classList.contains('min');
    clearTimeout(peekT); clearTimeout(pkT);
    if (m) {
      const r = panel.getBoundingClientRect();
      panel.style.transformOrigin = `${innerWidth / 2 - (r.left - tx)}px ${26 - (r.top - ty)}px`;
      pkT = setTimeout(() => { if (panel.classList.contains('min')) panel.classList.add('pk'); }, 620);
    } else { clearTimeout(pingT); isl.classList.remove('ping'); panel.classList.remove('peek', 'pk'); isl.classList.remove('open'); }
    panel.classList.toggle('min', m);
    isl.classList.toggle('show', m);
    minUI(m, m ? 'Mở rộng' : 'Thu gọn');
  };
  const peekOn = () => {
    if (!panel.classList.contains('min')) return;
    clearTimeout(peekT); clearTimeout(pkT);
    panel.classList.add('pk'); isl.classList.add('open');
    requestAnimationFrame(() => { if (panel.classList.contains('min') && isl.classList.contains('open')) { panel.classList.add('peek'); setPeekUI(true); } });
  };
  const peekOff = () => {
    clearTimeout(peekT);
    peekT = setTimeout(() => {
      if (!panel.classList.contains('peek')) { isl.classList.remove('open'); return; }
      if (panel.matches(':hover') || isl.matches(':hover') || (root.activeElement && panel.contains(root.activeElement))) return;
      panel.classList.remove('peek'); isl.classList.remove('open'); setPeekUI(false);
    }, 320);
  };
  isl.addEventListener('pointerenter', peekOn);
  isl.addEventListener('pointerleave', peekOff);
  panel.addEventListener('pointerenter', () => { if (panel.classList.contains('peek')) clearTimeout(peekT); });
  panel.addEventListener('pointerleave', () => { if (panel.classList.contains('peek')) peekOff(); });
  panel.addEventListener('focusout', () => { if (panel.classList.contains('peek')) peekOff(); });
  isl.onclick = () => bMin.onclick();
  isl.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bMin.onclick(); } };
  islBtn.onclick = e => { e.stopPropagation(); bRun.onclick(); };
  hd.ondblclick = e => { if (!e.target.closest('button')) bMin.onclick(); };
  keyEye.onclick = () => { const show = keyIn.type === 'password'; keyIn.type = show ? 'text' : 'password'; setIco(keyEye, show ? 'eyeoff' : 'eye', 14); };
  bClear.onclick = () => { log.textContent = ''; };
  bCopy.onclick = async () => {
    const t = [...log.querySelectorAll('.l')].map(l => l.dataset.t).join('\n');
    try { await navigator.clipboard.writeText(t); say('📋 Đã sao chép nhật ký'); } catch { say('⚠ Trình duyệt chặn sao chép - bôi đen nhật ký rồi Ctrl+C'); }
  };

  // kéo bảng: dùng transform + rAF (không gây layout), có hiệu ứng nhấc lên khi kéo
  let tx = 0, ty = 0;
  hd.onpointerdown = e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = tx, oy = ty;
    let raf = 0;
    hd.setPointerCapture(e.pointerId);
    panel.classList.add('drag');
    const apply = () => { raf = 0; panel.style.transform = `translate3d(${tx}px,${ty}px,0)`; };
    hd.onpointermove = ev => {
      const dx = Math.max(-r.left - r.width + 90, Math.min(innerWidth - 90 - r.left, ev.clientX - sx));
      const dy = Math.max(-r.top, Math.min(innerHeight - 50 - r.top, ev.clientY - sy));
      tx = ox + dx; ty = oy + dy;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const end = () => { hd.onpointermove = hd.onpointerup = hd.onpointercancel = null; panel.classList.remove('drag'); };
    hd.onpointerup = hd.onpointercancel = end;
    e.preventDefault();
  };

  /* ===== 3. Đọc chữ (KaTeX + MathJax v2/v3, đánh dấu ô nhập) ===== */
  const MJ_RENDER = '.MathJax_Preview,.MathJax,.MathJax_SVG,.MathJax_CHTML,.MathJax_Display,.MathJax_SVG_Display,.MathJax_CHTML_Display,.MJX_Assistive_MathML,mjx-container';
  const textOf = el => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.Select').forEach((x, i) => x.replaceWith(` [Ô chọn ${i + 1}] `));
    c.querySelectorAll(SEL_DROP).forEach((x, i) => x.replaceWith(` [Ô kéo ${i + 1}] `));
    c.querySelectorAll(SEL_DRAG).forEach(x => x.remove());
    c.querySelectorAll(INPUT).forEach((x, i) => x.replaceWith(` [Ô ${i + 1}] `));
    const scripts = c.querySelectorAll('script[type^="math/tex"]');
    if (scripts.length) {
      c.querySelectorAll(MJ_RENDER).forEach(k => k.remove());
      scripts.forEach(s => s.replaceWith(' ' + s.textContent + ' '));
    }
    c.querySelectorAll('mjx-container').forEach(k => {
      const a = k.querySelector('mjx-assistive-mml');
      k.replaceWith(' ' + (a ? a.textContent : (k.getAttribute('aria-label') || k.textContent)) + ' ');
    });
    c.querySelectorAll('.katex').forEach(k => {
      const a = k.querySelector('annotation[encoding="application/x-tex"]');
      k.replaceWith(' ' + (a ? a.textContent : k.textContent) + ' ');
    });
    c.querySelectorAll('.MathJax_Preview,.MJX_Assistive_MathML').forEach(k => k.remove());
    return tex(c.textContent.normalize('NFC')).replace(/\$/g, '').replace(/\s+/g, ' ').trim();
  };

  const questionEls = () => {
    const all = [...document.querySelectorAll(SEL_Q)].filter(e => !e.closest(SEL_A));
    const stems = all.filter(s => !all.some(o => o !== s && o.contains(s)));
    const extra = [...document.querySelectorAll(SEL_BOX)].filter(b => !stems.some(s => b.contains(s)));
    return [...stems, ...extra];
  };
  const answerEls = scope => {
    const a = [...scope.querySelectorAll(SEL_A)]
      .filter((e, _, arr) => !arr.some(o => o !== e && e.contains(o)));
    if (a.length) return a;
    const set = new Set();
    scope.querySelectorAll('input[type=checkbox],input[type=radio],[role=checkbox],[role=radio]').forEach(c =>
      set.add(c.closest('label,li') || (c.matches('input') ? c.parentElement : c)));
    return [...set];
  };
  const inputsOf = box => [...box.querySelectorAll(INPUT)].filter(i => !i.disabled && !i.readOnly && !i.closest('.Select'));

  // ----- kéo thả -----
  const slotsOf = scope => [...scope.querySelectorAll(SEL_DROP)].filter((e, _, a) => !a.some(o => o !== e && o.contains(e)));
  const dragsOf = scope => [...scope.querySelectorAll(SEL_DRAG)].filter((e, _, a) => !a.some(o => o !== e && o.contains(e)));
  const freeItems = scope => { const sl = slotsOf(scope); return dragsOf(scope).filter(d => !sl.some(s => s.contains(d))); };
  const labelOf = el => textOf(el) || el.querySelector('img')?.getAttribute('src') || '';
  const dndScope = box => {
    let s = box;
    for (let i = 0; i < 6 && s; i++, s = s.parentElement) {
      if (s.querySelector(SEL_DROP) && s.querySelector(SEL_DRAG)) return s;
      if (s === document.body) break;
    }
    return box;
  };

  const isMulti = (stem, opts, box) =>
    opts.some(o => o.matches('input[type=checkbox],[role=checkbox]') || o.querySelector('input[type=checkbox],[role=checkbox]')) ||
    /chọn\s+(?:các|những|nhiều|tất cả)|nhiều đáp án|một hoặc nhiều/i.test(textOf(box || stem)) ||
    /các (?:khẳng định|phát biểu|mệnh đề)/i.test(textOf(stem));
  const isCheckbox = o => o.matches('input[type=checkbox],[role=checkbox]') || !!o.querySelector('input[type=checkbox],[role=checkbox]');

  /* ===== 4. Điền ô / bấm đáp án (có kiểm chứng) ===== */
  const setVal = (el, v) => {
    if (el.isContentEditable) {
      el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, String(v));
      return;
    }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const tap = el => {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(t => el.dispatchEvent(new MouseEvent(t, { bubbles: true })));
    el.click();
  };

  const selState = el => {
    const inp = el.matches('input[type=checkbox],input[type=radio]') ? el : el.querySelector('input[type=checkbox],input[type=radio]');
    if (inp) return inp.checked;
    const aria = el.matches('[aria-checked]') ? el : el.querySelector('[aria-checked]');
    return aria ? aria.getAttribute('aria-checked') === 'true' : null;
  };
  const CLS_SEL = /(?:^|[\s_-])(?:selected|checked|chosen)(?:$|[\s_-])/i;
  const picked = el => {
    const s = selState(el);
    if (s !== null) return s;
    return [el, ...el.querySelectorAll('*')].some(x => CLS_SEL.test(typeof x.className === 'string' ? x.className : '')) ? true : null;
  };

  // bấm một đáp án và KIỂM TRA nó có thật sự được chọn (hoặc DOM có đổi) không
  const tapVerify = async (el, box) => {
    if (selState(el) === true) return true;
    const snap = box.innerHTML;
    const ok = () => selState(el) === true || picked(el) === true || box.innerHTML !== snap;
    tap(el); await sleep(250);
    if (ok()) return true;
    const inner = el.querySelector('input,label,[role=checkbox],[role=radio]');
    if (inner) { inner.click(); await sleep(250); }
    return ok();
  };
  const tapIdx = async (box, idx, fallback = []) => {
    let n = 0;
    for (let j = 0; j < idx.length; j++) {
      const el = answerEls(box)[idx[j]] || fallback[idx[j]];
      if (el && await tapVerify(el, box)) n++;
      if (j < idx.length - 1) await sleep(250);
    }
    return n;
  };

  const fillInput = (inp, v, enterToo = true) => {
    inp.focus(); setVal(inp, String(v));
    inp.dispatchEvent(new KeyboardEvent('keyup', { key: String(v).slice(-1), bubbles: true }));
    if (enterToo && enter.checked) ['keydown', 'keypress', 'keyup'].forEach(t =>
      inp.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
  };
  const fillAll = async (box, vals) => {
    let n = 0;
    for (let i = 0; i < vals.length; i++) {
      const cur = inputsOf(box)[i];
      if (!cur) break;
      const v = String(vals[i] ?? '').replace(/\$/g, '').trim();
      if (!v) continue;
      fillInput(cur, v, i === vals.length - 1);
      await sleep(150);
      const now = inputsOf(box)[i];
      if (!now || String(now.isContentEditable ? now.textContent : now.value).trim()) n++;
    }
    return n;
  };

  // giả lập kéo thả (dnd-kit)
  const ctr = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const ptr = (target, type, p, buttons) => {
    const init = { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: p.x, clientY: p.y, screenX: p.x, screenY: p.y, button: 0, buttons };
    target.dispatchEvent(new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: buttons ? 0.5 : 0 }));
    target.dispatchEvent(new MouseEvent(type.replace('pointer', 'mouse'), init));
  };
  const dragDrop = async (item, slot, scope) => {
    item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    slot.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await sleep(150);
    const a = ctr(item.getBoundingClientRect()), b = ctr(slot.getBoundingClientRect());
    if (Math.abs(a.y - b.y) < innerHeight * 0.5) { window.scrollBy(0, (a.y + b.y) / 2 - innerHeight / 2); await sleep(250); }
    const from = ctr(item.getBoundingClientRect()), to = ctr(slot.getBoundingClientRect());
    const snap = slot.innerHTML, nFree = freeItems(scope).length;
    const at = p => document.elementFromPoint(p.x, p.y) || document;
    ptr(item, 'pointerdown', from, 1);
    await sleep(320);
    const N = 12;
    for (let s = 1; s <= N; s++) {
      const p = { x: from.x + (to.x - from.x) * s / N, y: from.y + (to.y - from.y) * s / N };
      ptr(at(p), 'pointermove', p, 1);
      await sleep(30);
    }
    for (let s = 0; s < 3; s++) { ptr(at(to), 'pointermove', to, 1); await sleep(70); }
    ptr(at(to), 'pointerup', to, 0);
    await sleep(500);
    return slot.isConnected ? (slot.innerHTML !== snap || freeItems(scope).length !== nFree) : true;
  };

  /* ===== 5. AI (Gemini) ===== */
  const blobToB64 = b => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(b);
  });
  const OKTYPE = /^image\/(png|jpeg|gif|webp)$/;
  const imgData = async img => {
    if (img.naturalWidth && img.naturalWidth < 40) return null;
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return { type: 'image/png', data: c.toDataURL('image/png').split(',')[1] };
    } catch {
      try {
        const b = await (await fetch(img.currentSrc || img.src)).blob();
        if (!OKTYPE.test(b.type)) return null;
        return { type: b.type, data: await blobToB64(b) };
      } catch { return null; }
    }
  };
  const imgBlock = d => ({ inlineData: { mimeType: d.type, data: d.data } });

  const SYSTEM = 'Bạn là gia sư giải bài tập (chủ yếu Toán, Lý, Hóa, Sinh, Tiếng Việt, Tiếng Anh THCS/THPT Việt Nam). ' +
    'QUY TRÌNH BẮT BUỘC cho MỌI câu, ghi hết ra trường "work" TRƯỚC khi đưa đáp án: ' +
    '(1) Chép lại các dữ kiện đề cho và điều đề hỏi, nhìn kỹ hình nếu có, chú ý các từ phủ định (không, sai, ngoại trừ...), đơn vị, và ký hiệu tập hợp (ngoặc nhọn { }, dấu ; ngăn cách phần tử, ∈ ∉ ⊂ ∪ ∩ ∅, ℕ ℕ*): các đáp án có thể chỉ khác nhau ở loại ngoặc hoặc dấu ngăn cách nên phải so từng ký tự. ' +
    '(2) Giải từng bước, ghi rõ công thức và phép tính trung gian, không bỏ bước, không đoán. ' +
    '(3) Nếu là trắc nghiệm: lần lượt xét TỪNG đáp án và ghi rõ đúng hay sai kèm lý do, rồi mới kết luận. ' +
    '(4) Thử lại kết quả (thay ngược vào đề hoặc tính lại bằng cách khác); nếu thấy mâu thuẫn thì giải lại. ' +
    '(5) Chỉ sau cùng mới ghi đáp án vào các trường bên dưới, đáp án phải khớp với kết luận trong "work". ' +
    'Chỉ trả về DUY NHẤT một đối tượng JSON, không thêm chữ nào ngoài JSON, trường "work" luôn đứng đầu (viết gọn nhưng đủ bước, không dùng dấu ngoặc kép bên trong, dùng dấu nháy đơn nếu cần). ' +
    'Dạng trắc nghiệm: {"work":"...","choices":[số thứ tự các đáp án đúng, bắt đầu từ 1]} ' +
    '(mặc định chọn 1 đáp án; chỉ liệt kê nhiều đáp án khi đề yêu cầu chọn nhiều hoặc ghi có thể có nhiều đáp án đúng; ' +
    'nếu đề gồm nhiều mệnh đề đúng/sai, mỗi mệnh đề có cặp lựa chọn riêng, hãy liệt kê số thứ tự của mọi lựa chọn đúng theo danh sách đã đánh số). ' +
    'Dạng điền 1 ô: {"work":"...","text":"đáp số"} (chỉ ghi số/biểu thức, không ghi đơn vị trừ khi đề yêu cầu; phân số viết a/b; số thập phân dùng dấu chấm). ' +
    'Dạng nhiều ô trống [Ô 1], [Ô 2]...: {"work":"...","texts":["ô 1","ô 2"]} đúng thứ tự ô. ' +
    'Dạng kéo thả (có "Các mảnh để kéo" và ô trống [Ô kéo 1], [Ô kéo 2]...): {"work":"...","drops":[số thứ tự mảnh cho [Ô kéo 1], [Ô kéo 2], ...]}, ghi 0 nếu để trống. ' +
    'Dạng chọn trong danh sách thả xuống ([Ô chọn 1], [Ô chọn 2]... kèm "Các lựa chọn của [Ô chọn n]" đánh số từ 1): {"work":"...","picks":[số thứ tự lựa chọn cho từng ô theo đúng thứ tự]}. ' +
    'Nếu sau khi kiểm tra vẫn không chắc chắn thì chọn đáp án khả dĩ nhất.';

  const arrOf = (src, key) => {
    const m = src.match(new RegExp('"' + key + '"\\s*:\\s*\\[([^\\]]*)\\]'));
    return m ? m[1] : null;
  };
  const parseAI = s => {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI không trả về JSON');
    try { return JSON.parse(m[0]); } catch { /* thử cách thủ công */ }
    const out = {};
    const c = arrOf(m[0], 'choices'); if (c) out.choices = c.split(',').map(x => x.replace(/["\s]/g, '')).filter(Boolean);
    const ts = arrOf(m[0], 'texts');
    if (ts) out.texts = [...ts.matchAll(/"((?:[^"\\]|\\.)*)"|(-?\d+(?:[.,]\d+)?)/g)].map(x => x[1] ?? x[2]);
    const dr = arrOf(m[0], 'drops'); if (dr) out.drops = dr.split(',').map(x => +x.trim() || 0);
    const pk = arrOf(m[0], 'picks'); if (pk) out.picks = pk.split(',').map(x => +x.trim() || 0);
    const t = m[0].match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (t) out.text = t[1];
    if (!out.choices && !out.texts && !out.drops && !out.picks && out.text == null) throw new Error('AI trả JSON lỗi');
    return out;
  };
  const toNum = x => (typeof x === 'string' && /^[A-Za-z]$/.test(x.trim())) ? x.trim().toUpperCase().charCodeAt(0) - 64 : Number(x);

  const httpError = async (r, daily) => {
    const body = await r.text();
    let info = {};
    try { info = JSON.parse(body).error || {}; } catch { /* không phải JSON */ }
    const e = new Error(`API ${r.status}: ${(info.message || body).slice(0, 140)}`);
    e.status = r.status;
    e.daily = daily(body);
    e.fatal = r.status === 401 || r.status === 403;
    return { e, info, r };
  };

  const callGeminiModel = async (model, parts, temp = 0.2) => {
    const r = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': curKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 16384, temperature: temp, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) {
      const { e, info } = await httpError(r, b => /PerDay/i.test(b));
      const d = (info.details || []).find(x => /RetryInfo/.test(x['@type'] || ''))?.retryDelay;
      if (d) e.retryAfter = parseFloat(d) * 1000;
      throw e;
    }
    const j = await r.json();
    const out = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!out) throw new Error('Gemini không trả nội dung (' + (j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || '?') + ')');
    return parseAI(out);
  };

  const RETRY_CODES = new Set([500, 502, 503, 504]);
  const deadUntil = new Map();
  const deadKey = m => cfg.provider + '|' + m + '|' + curKey();
  const resetHint = () => {
    const now = new Date();
    const la = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const next = new Date(la); next.setHours(24, 0, 0, 0);
    return new Date(now.getTime() + (next - la)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };
  const callAI = async (parts, temp = 0.2) => {
    stats.ai++; setStats();
    const main = curModel();
    if (!main) throw Object.assign(new Error('chưa nhập tên model'), { fatal: true });
    const call = callGeminiModel;
    const list = fb.checked ? [main, ...fbList().filter(m => m !== main)] : [main];
    let lastErr;
    for (let round = 0; round < 3; round++) {
      const live = list.filter(m => !(deadUntil.get(deadKey(m)) > Date.now()));
      if (!live.length) {
        const e = new Error(`hết quota ngày của ${list.length > 1 ? 'mọi model' : main} (thường reset khoảng ${resetHint()} giờ máy bạn)${fb.checked ? '' : '. Bật "model dự phòng" nếu chấp nhận model yếu hơn'}`);
        e.status = 429; e.quota = true; throw e;
      }
      let wait = 0;
      for (const m of live) {
        try {
          const res = await call(m, parts, temp);
          if (res.work) say('ℹ [' + m + '] Lời giải: ' + String(res.work).replace(/\s+/g, ' ').slice(0, 600));
          return res;
        }
        catch (e) {
          lastErr = e;
          if (e.status === 404 && m !== main) continue;
          if (e.status === 404) { e.fatal = true; e.message += ` (model "${m}" không tồn tại - sửa ô Model)`; throw e; }
          if (e.status === 429 && e.daily) {
            deadUntil.set(deadKey(m), Date.now() + 3600e3);
            say(`🚫 ${m}: hết quota ngày, ${list.length > 1 ? 'chuyển model dự phòng (yếu hơn, dễ sai hơn)' : 'sẽ dừng'}`);
            continue;
          }
          if (e.status === 429) {
            wait = Math.max(wait, Math.min(e.retryAfter || 8000, 65000));
            say(`⏳ ${m}: 429 (giới hạn theo phút), chờ ~${Math.round(wait / 1000)}s`);
            continue;
          }
          if (RETRY_CODES.has(e.status)) { say(`⏳ ${m}: API ${e.status}, đang thử lại...`); continue; }
          throw e;
        }
      }
      if (round < 2) await sleep(Math.max(wait, 2000 * 2 ** round));
    }
    throw lastErr;
  };

  // ghi vào nhật ký đúng nội dung đề + đáp án đã gửi cho AI (để đối chiếu khi sai)
  const sent = (txt, parts) => say(`📋 Đề gửi AI (${parts.filter(p => p.inlineData).length} hình kèm): ` + txt.replace(/\s+/g, ' ').slice(0, 700));

  // ----- CHECK KÉP: hỏi 2 lần độc lập, lệch thì hỏi lần 3 để phân xử -----
  const normVal = v => {
    const s = String(v ?? '').replace(/\$/g, '').replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
    const m = s.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
    if (m) return String(Math.round((m[2] ? m[1] / m[2] : +m[1]) * 1e6) / 1e6);
    return s;
  };
  const ints = a => a.map(x => toNum(x) || 0);
  const sigOf = r => Array.isArray(r.drops) ? 'kéo:' + ints(r.drops).join(',')
    : Array.isArray(r.picks) ? 'chọn:' + ints(r.picks).join(',')
    : Array.isArray(r.choices) ? 'đáp án:' + [...new Set(ints(r.choices))].sort((a, b) => a - b).join(',')
    : Array.isArray(r.texts) ? 'điền:' + r.texts.map(normVal).join(' | ')
    : r.text != null ? 'điền:' + normVal(r.text) : '?';
  const hasImgIn = scope => [...scope.querySelectorAll('img')].some(i => i.naturalWidth >= 40);
  const consensus = async parts => {
    if (!dbl.checked) return callAI(parts);
    const r1 = await callAI(parts, 0.2), s1 = sigOf(r1);
    const r2 = await callAI([...parts, { text: 'Hãy tự giải độc lập từ đầu, thật cẩn thận, ưu tiên kiểm tra lại từng bước.' }], 0.6), s2 = sigOf(r2);
    if (s1 === s2 && s1 !== '?') { say(`✔ Check kép: 2 lần khớp (${s1})`); return r1; }
    say(`⚠ Check kép LỆCH: lần 1 [${s1}] ≠ lần 2 [${s2}] → gửi lại câu hỏi, lấy đáp án lần 3`);
    const r3 = await callAI(parts, 0.1), s3 = sigOf(r3);
    r3._unsure = true;
    const match = s3 === s1 ? 'giống lần 1' : s3 === s2 ? 'giống lần 2' : 'khác cả hai lần trước';
    say(`🔁 Lần 3 → [${s3}] (${match}) - dùng đáp án lần 3`);
    return r3;
  };

  // chuyển NGUYÊN KHỐI câu hỏi thành văn bản giữ cấu trúc, công thức giữ nguyên LaTeX, hình đánh số [HÌNH k]
  const rawText = box => {
    const c = box.cloneNode(true);
    answerEls(c).forEach((e, i) => e.insertBefore(document.createTextNode(` ⟦ĐÁP ÁN ${i + 1}⟧ `), e.firstChild));
    c.querySelectorAll('.Select').forEach((x, i) => x.replaceWith(` [Ô chọn ${i + 1}] `));
    c.querySelectorAll(INPUT).forEach((x, i) => x.replaceWith(` [Ô ${i + 1}] `));
    const scripts = c.querySelectorAll('script[type^="math/tex"]');
    if (scripts.length) {
      c.querySelectorAll(MJ_RENDER).forEach(k => k.remove());
      scripts.forEach(x => x.replaceWith(' $' + x.textContent + '$ '));
    }
    c.querySelectorAll('mjx-container').forEach(k => {
      const a = k.querySelector('mjx-assistive-mml');
      k.replaceWith(' $' + (a ? a.textContent : (k.getAttribute('aria-label') || k.textContent)) + '$ ');
    });
    c.querySelectorAll('.katex').forEach(k => {
      const a = k.querySelector('annotation[encoding="application/x-tex"]');
      k.replaceWith(' $' + (a ? a.textContent : k.textContent) + '$ ');
    });
    c.querySelectorAll('.MathJax_Preview,.MJX_Assistive_MathML').forEach(k => k.remove());
    c.querySelectorAll('img').forEach((im, i) => im.replaceWith(` [HÌNH ${i + 1}${im.alt ? ': ' + im.alt : ''}] `));
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    c.querySelectorAll('td,th').forEach(x => x.append(' | '));
    c.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(x => x.append('\n'));
    return c.textContent.normalize('NFC').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  };

  const askRaw = async (stem, box, opts, inps) => {
    const parts = [];
    let txt = 'Dưới đây là NGUYÊN KHỐI câu hỏi lấy từ trang web. Công thức ở dạng LaTeX giữa dấu $; [HÌNH k] là vị trí hình thứ k (các hình được đính kèm bên dưới theo thứ tự); ' +
      '⟦ĐÁP ÁN n⟧ đánh dấu đáp án thứ n; [Ô n] là ô nhập thứ n. Tự xác định dạng câu hỏi rồi trả lời đúng định dạng JSON đã nêu.\n\n' + rawText(box);
    if (opts.length && isMulti(stem, opts, box)) txt += '\n\n(Câu này CÓ THỂ có nhiều đáp án đúng, hãy liệt kê tất cả trong "choices".)';
    else if (!opts.length && inps.length) txt += `\n\n(Câu này điền ${inps.length} ô trống [Ô 1]..[Ô ${inps.length}].)`;
    parts.push({ text: withNote(txt) });
    const imgs = [...box.querySelectorAll('img')];
    for (let i = 0; i < imgs.length && i < 10; i++) {
      const d = await imgData(imgs[i]);
      if (d) parts.push({ text: `HÌNH ${i + 1}:` }, imgBlock(d));
    }
    sent(txt, parts);
    return consensus(parts);
  };

  const askAI = async (stem, box, opts, inps) => {
    if (raw.checked) return askRaw(stem, box, opts, inps);
    const parts = [];
    const imgs = [...box.querySelectorAll('img')].filter(i => !opts.some(o => o.contains(i))).slice(0, 4);
    for (const im of imgs) { const d = await imgData(im); if (d) parts.push(imgBlock(d)); }
    let txt = 'Câu hỏi:\n' + textOf(stem);
    const optImgs = [];
    if (opts.length) {
      txt += '\n\nCác đáp án (đánh số liên tục):\n';
      for (const [i, o] of opts.entries()) {
        const s = textOf(o), im = o.querySelector('img');
        txt += `${i + 1}. ${s || (im ? '(đáp án là hình, xem bên dưới)' : '')}\n`;
        if (!s && im) optImgs.push([i + 1, im]);
      }
      if (isMulti(stem, opts, box)) txt += '\n(Câu này CÓ THỂ có nhiều đáp án đúng, hãy liệt kê tất cả trong "choices".)';
    } else if (inps.length) {
      txt += `\n\n(Câu này điền ${inps.length} ô trống, đánh dấu [Ô 1]..[Ô ${inps.length}] trong đề.)`;
    }
    sent(txt, parts); parts.push({ text: withNote(txt) });
    for (const [i, im] of optImgs) {
      const d = await imgData(im);
      if (d) parts.push({ text: `Hình của đáp án ${i}:` }, imgBlock(d));
    }
    return consensus(parts);
  };

  const askDnD = async (stem, scope, items, slots) => {
    const parts = [];
    const imgs = [...scope.querySelectorAll('img')]
      .filter(i => !items.some(o => o.contains(i)) && !slots.some(o => o.contains(i))).slice(0, 4);
    for (const im of imgs) { const d = await imgData(im); if (d) parts.push(imgBlock(d)); }
    const q0 = textOf(stem), q = /\[Ô kéo \d+\]/.test(q0) ? q0 : textOf(scope);
    let txt = 'Câu hỏi (kéo thả):\n' + q + '\n\nCác mảnh để kéo:\n';
    const itemImgs = [];
    for (const [i, o] of items.entries()) {
      const s = textOf(o), im = o.querySelector('img');
      txt += `${i + 1}. ${s || (im ? '(là hình, xem bên dưới)' : '')}\n`;
      if (!s && im) itemImgs.push([i + 1, im]);
    }
    txt += `\nCó ${slots.length} ô trống, đánh dấu [Ô kéo 1]..[Ô kéo ${slots.length}] theo thứ tự xuất hiện.`;
    sent(txt, parts); parts.push({ text: withNote(txt) });
    for (const [i, im] of itemImgs) {
      const d = await imgData(im);
      if (d) parts.push({ text: `Hình của mảnh ${i}:` }, imgBlock(d));
    }
    const res = await consensus(parts);
    const d = Array.isArray(res.drops) ? res.drops : (Array.isArray(res.choices) ? res.choices : []);
    const out = d.map(x => toNum(x) || 0); out._unsure = !!res._unsure; return out;
  };

  const solveDnD = async (stem, box, st) => {
    const scope = dndScope(box);
    solveLock = true;
    try {
      if (!st.plan) {
        const items = freeItems(scope), slots = slotsOf(scope);
        if (!items.length) return { ok: false, msg: 'không thấy mảnh để kéo' };
        const drops = await askDnD(stem, scope, items, slots);
        st.unsure = !!drops._unsure || hasImgIn(scope);
        st.plan = { labels: items.map(labelOf), drops };
      }
      const { labels, drops } = st.plan;
      if (!drops.some(n => n >= 1)) return { ok: false, msg: 'AI không chọn mảnh nào' };
      let done = 0, have = 0, fail = 0;
      for (let j = 0; j < drops.length; j++) {
        const n = drops[j];
        if (!(n >= 1 && n <= labels.length)) continue;
        if (!scope.isConnected) return { ok: false, msg: 'trang đã đổi giữa chừng' };
        const slot = slotsOf(scope)[j];
        if (!slot) { fail++; continue; }
        if (slot.querySelector(SEL_DRAG)) { have++; continue; }
        const item = freeItems(scope).find(e => labelOf(e) === labels[n - 1]);
        if (!item) { fail++; continue; }
        (await dragDrop(item, slot, scope)) ? done++ : fail++;
      }
      const seq = drops.map(n => n || '-').join(',');
      if (fail) return { ok: false, msg: `kéo thả [${seq}]: ${fail} ô không nhận (xem nút Dò cấu trúc)` };
      return { ok: true, msg: `AI kéo thả → [${seq}] (${done} mới, ${have} đã có)` };
    } finally { solveLock = false; }
  };

  /* ----- ô chọn thả xuống (react-select) ----- */
  const selectsOf = scope => [...scope.querySelectorAll('.Select')].filter(s => !s.parentElement.closest('.Select'));
  const isOpen = s => s.classList.contains('is-open');
  const smouse = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
  const valueText = s => { const v = s.querySelector('.Select-value'); return v ? labelOf(v) : ''; };
  const openMenu = async s => {
    if (!isOpen(s)) smouse(s.querySelector('.Select-control') || s, 'mousedown');
    for (let i = 0; i < 20; i++) { if (s.querySelector('.Select-option')) return true; await sleep(80); }
    return false;
  };
  const closeMenu = async s => {
    if (!isOpen(s)) return;
    const c = s.querySelector('.Select-control') || s;
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    await sleep(120);
    if (isOpen(s)) { smouse(c, 'mousedown'); await sleep(120); }
  };
  const readOptions = async s => {
    if (!(await openMenu(s))) return [];
    const list = [...s.querySelectorAll('.Select-option')].map(labelOf);
    await closeMenu(s);
    return list;
  };
  const pickOption = async (s, idx, labels) => {
    if (!(await openMenu(s))) return false;
    const els = [...s.querySelectorAll('.Select-option')];
    let el = els[idx];
    if (!el || labelOf(el) !== labels[idx]) el = els.find(e => labelOf(e) === labels[idx]);
    if (!el) return false;
    smouse(el, 'mousedown'); smouse(el, 'mouseup');
    await sleep(300);
    if (valueText(s) !== labels[idx]) { el.click?.(); await sleep(300); }
    await closeMenu(s);
    return valueText(s) === labels[idx];
  };

  const askSelect = async (stem, box, sels, labels) => {
    const parts = [];
    const imgs = [...box.querySelectorAll('img')].filter(i => !sels.some(o => o.contains(i))).slice(0, 4);
    for (const im of imgs) { const d = await imgData(im); if (d) parts.push(imgBlock(d)); }
    const q0 = textOf(stem), q = /\[Ô chọn \d+\]/.test(q0) ? q0 : textOf(box);
    let txt = 'Câu hỏi (chọn đáp án trong danh sách thả xuống):\n' + q + '\n';
    labels.forEach((l, i) => { txt += `\nCác lựa chọn của [Ô chọn ${i + 1}]:\n` + l.map((x, k) => `${k + 1}. ${x}`).join('\n') + '\n'; });
    sent(txt, parts); parts.push({ text: withNote(txt) });
    const res = await consensus(parts);
    const p = Array.isArray(res.picks) ? res.picks : (res.picks != null ? [res.picks] : (Array.isArray(res.choices) ? res.choices : []));
    const out = p.map(x => toNum(x) || 0); out._unsure = !!res._unsure; return out;
  };

  const solveSelect = async (stem, box, st) => {
    const sels = selectsOf(box);
    if (sels.every(s => s.classList.contains('is-disabled'))) return { ok: true, msg: 'ô chọn đã bị khoá (đã chấm), bỏ qua' };
    solveLock = true;
    try {
      if (!st.sel) {
        const labels = [];
        for (const s of sels) labels.push(await readOptions(s));
        if (labels.some(l => !l.length)) return { ok: false, msg: 'không đọc được danh sách lựa chọn (xem nút Dò cấu trúc)' };
        const picks = await askSelect(stem, box, sels, labels);
        st.unsure = !!picks._unsure || hasImgIn(box);
        st.sel = { labels, picks };
      }
      const { labels, picks } = st.sel;
      for (let i = 0; i < sels.length; i++) {
        const n = picks[i];
        if (!(n >= 1 && n <= labels[i].length)) return { ok: false, msg: `AI trả số lựa chọn không hợp lệ cho ô ${i + 1}` };
        const cur = selectsOf(box)[i] || sels[i];
        if (valueText(cur) === labels[i][n - 1]) continue;
        if (!(await pickOption(cur, n - 1, labels[i]))) return { ok: false, msg: `không chọn được ô ${i + 1} (xem nút Dò cấu trúc)` };
      }
      return { ok: true, msg: `AI chọn → ${picks.map((n, i) => labels[i][n - 1]).join(' ; ')}` };
    } finally { solveLock = false; }
  };

  const solveAI = async (stem, box, st = {}) => {
    const sc = dndScope(box);
    if (slotsOf(sc).length && dragsOf(sc).length) return solveDnD(stem, box, st);
    if (selectsOf(box).length) return solveSelect(stem, box, st);
    const opts = answerEls(box), inps = inputsOf(box);
    if (!opts.length && !inps.length) return { ok: false, msg: 'chưa thấy đáp án / ô nhập' };
    const res = await askAI(stem, box, opts, inps);
    st.unsure = !!res._unsure || hasImgIn(box);

    // trắc nghiệm (1 hoặc nhiều đáp án)
    if (opts.length && Array.isArray(res.choices) && res.choices.length) {
      const idx = [...new Set(res.choices.map(toNum).filter(i => i >= 1 && i <= opts.length))];
      if (!idx.length) return { ok: false, msg: 'AI trả số đáp án không hợp lệ' };
      const nTap = await tapIdx(box, idx.map(i => i - 1), opts);
      // bỏ tích những ô checkbox đang tích nhầm từ lần trước
      for (const [i, o] of answerEls(box).entries())
        if (!idx.includes(i + 1) && isCheckbox(o) && selState(o) === true) { tap(o); await sleep(200); }
      if (nTap < idx.length) return { ok: false, msg: `chỉ bấm được ${nTap}/${idx.length} đáp án (bấm không ăn)` };
      return { ok: true, msg: `AI → ${idx.map(i => String.fromCharCode(64 + i)).join(', ')}` };
    }

    // điền 1 hoặc nhiều ô
    if (inps.length) {
      let vals = Array.isArray(res.texts) ? res.texts : (res.text != null ? [res.text] : []);
      if (vals.length === 1 && inps.length > 1) vals = String(vals[0]).split(/\s*;\s*/);
      if (vals.length >= inps.length) {
        vals = vals.slice(0, inps.length);
        const nFill = await fillAll(box, vals);
        if (nFill < vals.length) return { ok: false, msg: `chỉ điền được ${nFill}/${vals.length} ô` };
        return { ok: true, msg: `AI → ${vals.join(' ; ')} (điền ${inps.length} ô)` };
      }
      return { ok: false, msg: `có ${inps.length} ô nhưng AI chỉ trả ${vals.length} giá trị` };
    }
    return { ok: false, msg: 'AI trả lời không khớp dạng câu hỏi' };
  };

  /* ===== 6. Quét, giải & tự sang câu ===== */
  const findBox = el => {
    const b = el.closest(SEL_BOX);
    if (b && questionEls().filter(q => b.contains(q)).length <= 1) return b;
    const qs = questionEls();
    let box = el;
    for (let i = 0; i < 10 && box.parentElement && box.parentElement !== document.body; i++) {
      if (answerEls(box).length || box.querySelector(INPUT) || box.querySelector(SEL_DROP) || box.querySelector('.Select')) break;
      const p = box.parentElement;
      if (qs.some(q => q !== el && p.contains(q))) break;
      box = p;
    }
    return box;
  };
  const keyOf = (t, box) => t + '|' + answerEls(box).map(textOf).join('|') + '|in' + box.querySelectorAll(INPUT).length +
    '|dd' + slotsOf(dndScope(box)).length + '|sl' + selectsOf(box).length;

  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let warnedSub = '', lastAdv = 0, lastSubmit = 0, submitN = 0, submittedSig = '', lastSig = '';
  const state = new Map();
  const stale = new Map();

  const btnTxt = x => (x.querySelector('span')?.textContent || x.textContent).normalize('NFC').replace(/\s+/g, ' ').trim();
  const findBtn = () => {
    const b = [...document.querySelectorAll(NEXT_BTN + ', button, [role=button]')]
      .find(x => !x.disabled && x.getAttribute('aria-disabled') !== 'true' && visible(x) && NEXT_TXT.test(btnTxt(x)));
    return b ? { b, t: btnTxt(b) } : null;
  };
  const GRADED_TXT = /^(câu hỏi sau|câu hỏi tiếp theo|câu hỏi tiếp)$/i; // có nút này = câu đã được chấm
  let warnedHold = '';
  const advance = sig => {
    lastAdv = Date.now();
    const f = findBtn();
    if (!f) return;
    const { b, t } = f;
    if (SUBMIT_TXT.test(t)) {
      if (sure.checked && [...state.values()].some(x => x.done && x.unsure)) {
        if (warnedHold !== sig) { warnedHold = sig; say(`⏸ Câu này AI KHÔNG chắc (check kép lệch hoặc có hình) - đã điền, KHÔNG tự nộp. Bạn kiểm tra rồi tự bấm "${t}", script sẽ tự đi tiếp.`); }
        return;
      }
      if (!autoSubmit.checked) {
        if (warnedSub !== sig) { warnedSub = sig; say(`ℹ Đã điền xong - đang chờ bạn tự bấm "${t}" (đang tắt Tự nộp bài)`); }
        return;
      }
      if (submitN >= 2) {
        if (submittedSig) { submittedSig = ''; say(`⚠ Đã bấm "${t}" ${submitN} lần mà trang chưa đổi - dừng bấm để khỏi spam. Kiểm tra câu này rồi bấm "Giải lại câu này" hoặc "Bắt đầu".`); }
        return;
      }
      if (Date.now() - lastSubmit < 4000) return;
      submitN++; lastSubmit = Date.now(); submittedSig = sig;
    } else {
      submitN = 0; submittedSig = '';
      const until = Date.now() + 5000;
      for (const [k, s] of state) if (s.done) { state.delete(k); stale.set(k, until); }
    }
    b.scrollIntoView({ block: 'center' }); tap(b); say('⏭ bấm: ' + t);
  };

  let busyN = 0, running = false;
  const refreshStatus = () => setStatus(!running && !busyN ? 'stop' : (busyN || solveLock) ? 'busy' : 'run');

  // câu đã THỰC SỰ được điền/chọn chưa? true = rồi, false = chắc chắn còn trống, null = không kiểm tra được
  const filled = box => {
    let known = false;
    for (const i of inputsOf(box)) {
      known = true;
      if (!String(i.isContentEditable ? i.textContent : i.value).trim()) return false;
    }
    const sl = slotsOf(dndScope(box));
    if (sl.length) { known = true; if (sl.some(s => !s.querySelector(SEL_DRAG))) return false; }
    for (const s of selectsOf(box)) {
      if (s.classList.contains('is-disabled')) continue;
      known = true;
      if (!valueText(s)) return false;
    }
    const opts = answerEls(box);
    if (opts.length) {
      const sv = opts.map(selState);
      const locked = opts.some(o => (o.matches('input') ? o : o.querySelector('input'))?.disabled);
      if (sv.includes(true) || opts.some(o => picked(o) === true)) known = true;
      else if (sv.every(x => x === false) && !locked) return false;
    }
    return known ? true : null;
  };

  const finish = (r, name, st, err) => {
    if (r.ok) {
      st.done = true; st.at = Date.now(); stats.solved++; setStats(); say(`✅ [${name}] ${r.msg}`);
    } else {
      if (err?.quota || err?.fatal) return;
      st.n++;
      st.wait = Date.now() + ([429, 503].includes(err?.status) ? 15000 : 5000);
      const mt = maxTry();
      if (st.n === mt) { stats.skipped++; setStats(); say(`❓ [${name}] chưa giải được sau ${mt} lần: ${r.msg}. Script KHÔNG tự bỏ qua - bấm "Giải lại câu này" để gửi lại AI.`); }
    }
  };

  // đọc kết quả chấm của trang (đúng/sai) từ class của các phần tử trong câu hỏi
  const WRONG_CLS = /(?:^|[\s_-])(?:incorrect|wrong|sai)(?:$|[\s_-])/i;
  const RIGHT_CLS = /(?:^|[\s_-])(?:correct|đúng)(?:$|[\s_-])/i;
  let verdictSig = '', verdictTry = 0;
  const verdictOf = qs => {
    let w = 0, r = 0;
    for (const b of new Set(qs.map(findBox)))
      for (const e of [b, ...b.querySelectorAll('*')]) {
        const c = typeof e.className === 'string' ? e.className : '';
        if (!c) continue;
        if (WRONG_CLS.test(c)) w++; else if (RIGHT_CLS.test(c)) r++;
      }
    return w ? 'wrong' : r ? 'right' : null;
  };

  const runTick = (force = false) => {
    if ((!running && !force) || solveLock) return;
    const qs = questionEls();
    const sig = qs.map(textOf).join('¦');
    if (sig !== lastSig) { lastSig = sig; submitN = 0; submittedSig = ''; }
    let allReady = qs.length > 0;
    // đã bấm nộp đúng câu này -> chỉ chờ nút "Câu hỏi sau", không giải/điền lại câu đang bị chấm
    const nb = findBtn(), graded = !!nb && GRADED_TXT.test(nb.t);
    if (graded && verdictSig !== sig) {
      const v = verdictOf(qs);
      if (v) { verdictSig = sig; verdictTry = 0; stats[v]++; setStats(); say(v === 'right' ? '✅ Kết quả chấm: ĐÚNG' : '⚠ Kết quả chấm: SAI'); }
      else if (++verdictTry >= 4) { verdictSig = sig; verdictTry = 0; say('ℹ Chưa nhận ra kết quả chấm của câu này (không tính đúng/sai). Sau khi chấm, bấm Dò cấu trúc rồi gửi mình dòng "lớp chấm".'); }
    }
    if (!graded && (!submittedSig || submittedSig !== sig)) {
      for (const stem of qs) {
        const t = textOf(stem), box = findBox(stem), k = keyOf(t, box);
        if (stale.has(k)) {
          if (Date.now() < stale.get(k)) { allReady = false; continue; }
          stale.delete(k);
        }
        const st = state.get(k) || state.set(k, { n: 0 }).get(k);
        if (st.done) {
          if (Date.now() - st.at < 1200) { allReady = false; continue; }
          if (filled(box) !== false) continue; // đã điền thật (hoặc không kiểm tra được nhưng đã xác minh lúc bấm)
          const redo = st.redo || 0;
          if (redo >= 2) {
            allReady = false;
            if (!st.warned) { st.warned = true; stats.skipped++; setStats(); say('❓ Câu này vẫn trống sau 2 lần làm lại → KHÔNG nộp. Bấm "Giải lại câu này" để gửi lại AI.'); }
            continue;
          }
          say(`↻ Câu chưa được điền/chọn thật - làm lại (${redo + 1}/2)`);
          stats.solved = Math.max(0, stats.solved - 1); setStats();
          Object.assign(st, { done: false, n: 0, wait: 0, plan: null, sel: null, redo: redo + 1 });
        }
        allReady = false;
        if (st.busy || st.n >= maxTry() || Date.now() < (st.wait || 0)) continue;

        if (!curKey()) {
          say('⚠ Chưa nhập Gemini API key - nhập rồi bấm lại.');
          if (running) stop();
          return;
        }
        st.busy = true; busyN++;
        solveAI(stem, box, st)
          .then(r => finish(r, 'AI', st))
          .catch(e => {
            say('⚠ AI lỗi: ' + e.message);
            finish({ ok: false, msg: e.message }, 'AI', st, e);
            if (e.quota || e.fatal) { stop(); say('⏹ Đã tự dừng: ' + (e.quota ? 'hết quota. Đợi reset / nạp thêm, hoặc đổi key rồi bấm "Bắt đầu".' : 'key hoặc model không hợp lệ. Sửa lại rồi bấm "Bắt đầu".')); }
          })
          .finally(() => { st.busy = false; busyN--; refreshStatus(); });
      }
    }
    // CHỈ sang câu / nộp khi MỌI câu đã được điền thật
    if (running && autoNext.checked && allReady && !busyN && Date.now() - lastAdv > advGap()) advance(sig);
  };

  const tick = () => { runTick(); refreshStatus(); };

  let deb = 0;
  window.__funObs = new MutationObserver(() => { clearTimeout(deb); deb = setTimeout(tick, 400); });
  window.__funObs.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Giải lại: xoá kết quả cũ của câu hiện tại và gửi lại cho AI (chạy được cả khi đang dừng)
  const resolveNow = () => {
    if (!questionEls().length) return say('⚠ Không thấy câu hỏi nào để giải lại');
    if (!curKey()) return say('⚠ Chưa nhập API key');
    state.clear(); stale.clear(); submitN = 0; submittedSig = ''; lastSubmit = 0;
    say('↻ Giải lại câu hiện tại bằng Gemini');
    runTick(true); refreshStatus();
  };
  bRedo.onclick = resolveNow;

  bScan.onclick = () => {
    const q = questionEls(), a = answerEls(document);
    if (!q.length) say(`⚠ Không thấy câu hỏi (${SEL_Q})`);
    if (!a.length) say(`ℹ Không thấy đáp án trắc nghiệm (${SEL_A}) - bình thường nếu là câu điền ô`);
    const boxes = q.map(findBox);
    const imgs = boxes.reduce((n, b) => n + b.querySelectorAll('img').length, 0);
    const ins = boxes.reduce((n, b) => n + b.querySelectorAll(INPUT).length, 0);
    const nsel = boxes.reduce((n, b) => n + selectsOf(b).length, 0);
    const dnd = boxes.map(dndScope);
    const nd = dnd.reduce((n, b) => n + dragsOf(b).length, 0), ns = dnd.reduce((n, b) => n + slotsOf(b).length, 0);
    say(`🔍 ${q.length} câu hỏi, ${a.length} đáp án, ${ins} ô nhập, ${nsel} ô chọn, ${nd} mảnh kéo, ${ns} ô đích, ${imgs} hình`);
  };

  bDbg.onclick = () => {
    const q = questionEls()[0];
    const b = (q && findBox(q)) || document.querySelector(SEL_BOX);
    if (!b) return say('⚠ Không thấy ' + SEL_BOX + ' và không thấy câu hỏi');
    const n = s => b.querySelectorAll(s).length;
    say('📦 ' + (b.id ? '#' + b.id + ' ' : '') + b.className);
    say(`stem=${n(SEL_Q)} | ans=${answerEls(b).length} | input=${n(INPUT)} | checkbox=${n('input[type=checkbox],[role=checkbox]')} | radio=${n('input[type=radio],[role=radio]')} | editable=${n('[contenteditable=true]')} | img=${n('img')}`);
    say('multi=' + (answerEls(b).length ? isMulti(q || b, answerEls(b), b) : '-') + ' | filled=' + filled(b) + ' | chọn=' + answerEls(b).map(o => picked(o)).join(','));
    const sc = dndScope(b), sl = slotsOf(sc), dr = dragsOf(sc);
    if (sl.length || dr.length) {
      say(`kéo thả: ${dr.length} mảnh (${freeItems(sc).length} đang tự do) | ${sl.length} ô đích`);
      dr.slice(0, 5).forEach((d, i) => say(`mảnh ${i + 1}: <${d.tagName.toLowerCase()}${d.id ? ' id=' + d.id : ''}> .${(d.className + '').trim().split(/\s+/)[0] || ''} "${labelOf(d).slice(0, 25)}"`));
      sl.slice(0, 5).forEach((x, i) => { const r = x.getBoundingClientRect(); say(`ô đích ${i + 1}: ${x.id.slice(0, 12)}… ${Math.round(r.width)}×${Math.round(r.height)} ${x.querySelector(SEL_DRAG) ? '(đã có mảnh)' : '(trống)'}`); });
      if (sl.length && !dr.length) say('⚠ thấy ô đích nhưng không thấy mảnh kéo - gửi mình outerHTML của 1 mảnh kéo');
    }
    const sx = selectsOf(b);
    if (sx.length) {
      say(`ô chọn thả xuống: ${sx.length}`);
      sx.slice(0, 4).forEach((x, i) => say(`ô chọn ${i + 1}: .${(x.className + '').trim().replace(/\s+/g, '.').slice(0, 70)} | đang chọn: "${valueText(x).slice(0, 20)}" | ${x.querySelector('.Select-input input') ? 'có ô gõ' : 'không gõ'}`));
    }
    inputsOf(b).slice(0, 4).forEach((i, k) => say(`ô ${k + 1}: <${i.tagName.toLowerCase()}${i.type ? ' type=' + i.type : ''}${i.id ? ' id=' + i.id : ''}> .${(i.className + '').trim().split(/\s+/)[0] || ''}`));
    say('đề đọc được: ' + textOf(q || b).slice(0, 220));
    const cls = new Map();
    b.querySelectorAll('*').forEach(e => {
      const c = typeof e.className === 'string' ? e.className.trim() : '';
      if (c) cls.set(c, (cls.get(c) || 0) + 1);
    });
    say('lớp chấm: ' + ([...cls.keys()].filter(c => WRONG_CLS.test(c) || RIGHT_CLS.test(c)).slice(0, 8).join(' | ') || '(không có)'));
    say('class: ' + [...cls].slice(0, 25).map(([c, k]) => `${c.split(/\s+/)[0]}×${k}`).join(', '));
  };

  const stop = () => { running = false; clearInterval(window.__funTimer); refreshStatus(); };
  const start = () => {
    clearInterval(window.__funTimer);
    running = true;
    submitN = 0; submittedSig = ''; stale.clear();
    // bắt đầu lại = cho các câu đã bỏ cuộc được thử lại
    for (const s of state.values()) if (!s.done) { s.n = 0; s.wait = 0; }
    say(`▶ Bắt đầu v${VERSION} | model ${curModel()} | nguyên khối: ${raw.checked ? 'bật' : 'TẮT'} | check kép: ${dbl.checked ? 'bật' : 'TẮT'} | model dự phòng: ${fb.checked ? 'BẬT (yếu hơn)' : 'tắt'} | chỉ nộp khi chắc: ${sure.checked ? 'bật' : 'TẮT'}`);
    tick();
    window.__funTimer = setInterval(tick, Math.max(100, +delay.value || 2500));
  };
  bRun.onclick = () => { if (running) { stop(); say('⏹ Đã dừng.'); } else start(); };
  close.onclick = () => {
    stop(); window.__funObs?.disconnect();
    const a = panel.animate?.([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9 }], { duration: 240, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' });
    a ? (a.onfinish = () => host.remove()) : host.remove();
  };

  if (lsGet() === '1') unlock(true); // đã mở khoá từ lần trước
  say('Sẵn sàng. Dán Gemini key, bấm "Quét trang" để kiểm tra rồi "Bắt đầu".' + (unlocked ? ' Nâng cao: đã mở.' : ''));
})();