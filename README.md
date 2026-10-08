# Lucky Draw Spinner

A responsive React + Vite lucky draw wheel. Each visitor's participant list and temporary leave list are stored locally in their browser; no account or shared server state is used.

## Requirements

- Node.js 18 or newer
- npm

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

The deployable static site is generated in `dist/`.

## Deploy to Vercel

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Keep the detected Vite settings, or set the build command to `npm run build` and the output directory to `dist`.
4. Select **Deploy**. Vercel will provide a public URL and can redeploy automatically when you push changes.

The included `vercel.json` rewrites requests to the app entry point. Participant changes and leave status are stored independently in each visitor's browser `localStorage`.

## Change participant names

Edit the default `PARTICIPANTS` array in [`src/participants.js`](./src/participants.js). Visitors can also add names or permanently remove them from Settings; those changes persist in that browser only. Existing saved visitor lists are not overwritten by changes to the defaults. Temporary leave records expire 24 hours after they are created.
