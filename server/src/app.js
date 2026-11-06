import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createStudentRouter } from "./routes/student.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createFoldersRouter } from "./routes/folders.js";
import { createAcademicRecordsRouter } from "./routes/academic-records.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createAdminRouter } from "./routes/admin.js";

export function safeErrorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  const code = status === 400
    ? "INVALID_REQUEST"
    : status === 413
      ? "REQUEST_TOO_LARGE"
      : "INTERNAL_ERROR";
  const message = status === 400
    ? "The request body is invalid."
    : status === 413
      ? "The request body exceeds the allowed size."
      : "An unexpected server error occurred.";

  if (status === 500) {
    // Deliberately log only a generated request ID and a fixed message, never raw error details.
    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      message: "Unhandled API error",
    }));
  }

  res.status(status).json({
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  });
}

export function createApp({
  authRouter = createAuthRouter(),
  studentRouter = createStudentRouter(),
  documentsRouter = createDocumentsRouter(),
  foldersRouter = createFoldersRouter(),
  academicRecordsRouter = createAcademicRecordsRouter(),
  notificationsRouter = createNotificationsRouter(),
  adminRouter = createAdminRouter(),
} = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients may omit Origin. Browser origins must match the configured frontend exactly.
        callback(null, !origin || origin === config.frontendOrigin);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      credentials: true,
      optionsSuccessStatus: 204,
    }),
  );
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use(express.json({ limit: config.jsonBodyLimit, strict: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/student/documents", documentsRouter);
  app.use("/api/student/folders", foldersRouter);
  app.use("/api/student/academic-records", academicRecordsRouter);
  app.use("/api/student/notifications", notificationsRouter);
  app.use("/api/student", studentRouter);

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "student-vault-api" });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "The requested API route was not found.",
        requestId: req.requestId,
      },
    });
  });

  app.use(safeErrorHandler);

  return app;
}
