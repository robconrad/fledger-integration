import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";
import {
  createAccountGroup,
  createAccountType,
  createAccount,
} from "./support/factories.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("Account URLs via GraphQL", () => {
  let accountId: number;
  let accountUrlId: number;
  const testUrl = `https://bank.example.com/accounts/${Date.now()}`;

  test("setup: create account", async ({ request }) => {
    const ag = await createAccountGroup(request, token);
    const at = await createAccountType(request, token);
    const acc = await createAccount(request, token, { account_group_id: ag.id, account_type_id: at.id });
    accountId = acc.id;
  });

  test("create account_url", async ({ request }) => {
    const data = await graphql<{ create_account_url: {
      id: string; account_id: number; url: string; invert_amount: boolean;
    } }>(
      request, token,
      `mutation($au: AccountUrlChange!) {
        create_account_url(account_url: $au) { id account_id url invert_amount }
      }`,
      {
        au: { account_id: accountId, url: testUrl, invert_amount: false },
      }
    );
    expect(data.create_account_url.url).toBe(testUrl);
    expect(data.create_account_url.account_id).toBe(accountId);
    accountUrlId = Number(data.create_account_url.id);
  });

  test("query account_url by URL", async ({ request }) => {
    const data = await graphql<{ account_url: { id: string; url: string } | null }>(
      request, token,
      `query($url: String!) { account_url(url: $url) { id url } }`,
      { url: testUrl }
    );
    expect(data.account_url).not.toBeNull();
    expect(data.account_url!.url).toBe(testUrl);
  });

  test("query account_urls list", async ({ request }) => {
    const data = await graphql<{ account_urls: Array<{ id: string; url: string }> }>(
      request, token,
      `{ account_urls(size: 200) { id url } }`
    );
    const found = data.account_urls.find((au) => Number(au.id) === accountUrlId);
    expect(found).toBeDefined();
  });

  test("update account_url with transaction_dom_config", async ({ request }) => {
    const domConfig = {
      version: "1",
      rowSelector: "tr.row",
      dateSelector: "td.date",
      descriptionSelector: "td.desc",
      amountSelector: "td.amount",
    };
    const data = await graphql<{ update_account_url: {
      id: string; transaction_dom_config: unknown;
    } }>(
      request, token,
      `mutation($au: AccountUrlUpdate!) {
        update_account_url(account_url: $au) { id transaction_dom_config }
      }`,
      {
        au: { id: accountUrlId, transaction_dom_config: domConfig },
      }
    );
    expect(data.update_account_url.transaction_dom_config).not.toBeNull();
  });

  test("delete account_url", async ({ request }) => {
    const data = await graphql<{ delete_account_url: boolean }>(
      request, token,
      `mutation { delete_account_url(id: ${accountUrlId}) }`
    );
    expect(data.delete_account_url).toBe(true);
  });
});
