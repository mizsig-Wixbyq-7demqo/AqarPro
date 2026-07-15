import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeInternalPath,
  sanitizeNextPath,
} from "../lib/auth/navigation.ts";
import {
  isUuid,
  isValidEmail,
  isValidIsoDate,
} from "../lib/domain/validation.ts";

test("internal redirects preserve safe paths and discard fragments", () => {
  assert.equal(sanitizeNextPath("/dashboard?tab=collections"), "/dashboard?tab=collections");
  assert.equal(sanitizeInternalPath("/properties/one#private"), "/properties/one");
});

test("internal redirects reject direct and encoded external destinations", () => {
  const unsafeDestinations = [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%5c%5cevil.test",
    "/%2f%2fevil.test",
    "/%252f%252fevil.test",
    "/dashboard%0d%0aLocation:%20https://evil.test",
    " /dashboard",
  ];

  for (const destination of unsafeDestinations) {
    assert.equal(sanitizeNextPath(destination), "/dashboard");
  }
});

test("business dates are real ISO calendar dates", () => {
  assert.equal(isValidIsoDate("2028-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-04-31"), false);
  assert.equal(isValidIsoDate("15-07-2026"), false);
});

test("identifiers and emails use strict canonical validation", () => {
  assert.equal(isUuid("10000000-0000-4000-8000-000000000001"), true);
  assert.equal(isUuid("10000000000040008000000000000001"), false);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isValidEmail("owner@example.test"), true);
  assert.equal(isValidEmail("owner @example.test"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@x.test`), false);
});
