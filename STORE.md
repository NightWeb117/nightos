# The NightOS App Center

App Center lists the apps in `site/store/catalog.json`. There are two kinds:

- **web**: a link. NightOS opens it in a new browser tab, because most sites
  (Discord, Steam, YouTube) refuse to be shown inside another page.
- **html**: a game or tool that runs inside a NightOS window, in a sandboxed
  iframe. The sandbox gives it its own blank origin, so it can't read NightOS's
  files, settings, cookies or storage. One side effect: `localStorage` is not
  available to these apps, so wrap it in `try`/`catch`.

Anyone can also add their own `.html` file or website from **App Center ›
Add Apps**. Those stay in their own browser and are never shared.

## Reviewing a submission

People submit apps through the "Submit an app" issue form on GitHub. To publish one:

1. Read the issue and download the attached file.
2. Open the code and check it. Look for anything that loads scripts from other
   sites, sends data somewhere, mines crypto, or tries to escape the sandbox
   (`window.top`, `parent.postMessage` spam, pop-up loops). When in doubt, say no.
3. Make sure the person made it or has the right to share it. Don't accept
   copies of existing commercial games.
4. Put the files in `site/store/apps/<id>/` with an `index.html` at the top.
5. Add an entry to `site/store/catalog.json`:

```json
{ "id": "moonmaze", "name": "Moonlight Maze", "kind": "html",
  "path": "store/apps/moonmaze/index.html", "category": "Games",
  "author": "their GitHub name", "color": "#5ec7c1", "letter": "M",
  "summary": "One line for the card.", "description": "A longer description." }
```

   A web app uses `"kind": "web"` and `"url": "https://…"` instead of `path`.
6. Commit, push, and close the issue with a thank-you. The site redeploys in
   about a minute.

To feature an app on the App Center front page, set `"featured"` at the top of
`catalog.json` to its `id`.
