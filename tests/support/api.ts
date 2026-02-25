import { expect, type APIRequestContext } from "@playwright/test";

export const API_URL = "http://localhost:8080";
export const WEB_URL = "http://localhost:3200";

export async function getAuthToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/auth/token`, {
    data: { username: "fledger", password: "fledger-local" },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

export async function graphql<T = Record<string, unknown>>(
  request: APIRequestContext,
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const data: Record<string, unknown> = { query };
  if (variables) data.variables = variables;
  const response = await request.post(`${API_URL}/graphql`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  if (body.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data as T;
}

export async function graphqlBatch(
  request: APIRequestContext,
  token: string,
  operations: Array<{ query: string; variables?: Record<string, unknown> }>
): Promise<Array<Record<string, unknown>>> {
  const response = await request.post(`${API_URL}/graphql`, {
    headers: { Authorization: `Bearer ${token}` },
    data: operations,
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body as Array<Record<string, unknown>>;
}
