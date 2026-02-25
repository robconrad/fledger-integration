import { test, expect } from "@playwright/test";
import { API_URL, WEB_URL } from "./support/api.js";

test.describe("Health checks", () => {
  test("API returns OpenAPI spec", async ({ request }) => {
    const response = await request.get(`${API_URL}/openapi.yaml`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("openapi");
  });

  test("API GraphiQL is accessible", async ({ request }) => {
    const response = await request.get(`${API_URL}/graphiql`);
    expect(response.status()).toBe(200);
  });

  test("Web returns HTML", async ({ request }) => {
    const response = await request.get(`${WEB_URL}/`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<div id=\"root\">");
  });
});
