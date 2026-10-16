// .env is loaded in playwright.config.ts, which also sets baseURL from TWENTY_APP_URL.
export const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
// Settings > APIs & Webhooks > create an API key, then put TWENTY_API_KEY in .env.
export const API_KEY = process.env.TWENTY_API_KEY ?? '';
