import { drawQR } from './qr.js?v=1';

/* Remote play for the two-player board games.
   Talks to table.raisedcurious.com, which seats two people in a room and keeps
   an append-only list of moves. The rules stay here on the device: both ends
   replay the same move list through the same code, so neither can drift.

   The join sheet is deliberately the same shape as the one on Faces: a big
   four-digit code and a QR that carries it, because a child reads the picture
   and a grown-up reads the digits. */

const HOST = 'wss://table.raisedcurious.com/ws';
const LINK = 'https://play.raisedcurious.com';
const PID_KEY = 'rc.table.pid';

function myPid(){
  try {
    let p = localStorage.getItem(PID_KEY);
    if (!p){ p = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(PID_KEY, p); }
    return p;
  } catch(e){ return 'p' + Math.random().toString(36).slice(2); }
}

/* opts: { game, slug, onState(v), onOpen(), onClose() } */
export function createTable(opts){
  const T = {
    ws: null, code: null, seat: -1, moves: [], turn: 0, seated: 0, round: 0,
    connected: false, wanted: false
  };
  let retry = 0, timer = null;

  T.connect = code => {
    T.wanted = true;
    T.code = code || null;
    open();
  };
  T.leave = () => {
    T.wanted = false;
    if (timer){ clearTimeout(timer); timer = null; }
    if (T.ws){ try { T.ws.close(); } catch(e){} }
    T.ws = null; T.connected = false; T.seat = -1; T.moves = []; T.code = null;
  };
  T.send = (v) => {
    if (!T.connected || T.seat < 0) return false;
    if (T.seat !== T.turn) return false;
    try { T.ws.send(JSON.stringify({ t: 'move', n: T.moves.length, v })); return true; }
    catch(e){ return false; }
  };
  T.again = () => { try { T.ws.send(JSON.stringify({ t: 'again' })); } catch(e){} };
  T.myTurn = () => T.connected && T.seat >= 0 && T.seat === T.turn;

  function open(){
    if (T.ws) { try { T.ws.close(); } catch(e){} }
    const q = new URLSearchParams({ game: opts.game, pid: myPid() });
    if (T.code) q.set('code', T.code);
    let ws;
    try { ws = new WebSocket(HOST + '?' + q.toString()); } catch(e){ return schedule(); }
    T.ws = ws;
    ws.onopen = () => { retry = 0; T.connected = true; opts.onOpen && opts.onOpen(); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch(err){ return; }
      if (m.t !== 'state') return;
      const v = m.v;
      T.code = v.code; T.seat = v.seat; T.moves = v.moves || [];
      T.turn = v.turn; T.seated = v.seated; T.round = v.round || 0;
      opts.onState && opts.onState(v);
    };
    ws.onclose = () => {
      T.connected = false;
      opts.onClose && opts.onClose();
      if (T.wanted) schedule();
    };
    ws.onerror = () => {};
  }
  function schedule(){
    if (!T.wanted || timer) return;
    const wait = Math.min(8000, 600 * Math.pow(2, retry++));
    timer = setTimeout(() => { timer = null; if (T.wanted) open(); }, wait);
  }
  return T;
}

/* ---------- the join sheet ----------
   Two big buttons: start a game, or key in the four digits someone read out.
   Nothing here needs reading beyond the digits themselves. */
export function joinSheet(opts){
  const el = document.createElement('div');
  el.className = 'toy-sheet tbl-sheet';
  el.innerHTML =
    '<div class="card">' +
      '<h2>Play on two devices</h2>' +
      '<p class="sub">One of you starts a game and reads out the four numbers. ' +
      'The other types them in, or scans the square.</p>' +
      '<div class="tbl-two">' +
        '<button class="tbl-big" id="tbl-host">Start a game</button>' +
        '<button class="tbl-big alt" id="tbl-join">Type a code</button>' +
      '</div>' +
      '<div id="tbl-panel"></div>' +
      '<button class="toy-close">Close</button>' +
    '</div>';
  document.body.appendChild(el);

  const panel = el.querySelector('#tbl-panel');
  el.querySelector('.toy-close').onclick = () => close();
  el.onclick = e => { if (e.target === el) close(); };
  function close(){ el.classList.remove('open'); }
  function open(){ el.classList.add('open'); panel.innerHTML = ''; }

  el.querySelector('#tbl-host').onclick = () => { panel.innerHTML = '<p class="tbl-wait">…</p>'; opts.onHost(); };
  el.querySelector('#tbl-join').onclick = () => showPad();

  function showPad(){
    panel.innerHTML =
      '<div class="tbl-code" id="tbl-shown">- - - -</div>' +
      '<div class="tbl-pad">' +
        [1,2,3,4,5,6,7,8,9,'←',0,'ok'].map(k =>
          '<button data-k="' + k + '">' + k + '</button>').join('') +
      '</div>';
    let typed = '';
    const shown = panel.querySelector('#tbl-shown');
    const paint = () => shown.textContent = (typed.padEnd(4, '·').split('').join(' '));
    paint();
    panel.querySelectorAll('.tbl-pad button').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '←') typed = typed.slice(0, -1);
      else if (k === 'ok'){ if (typed.length === 4) opts.onJoin(typed); }
      else if (typed.length < 4) typed += k;
      paint();
      if (typed.length === 4 && k !== '←') opts.onJoin(typed);
    });
  }

  /* Shown once a room exists: the code, big, with the QR beside it. */
  function showCode(code, slug){
    panel.innerHTML = '<div class="tbl-share"><div class="tbl-code big">' +
      code.split('').join(' ') + '</div><div id="tbl-qr"></div></div>' +
      '<p class="tbl-wait" id="tbl-status">Waiting for the other player…</p>';
    const holder = panel.querySelector('#tbl-qr');
    try {
      const cv = drawQR(LINK + '/' + slug + '/#' + code, 4);
      holder.appendChild(cv);
    } catch(e){ holder.textContent = ''; }
  }
  function status(text){
    const s = panel.querySelector('#tbl-status');
    if (s) s.textContent = text;
  }
  function offline(){
    panel.innerHTML = '<p class="tbl-offline">\u2708\uFE0F<br>Playing on two devices needs the internet.<br>' +
      'Everything else here works without it \u2014 try the robot.</p>';
    el.querySelector('#tbl-host').disabled = true;
    el.querySelector('#tbl-join').disabled = true;
  }
  return { el, open, close, showCode, status, showPad, offline };
}

/* Two devices need a network by definition. Everything else on this site
   works on a plane, so this one has to say why it cannot rather than sit
   there reconnecting forever. */
export const online = () => navigator.onLine !== false;

/* A code in the address bar means someone followed a QR. */
export function codeFromUrl(){
  const h = (location.hash || '').replace('#', '').trim();
  return /^[0-9]{4}$/.test(h) ? h : null;
}
