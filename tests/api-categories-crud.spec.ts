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

test.describe("Categories CRUD via GraphQL", () => {
  const uniqueName = `test-category-${Date.now()}`;
  let categoryId: number;

  test("create category", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_category(
            category: {
              name: "${uniqueName}"
              category_group_id: 1
              is_transfer: false
              inactive: false
            }
          ) { id name }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.create_category.name).toBe(uniqueName);
    categoryId = Number(body.data.create_category.id);
  });

  test("read categories", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `{ categories(size: 200) { id name } }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const found = body.data.categories.find(
      (c: { id: string }) => Number(c.id) === categoryId
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(uniqueName);
  });

  test("update category", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          update_category(
            id: ${categoryId}
            category: {
              name: "${updatedName}"
              category_group_id: 1
              is_transfer: false
              inactive: false
            }
          ) { id name }
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.update_category.name).toBe(updatedName);
  });

  test("delete category", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          delete_category(id: ${categoryId})
        }`,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.delete_category).toBe(true);
  });
});
