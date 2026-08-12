import { createHmac } from "node:crypto";
import { getSecretKey, safeSignatureEqual } from "../_lib/paystack.js";

export const config = { api: { bodyParser: false } };

const readRawBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Payload too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export default async function webhook(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  try {
    const rawBody = await readRawBody(req);
    const expected = createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
    if (!safeSignatureEqual(req.headers["x-paystack-signature"], expected)) return res.status(401).end();
    const event = JSON.parse(rawBody.toString("utf8"));
    if (event?.event === "charge.success") {
      // Valid events are acknowledged. Paystack Dashboard remains the source of record until storage is added.
    }
    return res.status(200).end();
  } catch {
    return res.status(400).end();
  }
}

export { readRawBody };
