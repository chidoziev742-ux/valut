export function getStudentProfile(profile, email = "") {
  return {
    fullName: profile?.fullName ?? "",
    email,
    university: profile?.university ?? "",
    faculty: profile?.faculty ?? "",
    department: profile?.department ?? "",
    program: profile?.programme ?? profile?.program ?? "",
    studyYear: profile?.studyYear ?? "",
    academicSession: profile?.academicSession ?? "",
  };
}

export function getProfileResponse(payload, email = "") {
  if (!payload?.profile || typeof payload.profile !== "object") {
    throw new Error("The server returned an invalid profile.");
  }
  return getStudentProfile(payload.profile, email);
}
