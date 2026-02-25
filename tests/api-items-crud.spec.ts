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
  const today = new Date().toISOString().split("T")[0]!; // YYYY-MM-DD
  let itemId: number;

  // Items require a valid account and category — use ID 1 (seeded by migrations)
  const accountId = 1;
  const categoryId = 1;

  test("create item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_item(
            item: {
              date: "${today}"
              amount: 4250
              comments: "integration-test-item"
              account_id: ${accountId}
              category_id: ${categoryId}
            }
          ) { id date amount comments }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.create_item.comments).toBe("integration-test-item");
    expect(body.data.create_item.amount).toBe(4250);
    itemId = Number(body.data.create_item.id);
  });

  test("read items", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `{
          items(
            item_filters: { account_id: ${accountId} }
            size: 100
          ) { id date amount comments }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const found = body.data.items.find(
      (i: { id: string }) => Number(i.id) === itemId
    );
    expect(found).toBeDefined();
    expect(found.comments).toBe("integration-test-item");
  });

  test("update item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          update_item(
            id: ${itemId}
            item: {
              date: "${today}"
              amount: 9999
              comments: "integration-test-item-updated"
              account_id: ${accountId}
              category_id: ${categoryId}
            }
          ) { id amount comments }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.update_item.comments).toBe("integration-test-item-updated");
    expect(body.data.update_item.amount).toBe(9999);
  });

  test("delete item", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          delete_item(id: ${itemId})
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.delete_item).toBe(true);
  });
});
