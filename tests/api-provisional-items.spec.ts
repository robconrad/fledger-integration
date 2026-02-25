import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  uniqueSuffix,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Provisional Items via GraphQL", () => {
  let accountId: number;
  let categoryId: number;
  let provisionalItemId: number;
  const foreignKey = `prov-fk-${Date.now()}`;

  test("setup: create prerequisite entities", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    categoryId = cat.id;
  });

  test("create provisional item", async ({ request }) => {
    const data = await graphql<{ create_provisional_item: {
      id: string; amount: number; comments: string; foreign_key: string; account_id: number; date: string;
    } }>(
      request, token,
      `mutation($pi: ProvisionalItemChange!) {
        create_provisional_item(provisional_item: $pi) { id amount comments foreign_key account_id date }
      }`,
      {
        pi: {
          account_id: accountId,
          amount: 4250,
          comments: "provisional-test",
          date: "2025-06-01",
          foreign_key: foreignKey,
          category_id: categoryId,
        },
      }
    );
    expect(data.create_provisional_item.foreign_key).toBe(foreignKey);
    expect(data.create_provisional_item.amount).toBe(4250);
    provisionalItemId = Number(data.create_provisional_item.id);
  });

  test("query provisional items list", async ({ request }) => {
    const data = await graphql<{ provisional_items: Array<{ id: string; foreign_key: string }> }>(
      request, token,
      `{ provisional_items(size: 200) { id foreign_key } }`
    );
    const found = data.provisional_items.find((pi) => Number(pi.id) === provisionalItemId);
    expect(found).toBeDefined();
    expect(found!.foreign_key).toBe(foreignKey);
  });

  test("query by foreign_keys filter", async ({ request }) => {
    const data = await graphql<{ provisional_items: Array<{ id: string; foreign_key: string }> }>(
      request, token,
      `query($fks: [String!]!) { provisional_items(provisional_item_filters: { foreign_keys: $fks }, size: 100) { id foreign_key } }`,
      { fks: [foreignKey] }
    );
    expect(data.provisional_items).toHaveLength(1);
    expect(data.provisional_items[0]!.foreign_key).toBe(foreignKey);
  });

  test("create provisional item without category_id", async ({ request }) => {
    const fk2 = `prov-nocat-${Date.now()}`;
    const data = await graphql<{ create_provisional_item: {
      id: string; category_id: number | null; foreign_key: string;
    } }>(
      request, token,
      `mutation($pi: ProvisionalItemChange!) {
        create_provisional_item(provisional_item: $pi) { id category_id foreign_key }
      }`,
      {
        pi: {
          account_id: accountId,
          amount: 100,
          comments: "no-category",
          date: "2025-07-01",
          foreign_key: fk2,
        },
      }
    );
    expect(data.create_provisional_item.category_id).toBeNull();
  });

  test("delete provisional item", async ({ request }) => {
    const data = await graphql<{ delete_provisional_item: boolean }>(
      request, token,
      `mutation { delete_provisional_item(id: ${provisionalItemId}) }`
    );
    expect(data.delete_provisional_item).toBe(true);
  });
});
