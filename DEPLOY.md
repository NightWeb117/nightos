# Putting NightOS online

This publishes NightOS to GitHub Pages for free. After the first setup,
every `git push` updates the live site in about a minute.

## One-time setup

### 1. Install Git

Open PowerShell and run:

```bash
winget install --id Git.Git -e
```

Close and reopen PowerShell afterwards so the `git` command is found.

### 2. Create the GitHub repository

1. Sign up or sign in at https://github.com
2. Click **+** (top right) › **New repository**
3. Name it `nightos`, choose **Public** (free Pages hosting needs a public repo),
   and leave every "Add a README / .gitignore / license" box **unchecked**
4. Click **Create repository** and keep the page open

### 3. Push the code

In PowerShell, replace `YOUR-USERNAME` with your GitHub username:

```bash
cd $HOME\Downloads\nightos
git init -b main
git add -A
git commit -m "First version of NightOS"
git remote add origin https://github.com/YOUR-USERNAME/nightos.git
git push -u origin main
```

The first push opens a browser window asking you to sign in to GitHub. The
upload is about 55 MB, mostly the Linux image, so it can take a minute.
GitHub may warn that the Linux image is larger than 50 MB. That warning is
expected and the push still succeeds.

### 4. Turn on Pages

1. In the repository, open **Settings** › **Pages**
2. Under **Build and deployment** › **Source**, choose **GitHub Actions**
3. Open the **Actions** tab and wait for "Deploy NightOS" to turn green.
   If it ran before you changed the setting and failed, click it and choose **Re-run all jobs**

Your site is now live at:

```
https://YOUR-USERNAME.github.io/nightos/
```

## Pushing updates

After changing any file:

```bash
cd $HOME\Downloads\nightos
git add -A
git commit -m "Describe what you changed"
git push
```

The Actions tab shows each deploy. The live site updates when it turns green.
Press Ctrl+F5 on the site if you still see the old version.

## Optional: your own domain

In **Settings** › **Pages** › **Custom domain**, enter a domain you own and
follow GitHub's DNS instructions.

## Limits to know about

- GitHub Pages allows about 100 GB of downloads per month. Each visit to
  Linux Terminal reads part of the 51 MB Linux image, so that covers
  thousands of Linux sessions.
- Single files must stay under 100 MB, and the whole site under 1 GB.
