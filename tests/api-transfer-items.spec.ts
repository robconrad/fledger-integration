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

test.describe("Transfer Items via GraphQL", () => {
  let fromAccountId: number;
  let toAccountId: number;
  let transferCategoryId: number;
  let fromItemId: number;
  let toItemId: number;

  test("setup: create accounts and transfer category", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const from = await createAccount(request, token, {
      account_group_id: ag.id,
      account_type_id: at.id,
      name: `transfer-from-${Date.now()}`,
    });
    const to = await createAccount(request, token, {
      account_group_id: ag.id,
      account_type_id: at.id,
      name: `transfer-to-${Date.now()}`,
    });
    fromAccountId = from.id;
    toAccountId = to.id;

    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, {
      category_group_id: cg.id,
      is_transfer: true,
    });
    transferCategoryId = cat.id;
  });

  test("create transfer item returns two items", async ({ request }) => {
    const today = new Date().toISOString().split("T")[0]!;
    const data = await graphql<{ create_transfer_item: Array<{
      id: string; amount: number; comments: string;
      transfer: { from_id: number; to_id: number; from_account_id: number; to_account_id: number };
    }> }>(
      request,
      token,
      `mutation($ti: TransferItemChange!) {
        create_transfer_item(transfer_item: $ti) {
          id amount comments
          transfer { from_id to_id from_account_id to_account_id }
        }
      }`,
      {
        ti: {
          date: today,
          amount: 5000,
          comments: "transfer-test",
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          category_id: transferCategoryId,
        },
      }
    );
    expect(data.create_transfer_item).toHaveLength(2);
    const items = data.create_transfer_item;
    expect(items[0]!.transfer.from_account_id).toBe(fromAccountId);
    expect(items[0]!.transfer.to_account_id).toBe(toAccountId);
    fromItemId = items[0]!.transfer.from_id;
    toItemId = items[0]!.transfer.to_id;
  });

  test("read transfer items on from-account", async ({ request }) => {
    expect(fromItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{
      items: Array<{ id: string; transfer: { from_id: number; to_id: number } | null }>;
    }>(
      request,
      token,
      `query($accId: Int!) { items(item_filters: { account_id: $accId }, size: 100) {
        id transfer { from_id to_id }
      }}`,
      { accId: fromAccountId }
    );
    const found = data.items.find((i) => Number(i.id) === fromItemId);
    expect(found).toBeDefined();
    expect(found!.transfer).not.toBeNull();
  });

  test("read transfer items on to-account", async ({ request }) => {
    expect(toItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{
      items: Array<{ id: string; transfer: { from_id: number; to_id: number } | null }>;
    }>(
      request,
      token,
      `query($accId: Int!) { items(item_filters: { account_id: $accId }, size: 100) {
        id transfer { from_id to_id }
      }}`,
      { accId: toAccountId }
    );
    const found = data.items.find((i) => Number(i.id) === toItemId);
    expect(found).toBeDefined();
    expect(found!.transfer).not.toBeNull();
  });

  test("update transfer item", async ({ request }) => {
    expect(fromItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ update_transfer_item: Array<{
      id: string; amount: number; comments: string;
    }> }>(
      request,
      token,
      `mutation($ti: TransferItemUpdate!) {
        update_transfer_item(transfer_item: $ti) { id amount comments }
      }`,
      {
        ti: {
          from_id: fromItemId,
          to_id: toItemId,
          amount: 7777,
          comments: "transfer-updated",
        },
      }
    );
    expect(data.update_transfer_item).toHaveLength(2);
    for (const item of data.update_transfer_item) {
      expect(item.comments).toBe("transfer-updated");
    }
  });

  test("delete from-item cascades", async ({ request }) => {
    expect(fromItemId, "create test must pass first").toBeDefined();
    const data = await graphql<{ delete_item: boolean }>(
      request,
      token,
      `mutation($id: Int!) { delete_item(id: $id) }`,
      { id: fromItemId }
    );
    expect(data.delete_item).toBe(true);

    // to-item should also be gone
    const check = await graphql<{ item: null | { id: string } }>(
      request,
      token,
      `query($id: Int!) { item(id: $id) { id } }`,
      { id: toItemId }
    );
    expect(check.item).toBeNull();
  });
});
