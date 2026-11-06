const defaultApiBaseUrl = "http://127.0.0.1:4000";

export class ApiError extends Error {
  constructor(message, { status, code, requestId } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const baseUrl = configuredUrl || defaultApiBaseUrl;

  try {
    const parsedUrl = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error();
    }
  } catch {
    throw new ApiError("The API address is not configured correctly.");
  }

  return baseUrl.replace(/\/+$/, "");
}

export async function apiRequest(path, { method = "GET", body, signal, csrfToken } = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new ApiError("The API request path is invalid.");
  }

  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (typeof csrfToken === "string" && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const url = `${getApiBaseUrl()}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "include",
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection and try again.");
  }

  let responseBody;
  if (response.status !== 204) {
    try {
      responseBody = await response.json();
    } catch {
      if (response.ok) {
        throw new ApiError("The server returned an invalid response.", {
          status: response.status,
        });
      }
    }
  }

  if (!response.ok) {
    const backendError = responseBody?.error;
    throw new ApiError(
      typeof backendError?.message === "string" && backendError.message.trim()
        ? backendError.message
        : "The request could not be completed. Please try again.",
      {
        status: response.status,
        code: typeof backendError?.code === "string" ? backendError.code : undefined,
        requestId: typeof backendError?.requestId === "string"
          ? backendError.requestId
          : undefined,
      },
    );
  }

  return responseBody;
}

export async function apiUpload(path, { body, csrfToken, onProgress } = {}) {
  if (typeof path !== "string" || !path.startsWith("/") || !(body instanceof FormData)) {
    throw new ApiError("The upload request is invalid.");
  }

  const xhr = new XMLHttpRequest();
  const url = `${getApiBaseUrl()}${path}`;
  return new Promise((resolve, reject) => {
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Accept", "application/json");
    if (typeof csrfToken === "string" && csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      let responseBody;
      try {
        responseBody = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        reject(new ApiError("The server returned an invalid response.", { status: xhr.status }));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const backendError = responseBody?.error;
        reject(new ApiError(
          typeof backendError?.message === "string" && backendError.message.trim()
            ? backendError.message
            : "The request could not be completed. Please try again.",
          {
            status: xhr.status,
            code: typeof backendError?.code === "string" ? backendError.code : undefined,
            requestId: typeof backendError?.requestId === "string" ? backendError.requestId : undefined,
          },
        ));
        return;
      }
      resolve(responseBody);
    });
    xhr.addEventListener("error", () => reject(new ApiError("Unable to reach the server. Check your connection and try again.")));
    xhr.addEventListener("timeout", () => reject(new ApiError("The upload took too long. Please try again.")));
    xhr.addEventListener("abort", () => reject(new ApiError("The upload was cancelled.")));
    xhr.send(body);
  });
}
