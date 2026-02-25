import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import { createCategoryGroup } from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Categories CRUD via GraphQL", () => {
  const uniqueName = `test-category-${Date.now()}`;
  let categoryId: number;
  let categoryGroupId: number;

  test("setup: create category_group", async ({ request }) => {
    const cg = await createCategoryGroup(request, token);
    categoryGroupId = cg.id;
  });

  test("create category", async ({ request }) => {
    const data = await graphql<{ create_category: { id: string; name: string } }>(
      request,
      token,
      `mutation($cat: CategoryChange!) {
        create_category(category: $cat) { id name }
      }`,
      {
        cat: {
          name: uniqueName,
          category_group_id: categoryGroupId,
          is_transfer: false,
          inactive: false,
        },
      }
    );
    expect(data.create_category.name).toBe(uniqueName);
    categoryId = Number(data.create_category.id);
  });

  test("read categories", async ({ request }) => {
    const data = await graphql<{ categories: Array<{ id: string; name: string }> }>(
      request,
      token,
      "{ categories(size: 200) { id name } }"
    );
    const found = data.categories.find((c) => Number(c.id) === categoryId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(uniqueName);
  });

  test("update category", async ({ request }) => {
    const updatedName = `${uniqueName}-updated`;
    const data = await graphql<{ update_category: { id: string; name: string } }>(
      request,
      token,
      `mutation($cat: CategoryUpdate!) {
        update_category(category: $cat) { id name }
      }`,
      {
        cat: {
          id: categoryId,
          name: updatedName,
          category_group_id: categoryGroupId,
          is_transfer: false,
          inactive: false,
        },
      }
    );
    expect(data.update_category.name).toBe(updatedName);
  });

  test("delete category", async ({ request }) => {
    const data = await graphql<{ delete_category: boolean }>(
      request,
      token,
      `mutation { delete_category(id: ${categoryId}) }`
    );
    expect(data.delete_category).toBe(true);
  });
});
