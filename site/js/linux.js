'use strict';
/* ================= Real Linux: Alpine Linux on an emulated x86 PC (v86) =================
   The VM's first serial port is wired to an xterm.js terminal. A WebSocket relay gives the
   VM a real network connection, which is what makes apk/apt downloads work. */
const LINUX = {
  iso: 'images/alpine-virt-3.24.3-x86.iso', isoSize: 51380224,
  emu: null, term: null, fit: null, host: null, win: null,
  state: 'off', hidden: false, tail: '', queue: [], memMB: 0, startedAt: 0, ip: ''
};
const RELAY_DEFAULT = 'wss://relay.widgetry.org/';
AI.linux = () => `<svg viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="48" rx="10" fill="#1f3b5c"/><rect x="8.5" y="10.5" width="47" height="43" rx="8" fill="#101a26"/><path d="M14 46l12-16 8 10 6-7 10 13z" fill="#2f6fb0"/><path d="M15 21l6 5-6 5" fill="none" stroke="#8ae234" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 31h9" stroke="#8ae234" stroke-width="3.4" stroke-linecap="round"/></svg>`;
APPS.linux = { name: 'Linux Terminal', proc: 'v86', kw: 'linux alpine vm virtual machine kernel apk apt real terminal shell', single: true, launch: () => LinuxApp() };
DOCK.splice(DOCK.indexOf('terminal') + 1, 0, 'linux');
GRID_APPS.splice(GRID_APPS.indexOf('terminal') + 1, 0, 'linux');
DESC.linux = 'open the real Alpine Linux virtual machine';
CMDS.linux = () => { launch('linux'); };
procList = (orig => () => {
  const l = orig();
  if (LINUX.emu && LINUX.state !== 'off') l.push({ pid: 4096, name: 'v86 (Alpine Linux VM)', user: 'night', mem: LINUX.memMB, cpu: SYS.cpu[0] ? SYS.cpu[0] * .8 : 0, win: LINUX.win || undefined, child: !LINUX.win });
  return l;
})(procList);

function linuxSetupScript(rows, cols, net) {
  return `hostname nightos; echo nightos > /etc/hostname
printf '%s\\n' "http://dl-cdn.alpinelinux.org/alpine/v3.24/main" "http://dl-cdn.alpinelinux.org/alpine/v3.24/community" > /etc/apk/repositories
cat > /etc/profile.d/nightos.sh <<'NOSEOF'
export TERM=xterm-256color
PS1="$(printf '\\033[1;32m')\\u@\\h$(printf '\\033[0m'):$(printf '\\033[1;34m')\\w$(printf '\\033[0m')# "
apt() {
  case "$1" in
    update) apk update ;;
    upgrade|full-upgrade|dist-upgrade) apk upgrade ;;
    install) shift; apk add "$@" ;;
    remove|purge|autoremove) shift; apk del "$@" ;;
    search) shift; apk search "$@" ;;
    show) shift; apk info -a "$@" ;;
    list) apk list --installed ;;
    *) echo "Usage: apt update | upgrade | install PKG | remove PKG | search WORD | show PKG | list"; echo "(NightOS Linux is Alpine Linux, so apt hands these to apk.)"; return 1 ;;
  esac
}
alias apt-get=apt
alias ll='ls -la'
NOSEOF
. /etc/profile.d/nightos.sh
cat > /etc/motd <<'NOSEOF'

  NightOS Linux: Alpine 3.24 on a real Linux kernel, running in your browser.

    apt install PKG     install software (handed to apk)
    apk search WORD     search 27,000+ packages
    try:  apt install htop python3 nano

  Everything here lives in memory and resets when you reload the page.

NOSEOF
NOSNET="offline (network relay is turned off)"
if [ "${net}" = "1" ]; then
  ip link set eth0 up
  if udhcpc -i eth0 -t 8 -T 3 -n -q >/dev/null 2>&1; then NOSNET="connected, $(ip -4 addr show eth0 | awk '/inet /{print $2}')"; else NOSNET="not connected (the relay did not answer)"; fi
fi
stty rows ${rows} cols ${cols}
rm -f /tmp/nos.b64 /tmp/nos.sh
stty echo
echo __NOS_READY__
cat /etc/motd
echo "  Network: $NOSNET"
echo
cd /root
`;
}

