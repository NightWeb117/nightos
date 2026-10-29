'use strict';
/* ================= session, lock screen, boot, power ================= */
const SYSTEM = {
  state: 'lock', session: false,
  lock() { closePops(); closeOverview(); closeMenu(); showLock('lock'); },
  powerAction(a) {
    if (a === 'suspend') return SYSTEM.suspend();
    if (a === 'restart') return shellDialog({ title: 'Restart', body: 'The system will restart automatically in {n} seconds.', countdown: { secs: 60, done: SYSTEM.restart }, buttons: [{ label: 'Cancel' }, { label: 'Restart', cls: 'destr', action: SYSTEM.restart }] });
    if (a === 'off') return shellDialog({ title: 'Power Off', body: 'The system will power off automatically in {n} seconds.', countdown: { secs: 60, done: SYSTEM.poweroff }, buttons: [{ label: 'Cancel' }, { label: 'Power Off', cls: 'destr', action: SYSTEM.poweroff }] });
    if (a === 'logout') return shellDialog({ title: 'Log Out', body: 'Night will be logged out automatically in {n} seconds.', countdown: { secs: 60, done: SYSTEM.logout }, buttons: [{ label: 'Cancel' }, { label: 'Log Out', cls: 'sug', action: SYSTEM.logout }] });
  },
  closeAll() { WM.wins.slice().forEach(w => closeWin(w, true)); closePops(); closeOverview(); closeMenu(); $('#modal') && $('#modal').remove(); $('#toasts').innerHTML = ''; },
  logout() { SYSTEM.closeAll(); SYSTEM.session = false; setTimeout(() => showLock('login'), 250); },
  async suspend() {
    closePops(); SYSTEM.state = 'suspend'; const b = $('#boot'); b.hidden = false; b.innerHTML = ''; b.style.cursor = 'default';
    await wait(900);
    const wake = () => { b.removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); b.hidden = true; showLock('lock'); };
    b.addEventListener('pointerdown', wake); addEventListener('keydown', wake);
  },
  async shutdownSeq(reboot) {
    SYSTEM.closeAll(); SYSTEM.state = 'boot'; $('#lock').hidden = true;
    const b = $('#boot'); b.hidden = false; b.style.cursor = 'none';
    b.innerHTML = `<div class="splash">${LOGO}<div class="word">NightOS</div><div class="spinner"></div><div class="msg">${reboot ? 'Restarting…' : 'Shutting down…'}</div></div>`;
    await wait(1600);
    b.innerHTML = '<div class="klog"></div>'; const k = $('.klog', b);
    const L = ['[  OK  ] Stopped target graphical.target - Graphical Interface.', '         Stopping nightdm.service - Night Display Manager...', '[  OK  ] Stopped nightdm.service - Night Display Manager.', '         Stopping NetworkManager.service - Network Manager...', '[  OK  ] Stopped NetworkManager.service - Network Manager.', '[  OK  ] Stopped bluetooth.service - Bluetooth service.', '[  OK  ] Stopped cups.service - CUPS Scheduler.', '[  OK  ] Removed slice user-1000.slice - User Slice of UID 1000.', '[  OK  ] Unmounted boot-efi.mount - /boot/efi.', '[  OK  ] Stopped target local-fs.target - Local File Systems.', '[  OK  ] Reached target shutdown.target - System Shutdown.', `[  OK  ] Finished systemd-${reboot ? 'reboot' : 'poweroff'}.service - System ${reboot ? 'Reboot' : 'Power Off'}.`, `[${((Date.now() - SYS.boot) / 1000).toFixed(6).padStart(12)}] reboot: ${reboot ? 'Restarting system' : 'Power down'}`];
    for (const l of L) { k.append(klogLine(l)); await wait(70 + Math.random() * 90); }
    await wait(500); b.innerHTML = ''; await wait(700);
  },
  async restart() { await SYSTEM.shutdownSeq(true); bootSequence(); },
  async poweroff() {
    await SYSTEM.shutdownSeq(false);
    const b = $('#boot'); b.style.cursor = 'default';
    b.innerHTML = `<div class="off"><button aria-label="Power on">${sym('power')}</button><span>Press to power on</span></div>`;
    $('button', b).onclick = () => bootSequence();
  },
  async restartShell() {
    const parts = [$('#topbar'), $('#dock'), $('#desk')]; parts.forEach(p => { p.style.transition = 'opacity .3s'; p.style.opacity = 0; });
    notify('settings', 'Restarting…', '', { urgent: true, ms: 1400 });
    await wait(1200); parts.forEach(p => p.style.opacity = 1); const sh = PROCS.find(p => p.name === 'dusk-shell'); if (sh) sh.pid = nextPid();
  },
  async panic(kind) {
    SYSTEM.state = 'boot'; closePops(); closeMenu(); closeOverview();
    const b = $('#boot'); b.hidden = false; b.style.cursor = 'none';
    const t = ((Date.now() - SYS.boot) / 1000).toFixed(6).padStart(12);
    const msg = kind === 'init' ? 'Attempted to kill init! exitcode=0x00000009' : 'VFS: Unable to mount root fs on unknown-block(0,0)';
    b.innerHTML = `<div class="panic">[${t}] Kernel panic - not syncing: ${msg}
[${t}] CPU: 3 PID: 1 Comm: ${kind === 'init' ? 'systemd' : 'swapper/0'} Not tainted 6.8.0-45-night #47-NightOS
[${t}] Hardware name: Browser Virtual Machine/NightBoard, BIOS 1.0.4 10/13/2026
[${t}] Call Trace:
[${t}]  &lt;TASK&gt;
[${t}]  dump_stack_lvl+0x48/0x70
[${t}]  panic+0x34e/0x380
[${t}]  do_exit+0x9d2/0xab0
[${t}]  do_group_exit+0x35/0x90
[${t}]  get_signal+0x8e1/0x900
[${t}]  arch_do_signal_or_restart+0x29/0x250
[${t}]  syscall_exit_to_user_mode+0x14e/0x1f0
[${t}]  entry_SYSCALL_64_after_hwframe+0x78/0x80
[${t}]  &lt;/TASK&gt;
[${t}] Kernel Offset: 0x2a000000 from 0xffffffff81000000 (relocation range: 0xffffffff80000000-0xffffffffbfffffff)
[${t}] ---[ end Kernel panic - not syncing: ${msg} ]---

<span class="c-d">Rebooting in 6 seconds…</span></div>`;
    if (kind === 'rm') { FS = defaultFS(); store.set('fs1', FS); INSTALLED = new Set(); saveInstalled(); }
    WM.wins.slice().forEach(w => closeWin(w, true));
    await wait(6000); bootSequence(true);
  }
};
function klogLine(l) {
  const d = document.createElement('div');
  d.innerHTML = esc(l).replace('[  OK  ]', '[  <span class="ok">OK</span>  ]').replace(/(\bwarning\b|\bW:)/i, '<span class="warn">$1</span>');
  return d;
}
async function bootSequence(skipGrub) {
  SYSTEM.state = 'boot'; SYSTEM.session = false; $('#lock').hidden = true;
  const b = $('#boot'); b.hidden = false; b.style.cursor = 'none'; b.innerHTML = '';
  await wait(600);
  let skip = false; const onKey = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skip = true; if (e.key === 'ArrowDown') sel = Math.min(3, sel + 1); if (e.key === 'ArrowUp') sel = Math.max(0, sel - 1); draw && draw(); };
  let sel = 0, draw = null; addEventListener('keydown', onKey); b.onpointerdown = () => skip = true;
  if (!skipGrub) {
    b.innerHTML = '<div class="grub"><pre></pre></div>'; const pre = $('pre', b), ents = ['NightOS', 'Advanced options for NightOS', 'Memory test (memtest86+x64.efi)', 'UEFI Firmware Settings']; let left = 3;
    draw = () => { pre.innerHTML = `${''.padStart(26)}GNU GRUB  version 2.12\n\n ┌${'─'.repeat(66)}┐\n${ents.map((e, i) => ` │${i === sel ? `<span class="hl">*${e.padEnd(65)}</span>` : ' ' + e.padEnd(65)}│`).join('\n')}\n${' │' + ' '.repeat(66) + '│\n'}${' │' + ' '.repeat(66) + '│\n'} └${'─'.repeat(66)}┘\n\n      Use the ↑ and ↓ keys to select which entry is highlighted.\n      Press enter to boot the selected OS, \`e' to edit the commands\n      before booting or \`c' for a command-line.\n   The highlighted entry will be executed automatically in ${left}s.`; };
    draw();
    while (left > 0 && !skip) { await wait(1000); if (!skip) { left--; draw(); } }
  }
  draw = null; skip = false;
  b.innerHTML = '<div class="klog"></div>'; const k = $('.klog', b);
  const T = (s) => `[${s.toFixed(6).padStart(12)}] `;
  const kern = ['Linux version 6.8.0-45-night (buildd@nightos-builder) (x86_64-linux-gnu-gcc-13 (NightOS 13.2.0-23night1) 13.2.0, GNU ld (GNU Binutils for NightOS) 2.42) #47-NightOS SMP PREEMPT_DYNAMIC Tue Oct 13 09:12:44 UTC 2026', 'Command line: BOOT_IMAGE=/boot/vmlinuz-6.8.0-45-night root=UUID=4f2c9a1e-7b3d-4e8a-9c21-6d5e0f8b1a37 ro quiet splash vt.handoff=7', 'KERNEL supported cpus:', '  Intel GenuineIntel', '  AMD AuthenticAMD', 'BIOS-provided physical RAM map:', 'BIOS-e820: [mem 0x0000000000000000-0x000000000009efff] usable', 'BIOS-e820: [mem 0x0000000000100000-0x000000003fffffff] usable', 'NX (Execute Disable) protection: active', 'efi: EFI v2.8 by NightBoard', 'DMI: Browser Virtual Machine/NightBoard, BIOS 1.0.4 10/13/2026', 'tsc: Detected 3200.000 MHz processor', 'ACPI: Early table checksum verification disabled', `Memory: 16194332K/16656148K available (20480K kernel code, 4372K rwdata, 14184K rodata, 4744K init, 17352K bss, 461556K reserved, 0K cma-reserved)`, `smpboot: CPU0: ${CPU_NAME} (family: 0x19, model: 0x61, stepping: 0x2)`, `smp: Brought up 1 node, ${SYS.cores} CPUs`, 'devtmpfs: initialized', 'PCI: Using configuration type 1 for base access', 'ACPI: Interpreter enabled', 'iommu: Default domain type: Translated', 'pci 0000:00:02.0: vgaarb: setting as boot VGA device', 'NET: Registered PF_INET protocol family', 'nvme nvme0: pci function 0000:02:00.0', 'nvme nvme0: 8/0/0 default/read/poll queues', ' nvme0n1: p1 p2', 'EXT4-fs (nvme0n1p2): mounted filesystem 4f2c9a1e-7b3d-4e8a-9c21-6d5e0f8b1a37 ro with ordered data mode. Quota mode: none.', 'systemd[1]: systemd 255.4-1night8 running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +IMA +SMACK +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +IPTC +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 -PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD -BPF_FRAMEWORK -XKBCOMMON +UTMP +SYSVINIT default-hierarchy=unified)', 'systemd[1]: Detected architecture x86-64.', 'systemd[1]: Hostname set to <nightos>.'];
  let t = 0;
  for (const l of kern) { if (skip) break; t += Math.random() * .08 + .002; k.append(klogLine(T(t) + l)); await wait(28); }
  const units = ['Created slice system-modprobe.slice - Slice /system/modprobe.', 'Started systemd-journald.service - Journal Service.', 'Finished systemd-remount-fs.service - Remount Root and Kernel File Systems.', 'Started systemd-udevd.service - Rule-based Manager for Device Events and Files.', 'Mounted boot-efi.mount - /boot/efi.', 'Reached target local-fs.target - Local File Systems.', 'Started systemd-resolved.service - Network Name Resolution.', 'Started systemd-timesyncd.service - Network Time Synchronization.', 'Started dbus.service - D-Bus System Message Bus.', 'Started NetworkManager.service - Network Manager.', 'Reached target network.target - Network.', 'Started wpa_supplicant.service - WPA supplicant.', 'Started bluetooth.service - Bluetooth service.', 'Started polkit.service - Authorization Manager.', 'Started cups.service - CUPS Scheduler.', 'Reached target multi-user.target - Multi-User System.', 'Started nightdm.service - Night Display Manager.', 'Reached target graphical.target - Graphical Interface.'];
  for (const u of units) { if (skip) break; k.append(klogLine('[  OK  ] ' + u)); if (u.includes('nightdm')) k.append(klogLine('         Starting nightdm.service - Night Display Manager...')); await wait(55 + Math.random() * 60); }
  removeEventListener('keydown', onKey); b.onpointerdown = null;
  await bootFilm(b);
  SYS.boot = Date.now(); b.hidden = true; b.innerHTML = '';
  showLock('login');
}
// The spider-and-moon film plays where a plain splash used to. Settings › Appearance can turn it off.
async function bootFilm(b) {
  if (typeof playIntro !== 'function' || CFG.bootFilm === false) {
    b.innerHTML = `<div class="splash">${LOGO}<div class="word">NightOS</div><div class="spinner"></div></div>`;
    await wait(1700); return;
  }
  b.innerHTML = ''; await playIntro(b);
}

