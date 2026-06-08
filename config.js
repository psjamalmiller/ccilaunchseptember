// Keap-sourced metrics. Each maps to a Keap TAG ID supplied via env var.
// The refresh counts contacts carrying that tag (so use launch-specific tags,
// e.g. "Sept25 Prayer Call", so the count = this launch's number).
// ee_booked has NO API source — it stays manual entry in the dashboard.
export const KEAP_METRICS = [
  { key: "ee_prayer",      kind: "count", tagEnv: "KEAP_TAG_EE_PRAYER" },
  { key: "ee_assessment",  kind: "count", tagEnv: "KEAP_TAG_EE_ASSESSMENT" },
  { key: "ee_masterclass", kind: "count", tagEnv: "KEAP_TAG_EE_MASTERCLASS" },
  { key: "ee_enrolled",    kind: "count", tagEnv: "KEAP_TAG_EE_ENROLLED" },
  { key: "ws_registered",  kind: "count", tagEnv: "KEAP_TAG_WS_REGISTERED" },
  { key: "ws_vip",         kind: "count", tagEnv: "KEAP_TAG_WS_VIP" },
  { key: "ws_enrolled",    kind: "count", tagEnv: "KEAP_TAG_WS_ENROLLED" },
  { key: "cci_email",      kind: "level", tagEnv: "KEAP_TAG_CCI_EMAIL" },
];