function linuxEnsureTerm() {
  if (LINUX.term) return;
  const host = el('<div class="lx-term"></div>');
  const t = new Terminal({
    fontFamily: '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace', fontSize: 13.5, cursorBlink: true, scrollback: 5000, allowProposedApi: false,
    theme: { background: '#15161c', foreground: '#d8dae3', cursor: '#d8dae3', selectionBackground: '#3a4160', black: '#2e3436', red: '#ef6b6b', green: '#8ae234', yellow: '#fce94f', blue: '#7aa7e6', magenta: '#d38ad8', cyan: '#34e2e2', white: '#d3d7cf', brightBlack: '#555753', brightRed: '#ff8a8a', brightGreen: '#a6ef5a', brightYellow: '#fff27a', brightBlue: '#9cc3f5', brightMagenta: '#e5a8e8', brightCyan: '#7af0f0', brightWhite: '#ffffff' }
  });
  const fit = new FitAddon.FitAddon(); t.loadAddon(fit);
  t.open(host);
  t.onData(d => { if (LINUX.emu && LINUX.state !== 'off' && LINUX.state !== 'loading') LINUX.emu.serial0_send(d); });
  t.attachCustomKeyEventHandler(e => {
    if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { const s = t.getSelection(); if (s && navigator.clipboard) navigator.clipboard.writeText(s).catch(() => { }); return false; }
    return true;
  });
  Object.assign(LINUX, { term: t, fit, host });
}
function linuxFlush() {
  LINUX.flushing = false;
  if (!LINUX.queue.length || !LINUX.term) return;
  LINUX.term.write(new Uint8Array(LINUX.queue)); LINUX.queue = [];
}
function linuxByte(b) {
  const L = LINUX;
  L.tail = (L.tail + String.fromCharCode(b)).slice(-160);
  if (L.state === 'booting' && !L.sentBoot && /boot: $/.test(L.tail)) { L.sentBoot = true; setTimeout(() => linuxType('virt console=ttyS0,115200\n'), 350); }
  if ((L.state === 'booting') && /login: $/.test(L.tail)) { L.state = 'login'; setTimeout(() => L.emu.serial0_send('root\n'), 200); linuxStatus('Logging in…'); }
  else if (L.state === 'login' && /:~# (\x1b\[6n)?$/.test(L.tail)) { L.state = 'setup'; L.hidden = true; linuxSetup(); }
  else if (L.state === 'setup' && L.tail.includes('__NOS_READY__')) { L.state = 'ready'; L.tail = ''; L.hidden = false; L.skipLine = true; linuxStatus(''); updateLinuxTitle(); return; }
  if (L.hidden) return;
  if (L.skipLine) { if (b === 10) L.skipLine = false; return; }
  L.queue.push(b);
  if (!L.flushing) { L.flushing = true; requestAnimationFrame(linuxFlush); }
}
async function linuxType(s, gap = 18) { for (const ch of s) { if (!LINUX.emu) return; LINUX.emu.serial0_send(ch); await wait(gap); } }
async function linuxSetup() {
  const L = LINUX, t = L.term;
  t.write('\r\n\x1b[2m  Setting up NightOS Linux' + (CFG.relay !== 'off' ? ' and connecting to the network' : '') + '…\x1b[0m\r\n');
  linuxStatus('Configuring…');
  const b64 = btoa(linuxSetupScript(t.rows, t.cols, CFG.relay !== 'off' ? 1 : 0));
  await linuxType('stty -echo\n', 4); await wait(300);
  for (let i = 0; i < b64.length; i += 800) { L.emu.serial0_send(`echo ${b64.slice(i, i + 800)} >> /tmp/nos.b64\n`); await wait(160); }
  L.emu.serial0_send('base64 -d /tmp/nos.b64 > /tmp/nos.sh; . /tmp/nos.sh\n');
}
function linuxStatus(s) { LINUX.statusText = s; const n = LINUX.win && $('.lx-status', LINUX.win.body); if (n) { n.textContent = s; n.hidden = !s; } updateLinuxTitle(); }
function updateLinuxTitle() {
  const L = LINUX; if (!L.win) return;
  const sub = L.state === 'off' ? 'Powered off' : L.state === 'ready' ? 'Alpine Linux 3.24 · running' : L.state === 'loading' ? 'Starting virtual machine' : 'Booting';
  L.win.setTitle(L.state === 'ready' ? 'root@nightos: ~' : 'Linux Terminal', sub);
}
async function rangeSupported(url) {
  try { const r = await fetch(url, { headers: { Range: 'bytes=0-1' } }); if (r.body && r.body.cancel) r.body.cancel(); return r.status === 206; } catch (e) { return false; }
}
async function linuxBoot() {
  const L = LINUX;
  if (typeof V86 === 'undefined') { L.term.write('\x1b[31mThe Linux emulator is not available in this copy of NightOS.\x1b[0m\r\nOpen the NightOS website to use real Linux.\r\n'); return; }
  if (L.emu) return;
  L.state = 'loading'; L.sentBoot = false; L.tail = ''; L.hidden = false; L.startedAt = Date.now();
  L.memMB = navigator.deviceMemory && navigator.deviceMemory < 4 ? 256 : 512;
  linuxStatus('Starting virtual machine…');
  L.term.write('\x1b[2mStarting an emulated x86 PC (' + L.memMB + ' MB RAM) and booting Alpine Linux. This takes about a minute.\x1b[0m\r\n\r\n');
  const asyncDisk = await rangeSupported(L.iso);
  const relay = CFG.relay === 'off' ? null : (CFG.relay || RELAY_DEFAULT);
  try {
    L.emu = new V86({
      wasm_path: 'vendor/v86/v86.wasm', memory_size: L.memMB * 1024 * 1024, vga_memory_size: 2 * 1024 * 1024,
      bios: { url: 'vendor/bios/seabios.bin' }, vga_bios: { url: 'vendor/bios/vgabios.bin' },
      cdrom: { url: L.iso, async: asyncDisk, size: L.isoSize }, autostart: true, disable_keyboard: true, disable_mouse: true,
      ...(relay ? { net_device: { type: 'virtio', relay_url: relay } } : {})
    });
  } catch (e) { L.term.write('\x1b[31mCould not start the virtual machine: ' + (e.message || e) + '\x1b[0m\r\n'); L.state = 'off'; L.emu = null; linuxStatus(''); return; }
  L.emu.add_listener('download-progress', e => { if (e.total && !asyncDisk) linuxStatus(`Downloading Linux… ${Math.round(e.loaded / e.total * 100)}%`); });
  L.emu.add_listener('emulator-started', () => { L.state = 'booting'; linuxStatus('Booting…'); });
  L.emu.add_listener('serial0-output-byte', linuxByte);
  clearTimeout(L.watch);
  L.watch = setTimeout(() => { if (L.emu && L.state === 'booting') L.term.write('\r\n\x1b[33mBooting is taking longer than usual. Slow computers can need two or three minutes. You can restart from the menu.\x1b[0m\r\n'); }, 180000);
}
function linuxPowerOff() {
  const L = LINUX; clearTimeout(L.watch);
  if (L.emu) { try { L.emu.destroy(); } catch (e) { } }
  L.emu = null; L.state = 'off'; L.queue = []; linuxStatus('');
  if (L.term) L.term.write('\r\n\x1b[2m[ The virtual machine is powered off. ]\x1b[0m\r\n');
}
function LinuxApp() {
  linuxEnsureTerm();
  const L = LINUX;
  const win = openWin({ app: 'linux', w: 820, h: 520, minW: 380, minH: 240, cls: 'force-dark', mem: 40 });
  L.win = win;
  win.body.innerHTML = '<div class="lx"><div class="lx-status" hidden></div></div>';
  const box = $('.lx', win.body); box.prepend(L.host);
  const refit = () => { try { L.fit.fit(); } catch (e) { } };
  const fitShell = () => { refit(); if (L.state === 'ready') L.emu.serial0_send(`stty rows ${L.term.rows} cols ${L.term.cols}\n`); L.term.focus(); };
  const pwr = hbtn('power', 'Power', () => menuAt(pwr, [
    L.emu ? { label: 'Restart', icon: 'restart', action: () => { linuxPowerOff(); L.term.reset(); linuxBoot(); } } : { label: 'Power On', icon: 'power', action: () => { L.term.reset(); linuxBoot(); } },
    L.emu ? { label: 'Power Off', icon: 'power', action: linuxPowerOff } : null]));
  const menuB = hbtn('menu', 'Main Menu', () => menuAt(menuB, [
    { label: 'Fit Shell to Window', action: fitShell, disabled: L.state !== 'ready' },
    { label: 'Copy', kb: 'Shift+Ctrl+C', action: () => { const s = L.term.getSelection(); if (s && navigator.clipboard) navigator.clipboard.writeText(s).catch(() => { }); } },
    { label: 'Paste', kb: 'Shift+Ctrl+V', action: () => { if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(s => { if (L.emu) L.emu.serial0_send(s); }).catch(() => notify('linux', 'Paste', 'Press Shift+Ctrl+V inside the terminal to paste.')); } },
    { label: 'Clear Scrollback', action: () => L.term.clear() }, '-',
    { label: 'Network Relay…', action: relayDialog },
    { label: 'About Linux Terminal', action: () => notify('linux', 'NightOS Linux', 'Alpine Linux 3.24 (kernel 6.18) on the v86 x86 emulator.') }]));
  win.hr.append(pwr, menuB);
  async function relayDialog() {
    const r = await winDialog(win, { title: 'Network Relay', body: 'The virtual machine reaches the internet through a WebSocket relay. Leave it empty for the public v86 relay, type “off” to disconnect, or enter your own wss:// address. It takes effect when the VM restarts.', entry: CFG.relay && CFG.relay !== RELAY_DEFAULT ? CFG.relay : '', buttons: [{ label: 'Cancel', value: 'c' }, { label: 'Save', cls: 'sug', value: 'ok' }], validate: v => !v.trim() || v.trim() === 'off' || /^wss?:\/\//.test(v.trim()) ? '' : 'Use a ws:// or wss:// address, or “off”.' });
    if (r.btn === 'ok') { const v = r.value.trim(); CFG.relay = v === '' ? RELAY_DEFAULT : v; saveCfg(); notify('linux', 'Relay saved', 'Restart the virtual machine to use it.'); }
  }
  win.onResize = () => requestAnimationFrame(refit);
  win.onFocus = () => L.term.focus();
  win.beforeClose = async () => {
    if (!L.emu) return true;
    const r = await winDialog(win, { title: 'Power off the Linux machine?', body: 'Powering off erases everything inside it. You can also keep it running in the background and reopen it later.', buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Keep Running', value: 'keep' }, { label: 'Power Off', cls: 'destr', value: 'off' }] });
    if (r.btn === 'off') { linuxPowerOff(); return true; }
    return r.btn === 'keep';
  };
  win.onClose = () => { L.host.remove(); L.win = null; };
  setTimeout(() => { refit(); L.term.focus(); }, 60);
  updateLinuxTitle(); linuxStatus(L.statusText || '');
  if (!L.emu) { L.term.reset(); linuxBoot(); }
  return win;
}
