import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  createItem,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Reporting: Slices, Aggregates, Normalization", () => {
  let accountId: number;
  let categoryId: number;

  test("setup: create entities and items for reporting", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    categoryId = cat.id;

    // Create items across different dates for reporting
    await createItem(request, token, { account_id: accountId, category_id: categoryId, amount: 1000, date: "2024-01-15" });
    await createItem(request, token, { account_id: accountId, category_id: categoryId, amount: 2000, date: "2024-06-15" });
    await createItem(request, token, { account_id: accountId, category_id: categoryId, amount: 3000, date: "2025-01-15" });
  });

  test("category_group_slices returns dates and amounts", async ({ request }) => {
    const data = await graphql<{ category_group_slices: { dates: string[]; amounts: unknown } }>(
      request, token,
      `{ category_group_slices(interval: year) { dates amounts } }`
    );
    expect(data.category_group_slices.dates.length).toBeGreaterThan(0);
    expect(data.category_group_slices.amounts).toBeDefined();
  });

  test("category_slices returns dates and amounts", async ({ request }) => {
    const data = await graphql<{ category_slices: { dates: string[]; amounts: unknown } }>(
      request, token,
      `{ category_slices(interval: week) { dates amounts } }`
    );
    expect(data.category_slices.dates.length).toBeGreaterThan(0);
    expect(data.category_slices.amounts).toBeDefined();
  });

  test("item_aggregate returns amount totals", async ({ request }) => {
    expect(accountId, "setup test must pass first").toBeDefined();
    const data = await graphql<{ item_aggregate: { amount: number; amount_in: number; amount_out: number } }>(
      request, token,
      `query($accId: Int!) { item_aggregate(item_filters: { account_id: $accId }) { amount amount_in amount_out } }`,
      { accId: accountId }
    );
    expect(typeof data.item_aggregate.amount).toBe("number");
    expect(typeof data.item_aggregate.amount_in).toBe("number");
    expect(typeof data.item_aggregate.amount_out).toBe("number");
  });

  test("normalization returns periods with spend data", async ({ request }) => {
    const data = await graphql<{ normalization: Array<{
      start: string; end: string; months: number; annualized_spend: number;
      annualized_category_group_spend: Array<{ amount: number }>;
    }> }>(
      request, token,
      `{ normalization { start end months annualized_spend net_worth annualized_category_group_spend { amount category_group { id name } } } }`
    );
    expect(data.normalization.length).toBeGreaterThan(0);
    const period = data.normalization[0]!;
    expect(period.start).toBeDefined();
    expect(period.end).toBeDefined();
    expect(typeof period.months).toBe("number");
    expect(typeof period.annualized_spend).toBe("number");
  });
});
