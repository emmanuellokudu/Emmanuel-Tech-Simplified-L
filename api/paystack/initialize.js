import { createReference, getSiteUrl, handleError, paystackRequest, sendJson, validateInitializeInput } from "../_lib/paystack.js";

export default async function initialize(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  try {
    const input = validateInitializeInput(req.body);
    const reference = createReference();
    const siteUrl = getSiteUrl(req);
    const data = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountSubunit,
        currency: "KES",
        reference,
        callback_url: `${siteUrl}/?payment=callback`,
        metadata: {
          payment_purpose: "Support Emmanuel Tech Simplified",
          customer_name: input.name,
          support_message: input.message,
          expected_amount: input.amountSubunit,
          expected_currency: "KES",
          cancel_action: `${siteUrl}/?payment=cancelled`,
        },
      }),
    });
    if (!data || typeof data.authorization_url !== "string" || typeof data.reference !== "string") throw new Error("Incomplete initialization response.");
    const authorizationUrl = new URL(data.authorization_url);
    if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com") throw new Error("Invalid checkout URL.");
    return sendJson(res, 200, { authorizationUrl: authorizationUrl.href, reference: data.reference });
  } catch (error) {
    return handleError(res, error);
  }
};
