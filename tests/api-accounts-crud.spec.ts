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

  test("create account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account(
            account: {
              priority: 999
              name: "${uniqueName}"
              account_group_id: 1
              account_type_id: 1
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
            id: ${accountId}
            account: {
              priority: 999
              name: "${updatedName}"
              account_group_id: 1
              account_type_id: 1
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
