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

The installer and portable `.exe` are written to `release/`. The website in `../site`
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
browser, and switch full screen. `main.js` checks each request again. App Center apps
run in sandboxed frames and can't reach any of these. Websites in NightOS windows get
the microphone and notifications only on the sites listed in `TRUSTED_WEB` in `main.js`.

The app isn't code-signed, so Windows SmartScreen warns the first time. Choose
**More info › Run anyway**.
