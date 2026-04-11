# MCE AU Results Explorer

Next.js explorer app for AU result analytics.

## Features

- Filter by department, semester, batch, and rank list size.
- Overview cards for pass/fail and arrears distribution.
- Student profile lookup by register number.
- Ranking table and subject-wise pass metrics.

## Backend API Base URL

The app reads backend base from `NEXT_PUBLIC_API_BASE_URL`.

- Default fallback: `http://127.0.0.1:3000/api/v2`

Example `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/api/v2
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run build
```