/* ================= lock screen ================= */
function renderLockClock() {
  const d = new Date(), t = $('.lk-time'), dt = $('.lk-date'); if (!t) return;
  t.textContent = hhmm(d); dt.textContent = `${WDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function showLock(mode) {
  SYSTEM.state = 'lock'; closePops(); closeMenu(); closeOverview();
  const L = $('#lock'); L.hidden = false; L.classList.remove('out', 'auth');
  L.innerHTML = `<canvas id="lockbg"></canvas><div class="lk-bar"><span class="lk-tray" style="display:flex;gap:12px"></span></div>
    <div class="lk-clock"><div class="lk-date"></div><div class="lk-time"></div></div>
    <div class="lk-hint">${sym('up')}<span>${mode === 'login' ? 'Click or press a key to log in' : 'Click or press a key to unlock'}</span></div>
    <form class="lk-auth" autocomplete="off"><div class="avatar" aria-hidden="true">N</div><div class="lk-name">Night</div><div class="lk-pw"><input id="lkpw" type="password" placeholder="Password" aria-label="Password" autocomplete="off"><button class="lk-go" type="submit" aria-label="${mode === 'login' ? 'Log in' : 'Unlock'}">${sym('fwd')}</button></div><div class="lk-msg" aria-live="polite"></div></form>`;
  const cv = $('#lockbg', L); cv.width = wallCanvas.width; cv.height = wallCanvas.height; cv.getContext('2d').drawImage(wallCanvas, 0, 0);
  renderLockClock(); renderTray();
  const form = $('form', L), pw = $('#lkpw', L), msg = $('.lk-msg', L);
  const toAuth = () => { if (L.classList.contains('auth')) return; L.classList.add('auth'); setTimeout(() => pw.focus(), 60); };
  const toClock = () => { L.classList.remove('auth'); pw.value = ''; msg.textContent = ''; pw.blur(); };
  L.onpointerdown = e => { if (!L.classList.contains('auth')) toAuth(); else if (!e.target.closest('form')) toClock(); };
  L.onkeydown = null;
  const keyH = e => {
    if (SYSTEM.state !== 'lock') return;
    if (e.key === 'Escape') { toClock(); return; }
    if (!L.classList.contains('auth') && !e.ctrlKey && !e.metaKey && !e.altKey) { toAuth(); if (e.key.length === 1) { e.preventDefault(); setTimeout(() => { pw.value += e.key; }, 70); } }
  };
  removeEventListener('keydown', window.__lockKey || (() => { })); window.__lockKey = keyH; addEventListener('keydown', keyH);
  form.onsubmit = async e => {
    e.preventDefault();
    const go = $('.lk-go', L); go.innerHTML = '<span class="spinner"></span>'; pw.disabled = true;
    await wait(650 + Math.random() * 300);
    msg.textContent = '';
    L.classList.add('out'); SYSTEM.state = 'desktop';
    setTimeout(() => { L.hidden = true; L.innerHTML = ''; }, 460);
    removeEventListener('keydown', keyH);
    if (!SYSTEM.session) { SYSTEM.session = true; onLogin(); }
    else focusTop();
  };
}
function onLogin() {
  SYS.boot = SYS.boot || Date.now(); playSound('login');
  setTimeout(() => notify('settings', 'Welcome to NightOS 24.10', 'Open Activities in the top-left corner to find your apps.'), 900);
  if (!CFG.upgraded) setTimeout(() => notify('settings', 'Software Updates', '3 updates are available for your system.', { actionLabel: 'Open Terminal', action: () => { const w = launch('terminal'); setTimeout(() => { const i = w && w.body.querySelector('.t-in'); if (i) i.value = 'sudo apt update && sudo apt upgrade'; }, 50); }, ms: 8000 }), 7000);
  if (CFG.helloOnStart !== false && APPS.hello) setTimeout(() => launch('hello'), 600);
  else if (!CFG.toured) setTimeout(() => launch('tour'), 600);
  if (CFG.autoSnap && typeof createSnapshot === 'function') setTimeout(() => createSnapshot(`Automatic – ${fmtWhen(Date.now())}`, true), 3000);
  if (CFG.vm && CFG.vm.autostart && APPS.linux) setTimeout(() => { const w = launch('linux'); if (w) setTimeout(() => minimizeWin(w), 400); }, 1500);
}

/* ================= boot the page ================= */
function init() {
  applyLook(); renderWall(false); initShell();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => renderWall(false), 250); });
  setInterval(sysTick, 1000); sysTick();
  setInterval(() => { if (!REAL.battery && CFG.battery > 4 && Math.random() < .5) { CFG.battery--; saveCfg(); renderTray(); if (CFG.battery === 20) notify('settings', 'Low Battery', '20 % remaining', { urgent: true }); } }, 120000);
  SYSTEM.state = 'boot';
  const b = $('#boot'); b.hidden = false; b.style.cursor = 'none';
  bootFilm(b).then(() => { b.hidden = true; b.innerHTML = ''; showLock('login'); });
}
init();
