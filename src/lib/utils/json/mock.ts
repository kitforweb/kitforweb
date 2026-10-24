import { faker } from "@faker-js/faker/locale/en";
import { fail, ok, type ConvertResult } from "../convert/result";
import { parseJsonStrict } from "./parse";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL_RE = /^https?:\/\//;

/** Merges the objects of an array so every key seen anywhere becomes part of the template. */
export function mergeTemplate(values: Json[]): Json {
  const objects = values.filter(
    (v): v is { [key: string]: Json } => v !== null && typeof v === "object" && !Array.isArray(v),
  );
  if (objects.length === 0 || objects.length !== values.length) return values[0] ?? null;
  const merged: { [key: string]: Json } = {};
  for (const o of objects)
    for (const [k, v] of Object.entries(o)) if (!(k in merged) || merged[k] === null) merged[k] = v;
  return merged;
}

const has = (key: string, ...words: string[]) => words.some((w) => key.includes(w));

function mockString(key: string, sample: string): string {
  const k = key.toLowerCase().replace(/[_\-\s]/g, "");
  if (UUID.test(sample) || has(k, "uuid", "guid")) return faker.string.uuid();
  if (EMAIL.test(sample) || has(k, "email", "mail")) return faker.internet.email().toLowerCase();
  if (ISO_DATE.test(sample)) return faker.date.past({ years: 3 }).toISOString().slice(0, 10);
  if (ISO_DATETIME.test(sample) || /(date|at|time)$/.test(k)) return faker.date.past({ years: 3 }).toISOString();
  if (has(k, "avatar", "image", "photo", "picture", "thumbnail")) return faker.image.avatar();
  if (URL_RE.test(sample) || has(k, "url", "website", "link", "homepage")) return faker.internet.url();
  if (has(k, "firstname", "givenname")) return faker.person.firstName();
  if (has(k, "lastname", "surname", "familyname")) return faker.person.lastName();
  if (has(k, "username", "login", "handle")) return faker.internet.username();
  if (has(k, "fullname") || k === "name" || k === "author") return faker.person.fullName();
  if (has(k, "phone", "mobile", "tel")) return faker.phone.number();
  if (has(k, "city", "town")) return faker.location.city();
  if (has(k, "countrycode")) return faker.location.countryCode();
  if (has(k, "country")) return faker.location.country();
  if (has(k, "zip", "postal", "postcode")) return faker.location.zipCode();
  if (has(k, "street", "address")) return faker.location.streetAddress();
  if (has(k, "state", "region", "province")) return faker.location.state();
  if (has(k, "company", "organization", "organisation")) return faker.company.name();
  if (has(k, "job", "position", "role")) return faker.person.jobTitle();
  if (has(k, "color", "colour")) return faker.color.rgb();
  if (has(k, "currency")) return faker.finance.currencyCode();
  if (has(k, "ip")) return faker.internet.ipv4();
  if (has(k, "title", "subject", "headline")) return faker.lorem.sentence({ min: 3, max: 6 }).replace(/\.$/, "");
  if (has(k, "description", "bio", "summary", "body", "text", "comment", "message", "content"))
    return faker.lorem.sentence();
  if (has(k, "product")) return faker.commerce.productName();
  if (has(k, "slug")) return faker.lorem.slug();
  if (has(k, "id", "code", "token", "key", "sku"))
    return faker.string.alphanumeric(Math.max(6, Math.min(sample.length, 32)));
  return sample.includes(" ") ? faker.lorem.words({ min: 2, max: 4 }) : faker.lorem.word();
}

function mockNumber(key: string, sample: number, index: number): number {
  const k = key.toLowerCase().replace(/[_\-\s]/g, "");
  const decimals = Number.isInteger(sample) ? 0 : Math.min(String(sample).split(".")[1]?.length ?? 2, 4);
  if (k === "id" || k.endsWith("id")) return k === "id" ? index + 1 : faker.number.int({ min: 1, max: 1000 });
  if (has(k, "price", "amount", "total", "cost", "salary", "balance")) {
    return Number(faker.commerce.price({ min: 1, max: Math.max(100, Math.abs(sample) * 3), dec: decimals }));
  }
  if (has(k, "age")) return faker.number.int({ min: 18, max: 90 });
  if (has(k, "lat")) return faker.location.latitude();
  if (has(k, "lng", "lon")) return faker.location.longitude();
  if (has(k, "year")) return faker.number.int({ min: 1990, max: new Date().getFullYear() });
  if (has(k, "rating", "score", "stars"))
    return faker.number.float({ min: 0, max: Math.max(5, sample), fractionDigits: decimals });
  const max = Math.max(10, Math.abs(sample) * 2);
  return decimals > 0
    ? faker.number.float({ min: 0, max, fractionDigits: decimals })
    : faker.number.int({ min: 0, max: Math.round(max) });
}

export function mockValue(sample: Json, key: string, index: number): Json {
  if (sample === null) return null;
  if (Array.isArray(sample)) {
    if (sample.length === 0) return [];
    const template = mergeTemplate(sample);
    const length = faker.number.int({ min: 1, max: Math.max(1, Math.min(sample.length, 5)) });
    return Array.from({ length }, (_, i) => mockValue(template, key, i));
  }
  switch (typeof sample) {
    case "boolean":
      return faker.datatype.boolean();
    case "number":
      return mockNumber(key, sample, index);
    case "string":
      return mockString(key, sample);
    default:
      return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, mockValue(v, k, index)]));
  }
}

export interface MockOptions {
  count: number;
  seed?: number;
}

/** Generates `count` realistic fake records with the same structure as the sample. */
export function generateMock(json: string, { count, seed }: MockOptions): ConvertResult {
  const parsed = parseJsonStrict(json);
  if (!parsed.ok) return parsed.result;
  if (!Number.isInteger(count) || count < 1 || count > 1000) return fail("Count must be between 1 and 1000.");
  const sample = parsed.value as Json;
  const template = Array.isArray(sample) ? mergeTemplate(sample) : sample;
  if (template === null || typeof template !== "object")
    return fail("The sample must be an object or an array of objects.");
  faker.seed(seed ?? Date.now());
  // With a seed, dates are relative to a fixed day so results are reproducible.
  faker.setDefaultRefDate(seed === undefined ? new Date() : new Date("2026-01-01T00:00:00Z"));
  const records = Array.from({ length: count }, (_, i) => mockValue(template, "", i));
  return ok(JSON.stringify(records, null, 2));
}
