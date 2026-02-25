import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
  createCategoryGroup,
  createCategory,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Items CRUD via GraphQL", () => {
  const today = new Date().toISOString().split("T")[0]!;
  let itemId: number;
  let accountId: number;
  let categoryId: number;

  test("setup: create prerequisite entities", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, {
      account_group_id: ag.id,
      account_type_id: at.id,
    });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, {
      category_group_id: cg.id,
    });
    categoryId = cat.id;
  });

  test("create item", async ({ request }) => {
    const data = await graphql<{
      create_item: { id: string; date: string; amount: number; comments: string };
    }>(
      request,
      token,
      `mutation($item: ItemChange!) {
        create_item(item: $item) { id date amount comments }
      }`,
      {
        item: {
          date: today,
          amount: 4250,
          comments: "integration-test-item",
          account_id: accountId,
          category_id: categoryId,
        },
      }
    );
    expect(data.create_item.comments).toBe("integration-test-item");
    expect(data.create_item.amount).toBe(4250);
    itemId = Number(data.create_item.id);
  });

  test("read items", async ({ request }) => {
    expect(itemId, "create test must pass first").toBeDefined();
    const data = await graphql<{
      items: Array<{ id: string; date: string; amount: number; comments: string }>;
    }>(
      request,
      token,
      `query($accId: Int!) { items(item_filters: { account_id: $accId }, size: 100) { id date amount comments } }`,
      { accId: accountId }
    );
    const found = data.items.find((i) => Number(i.id) === itemId);
    expect(found).toBeDefined();
    expect(found!.comments).toBe("integration-test-item");
  });

  test("update item", async ({ request }) => {
    expect(itemId, "create test must pass first").toBeDefined();
    const data = await graphql<{
      update_item: { id: string; amount: number; comments: string };
    }>(
      request,
      token,
      `mutation($item: ItemUpdate!) {
        update_item(item: $item) { id amount comments }
      }`,
      {
        item: {
          id: itemId,
          date: today,
          amount: 9999,
          comments: "integration-test-item-updated",
          account_id: accountId,
          category_id: categoryId,
        },
      }
    );
    expect(data.update_item.comments).toBe("integration-test-item-updated");
    expect(data.update_item.amount).toBe(9999);
  });

  test("delete item", async ({ request }) => {
    expect(itemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ delete_item: boolean }>(
      request,
      token,
      `mutation($id: Int!) { delete_item(id: $id) }`,
      { id: itemId }
    );
    expect(data.delete_item).toBe(true);
  });
});
