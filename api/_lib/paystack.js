import { randomBytes, timingSafeEqual } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";

try {
  setDefaultResultOrder("ipv4first");
} catch {}

const MIN_AMOUNT = 50;
const MAX_AMOUNT = 1000000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9.=\-]{8,100}$/;

class RequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const normalizeText = (value, label, { required = false, min = 0, max }) => {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw new RequestError(`${label} must be text.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (required && !normalized) throw new RequestError(`${label} is required.`);
  if (normalized && normalized.length < min) throw new RequestError(`${label} is too short.`);
  if (normalized.length > max) throw new RequestError(`${label} must be ${max} characters or fewer.`);
  return normalized;
};

const validateInitializeInput = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Enter valid payment details.");
  const name = normalizeText(body.name, "Full name", { required: true, min: 2, max: 100 });
  const email = normalizeText(body.email, "Email", { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new RequestError("Enter a valid email address.");
  if (typeof body.amount !== "number" || !Number.isSafeInteger(body.amount)) throw new RequestError("Amount must be a whole number in KES.");
  if (body.amount < MIN_AMOUNT || body.amount > MAX_AMOUNT) throw new RequestError(`Amount must be between KES ${MIN_AMOUNT} and KES ${MAX_AMOUNT.toLocaleString("en-US")}.`);
  const message = normalizeText(body.message, "Message", { max: 500 });
  return { name, email, amount: body.amount, amountSubunit: body.amount * 100, message };
};

const validateReference = (value) => {
  if (typeof value !== "string" || !REFERENCE_PATTERN.test(value)) throw new RequestError("Enter a valid transaction reference.");
  return value;
};

const createReference = () => `ets-support-${Date.now()}-${randomBytes(8).toString("hex")}`;

const getSecretKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new RequestError("Payment service is not configured.", 503);
  return key;
};

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid site URL protocol.");
  return url.origin;
};

const getSiteUrl = (req) => {
  if (process.env.SITE_URL) return normalizeBaseUrl(process.env.SITE_URL);
  if (process.env.VERCEL_URL) return normalizeBaseUrl(process.env.VERCEL_URL);
  const host = String(req?.headers?.host || "");
  if (host) {
    const proto = req.headers?.["x-forwarded-proto"] || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
    return normalizeBaseUrl(`${proto}://${host}`);
  }
  throw new RequestError("Payment callback URL is not configured.", 503);
};

const paystackRequest = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`https://api.paystack.co${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch (err) {
    throw new RequestError(`Could not connect to Paystack API (${err instanceof Error ? err.message : "network error"}).`, 502);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new RequestError("Payment provider returned an invalid response.", 502);
  }
  if (!response.ok || payload.status !== true) {
    const providerMessage = payload?.message || "Payment provider could not process the request. Please try again.";
    throw new RequestError(providerMessage, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return payload.data;
};

const sendJson = (res, statusCode, body) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).json(body);
};

const handleError = (res, error) => {
  const isRequestError = error instanceof RequestError || error?.name === "RequestError" || typeof error?.statusCode === "number";
  const statusCode = isRequestError ? (error.statusCode || 400) : 500;
  if (statusCode >= 500) console.error("[Paystack Server Error]", error);
  const message = error instanceof Error && error.message ? error.message : "Payment service is temporarily unavailable.";
  return sendJson(res, statusCode, { error: message });
};

const safeSignatureEqual = (received, expected) => {
  if (typeof received !== "string" || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
};

export { RequestError, createReference, getSecretKey, getSiteUrl, handleError, paystackRequest, safeSignatureEqual, sendJson, validateInitializeInput, validateReference };
