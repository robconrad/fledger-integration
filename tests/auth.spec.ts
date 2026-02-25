import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8080";

test.describe("Authentication", () => {
  test("POST /auth/token returns JWT", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/token`, {
      data: { username: "fledger", password: "fledger-local" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  test("invalid credentials return 401", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/token`, {
      data: { username: "wrong", password: "wrong" },
    });
    expect(response.status()).toBe(401);
  });

  test("GraphQL requires auth", async ({ request }) => {
    const response = await request.post(`${API_URL}/graphql`, {
      data: { query: "{ accounts(inactive: false, size: 5) { id } }" },
    });
    expect(response.status()).toBe(401);
  });

  test("GraphQL works with valid token", async ({ request }) => {
    const authResponse = await request.post(`${API_URL}/auth/token`, {
      data: { username: "fledger", password: "fledger-local" },
    });
    const { token } = await authResponse.json();

    const response = await request.post(`${API_URL}/graphql`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { query: "{ accounts(inactive: false, size: 5) { id name } }" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("accounts");
  });
});
