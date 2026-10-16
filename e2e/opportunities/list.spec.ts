import { test, expect } from '@playwright/test';
import { API_KEY } from '../helpers/config';
import { SELECTORS } from '../helpers/selectors';
import {
  createOpportunityViaApi,
  deleteOpportunitiesByName,
  type SeedAmount,
} from '../helpers/api';
import {
  createOpportunityViaUi,
  expectFooterAmount,
  expectViewCount,
  openListFilteredByName,
  parseFooterNumber,
  readRowNames,
  readViewCount,
  setAmountAggregate,
  type AggregateOperation,
} from '../helpers/ui';

test.describe('Opportunities list', () => {
  // Login plus slowMo already uses about half of the default 30s.
  test.describe.configure({ timeout: 90_000 });

  let runId: string;

  test.beforeEach(async ({ page }, testInfo) => {
    expect(API_KEY, 'TWENTY_API_KEY is not set').not.toBe('');
    runId = `QA-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`;

    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for the post-login redirect before navigating, or auth restarts.
    await expect(page).toHaveURL(/\/objects\//, { timeout: 30_000 });
  });

  test.afterEach(async ({ request }) => {
    await deleteOpportunitiesByName(request, runId);
  });

  // Test plan item 1
  test.describe('Aggregates (table footer)', () => {
    test('Amount aggregate does not add up different currencies as one', async ({
      page,
      request,
    }) => {
      await createOpportunityViaApi(request, `${runId}-usd`, {
        amountMicros: 100_000_000,
        currencyCode: 'USD',
      });
      await createOpportunityViaApi(request, `${runId}-eur`, {
        amountMicros: 100_000_000,
        currencyCode: 'EUR',
      });

      await openListFilteredByName(page, runId);
      await setAmountAggregate(page, 'Sum');

      const footerText = await page.locator(SELECTORS.amountFooterValue).innerText();

      // 100 USD + 100 EUR is not 200 of anything; a plain "200" means currencies were mixed.
      expect(
        parseFooterNumber(footerText),
        `footer shows "${footerText}" for 100 USD + 100 EUR`,
      ).not.toBe(200);
    });

    const extremeCases: Array<{
      title: string;
      amounts: SeedAmount[];
      operation: AggregateOperation;
      expected: number;
    }> = [
        {
          title: 'negative amounts are subtracted in Sum',
          amounts: [
            { amountMicros: -500_000_000, currencyCode: 'USD' },
            { amountMicros: 1_000_000_000, currencyCode: 'USD' },
          ],
          operation: 'Sum',
          expected: 500,
        },
        {
          title: 'negative amount is picked by Min',
          amounts: [
            { amountMicros: -500_000_000, currencyCode: 'USD' },
            { amountMicros: 1_000_000_000, currencyCode: 'USD' },
          ],
          operation: 'Min',
          expected: -500,
        },
        {
          title: 'all-zero amounts show 0, not empty',
          amounts: [
            { amountMicros: 0, currencyCode: 'USD' },
            { amountMicros: 0, currencyCode: 'USD' },
          ],
          operation: 'Average',
          expected: 0,
        },
        {
          title: 'empty amounts are left out of Average',
          amounts: [
            { amountMicros: 100_000_000, currencyCode: 'USD' },
            { amountMicros: null, currencyCode: 'USD' },
          ],
          operation: 'Average',
          expected: 100,
        },
        {
          // Each value fits in bigint micros, but the sum (1e19) does not.
          title: 'very large amounts do not overflow in Sum',
          amounts: [
            { amountMicros: '5000000000000000000', currencyCode: 'USD' },
            { amountMicros: '5000000000000000000', currencyCode: 'USD' },
          ],
          operation: 'Sum',
          expected: 10_000_000_000_000,
        },
        {
          title: 'amounts with many decimal places average correctly',
          amounts: [
            { amountMicros: 123_456, currencyCode: 'USD' },
            { amountMicros: 654_321, currencyCode: 'USD' },
            { amountMicros: 1, currencyCode: 'USD' },
          ],
          operation: 'Average',
          expected: (0.123456 + 0.654321 + 0.000001) / 3,
        },
      ];

    for (const { title, amounts, operation, expected } of extremeCases) {
      test(title, async ({ page, request }) => {
        for (const [index, amount] of amounts.entries()) {
          await createOpportunityViaApi(request, `${runId}-${index}`, amount);
        }

        await openListFilteredByName(page, runId);
        await expect(page.locator(SELECTORS.tableRow)).toHaveCount(amounts.length);

        await setAmountAggregate(page, operation);
        await expectFooterAmount(page, expected);
      });
    }
  });

  // Test plan item 2
  test.describe('Record creation', () => {
    test('new record that does not match the active filter', async ({ page, request }) => {
      const keptName = `${runId}-KEEP`;
      const otherName = `${runId}-OTHER`;
      await createOpportunityViaApi(request, keptName, {
        amountMicros: 1_000_000,
        currencyCode: 'USD',
      });

      await openListFilteredByName(page, keptName);
      await expectViewCount(page, 1);

      await createOpportunityViaUi(page, otherName);

      // Right after creation: row hidden, and count matches what is shown.
      await expect(
        page.locator(SELECTORS.tableRow).filter({ hasText: otherName }),
      ).toHaveCount(0);
      expect(await readViewCount(page)).toBe(
        await page.locator(SELECTORS.tableRow).count(),
      );

      // Fresh load: same state as before, coming from the server.
      await openListFilteredByName(page, keptName);
      await expect(page.locator(SELECTORS.tableRow)).toHaveCount(1);
      await expectViewCount(page, 1);

      // Record was actually saved, just filtered out.
      await openListFilteredByName(page, runId);
      await expect(
        page.locator(SELECTORS.tableRow).filter({ hasText: otherName }),
      ).toHaveCount(1);
      await expectViewCount(page, 2);
    });

    test('new record lands in the right position under an active sort', async ({
      page,
      request,
    }) => {
      await createOpportunityViaApi(request, `${runId}-300`, {
        amountMicros: 300_000_000,
        currencyCode: 'USD',
      });
      await createOpportunityViaApi(request, `${runId}-200`, {
        amountMicros: 200_000_000,
        currencyCode: 'USD',
      });
      await createOpportunityViaApi(request, `${runId}-100`, {
        amountMicros: 100_000_000,
        currencyCode: 'USD',
      });

      const sortByAmountDesc = { field: 'amount', direction: 'DESC' } as const;
      await openListFilteredByName(page, runId, sortByAmountDesc);

      await createOpportunityViaUi(page, `${runId}-150`, {
        value: '150',
        currencyCode: 'USD',
      });

      const expectedOrder = [
        `${runId}-300`,
        `${runId}-200`,
        `${runId}-150`,
        `${runId}-100`,
      ];

      // Right after creation (optimistic UI), not stuck at the top or bottom.
      await expect.poll(() => readRowNames(page)).toEqual(expectedOrder);

      // Fresh load: the server order matches.
      await openListFilteredByName(page, runId, sortByAmountDesc);
      await expect(page.locator(SELECTORS.tableRow)).toHaveCount(4);
      await expect.poll(() => readRowNames(page)).toEqual(expectedOrder);
    });
  });
});
