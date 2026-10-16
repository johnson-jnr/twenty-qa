import { expect, type APIRequestContext } from '@playwright/test';
import { API_KEY, API_URL } from './config';

// Seed and cleanup helpers that talk to the Twenty REST API directly.

export type SeedAmount = {
  // Strings keep very large values from losing precision in JS numbers.
  amountMicros: number | string | null;
  currencyCode: string;
};

const apiHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
});

export const createOpportunityViaApi = async (
  request: APIRequestContext,
  name: string,
  amount: SeedAmount,
): Promise<string> => {
  const response = await request.post(`${API_URL}/rest/opportunities`, {
    headers: apiHeaders(),
    data: {
      name,
      amount:
        amount.amountMicros === null
          ? { amountMicros: null, currencyCode: amount.currencyCode }
          : amount,
    },
  });
  // toBeOK prints the response body on failure.
  await expect(response).toBeOK();
  const body = await response.json();
  return body.data.createOpportunity.id;
};

export const deleteOpportunitiesByName = async (
  request: APIRequestContext,
  namePart: string,
) => {
  const response = await request.get(`${API_URL}/rest/opportunities`, {
    headers: apiHeaders(),
    params: { filter: `name[like]:"%${namePart}%"`, limit: 200 },
  });
  const body = await response.json();
  for (const opportunity of body.data?.opportunities ?? []) {
    await request.delete(`${API_URL}/rest/opportunities/${opportunity.id}`, {
      headers: apiHeaders(),
    });
  }
};

// Views live in the metadata API, not REST. Their ids differ per workspace, so look it up.
export const getOpportunityTableViewId = async (
  request: APIRequestContext,
): Promise<string> => {
  const response = await request.post(`${API_URL}/metadata`, {
    headers: apiHeaders(),
    data: {
      query: `{
        getViews { id type key objectMetadataId }
        objects(paging: { first: 200 }) { edges { node { id nameSingular } } }
      }`,
    },
  });
  await expect(response).toBeOK();
  const { data } = await response.json();
  const objectId = data.objects.edges.find(
    (edge: { node: { nameSingular: string } }) => edge.node.nameSingular === 'opportunity',
  )?.node.id;
  const view = data.getViews.find(
    (view: { type: string; key: string | null; objectMetadataId: string }) =>
      view.objectMetadataId === objectId && view.type === 'TABLE' && view.key === 'INDEX',
  );
  expect(view, 'no "All Opportunities" table view found').toBeDefined();
  return view.id;
};
