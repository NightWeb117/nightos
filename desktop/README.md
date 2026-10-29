# NightOS for Windows

The desktop app is the NightOS website packaged with Electron. Running as a real
program lets it do things a web page can't:

- **Steam:** reads your Steam library and lists every installed game in
  **Game Library**, the launcher and search, with its Steam cover art. Play starts
  the game through Steam, so updates, cloud saves and anti-cheat work as usual.
- **Discord:** opens your installed Discord. If Discord isn't installed, its web
  app opens in a NightOS window instead.
- **Real websites:** Nightfox and App Center web apps load actual sites in NightOS
  windows. Logins are kept between sessions.
- **Windows programs:** the programs and shortcuts on your Windows desktop
  (`.exe`, `.lnk`, `.url`) show up on the NightOS desktop and in **Windows
  Programs**, with their real icons. Add any other program with **Add Program…**,
  or drag it from File Explorer onto NightOS. The first time each one runs, a
  Windows dialog asks you to confirm.
- **Your Windows folders:** Files › Windows Folders opens your real Desktop,
  Documents, Downloads, Pictures, Music and Videos. NightOS asks in a Windows dialog
  before using each one. Deleted things go to the Recycle Bin, and NightOS never
  writes programs or scripts there.
- **Running programs in the taskbar:** windows open on your PC show up in the NightOS
  panel or dock. Click to switch or minimize, right-click to close.
- **Flatpak apps:** App Center › Flatpak lists the apps on Flathub. Flatpaks are Linux
  programs, so NightOS installs them into WSL (Windows Subsystem for Linux) and they open
  as their own windows. The first time, NightOS offers to install WSL (needs admin and a
  restart) and then Flatpak inside it. Installed Flatpaks show up in Activities, and the
  terminal has `flatpak list`, `flatpak run` and `flatpak search`.
- **Screen Recorder:** records the NightOS window or the whole screen, with sound.
- **Updates:** the installed app checks GitHub Releases, downloads new versions in
  the background and installs them when NightOS restarts. The portable `.exe`
  can't replace itself, so it tells you when a new version is out and offers the
  download. **Settings › Desktop App › Updates** has Check Now and an on/off switch.
- **Full screen:** press F11 any time, or turn on **Settings › Desktop App ›
  Start in full screen**. **Power Off** quits the app.

Games and the Discord and Steam apps open in their own windows on top of NightOS.
NightOS can start them, but can't draw other programs inside its own windows.

## Build it

Needs Node.js. From this folder:

```bash
npm install
```

```bash
npm run dist
```

The installer and portable `.exe` are written to `release/`, with `latest.yml` and
the installer's `.blockmap`. Upload all four to the GitHub release, or installed
copies won't see the update. The website in `../site`
is bundled in, so rebuild after you change it.

If the build fails with `EBUSY ... app.asar`, something on the PC (usually an
antivirus scan) is holding the previous build open. Wait a minute, or build to another
folder:

```bash
npx electron-builder --win nsis portable --config.directories.output=C:\Temp\nightos-build
```

## Try it without building

```bash
npm start
```

```bash
npm run selftest
```

`selftest` opens NightOS, checks the native features, and saves screenshots and a
report to `selftest/`, then quits.

## Security

The page can only call the actions listed in `preload.js`: list Steam games, launch
Discord, Steam, a Steam game by its number or a Steam page, open a web link in your
browser, switch full screen, list, add or run Windows programs, and search, install,
remove or run Flatpak apps. A Flatpak only installs after you confirm in a native dialog, and
only apps that are already installed can run. `main.js` checks
each request again. A program only runs if it's an existing `.exe`, `.lnk` or `.url`
file with a full path, and the first run of each one needs your OK in a native
Windows dialog that page content can't fake or click. Approvals are stored in
`desktop.json` in the app's data folder, and **Settings › Desktop App › Forget
approved programs** clears them. App Center apps
run in sandboxed frames and can't reach any of these. Websites in NightOS windows get
the microphone and notifications only on the sites listed in `TRUSTED_WEB` in `main.js`.

The app isn't code-signed, so Windows SmartScreen warns the first time. Choose
**More info › Run anyway**.
