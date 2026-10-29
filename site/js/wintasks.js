'use strict';
/* ================= Running Windows programs in the NightOS taskbar (desktop app only) =================
   The panel (or dock) lists the windows open on your PC. Click one to bring it to the front or
   minimize it; right-click to close it. */
if (NATIVE && NATIVE.winWindows) {
  const WT = { list: [], fg: 0, timer: 0, busy: false };
  const on = () => CFG.winTasks !== false && SYSTEM.state === 'desktop' && !document.hidden;
  // Linux windows from WSL are all hosted by msrdc.exe. Use the Flatpak's own icon when the title matches one.
  const linuxIcon = w => { if (!/\\msrdc\.exe$/i.test(w.exe || '')) return null; const f = (CFG.flatpaks || []).find(a => w.title.startsWith(a.name + ' (')); return f && typeof fpIcon === 'function' ? fpIcon(f.icon, f.name) : null; };
  const btnHTML = (w, cls) => `<button class="${cls} wt" data-hwnd="${w.hwnd}" title="${esc(w.title)}" aria-label="${esc(w.title)} (Windows)">${linuxIcon(w) || (w.icon ? `<img alt="" src="${w.icon}">` : AI.winapps ? AI.winapps() : '')}${cls === 'dk' ? `<span class="tip">${esc(w.title)}</span><span class="dots"><i></i></span>` : `<span class="pn-ind"><i></i></span>`}</button>`;
  function paint() {
    const list = CFG.winTasks === false ? [] : WT.list;
    const box = $('#panel .pn-tasks');
    if (box) { $$('.wt, .wt-sep', box).forEach(x => x.remove()); if (list.length) box.insertAdjacentHTML('beforeend', '<span class="wt-sep"></span>' + list.map(w => btnHTML(w, `pn-task run ${w.hwnd === WT.fg ? 'act' : ''} ${w.min ? 'minimized' : ''}`)).join('')); }
    const d = $('#dock');
    if (d && !d.hidden) { $$('.wt, .wt-sep', d).forEach(x => x.remove()); const apps = $('.dk[data-app="__apps"]', d); if (apps && list.length) apps.insertAdjacentHTML('beforebegin', list.map(w => btnHTML(w, 'dk')).join('') + '<span class="dk-sep wt-sep"></span>'); }
  }
  async function poll() {
    clearTimeout(WT.timer);
    if (on() && !WT.busy) { WT.busy = true; try { const r = await NATIVE.winWindows(); const key = JSON.stringify(r); if (key !== WT.key) { WT.key = key; WT.list = r.windows; WT.fg = r.foreground; paint(); } } catch (e) { } WT.busy = false; }
    else if (!on() && WT.list.length) { WT.list = []; WT.key = ''; paint(); }
    WT.timer = setTimeout(poll, 2000);
  }
  renderTasks = (orig => () => { orig(); paint(); })(renderTasks);
  updateDock = (orig => () => { orig(); paint(); })(updateDock);
  const act = async (hwnd, what) => { try { await NATIVE.winWindowAction(hwnd, what); } catch (e) { notify('winapps', 'That window is gone', 'It may have closed already.'); } setTimeout(poll, 250); };
  const click = e => {
    const b = e.target.closest('[data-hwnd]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    const w = WT.list.find(x => String(x.hwnd) === b.dataset.hwnd); if (!w) return;
    act(w.hwnd, w.hwnd === WT.fg && !w.min ? 'minimize' : 'focus');
  };
  const menu = e => {
    const b = e.target.closest('[data-hwnd]'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const w = WT.list.find(x => String(x.hwnd) === b.dataset.hwnd); if (!w) return;
    const items = [{ label: w.title, disabled: true }, '-', { label: 'Bring to Front', action: () => act(w.hwnd, 'focus') }, { label: 'Minimize', action: () => act(w.hwnd, 'minimize') }, '-', { label: 'Close Window', action: () => act(w.hwnd, 'close') }];
    showMenu(e.clientX, LOOK().panelPos === 'bottom' || LOOK().layout === 'dock' ? e.clientY - 12 - 5 * 34 : e.clientY + 8, items);
  };
  document.addEventListener('click', e => { if (e.target.closest('#panel [data-hwnd], #dock [data-hwnd]')) click(e); }, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest('#panel [data-hwnd], #dock [data-hwnd]')) menu(e); }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  poll();
  window.WINTASKS = { refresh: () => { WT.key = ''; poll(); } };
}
