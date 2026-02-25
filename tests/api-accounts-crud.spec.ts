import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import { createAccountGroup, createAccountType } from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Accounts CRUD via GraphQL", () => {
  const uniqueName = `test-account-${Date.now()}`;
  let accountId: number;
  let accountGroupId: number;
  let accountTypeId: number;

  test("setup: create account_group and account_type", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    accountGroupId = ag.id;
    const at = await createAccountType(request, token);
    accountTypeId = at.id;
  });

  test("create account", async ({ request }) => {
    const data = await graphql<{ create_account: { id: string; name: string } }>(
      request,
      token,
      `mutation($acc: AccountChange!) {
        create_account(account: $acc) { id name }
      }`,
      {
        acc: {
          priority: 999,
          name: uniqueName,
          account_group_id: accountGroupId,
          account_type_id: accountTypeId,
          inactive: false,
        },
      }
    );
    expect(data.create_account.name).toBe(uniqueName);
    accountId = Number(data.create_account.id);
  });

  test("read account", async ({ request }) => {
    const data = await graphql<{ accounts: Array<{ id: string; name: string }> }>(
      request,
      token,
      "{ accounts(inactive: false, size: 200) { id name } }"
    );
    const found = data.accounts.find((a) => Number(a.id) === accountId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(uniqueName);
  });

  test("update account", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const data = await graphql<{ update_account: { id: string; name: string } }>(
      request,
      token,
      `mutation($acc: AccountUpdate!) {
        update_account(account: $acc) { id name }
      }`,
      {
        acc: {
          id: accountId,
          priority: 999,
          name: updatedName,
          account_group_id: accountGroupId,
          account_type_id: accountTypeId,
          inactive: false,
        },
      }
    );
    expect(data.update_account.name).toBe(updatedName);
  });

  test("delete account", async ({ request }) => {
    const data = await graphql<{ delete_account: boolean }>(
      request,
      token,
      `mutation { delete_account(id: ${accountId}) }`
    );
    expect(data.delete_account).toBe(true);
  });
});
