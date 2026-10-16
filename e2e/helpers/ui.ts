import { expect, type Page } from '@playwright/test';
import { getOpportunityTableViewId } from './api';
import { SELECTORS } from './selectors';

export type AggregateOperation = 'Sum' | 'Average' | 'Min' | 'Max';

// Without a viewId the app opens the last used view, which may be the
// "By Stage" Kanban board with no table rows. Same id for the whole worker.
let tableViewId: string | undefined;

// The app applies filter/sort params and then strips them from the URL,
// so page.reload() drops them. Call this again instead of reloading.
export const openListFilteredByName = async (
  page: Page,
  namePart: string,
  sort?: { field: string; direction: 'ASC' | 'DESC' },
) => {
  tableViewId ??= await getOpportunityTableViewId(page.request);
  const params = new URLSearchParams({
    viewId: tableViewId,
    'filter[name][CONTAINS]': namePart,
  });
  if (sort) params.set(`sort[${sort.field}]`, sort.direction);
  await page.goto(`/objects/opportunities?${params.toString()}`);
  // Unfiltered rows can linger briefly, so wait until only matching rows show.
  await expect
    .poll(
      async () => {
        const names = await readRowNames(page);
        return names.length > 0 && names.every((name) => name.includes(namePart));
      },
      { message: `table rows filtered to "${namePart}"`, timeout: 20_000 },
    )
    .toBe(true);
};

export const setAmountAggregate = async (page: Page, operation: AggregateOperation) => {
  await page.locator(SELECTORS.amountFooterCell).click();
  const menu = page.locator(SELECTORS.aggregateMenu);
  await menu.getByRole('button', { name: 'More options', exact: true }).click();
  await menu.getByRole('button', { name: operation, exact: true }).click();
  await page.keyboard.press('Escape');
  // The label only renders once the new value has loaded.
  await expect(page.locator(SELECTORS.amountFooterLabel)).toHaveText(
    `${operation} of Amount`,
  );
};

export const readViewCount = async (page: Page) =>
  Number((await page.locator(SELECTORS.viewCount).innerText()).replace(/\D/g, ''));

export const expectViewCount = async (page: Page, expected: number) =>
  expect(page.locator(SELECTORS.viewCount)).toHaveText(
    new RegExp(`·\\s*${expected}\\s*$`),
  );

export const readRowNames = async (page: Page) =>
  page.locator(`${SELECTORS.tableRow} ${SELECTORS.rowNameCell}`).allInnerTexts();

// Footer uses short format ("707.8k", "-500", "1.2m"), so turn it back into a number.
export const parseFooterNumber = (text: string) => {
  const cleaned = text.replace(/[^0-9.\-kmbt]/gi, '').toLowerCase();
  const multipliers: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const suffix = cleaned.slice(-1);
  const multiplier = multipliers[suffix] ?? 1;
  const numeric = multiplier === 1 ? cleaned : cleaned.slice(0, -1);
  return Number(numeric) * multiplier;
};

export const expectFooterAmount = async (page: Page, expected: number) => {
  const text = await page.locator(SELECTORS.amountFooterValue).innerText();

  expect(text, 'footer shows a broken number').not.toMatch(/NaN|Infinity|e\+|undefined/i);
  // Short format rounds to ~3 significant digits, so allow 1% drift.
  const tolerance = Math.max(Math.abs(expected) * 0.01, 0.01);
  expect(
    Math.abs(parseFooterNumber(text) - expected),
    `footer shows "${text}", expected about ${expected}`,
  ).toBeLessThanOrEqual(tolerance);
};

export const createOpportunityViaUi = async (
  page: Page,
  name: string,
  amount?: { value: string; currencyCode: string },
) => {
  await page.getByRole('button', { name: 'Create Opportunity', exact: true }).click();
  const panel = page.locator(SELECTORS.sidePanel);
  await expect(panel.locator(SELECTORS.sidePanelCreateButton)).toBeVisible();

  // An active filter can prefill the name, so clear it before typing.
  await panel.locator(SELECTORS.sidePanelNameInput).fill('');
  await panel.locator(SELECTORS.sidePanelNameInput).fill(name);

  if (amount !== undefined) {
    await panel.locator(SELECTORS.sidePanelCurrencyButton).click();
    await page.locator(SELECTORS.sidePanelCurrencySearch).fill(amount.currencyCode);
    await page
      .getByRole('button', { name: new RegExp(`\\(${amount.currencyCode}\\)$`) })
      .click();
    await panel.locator(SELECTORS.sidePanelAmountInput).fill(amount.value);
  }

  await panel.locator(SELECTORS.sidePanelCreateButton).click();
  await page.locator(SELECTORS.sidePanelClose).click();
  // The aside stays in the DOM after closing, so check its close button instead.
  await expect(page.locator(SELECTORS.sidePanelClose)).toBeHidden();
};
