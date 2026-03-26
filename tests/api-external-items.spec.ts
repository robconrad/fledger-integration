import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
  createItem,
  createExternalItem,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("External Items via GraphQL", () => {
  let accountId: number;
  let categoryId: number;
  let externalItemId: number;
  const foreignKey = `ext-fk-${Date.now()}`;

  test("setup: create prerequisite entities", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    categoryId = cat.id;
  });

  test("create external item", async ({ request }) => {
    const ei = await createExternalItem(request, token, {
      account_id: accountId,
      amount: 4250,
      comments: "external-test",
      foreign_key: foreignKey,
      date: "2025-06-01",
    });
    expect(ei.foreign_key).toBe(foreignKey);
    expect(ei.amount).toBe(4250);
    expect(ei.linked_item_ids).toEqual([]);
    externalItemId = ei.id;
  });

  test("query external items list", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ external_items: Array<{ id: string; foreign_key: string; linked_item_ids: number[] }> }>(
      request, token,
      `{ external_items(size: 200) { id foreign_key linked_item_ids } }`
    );
    const found = data.external_items.find((ei) => Number(ei.id) === externalItemId);
    expect(found).toBeDefined();
    expect(found!.foreign_key).toBe(foreignKey);
    expect(found!.linked_item_ids).toEqual([]);
  });

  test("query by foreign_keys filter", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ external_items: Array<{ id: string; foreign_key: string }> }>(
      request, token,
      `query($fks: [String!]!) { external_items(external_item_filters: { foreign_keys: $fks }, size: 100) { id foreign_key } }`,
      { fks: [foreignKey] }
    );
    expect(data.external_items).toHaveLength(1);
    expect(data.external_items[0]!.foreign_key).toBe(foreignKey);
  });

  test("filter by linked: false returns unlinked items", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ external_items: Array<{ id: string; foreign_key: string }> }>(
      request, token,
      `query($accId: Int!) { external_items(external_item_filters: { account_id: $accId, linked: false }, size: 100) { id foreign_key } }`,
      { accId: accountId }
    );
    const found = data.external_items.find((ei) => Number(ei.id) === externalItemId);
    expect(found).toBeDefined();
  });

  test("link external item to item", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    // Create an item to link to
    const item = await createItem(request, token, {
      account_id: accountId,
      category_id: categoryId,
      amount: 4250,
      date: "2025-06-01",
      comments: "link-target",
    });

    const data = await graphql<{ link_external_item: { id: string; linked_item_ids: number[] } }>(
      request, token,
      `mutation($eiId: Int!, $itemId: Int!) {
        link_external_item(external_item_id: $eiId, item_id: $itemId) { id linked_item_ids }
      }`,
      { eiId: externalItemId, itemId: item.id }
    );
    expect(data.link_external_item.linked_item_ids).toContain(item.id);
  });

  test("filter by linked: true returns linked items", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ external_items: Array<{ id: string; linked_item_ids: number[] }> }>(
      request, token,
      `query($accId: Int!) { external_items(external_item_filters: { account_id: $accId, linked: true }, size: 100) { id linked_item_ids } }`,
      { accId: accountId }
    );
    const found = data.external_items.find((ei) => Number(ei.id) === externalItemId);
    expect(found).toBeDefined();
    expect(found!.linked_item_ids.length).toBeGreaterThan(0);
  });

  test("unlink external item from item", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    // Get current linked item ids
    const before = await graphql<{ external_items: Array<{ id: string; linked_item_ids: number[] }> }>(
      request, token,
      `query($fks: [String!]!) { external_items(external_item_filters: { foreign_keys: $fks }, size: 1) { id linked_item_ids } }`,
      { fks: [foreignKey] }
    );
    const linkedItemId = before.external_items[0]!.linked_item_ids[0]!;

    const data = await graphql<{ unlink_external_item: { id: string; linked_item_ids: number[] } }>(
      request, token,
      `mutation($eiId: Int!, $itemId: Int!) {
        unlink_external_item(external_item_id: $eiId, item_id: $itemId) { id linked_item_ids }
      }`,
      { eiId: externalItemId, itemId: linkedItemId }
    );
    expect(data.unlink_external_item.linked_item_ids).not.toContain(linkedItemId);
  });

  test("delete external item", async ({ request }) => {
    expect(externalItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ delete_external_item: boolean }>(
      request, token,
      `mutation($id: Int!) { delete_external_item(id: $id) }`,
      { id: externalItemId }
    );
    expect(data.delete_external_item).toBe(true);
  });
});
