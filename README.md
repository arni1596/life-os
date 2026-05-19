# Life OS

Life OS is a Next.js daily execution dashboard that turns a simple life blueprint into a Good Day or Bad Day Minimum plan, with local progress tracking, recent history, and CSV export.

## What It Does

Life OS helps the user open one page and know what to do today. It creates a simple daily plan, tracks the Daily Master 7 checklist, saves progress in the browser, keeps a short history, and exports monthly progress as a CSV file.

The app is built around small daily proof. It keeps the focus on simple actions, recovery after hard days, and visible progress over time.

## Why I Built It

I built Life OS to practice building a useful TypeScript and Next.js app around a real daily workflow. I wanted the app to support consistency without turning into a motivational quote board or a complicated productivity system.

The core idea is simple: a normal day gets a fuller plan, and a hard day still gets a minimum plan that counts.

## Current Features

- Generate a daily plan from a local API route.
- Switch between Good Day and Bad Day Minimum modes.
- Track the Daily Master 7 checklist.
- Check off plan steps with estimated minutes.
- Save today's progress in `localStorage`.
- Keep recent daily history.
- View past days as read-only records.
- Reset today's checkboxes without erasing saved history.
- Export the current month as a CSV file.
- Responsive layout for desktop and mobile.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Local browser storage

## How To Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

Run linting:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Local Data Note

Life OS stores progress in the browser with `localStorage`. It does not use a database, authentication, or a cloud account.

Progress is tied to the browser and device where the app is used. Clearing browser storage will clear saved progress.

## Screenshots

Add screenshots here before sharing the project publicly:

```markdown
![Life OS dashboard](public/screenshots/life-os-dashboard.png)
![Bad Day Minimum mode](public/screenshots/bad-day-minimum.png)
![Progress history](public/screenshots/progress-history.png)
```

## Future Improvements

- Add editable plan items.
- Add a weekly summary view.
- Add better long-term trend visuals.
- Add import support for previously exported CSV files.
- Add tests for local storage behavior and CSV export.
- Add screenshot images for the README.

## Resume-Ready Highlights

- Built a TypeScript and Next.js daily execution dashboard with local progress tracking and read-only history views.
- Implemented Good Day and Bad Day Minimum modes to support both normal execution and recovery-friendly planning.
- Used `localStorage` to persist checklist state, plan progress, selected date, and monthly history without adding a database.
- Added CSV export for monthly progress records.
- Designed a calm, responsive interface focused on small daily actions and visible follow-through.
