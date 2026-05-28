import crypto from "crypto";

const R2_ENDPOINT_HOST = `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ENDPOINT = `https://${R2_ENDPOINT_HOST}`;

function requireR2Config() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing R2 environment variables: ${missing.join(", ")}`);
  }
}

function hashHex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function encodeS3Key(key) {
  return key
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

function getSigningKey(dateStamp) {
  const dateKey = hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function signedHeadersFor(method, pathname, headers, payloadHash) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = {
    ...headers,
    host: R2_ENDPOINT_HOST,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const sortedHeaderKeys = Object.keys(canonicalHeaders)
    .map(key => key.toLowerCase())
    .sort();
  const canonicalHeaderString = sortedHeaderKeys
    .map(key => `${key}:${String(canonicalHeaders[key]).trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalRequest = [
    method,
    pathname,
    "",
    canonicalHeaderString,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = hmac(getSigningKey(dateStamp), stringToSign, "hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${process.env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...canonicalHeaders,
    Authorization: authorization,
  };
}

export async function putR2Object({ key, body, contentType }) {
  requireR2Config();

  const bucket = process.env.R2_BUCKET_NAME;
  const pathname = `/${bucket}/${encodeS3Key(key)}`;
  const payload = Buffer.from(body);
  const payloadHash = hashHex(payload);
  const headers = signedHeadersFor("PUT", pathname, { "content-type": contentType }, payloadHash);
  const response = await fetch(`${R2_ENDPOINT}${pathname}`, {
    method: "PUT",
    headers,
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.status} ${await response.text()}`);
  }
}

export async function copyR2Object({ sourceKey, destinationKey, contentType }) {
  requireR2Config();

  const bucket = process.env.R2_BUCKET_NAME;
  const pathname = `/${bucket}/${encodeS3Key(destinationKey)}`;
  const payloadHash = hashHex("");
  const headers = signedHeadersFor("PUT", pathname, {
    "content-type": contentType || "application/octet-stream",
    "x-amz-copy-source": `/${bucket}/${encodeS3Key(sourceKey)}`,
  }, payloadHash);
  const response = await fetch(`${R2_ENDPOINT}${pathname}`, {
    method: "PUT",
    headers,
  });

  if (!response.ok) {
    throw new Error(`R2 copy failed: ${response.status} ${await response.text()}`);
  }
}

export async function deleteR2Object({ key }) {
  requireR2Config();

  const bucket = process.env.R2_BUCKET_NAME;
  const pathname = `/${bucket}/${encodeS3Key(key)}`;
  const payloadHash = hashHex("");
  const headers = signedHeadersFor("DELETE", pathname, {}, payloadHash);
  const response = await fetch(`${R2_ENDPOINT}${pathname}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed: ${response.status} ${await response.text()}`);
  }
}

export function publicR2Url(key) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "";
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/${key}` : "";
}

export function makeImageKey(userId, fileName, contentType) {
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const originalExtension = fileName?.split(".").pop()?.toLowerCase();
  const extension = extensionByType[contentType] || originalExtension || "bin";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "bin";
  const id = crypto.randomUUID();

  return `images/recipes/${userId}/${Date.now()}-${id}.${safeExtension}`;
}
