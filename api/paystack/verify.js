import { handleError, paystackRequest, sendJson, validateReference } from "../_lib/paystack.js";

export default async function verify(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const reference = validateReference(req.query?.reference);
    const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
    const expectedAmount = Number(data?.metadata?.expected_amount);
    const expectedCurrency = data?.metadata?.expected_currency;
    const integrityMatches = Number.isSafeInteger(expectedAmount)
      && data.amount === expectedAmount
      && data.currency === "KES"
      && expectedCurrency === "KES"
      && data.reference === reference;
    if (!integrityMatches) return sendJson(res, 200, { verified: false, status: "invalid", reference });
    return sendJson(res, 200, {
      verified: data.status === "success",
      status: typeof data.status === "string" ? data.status : "invalid",
      amount: data.amount / 100,
      currency: "KES",
      reference,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
