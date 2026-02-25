import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8080";

let token: string;

test.beforeAll(async ({ request }) => {
  const response = await request.post(`${API_URL}/auth/token`, {
    data: { username: "fledger", password: "fledger-local" },
  });
  const body = await response.json();
  token = body.token;
});

test.describe("Accounts CRUD via GraphQL", () => {
  const uniqueName = `test-account-${Date.now()}`;
  let accountId: number;
  let accountGroupId: number;
  let accountTypeId: number;

  test("setup: create account_group and account_type", async ({ request }) => {
    // Create account group
    const agResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account_group(
            account_group: {
              name: "test-group-${Date.now()}"
              is_retirement: false
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(agResponse.status()).toBe(200);
    const agBody = await agResponse.json();
    accountGroupId = Number(agBody.data.create_account_group.id);

    // Create account type
    const atResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account_type(
            account_type: {
              name: "test-type-${Date.now()}"
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(atResponse.status()).toBe(200);
    const atBody = await atResponse.json();
    accountTypeId = Number(atBody.data.create_account_type.id);
  });

  test("create account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account(
            account: {
              priority: 999
              name: "${uniqueName}"
              account_group_id: ${accountGroupId}
              account_type_id: ${accountTypeId}
              inactive: false
            }
          ) { id name }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.create_account.name).toBe(uniqueName);
    accountId = Number(body.data.create_account.id);
  });

  test("read account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `{ accounts(inactive: false, size: 200) { id name } }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const found = body.data.accounts.find(
      (a: { id: string }) => Number(a.id) === accountId
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(uniqueName);
  });

  test("update account", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          update_account(
            account: {
              id: ${accountId}
              priority: 999
              name: "${updatedName}"
              account_group_id: ${accountGroupId}
              account_type_id: ${accountTypeId}
              inactive: false
            }
          ) { id name }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.update_account.name).toBe(updatedName);
  });

  test("delete account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          delete_account(id: ${accountId})
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.delete_account).toBe(true);
  });
});
