// Site identity — change the wordmark here and it propagates everywhere.
// RLFY-01 is the unit alias for chrome/decals only.
export const SITE = {
  ident: "RLFY-01",
  name: "Jacob",
  fullName: "Jacob Thomas",
  headline: "Incoming Cybersecurity Student",
  subtitle: "Incoming cybersecurity student at Oxford Brookes",
  roles: ["WRITEUPS", "PROJECTS", "EXPERIMENTS"],
  description:
    "Incoming cybersecurity student at Oxford Brookes: writeups, projects, and experiments.",
  repo: "https://github.com/rulify/personal_site",
  email: "jacobthomas55555@gmail.com",
  linkedin: "https://www.linkedin.com/in/jacob-thomas-cyber/",
  year: 2026,
  serial: "SER 1292-1184 // MODEL 54-09B",
};

// Project status → hazard-token tone (§3: genuine status only, never decoration).
export const STATUS_TONE: Record<string, "ok" | "warn" | "error"> = {
  ACTIVE: "ok",
  DONE: "ok",
  WIP: "warn",
  ARCHIVED: "error",
};
