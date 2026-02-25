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
  let accountId: string;

  test("create account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation CreateAccount($input: AccountInput!) {
          createAccount(input: $input) { id name }
        }`,
        variables: {
          input: { name: uniqueName, account_type_id: 1, account_group_id: 1 },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.createAccount.name).toBe(uniqueName);
    accountId = body.data.createAccount.id;
  });

  test("read account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `{ accounts(inactive: false, size: 100) { id name } }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const found = body.data.accounts.find(
      (a: { id: string }) => a.id === accountId
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(uniqueName);
  });

  test("update account", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation UpdateAccount($id: Long!, $input: AccountInput!) {
          updateAccount(id: $id, input: $input) { id name }
        }`,
        variables: {
          id: Number(accountId),
          input: { name: updatedName, account_type_id: 1, account_group_id: 1 },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.updateAccount.name).toBe(updatedName);
  });

  test("delete account", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation DeleteAccount($id: Long!) {
          deleteAccount(id: $id)
        }`,
        variables: { id: Number(accountId) },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.deleteAccount).toBe(true);
  });
});
