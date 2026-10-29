# NightOS

**[Try it in your browser](https://nightweb117.github.io/nightos/)** · **[Download NightOS for Windows](https://github.com/NightWeb117/nightos/releases/latest)**

A Linux desktop that runs in your browser. The desktop, windows and apps are
written in plain JavaScript. The **Linux Terminal** app boots real Alpine Linux
on an emulated x86 PC, so the kernel, processes and package manager are real.

## What's real

| Part | How |
| --- | --- |
| Linux kernel, processes, `ps`, `htop`, `kill` | Alpine Linux 3.24 booted by the [v86](https://github.com/copy/v86) x86 emulator |
| `apt install …` / `apk add …` | The VM reaches Alpine's package mirrors through a WebSocket network relay. `apt` is a small wrapper around `apk` |
| NightOS Terminal (the other terminal) | A bash interpreter written in JavaScript, plus real Python (Brython) and real JavaScript (`node`) |
| Files | Import from your computer, download back out, stored in IndexedDB |
| Battery, network state, memory, CPU load, storage | Read from browser APIs |
| App Center | Web apps (Discord, Steam store, YouTube…) open in a real tab; HTML games run sandboxed in NightOS windows. See [STORE.md](STORE.md) |

What is still simulated: the NightOS desktop's own process list, and the
Nightfox browser, which only shows the built-in nightos.org pages.

## Run it on your computer

The site is static files. Serve the `site` folder with any web server:

```bash
cd site
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk does
not work, because the emulator has to download its files.

## Project layout

```
site/                  everything that gets published
  index.html           page shell and all CSS
  js/                  core.js (window manager, files), shell.js (top bar, dock),
                       term.js + bash.js (NightOS shell), langs.js (Python, JS),
                       apps.js / apps2.js (apps), real.js (browser data),
                       linux.js (the Alpine VM), system.js (boot, lock screen)
  vendor/              v86, xterm.js and the BIOS files, kept local on purpose
  images/              the Alpine Linux CD image the VM boots
.github/workflows/     deploys site/ to GitHub Pages on every push
```

## Network relay

The VM's network goes through `wss://relay.widgetry.org/`, a public relay
run for v86 users. It is free and shared, so it can be slow or rate limited.
To use your own, run a WebSocket-to-Ethernet relay such as
[websockproxy](https://github.com/benjamincburns/websockproxy) and enter its
address in Linux Terminal › menu › Network Relay.

## Updating Alpine

Download a newer `alpine-virt-*-x86.iso` from
https://alpinelinux.org/downloads/ into `site/images/`, then update `iso`,
`isoSize` and the version in the repository URLs in `site/js/linux.js`.

## Credits and licenses

- [v86](https://github.com/copy/v86): BSD 2-Clause (see `site/vendor/v86/LICENSE`)
- [xterm.js](https://github.com/xtermjs/xterm.js): MIT (see `site/vendor/xterm/LICENSE`)
- [Alpine Linux](https://alpinelinux.org): redistributed unmodified. Its packages carry their own
  licenses, mostly GPL. Source code is available at https://gitlab.alpinelinux.org/alpine/aports
- [Brython](https://brython.info): BSD 3-Clause, loaded from jsDelivr when Python first runs
- [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro): MIT, loaded for screenshots
- Cantarell and JetBrains Mono fonts: SIL Open Font License, from Google Fonts
