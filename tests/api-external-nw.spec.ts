import { test, expect } from "@playwright/test";
import { getAuthToken, graphql } from "./support/api.js";

let token: string;

test.beforeAll(async ({ request }) => {
  token = await getAuthToken(request);
});

test.describe("External Net Worth Records via GraphQL", () => {
  let recordId: number;
  // Use a unique date per run to avoid unique constraint violations on retry
  const dayOffset = Math.floor(Math.random() * 3650);
  const testDate = new Date(2020, 0, 1 + dayOffset).toISOString().split("T")[0]!;

  test("create external_net_worth_record", async ({ request }) => {
    const data = await graphql<{ create_external_net_worth_record: {
      id: string; amount: number; date: string;
    } }>(
      request, token,
      `mutation($r: ExternalNetWorthRecordChange!) {
        create_external_net_worth_record(external_net_worth_record: $r) { id amount date }
      }`,
      { r: { amount: 1000000, date: testDate } }
    );
    expect(data.create_external_net_worth_record.amount).toBe(1000000);
    expect(data.create_external_net_worth_record.date).toContain(testDate);
    recordId = Number(data.create_external_net_worth_record.id);
  });

  test("query external_net_worth_records list", async ({ request }) => {
    const data = await graphql<{ external_net_worth_records: Array<{ id: string; amount: number; date: string }> }>(
      request, token,
      `{ external_net_worth_records(size: 200) { id amount date } }`
    );
    const found = data.external_net_worth_records.find((r) => Number(r.id) === recordId);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(1000000);
  });

  test("query by date", async ({ request }) => {
    const data = await graphql<{ external_net_worth_record: { id: string; date: string } | null }>(
      request, token,
      `{ external_net_worth_record(date: "${testDate}") { id date } }`
    );
    expect(data.external_net_worth_record).not.toBeNull();
    expect(data.external_net_worth_record!.date).toContain(testDate);
  });

  test("update amount", async ({ request }) => {
    const data = await graphql<{ update_external_net_worth_record: { id: string; amount: number } }>(
      request, token,
      `mutation($r: ExternalNetWorthRecordUpdate!) {
        update_external_net_worth_record(external_net_worth_record: $r) { id amount }
      }`,
      { r: { id: recordId, amount: 2000000 } }
    );
    expect(data.update_external_net_worth_record.amount).toBe(2000000);
  });

  test("delete external_net_worth_record", async ({ request }) => {
    const data = await graphql<{ delete_external_net_worth_record: boolean }>(
      request, token,
      `mutation { delete_external_net_worth_record(id: ${recordId}) }`
    );
    expect(data.delete_external_net_worth_record).toBe(true);
  });
});
