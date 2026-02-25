import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  createItem,
  uniqueSuffix,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Item filtering via GraphQL", () => {
  let accountId1: number;
  let accountId2: number;
  let categoryId1: number;
  let categoryId2: number;
  let categoryGroupId1: number;
  let categoryGroupId2: number;
  const fk1 = `fk-filter-${Date.now()}-a`;
  const fk2 = `fk-filter-${Date.now()}-b`;

  test("setup: create entities and items", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc1 = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    const acc2 = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId1 = acc1.id;
    accountId2 = acc2.id;

    const cg1 = await createCategoryGroup(request, token);
    const cg2 = await createCategoryGroup(request, token);
    categoryGroupId1 = cg1.id;
    categoryGroupId2 = cg2.id;
    const cat1 = await createCategory(request, token, { category_group_id: cg1.id });
    const cat2 = await createCategory(request, token, { category_group_id: cg2.id });
    categoryId1 = cat1.id;
    categoryId2 = cat2.id;

    // Create items with different dates, amounts, accounts, categories
    await createItem(request, token, { account_id: accountId1, category_id: categoryId1, amount: 1000, date: "2025-01-15", comments: "filter-item-alpha", foreign_key: fk1 });
    await createItem(request, token, { account_id: accountId1, category_id: categoryId2, amount: 5000, date: "2025-06-15", comments: "filter-item-beta" });
    await createItem(request, token, { account_id: accountId1, category_id: categoryId1, amount: 2000, date: "2025-03-01", comments: "filter-item-gamma", foreign_key: fk2 });
    await createItem(request, token, { account_id: accountId2, category_id: categoryId2, amount: 8000, date: "2025-09-20", comments: "filter-item-delta" });
    await createItem(request, token, { account_id: accountId1, category_id: categoryId1, amount: 300, date: "2025-12-31", comments: "filter-item-epsilon" });
  });

  test("filter by date_min and date_max", async ({ request }) => {
    const data = await graphql<{ items: Array<{ date: string; comments: string }> }>(
      request, token,
      `{ items(item_filters: { account_id: ${accountId1}, date_min: "2025-03-01", date_max: "2025-09-30" }, size: 100) { date comments } }`
    );
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of data.items) {
      expect(item.date >= "2025-03-01").toBe(true);
      expect(item.date <= "2025-09-30").toBe(true);
    }
  });

  test("filter by amount_min and amount_max", async ({ request }) => {
    const data = await graphql<{ items: Array<{ amount: number; comments: string }> }>(
      request, token,
      `{ items(item_filters: { account_id: ${accountId1}, amount_min: 500, amount_max: 6000 }, size: 100) { amount comments } }`
    );
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of data.items) {
      expect(item.amount).toBeGreaterThanOrEqual(500);
      expect(item.amount).toBeLessThanOrEqual(6000);
    }
  });

  test("filter by category_id", async ({ request }) => {
    const data = await graphql<{ items: Array<{ id: string; category: { id: string } | null }> }>(
      request, token,
      `{ items(item_filters: { account_id: ${accountId1}, category_id: ${categoryId1} }, size: 100) { id category { id } } }`
    );
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of data.items) {
      expect(Number(item.category?.id)).toBe(categoryId1);
    }
  });

  test("filter by category_group_id", async ({ request }) => {
    const data = await graphql<{ items: Array<{ id: string }> }>(
      request, token,
      `{ items(item_filters: { category_group_id: ${categoryGroupId1} }, size: 100) { id } }`
    );
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  test("filter by comments partial match", async ({ request }) => {
    const data = await graphql<{ items: Array<{ comments: string }> }>(
      request, token,
      `{ items(item_filters: { comments: "filter-item-alpha" }, size: 100) { comments } }`
    );
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0]!.comments).toContain("filter-item-alpha");
  });

  test("filter by foreign_key", async ({ request }) => {
    const data = await graphql<{ items: Array<{ foreign_key: string | null }> }>(
      request, token,
      `query($fk: String!) { items(item_filters: { account_id: ${accountId1}, foreign_key: $fk }, size: 100) { foreign_key } }`,
      { fk: fk1 }
    );
    expect(data.items).toHaveLength(1);
    expect(data.items[0]!.foreign_key).toBe(fk1);
  });

  test("filter by foreign_keys array", async ({ request }) => {
    const data = await graphql<{ items: Array<{ foreign_key: string | null }> }>(
      request, token,
      `query($fks: [String!]!) { items(item_filters: { account_id: ${accountId1}, foreign_keys: $fks }, size: 100) { foreign_key } }`,
      { fks: [fk1, fk2] }
    );
    expect(data.items).toHaveLength(2);
    const keys = data.items.map((i) => i.foreign_key);
    expect(keys).toContain(fk1);
    expect(keys).toContain(fk2);
  });
});
