import { test, expect } from "@playwright/test";
import { getAuthToken, graphql, graphqlBatch } from "./support/api.js";
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

test.describe("Batch GraphQL operations", () => {
  let accountId: number;
  let categoryId: number;

  test("setup: create prerequisite entities", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
    const cg = await createCategoryGroup(request, token);
    const cat = await createCategory(request, token, { category_group_id: cg.id });
    categoryId = cat.id;
  });

  test("batch queries return array of results", async ({ request }) => {
    const results = await graphqlBatch(request, token, [
      { query: "{ accounts(inactive: false, size: 5) { id name } }" },
      { query: "{ categories(size: 5) { id name } }" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty("data");
    expect(results[1]).toHaveProperty("data");
  });

  test("batch mutations create multiple items", async ({ request }) => {
    expect(accountId, "setup test must pass first").toBeDefined();
    const today = new Date().toISOString().split("T")[0]!;
    const results = await graphqlBatch(request, token, [
      {
        query: `mutation($item: ItemChange!) { create_item(item: $item) { id comments } }`,
        variables: { item: { date: today, amount: 100, comments: "batch-1", account_id: accountId, category_id: categoryId } },
      },
      {
        query: `mutation($item: ItemChange!) { create_item(item: $item) { id comments } }`,
        variables: { item: { date: today, amount: 200, comments: "batch-2", account_id: accountId, category_id: categoryId } },
      },
    ]);
    expect(results).toHaveLength(2);
    const data0 = results[0] as { data?: { create_item?: { comments: string } } };
    const data1 = results[1] as { data?: { create_item?: { comments: string } } };
    expect(data0.data?.create_item?.comments).toBe("batch-1");
    expect(data1.data?.create_item?.comments).toBe("batch-2");
  });

  test("batch with invalid query returns error status", async ({ request }) => {
    const response = await request.post("http://localhost:8080/graphql", {
      headers: { Authorization: `Bearer ${token}` },
      data: [
        { query: "{ accounts(inactive: false, size: 5) { id } }" },
        { query: "{ nonExistentField }" },
      ],
    });
    // The API rejects the entire batch when any query is invalid
    expect(response.status()).toBe(400);
    const body = await response.json();
    // Response should indicate the invalid field
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).toContain("nonExistentField");
  });
});
