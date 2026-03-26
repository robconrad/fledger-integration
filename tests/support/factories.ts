import { type APIRequestContext } from "@playwright/test";
import { graphql } from "./api.js";

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createAccountGroup(
  request: APIRequestContext,
  token: string,
  overrides: { name?: string; is_retirement?: boolean } = {}
): Promise<{ id: number; name: string }> {
  const name = overrides.name ?? `test-ag-${uniqueSuffix()}`;
  const data = await graphql<{ create_account_group: { id: string; name: string } }>(
    request,
    token,
    `mutation($ag: AccountGroupChange!) {
      create_account_group(account_group: $ag) { id name }
    }`,
    { ag: { name, is_retirement: overrides.is_retirement ?? false, inactive: false } }
  );
  return { id: Number(data.create_account_group.id), name: data.create_account_group.name };
}

export async function createAccountType(
  request: APIRequestContext,
  token: string,
  overrides: { name?: string } = {}
): Promise<{ id: number; name: string }> {
  const name = overrides.name ?? `test-at-${uniqueSuffix()}`;
  const data = await graphql<{ create_account_type: { id: string; name: string } }>(
    request,
    token,
    `mutation($at: AccountTypeChange!) {
      create_account_type(account_type: $at) { id name }
    }`,
    { at: { name, inactive: false } }
  );
  return { id: Number(data.create_account_type.id), name: data.create_account_type.name };
}

export async function createAccount(
  request: APIRequestContext,
  token: string,
  opts: { account_group_id: number; account_type_id: number; name?: string; priority?: number }
): Promise<{ id: number; name: string }> {
  const name = opts.name ?? `test-acc-${uniqueSuffix()}`;
  const data = await graphql<{ create_account: { id: string; name: string } }>(
    request,
    token,
    `mutation($acc: AccountChange!) {
      create_account(account: $acc) { id name }
    }`,
    {
      acc: {
        name,
        priority: opts.priority ?? 999,
        account_group_id: opts.account_group_id,
        account_type_id: opts.account_type_id,
        inactive: false,
      },
    }
  );
  return { id: Number(data.create_account.id), name: data.create_account.name };
}

export async function createCategoryGroup(
  request: APIRequestContext,
  token: string,
  overrides: { name?: string } = {}
): Promise<{ id: number; name: string }> {
  const name = overrides.name ?? `test-cg-${uniqueSuffix()}`;
  const data = await graphql<{ create_category_group: { id: string; name: string } }>(
    request,
    token,
    `mutation($cg: CategoryGroupChange!) {
      create_category_group(category_group: $cg) { id name }
    }`,
    { cg: { name, inactive: false } }
  );
  return { id: Number(data.create_category_group.id), name: data.create_category_group.name };
}

export async function createCategory(
  request: APIRequestContext,
  token: string,
  opts: { category_group_id: number; name?: string; is_transfer?: boolean }
): Promise<{ id: number; name: string }> {
  const name = opts.name ?? `test-cat-${uniqueSuffix()}`;
  const data = await graphql<{ create_category: { id: string; name: string } }>(
    request,
    token,
    `mutation($cat: CategoryChange!) {
      create_category(category: $cat) { id name }
    }`,
    {
      cat: {
        name,
        category_group_id: opts.category_group_id,
        is_transfer: opts.is_transfer ?? false,
        inactive: false,
      },
    }
  );
  return { id: Number(data.create_category.id), name: data.create_category.name };
}

export async function createItem(
  request: APIRequestContext,
  token: string,
  opts: {
    account_id: number;
    category_id: number;
    amount: number;
    date?: string;
    comments?: string;
  }
): Promise<{ id: number; date: string; amount: number; comments: string }> {
  const date = opts.date ?? new Date().toISOString().split("T")[0]!;
  const comments = opts.comments ?? `test-item-${uniqueSuffix()}`;
  const data = await graphql<{
    create_item: { id: string; date: string; amount: number; comments: string };
  }>(
    request,
    token,
    `mutation($item: ItemChange!) {
      create_item(item: $item) { id date amount comments }
    }`,
    {
      item: {
        date,
        amount: opts.amount,
        comments,
        account_id: opts.account_id,
        category_id: opts.category_id,
      },
    }
  );
  return {
    id: Number(data.create_item.id),
    date: data.create_item.date,
    amount: data.create_item.amount,
    comments: data.create_item.comments,
  };
}

export async function createExternalItem(
  request: APIRequestContext,
  token: string,
  opts: {
    account_id: number;
    amount: number;
    foreign_key: string;
    date?: string;
    comments?: string;
  }
): Promise<{ id: number; foreign_key: string; amount: number; comments: string; linked_item_ids: number[] }> {
  const date = opts.date ?? new Date().toISOString().split("T")[0]!;
  const comments = opts.comments ?? `test-ext-${uniqueSuffix()}`;
  const data = await graphql<{
    create_external_item: { id: string; foreign_key: string; amount: number; comments: string; linked_item_ids: number[] };
  }>(
    request,
    token,
    `mutation($ei: ExternalItemChange!) {
      create_external_item(external_item: $ei) { id foreign_key amount comments linked_item_ids }
    }`,
    {
      ei: {
        date,
        amount: opts.amount,
        comments,
        account_id: opts.account_id,
        foreign_key: opts.foreign_key,
      },
    }
  );
  return {
    id: Number(data.create_external_item.id),
    foreign_key: data.create_external_item.foreign_key,
    amount: data.create_external_item.amount,
    comments: data.create_external_item.comments,
    linked_item_ids: data.create_external_item.linked_item_ids,
  };
}
