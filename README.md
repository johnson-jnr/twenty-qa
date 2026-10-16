# twentyQA

Automated end-to-end tests I use to help me test [Twenty CRM](https://github.com/twentyhq/twenty) on a local instance. These tests help me catch edge cases and subtle bugs that are easy to miss when clicking through the app by hand. Also let me rerun same scenarios after a fix or a new Twenty release.

The tests drive the Twenty web app in a real browser and seed or clean up data through the Twenty API. They're meant to run on your machine against a local Twenty instance, not against a hosted or production workspace.

## Technologies

- [Playwright](https://playwright.dev) (`@playwright/test`) for running tests and generating reports
- TypeScript
- [pnpm](https://pnpm.io)

## Prerequisites

- **Node.js 20.12 or newer.** The config loads `.env` with `process.loadEnvFile`.
- **pnpm 11.** `package.json` requires pnpm, `npm`/`npx` commands fail with `EBADDEVENGINES`. Use `pnpm` and `pnpm exec` instead.
- **Twenty running locally.** Follow Twenty's [local setup guide](https://docs.twenty.com/developers/contribute/capabilities/local-setup). By default the frontend runs on `http://localhost:3001` and the backend on `http://localhost:3000`.

The tests sign in with the demo account that the local setup seeds. The login screen comes pre-filled, so the tests just click **Continue** and **Sign in**. If you reset or change that workspace, sign-in in `beforeEach` is the first thing to check.

## Setup

1. Install dependencies and the browser:

   ```sh
   pnpm install
   pnpm exec playwright install chromium
   ```

2. Create your `.env` from the example:

   ```sh
   cp .env.example .env
   ```

3. In Twenty, go to **Settings → APIs & Webhooks**, create an API key, and set it as `TWENTY_API_KEY` in `.env`. Change `TWENTY_APP_URL` or `TWENTY_API_URL` only if your Twenty instance doesn't use the default ports.

   | Variable | Default | Used for |
   |---|---|---|
   | `TWENTY_APP_URL` | `http://localhost:3001` | Playwright `baseURL` (the web app) |
   | `TWENTY_API_URL` | `http://localhost:3000` | REST and metadata API calls for seeding and cleanup |
   | `TWENTY_API_KEY` | none (required) | Bearer token for those API calls |


## Running tests

```sh
pnpm exec playwright test                                # everything
pnpm exec playwright test e2e/opportunities              # one folder
pnpm exec playwright test -g "different currencies"      # tests whose title matches
pnpm exec playwright test --headed                       # watch the browser
pnpm exec playwright test --trace on                     # record a trace for every test
pnpm exec playwright show-report                         # open the last HTML report
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm list-tests` | Lists every test Playwright would run, one per line, without running them. Useful for checking what a `-g` filter or folder matches. |
| `pnpm save-report` | Copies the last HTML report from `playwright-report/` into `reports/<test-name>_<date-time>/` so the next run doesn't overwrite it. It prints the folder it saved to and the command to open it. It refuses to save a report from a `--list` run or one with no executed tests. |

`playwright-report/` is replaced on every run, so run `pnpm save-report` right after a run you want to keep.

## Project layout

```
e2e/
├── helpers/
│   ├── config.ts       API URL and API key, read from .env
│   ├── selectors.ts    shared locators for the Twenty UI
│   ├── api.ts          seed and cleanup through the Twenty API
│   └── ui.ts           page actions and assertions (open list, set aggregate, create record…)
├── opportunities/
│   └── list.spec.ts    Opportunities list e2e tests
└── example.spec.ts     Playwright's sample test (runs against playwright.dev)
scripts/
└── save-report.mjs     the save-report script
reports/                saved reports (gitignored)
```

Specs use the helpers rather than calling the API or building locators themselves. Put new API calls in `api.ts`, new page interactions in `ui.ts`, and new locators in `selectors.ts`.

## License

[MIT](LICENSE)
