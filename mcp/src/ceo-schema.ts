import { z } from "zod";
const ceoActionSchema = z.object({
  title: z.string().min(1),
  why: z.string().min(1),
  owner_type: z.enum(["ARTIST", "HUMAN", "AI_AGENT", "AGENCY"]),
  owner_name: z.string().nullable(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  due_date: z.string().nullable(),
  next_action: z.string().min(1),
  domain: z.enum(["strategy", "music", "release", "content", "audience", "growth", "live", "revenue", "finance", "industry", "operations"]),
  consequential: z.boolean(),
  consequence_type: z.enum(["EMAIL", "SOCIAL_PUBLISH", "SPEND", "BOOKING_ACCEPTANCE", "CONTRACT_RIGHTS", "RELEASE_DATE_CHANGE", "PUBLIC_STATEMENT", "OTHER"]).nullable(),
});

export const ceoResponseSchema = z.object({
  current_state: z.object({
    summary: z.string(),
    facts_used: z.array(z.string()),
  }),
  diagnosis: z.object({
    primary_bottleneck: z.string(),
    evidence: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  actions: z.array(ceoActionSchema).max(3),
  missing_data: z.array(z.string()),
  notes: z.array(z.string()),
});

export const ceoJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["current_state", "diagnosis", "actions", "missing_data", "notes"],
  properties: {
    current_state: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "facts_used"],
      properties: {
        summary: { type: "string" },
        facts_used: { type: "array", items: { type: "string" } },
      },
    },
    diagnosis: {
      type: "object",
      additionalProperties: false,
      required: ["primary_bottleneck", "evidence", "confidence"],
      properties: {
        primary_bottleneck: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "owner_type", "owner_name", "priority", "due_date", "next_action", "domain", "consequential", "consequence_type"],
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          owner_type: { type: "string", enum: ["ARTIST", "HUMAN", "AI_AGENT", "AGENCY"] },
          owner_name: { type: ["string", "null"] },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          due_date: { type: ["string", "null"] },
          next_action: { type: "string" },
          domain: { type: "string", enum: ["strategy", "music", "release", "content", "audience", "growth", "live", "revenue", "finance", "industry", "operations"] },
          consequential: { type: "boolean" },
          consequence_type: { type: ["string", "null"], enum: ["EMAIL", "SOCIAL_PUBLISH", "SPEND", "BOOKING_ACCEPTANCE", "CONTRACT_RIGHTS", "RELEASE_DATE_CHANGE", "PUBLIC_STATEMENT", "OTHER", null] },
        },
      },
    },
    missing_data: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
  },
} as const;

