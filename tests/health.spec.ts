import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8080";
const WEB_URL = "http://localhost:3200";

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
