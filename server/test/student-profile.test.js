import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

process.env.FRONTEND_ORIGIN = "http://localhost:5173";

const [{ createApp }, { createStudentRouter }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/student.js"),
]);

const frontendOrigin = "http://localhost:5173";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const csrfToken = (token) => createHmac("sha256", token).update("vaultori-csrf-v1").digest("base64url");
const profileBody = {
  fullName: "Alice Example",
  university: "Example University",
  faculty: "Science",
  department: "Computing",
  programme: "Computer Science",
  studyYear: "Year 2",
  academicSession: "2026/2027",
};

async function withServer(app, run) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections?.();
    });
  }
}

function createProfilePool({ missingBob = false } = {}) {
  const sessions = new Map([
    [tokenHash(tokenA), { user_id: "user-alice" }],
    [tokenHash(tokenB), { user_id: "user-bob" }],
  ]);
  const profiles = new Map([
    ["user-alice", {
      full_name: "Alice Example",
      university: "Alice University",
      faculty: "Arts",
      department: "History",
      programme: "History",
      study_year: "Year 3",
      academic_session: "2026/2027",
    }],
    ...(!missingBob ? [["user-bob", {
      full_name: "Bob Example",
      university: "Bob University",
      faculty: "Science",
      department: "Physics",
      programme: "Physics",
      study_year: "Year 1",
      academic_session: "2026/2027",
    }]] : []),
  ]);
  const queries = [];

  return {
    queries,
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.includes("FROM auth_sessions s")) {
        const session = sessions.get(values[0]);
        return { rows: session ? [{ user_id: session.user_id }] : [] };
      }
      if (text.includes("FROM student_profiles") && text.startsWith("SELECT")) {
        const profile = profiles.get(values[0]);
        return { rows: profile ? [{ ...profile }] : [] };
      }
      if (text.includes("INSERT INTO student_profiles")) {
        const [userId, fullName, university, faculty, department, programme, studyYear, academicSession] = values;
        const profile = {
          full_name: fullName,
          university,
          faculty,
          department,
          programme,
          study_year: studyYear,
          academic_session: academicSession,
        };
        profiles.set(userId, profile);
        return { rows: [{ ...profile }] };
      }
      throw new Error("Unexpected profile query");
    },
  };
}

function createTestApp(pool) {
  return createApp({
    studentRouter: createStudentRouter({ getPool: () => pool }),
  });
}

function sessionHeaders(token) {
  return { Cookie: `vaultori_refresh=${token}` };
}

test("unauthenticated users cannot access student profile endpoints", async () => {
  const pool = createProfilePool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const getResponse = await fetch(`${baseUrl}/api/student/profile`);
    const putResponse = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileBody),
    });

    assert.equal(getResponse.status, 401);
    assert.equal(putResponse.status, 401);
    assert.equal(pool.queries.length, 0);
  });
});

test("the configured frontend may preflight profile updates", async () => {
  await withServer(createTestApp(createProfilePool()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/profile`, {
      method: "OPTIONS",
      headers: {
        Origin: frontendOrigin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type,x-csrf-token",
      },
    });

    assert.equal(response.status, 204);
    assert.match(response.headers.get("access-control-allow-methods"), /\bPUT\b/);
    assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  });
});

test("a student can read their own profile and another student receives only their own profile", async () => {
  const pool = createProfilePool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const aliceResponse = await fetch(`${baseUrl}/api/student/profile`, {
      headers: sessionHeaders(tokenA),
    });
    const bobResponse = await fetch(`${baseUrl}/api/student/profile`, {
      headers: sessionHeaders(tokenB),
    });

    assert.equal(aliceResponse.status, 200);
    assert.equal((await aliceResponse.json()).profile.fullName, "Alice Example");
    assert.equal(bobResponse.status, 200);
    assert.equal((await bobResponse.json()).profile.fullName, "Bob Example");
    assert.deepEqual(pool.queries.filter(({ text }) => text.startsWith("SELECT full_name")).map(({ values }) => values[0]), [
      "user-alice",
      "user-bob",
    ]);
  });
});

test("a student can update only their own profile", async () => {
  const pool = createProfilePool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenA),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenA),
      },
      body: JSON.stringify(profileBody),
    });
    const bobAttempt = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenB),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenB),
      },
      body: JSON.stringify({ ...profileBody, user_id: "user-alice" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).profile, profileBody);
    assert.equal(bobAttempt.status, 400);
    const update = pool.queries.find(({ text }) => text.includes("INSERT INTO student_profiles"));
    assert.equal(update.values[0], "user-alice");
    assert.equal(pool.queries.filter(({ text }) => text.includes("INSERT INTO student_profiles")).length, 1);
    assert.match(update.text, /ON CONFLICT \(user_id\) DO UPDATE/);
    assert.match(update.text, /WHERE user_id = \$1|VALUES \(\$1/);
  });
});

test("profile updates reject invalid data and restricted fields", async () => {
  const pool = createProfilePool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const send = async (body) => fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenA),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenA),
      },
      body: JSON.stringify(body),
    });

    const missingName = await send({ ...profileBody, fullName: "  " });
    const longField = await send({ ...profileBody, university: "U".repeat(121) });
    const omittedField = { ...profileBody };
    delete omittedField.academicSession;
    const missingOptionalField = await send(omittedField);
    const restrictedField = await send({ ...profileBody, user_id: "user-bob" });
    const emailField = await send({ ...profileBody, email: "attacker@example.com" });

    assert.equal(missingName.status, 400);
    assert.equal((await missingName.json()).error.code, "INVALID_PROFILE");
    assert.equal(longField.status, 400);
    assert.equal(missingOptionalField.status, 400);
    assert.equal(restrictedField.status, 400);
    assert.equal(emailField.status, 400);
    assert.equal(pool.queries.filter(({ text }) => text.includes("INSERT INTO student_profiles")).length, 0);
  });
});

test("profile updates require a valid CSRF token and trusted origin", async () => {
  const pool = createProfilePool();
  await withServer(createTestApp(pool), async (baseUrl) => {
    const missingCsrf = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenA),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileBody),
    });
    const wrongOrigin = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenA),
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenA),
      },
      body: JSON.stringify(profileBody),
    });
    const wrongCsrf = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenA),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenB),
      },
      body: JSON.stringify(profileBody),
    });

    assert.equal(missingCsrf.status, 403);
    assert.equal(wrongOrigin.status, 403);
    assert.equal(wrongCsrf.status, 403);
    assert.equal(pool.queries.filter(({ text }) => text.includes("INSERT INTO student_profiles")).length, 0);
  });
});

test("missing profile is reported clearly and can be created by the authenticated owner", async () => {
  const pool = createProfilePool({ missingBob: true });
  pool.queries.length = 0;
  await withServer(createTestApp(pool), async (baseUrl) => {
    const missingResponse = await fetch(`${baseUrl}/api/student/profile`, {
      headers: sessionHeaders(tokenB),
    });
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, 404);
    assert.equal(missingBody.error.code, "PROFILE_NOT_FOUND");

    const updateResponse = await fetch(`${baseUrl}/api/student/profile`, {
      method: "PUT",
      headers: {
        ...sessionHeaders(tokenB),
        Origin: frontendOrigin,
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken(tokenB),
      },
      body: JSON.stringify(profileBody),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).profile.fullName, profileBody.fullName);
    const insert = pool.queries.find(({ text }) => text.includes("INSERT INTO student_profiles"));
    assert.equal(insert.values[0], "user-bob");
  });
});
