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
  let categoryId: string;

  test("create category", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation CreateCategory($input: CategoryInput!) {
          createCategory(input: $input) { id name }
        }`,
        variables: {
          input: { name: uniqueName, category_group_id: 1 },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.createCategory.name).toBe(uniqueName);
    categoryId = body.data.createCategory.id;
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
      (c: { id: string }) => c.id === categoryId
    );
    expect(found).toBeDefined();
    expect(found.name).toBe(uniqueName);
  });

  test("update category", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation UpdateCategory($id: Long!, $input: CategoryInput!) {
          updateCategory(id: $id, input: $input) { id name }
        }`,
        variables: {
          id: Number(categoryId),
          input: { name: updatedName, category_group_id: 1 },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.updateCategory.name).toBe(updatedName);
  });

  test("delete category", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation DeleteCategory($id: Long!) {
          deleteCategory(id: $id)
        }`,
        variables: { id: Number(categoryId) },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.deleteCategory).toBe(true);
  });
});
