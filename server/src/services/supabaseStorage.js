import { config as defaultConfig } from "../config.js";

export class StorageUnavailableError extends Error {
  constructor() {
    super("Document storage is not configured.");
    this.name = "StorageUnavailableError";
    this.status = 503;
    this.code = "STORAGE_UNAVAILABLE";
  }
}

const safeStorageErrorCodes = new Set([
  "AccessDenied",
  "BucketNotFound",
  "DatabaseError",
  "Duplicate",
  "EntityTooLarge",
  "InternalServerError",
  "InvalidJWT",
  "InvalidKey",
  "InvalidMimeType",
  "InvalidRequest",
  "NoSuchBucket",
  "NotFound",
  "PayloadTooLarge",
  "ResourceAlreadyExists",
  "SignatureDoesNotMatch",
  "Unauthorized",
]);

async function readSafeStorageErrorCode(response) {
  try {
    const body = await response.clone().json();
    const code = body && typeof body === "object"
      ? body.code ?? body.errorCode ?? body.error_code
      : undefined;
    return typeof code === "string" && safeStorageErrorCodes.has(code)
      ? code
      : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

function getStorageSettings(storageConfig) {
  const { supabaseUrl, serviceRoleKey, bucket } = storageConfig;
  if (!supabaseUrl || !serviceRoleKey || !bucket) throw new StorageUnavailableError();

  let baseUrl;
  try {
    baseUrl = new URL(supabaseUrl);
  } catch {
    throw new StorageUnavailableError();
  }
  if (
    !["https:", "http:"].includes(baseUrl.protocol)
    || baseUrl.username
    || baseUrl.password
    || baseUrl.pathname !== "/"
    || baseUrl.search
    || baseUrl.hash
    || (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname))
    || !/^[A-Za-z0-9._-]{1,100}$/.test(bucket)
  ) {
    throw new StorageUnavailableError();
  }

  return { baseUrl: baseUrl.origin, serviceRoleKey, bucket };
}

function objectUrl(baseUrl, bucket, objectPath, operation) {
  const safePath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/${operation}/${encodeURIComponent(bucket)}/${safePath}`;
}

export function createSupabaseStorage({
  storageConfig = defaultConfig.storage,
  fetchImpl = fetch,
} = {}) {
  async function request(url, options, { requestId } = {}) {
    const { serviceRoleKey } = getStorageSettings(storageConfig);
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(20_000),
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          ...options.headers,
        },
      });
    } catch {
      throw Object.assign(new Error("Document storage is temporarily unavailable."), {
        status: 503,
        code: "STORAGE_UNAVAILABLE",
      });
    }
    if (!response.ok) {
      const storageErrorCode = await readSafeStorageErrorCode(response);
      if (requestId) {
        console.error(JSON.stringify({
          level: "error",
          requestId,
          message: "Supabase Storage upload failed",
          status: response.status,
          storageErrorCode,
        }));
      }
      await response.body?.cancel();
      throw Object.assign(new Error("Document storage could not complete the request."), {
        status: 503,
        code: "STORAGE_UNAVAILABLE",
      });
    }
    return response;
  }

  return {
    async uploadObject(objectPath, bytes, mimeType, { overwrite = false, requestId } = {}) {
      const { baseUrl, bucket } = getStorageSettings(storageConfig);
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/i.test(objectPath)) {
        throw new Error("Invalid storage object path.");
      }
      const response = await request(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "POST",
          headers: {
            "Content-Type": mimeType,
            "x-upsert": overwrite ? "true" : "false",
          },
          body: bytes,
        },
        { requestId },
      );
      await response.body?.cancel();
    },

    async removeObject(objectPath) {
      const { baseUrl, bucket } = getStorageSettings(storageConfig);
      const response = await request(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: [objectPath] }),
        },
      );
      await response.body?.cancel();
    },

    async readObject(objectPath) {
      const { baseUrl, bucket } = getStorageSettings(storageConfig);
      const response = await request(objectUrl(baseUrl, bucket, objectPath, "authenticated"), { method: "GET" });
      return Buffer.from(await response.arrayBuffer());
    },

    async createSignedDownloadUrl(objectPath, expiresIn = 60) {
      const { baseUrl, bucket } = getStorageSettings(storageConfig);
      const response = await request(objectUrl(baseUrl, bucket, objectPath, "sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn }),
      });
      const body = await response.json();
      if (typeof body.signedURL !== "string") {
        throw new Error("Document storage returned an invalid download link.");
      }
      const signedUrl = new URL(body.signedURL, `${baseUrl}/storage/v1/`);
      if (signedUrl.origin !== baseUrl) throw new Error("Document storage returned an invalid download link.");
      return signedUrl.toString();
    },
  };
}
