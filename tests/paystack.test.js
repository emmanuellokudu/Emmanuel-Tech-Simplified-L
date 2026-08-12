import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";

import { safeSignatureEqual, validateInitializeInput, validateReference } from "../api/_lib/paystack.js";
import initialize from "../api/paystack/initialize.js";
import verify from "../api/paystack/verify.js";
import webhook from "../api/paystack/webhook.js";

const responseMock = () => ({
  statusCode: 0, body: undefined, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const webhookResponseMock = () => ({
  statusCode: 0, ended: false, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  end() { this.ended = true; return this; },
});

test("accepts and normalizes a valid payment request", () => {
  assert.deepEqual(
    validateInitializeInput({ name: "  Emmanuel   Lokudu ", email: "USER@example.com", amount: 250, message: " Thank you " }),
    { name: "Emmanuel Lokudu", email: "user@example.com", amount: 250, amountSubunit: 25000, message: "Thank you" },
  );
});

test("rejects invalid, decimal, modified, and out-of-range amounts", () => {
  const base = { name: "Test User", email: "test@example.com", message: "" };
  for (const amount of [49, 100001, 10.5, "500", "coffee", null]) assert.throws(() => validateInitializeInput({ ...base, amount }));
});

test("rejects missing/invalid identity fields and overlong messages", () => {
  assert.throws(() => validateInitializeInput({ name: "", email: "test@example.com", amount: 100, message: "" }));
  assert.throws(() => validateInitializeInput({ name: "Test User", email: "bad-email", amount: 100, message: "" }));
  assert.throws(() => validateInitializeInput({ name: "Test User", email: "test@example.com", amount: 100, message: "x".repeat(501) }));
});

test("validates generated-style transaction references", () => {
  assert.equal(validateReference("ets-support-1700000000000-a1b2c3d4e5f60708"), "ets-support-1700000000000-a1b2c3d4e5f60708");
  for (const reference of ["", "../secret", "bad ref", "a".repeat(101)]) assert.throws(() => validateReference(reference));
});

test("compares webhook signatures without accepting malformed values", () => {
  const signature = "a".repeat(128);
  assert.equal(safeSignatureEqual(signature, signature), true);
  assert.equal(safeSignatureEqual("b".repeat(128), signature), false);
  assert.equal(safeSignatureEqual("short", signature), false);
  assert.equal(safeSignatureEqual(undefined, signature), false);
});

test("webhook accepts only a valid SHA-512 signature over the raw body", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "unit-test-secret-placeholder";
  t.after(() => { delete process.env.PAYSTACK_SECRET_KEY; });
  const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "test-reference" } }));
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const validRequest = Readable.from([rawBody]);
  validRequest.method = "POST";
  validRequest.headers = { "x-paystack-signature": signature };
  const validResponse = webhookResponseMock();
  await webhook(validRequest, validResponse);
  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.ended, true);

  const invalidRequest = Readable.from([rawBody]);
  invalidRequest.method = "POST";
  invalidRequest.headers = { "x-paystack-signature": "0".repeat(128) };
  const invalidResponse = webhookResponseMock();
  await webhook(invalidRequest, invalidResponse);
  assert.equal(invalidResponse.statusCode, 401);
});

test("initialization converts KES to subunits and returns only safe checkout data", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "unit-test-secret-placeholder";
  process.env.SITE_URL = "https://example.com/path";
  const originalFetch = global.fetch;
  let providerRequest;
  t.after(() => {
    global.fetch = originalFetch;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.SITE_URL;
  });
  global.fetch = async (url, options) => {
    providerRequest = { url, options, body: JSON.parse(options.body) };
    return { ok: true, async json() { return { status: true, data: { authorization_url: "https://checkout.paystack.com/test-code", access_code: "private-access-code", reference: providerRequest.body.reference } }; } };
  };
  const res = responseMock();
  await initialize({ method: "POST", headers: { host: "untrusted.example" }, body: { name: "Test User", email: "test@example.com", amount: 500, message: "Great work" } }, res);
  assert.equal(providerRequest.url, "https://api.paystack.co/transaction/initialize");
  assert.equal(providerRequest.body.amount, 50000);
  assert.equal(providerRequest.body.currency, "KES");
  assert.equal(providerRequest.body.callback_url, "https://example.com/?payment=callback");
  assert.equal(providerRequest.body.metadata.expected_amount, 50000);
  assert.equal(providerRequest.body.metadata.cancel_action, "https://example.com/?payment=cancelled");
  assert.deepEqual(res.body, { authorizationUrl: "https://checkout.paystack.com/test-code", reference: providerRequest.body.reference });
  assert.equal(JSON.stringify(res.body).includes("private-access-code"), false);
});

test("verification succeeds only when status, amount, currency, metadata and reference match", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "unit-test-secret-placeholder";
  const reference = "ets-support-1700000000000-a1b2c3d4e5f60708";
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; delete process.env.PAYSTACK_SECRET_KEY; });
  global.fetch = async () => ({ ok: true, async json() { return { status: true, data: { status: "success", amount: 25000, currency: "KES", reference, metadata: { expected_amount: 25000, expected_currency: "KES" } } }; } });
  const res = responseMock();
  await verify({ method: "GET", query: { reference } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { verified: true, status: "success", amount: 250, currency: "KES", reference });
});

test("verification rejects mismatched amount and preserves pending state", async (t) => {
  process.env.PAYSTACK_SECRET_KEY = "unit-test-secret-placeholder";
  const reference = "ets-support-1700000000000-a1b2c3d4e5f60708";
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; delete process.env.PAYSTACK_SECRET_KEY; });
  const data = { status: "success", amount: 10000, currency: "KES", reference, metadata: { expected_amount: 25000, expected_currency: "KES" } };
  global.fetch = async () => ({ ok: true, async json() { return { status: true, data }; } });
  let res = responseMock();
  await verify({ method: "GET", query: { reference } }, res);
  assert.deepEqual(res.body, { verified: false, status: "invalid", reference });
  data.status = "pending"; data.amount = 25000; res = responseMock();
  await verify({ method: "GET", query: { reference } }, res);
  assert.equal(res.body.verified, false);
  assert.equal(res.body.status, "pending");
});

test("verification rejects direct requests with an invalid reference", async () => {
  const res = responseMock();
  await verify({ method: "GET", query: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid transaction reference/i);
});
