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
  let accountId: number;
  let categoryId: number;

  test("setup: create prerequisite entities", async ({ request }) => {
    // Create account group
    const agResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account_group(
            account_group: {
              name: "items-test-group-${Date.now()}"
              is_retirement: false
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(agResponse.status()).toBe(200);
    const agBody = await agResponse.json();
    const accountGroupId = Number(agBody.data.create_account_group.id);

    // Create account type
    const atResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account_type(
            account_type: {
              name: "items-test-type-${Date.now()}"
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(atResponse.status()).toBe(200);
    const atBody = await atResponse.json();
    const accountTypeId = Number(atBody.data.create_account_type.id);

    // Create account
    const accResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_account(
            account: {
              priority: 999
              name: "items-test-account-${Date.now()}"
              account_group_id: ${accountGroupId}
              account_type_id: ${accountTypeId}
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(accResponse.status()).toBe(200);
    const accBody = await accResponse.json();
    accountId = Number(accBody.data.create_account.id);

    // Create category group
    const cgResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_category_group(
            category_group: {
              name: "items-test-catgroup-${Date.now()}"
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(cgResponse.status()).toBe(200);
    const cgBody = await cgResponse.json();
    const categoryGroupId = Number(cgBody.data.create_category_group.id);

    // Create category
    const catResponse = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        query: `mutation {
          create_category(
            category: {
              name: "items-test-category-${Date.now()}"
              category_group_id: ${categoryGroupId}
              is_transfer: false
              inactive: false
            }
          ) { id }
        }`,
      },
    });
    expect(catResponse.status()).toBe(200);
    const catBody = await catResponse.json();
    categoryId = Number(catBody.data.create_category.id);
  });

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
            item: {
              id: ${itemId}
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
    expect(body.data.update_item.comments).toBe(
      "integration-test-item-updated"
    );
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
