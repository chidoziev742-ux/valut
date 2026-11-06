import assert from "node:assert/strict";
import test from "node:test";
import { getProfileResponse } from "./profileData.js";

test("profile display model uses the authenticated user's email instead of profile data", () => {
  const authenticatedUser = { email: "student@example.com" };
  const profile = getProfileResponse({
    profile: {
      fullName: "Student User",
      university: "Example University",
      faculty: "Science",
      department: "Computing",
      programme: "Computer Science",
      studyYear: "Year 2",
      academicSession: "2026/2027",
    },
  }, authenticatedUser.email);

  assert.equal(profile.email, authenticatedUser.email);
  assert.equal(profile.fullName, "Student User");
});
