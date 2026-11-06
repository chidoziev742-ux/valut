import { config } from "../config.js";

const brevoEmailEndpoint = "https://api.brevo.com/v3/smtp/email";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requestTimeoutMs = 10000;

export class EmailServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
  }
}

function getBrevoConfiguration(settings) {
  const { apiKey, fromEmail, fromName } = settings?.brevo ?? {};
  if (
    typeof apiKey !== "string" ||
    !apiKey.trim() ||
    typeof fromEmail !== "string" ||
    !emailPattern.test(fromEmail.trim()) ||
    typeof fromName !== "string" ||
    !fromName.trim()
  ) {
    throw new EmailServiceError(
      "EMAIL_NOT_CONFIGURED",
      "Transactional email is not configured.",
    );
  }

  return {
    apiKey: apiKey.trim(),
    fromEmail: fromEmail.trim(),
    fromName: fromName.trim(),
  };
}

function validateMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new EmailServiceError("INVALID_EMAIL_MESSAGE", "A valid email message is required.");
  }
  const { to, subject, htmlContent, textContent } = message;
  if (typeof to !== "string" || !emailPattern.test(to.trim())) {
    throw new EmailServiceError("INVALID_EMAIL_MESSAGE", "A valid recipient email is required.");
  }
  if (typeof subject !== "string" || !subject.trim()) {
    throw new EmailServiceError("INVALID_EMAIL_MESSAGE", "An email subject is required.");
  }
  if (
    (htmlContent !== undefined && typeof htmlContent !== "string") ||
    (textContent !== undefined && typeof textContent !== "string") ||
    (typeof htmlContent !== "string" && typeof textContent !== "string") ||
    (!htmlContent?.trim() && !textContent?.trim())
  ) {
    throw new EmailServiceError(
      "INVALID_EMAIL_MESSAGE",
      "HTML content, text content, or both are required.",
    );
  }
}

export function createEmailService({
  settings = config,
  fetchImpl = globalThis.fetch,
} = {}) {
  return Object.freeze({
    async sendTransactionalEmail(message) {
      validateMessage(message);
      const { apiKey, fromEmail, fromName } = getBrevoConfiguration(settings);
      if (typeof fetchImpl !== "function") {
        throw new EmailServiceError(
          "EMAIL_PROVIDER_UNAVAILABLE",
          "Transactional email provider is unavailable.",
        );
      }

      const payload = {
        sender: { email: fromEmail, name: fromName },
        to: [{ email: message.to.trim() }],
        subject: message.subject.trim(),
        ...(message.htmlContent !== undefined ? { htmlContent: message.htmlContent } : {}),
        ...(message.textContent !== undefined ? { textContent: message.textContent } : {}),
      };

      let response;
      try {
        response = await fetchImpl(brevoEmailEndpoint, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch {
        throw new EmailServiceError(
          "EMAIL_PROVIDER_UNAVAILABLE",
          "Transactional email provider is unavailable.",
        );
      }

      if (!response.ok) {
        throw new EmailServiceError(
          "EMAIL_PROVIDER_REJECTED",
          "Transactional email provider rejected the message.",
        );
      }

      let result;
      try {
        result = await response.json();
      } catch {
        throw new EmailServiceError(
          "EMAIL_PROVIDER_INVALID_RESPONSE",
          "Transactional email provider returned an invalid response.",
        );
      }

      if (typeof result?.messageId !== "string" || !result.messageId) {
        throw new EmailServiceError(
          "EMAIL_PROVIDER_INVALID_RESPONSE",
          "Transactional email provider returned an invalid response.",
        );
      }

      return { messageId: result.messageId };
    },
  });
}
