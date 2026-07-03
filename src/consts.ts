// Site identity — change the wordmark here and it propagates everywhere.
export const SITE = {
  ident: "RLFY-01",
  description: "Writeups, projects, and experiments.",
  tagline: "writeups · projects · experiments",
  repo: "https://github.com/rulify/personal_site",
  year: 2026,
  serial: "SER 7599-2607 // MODEL 26-07C",
};

// Project status → hazard-token tone (§3: genuine status only, never decoration).
export const STATUS_TONE: Record<string, "ok" | "warn" | "error"> = {
  ACTIVE: "ok",
  DONE: "ok",
  WIP: "warn",
  ARCHIVED: "error",
};
