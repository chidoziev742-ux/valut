import assert from "node:assert/strict";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const { createEmailService, EmailServiceError } = await import("../src/services/email.js");

const configuredSettings = {
  brevo: {
    apiKey: "test-brevo-api-key",
    fromEmail: "no-reply@example.com",
    fromName: "Vaultori",
  },
};

test("sends a transactional email through Brevo with HTML and text content", async () => {
  let request;
  const service = createEmailService({
    settings: configuredSettings,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ messageId: "brevo-message-123" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await service.sendTransactionalEmail({
    to: "student@example.com",
    subject: "Reset your password",
    htmlContent: "<p>Use your reset link.</p>",
    textContent: "Use your reset link.",
  });

  assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["api-key"], "test-brevo-api-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    sender: { email: "no-reply@example.com", name: "Vaultori" },
    to: [{ email: "student@example.com" }],
    subject: "Reset your password",
    htmlContent: "<p>Use your reset link.</p>",
    textContent: "Use your reset link.",
  });
  assert.deepEqual(result, { messageId: "brevo-message-123" });
});

test("reports missing Brevo configuration without making a provider request", async () => {
  let requestMade = false;
  const service = createEmailService({
    settings: { brevo: {} },
    fetchImpl: async () => {
      requestMade = true;
      throw new Error("should not be called");
    },
  });

  await assert.rejects(
    service.sendTransactionalEmail({
      to: "student@example.com",
      subject: "Test",
      textContent: "Test message",
    }),
    (error) => {
      assert.ok(error instanceof EmailServiceError);
      assert.equal(error.code, "EMAIL_NOT_CONFIGURED");
      assert.equal(error.message, "Transactional email is not configured.");
      return true;
    },
  );
  assert.equal(requestMade, false);
});

test("sanitizes provider failures and does not expose the API key", async () => {
  const apiKey = "test-brevo-api-key";
  const service = createEmailService({
    settings: {
      brevo: {
        ...configuredSettings.brevo,
        apiKey,
      },
    },
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: `rejected with ${apiKey}` }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  });

  await assert.rejects(
    service.sendTransactionalEmail({
      to: "student@example.com",
      subject: "Test",
      htmlContent: "<p>Test</p>",
    }),
    (error) => {
      assert.ok(error instanceof EmailServiceError);
      assert.equal(error.code, "EMAIL_PROVIDER_REJECTED");
      assert.equal(error.message, "Transactional email provider rejected the message.");
      assert.equal(error.message.includes(apiKey), false);
      return true;
    },
  );
});

test("sanitizes network failures without exposing provider error details", async () => {
  const service = createEmailService({
    settings: configuredSettings,
    fetchImpl: async () => {
      throw new Error("request failed with test-brevo-api-key");
    },
  });

  await assert.rejects(
    service.sendTransactionalEmail({
      to: "student@example.com",
      subject: "Test",
      textContent: "Test",
    }),
    (error) => {
      assert.equal(error.code, "EMAIL_PROVIDER_UNAVAILABLE");
      assert.equal(error.message.includes("test-brevo-api-key"), false);
      return true;
    },
  );
});
