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

test.describe("Items CRUD via GraphQL", () => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  let itemId: string;

  // Items require a valid account and category — use ID 1 (seeded by migrations)
  const accountId = 1;
  const categoryId = 1;

  test("create item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation CreateItem($input: ItemInput!) {
          createItem(input: $input) { id date amount description }
        }`,
        variables: {
          input: {
            date: today,
            amount: 42.50,
            description: "integration-test-item",
            account_id: accountId,
            category_id: categoryId,
          },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.createItem.description).toBe("integration-test-item");
    expect(body.data.createItem.amount).toBe(42.50);
    itemId = body.data.createItem.id;
  });

  test("read items", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `{
          items(account_id: ${accountId}, size: 100) {
            id date amount description
          }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const found = body.data.items.find(
      (i: { id: string }) => i.id === itemId
    );
    expect(found).toBeDefined();
    expect(found.description).toBe("integration-test-item");
  });

  test("update item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation UpdateItem($id: Long!, $input: ItemInput!) {
          updateItem(id: $id, input: $input) { id amount description }
        }`,
        variables: {
          id: Number(itemId),
          input: {
            date: today,
            amount: 99.99,
            description: "integration-test-item-updated",
            account_id: accountId,
            category_id: categoryId,
          },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.updateItem.description).toBe("integration-test-item-updated");
    expect(body.data.updateItem.amount).toBe(99.99);
  });

  test("delete item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation DeleteItem($id: Long!) {
          deleteItem(id: $id)
        }`,
        variables: { id: Number(itemId) },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.deleteItem).toBe(true);
  });
});
