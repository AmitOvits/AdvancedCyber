import { supabase } from "./client";
import type { Database, Json } from "./types";

type MessageLogRow = Database["public"]["Tables"]["message_logs"]["Row"];
type MessageLogInsert = Database["public"]["Tables"]["message_logs"]["Insert"];
type ClassificationStatusRow = Database["public"]["Tables"]["classification_status"]["Row"];
type ClassificationStatusInsert = Database["public"]["Tables"]["classification_status"]["Insert"];
type UserPreferenceRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type UserPreferenceInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

export type MessageRole = "user" | "ai" | "system" | "import";

export interface SaveMessageLogInput {
  id?: string;
  content: string;
  origin: string;
  externalId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  role?: MessageRole;
  source?: string;
  responseText?: string | null;
  metadata?: Json;
  receivedAt?: string;
  processedAt?: string | null;
}

export interface SaveClassificationStatusInput {
  id?: string;
  messageLogId: string;
  status?: string;
  category?: string | null;
  subcategory?: string | null;
  confidence?: number | null;
  classifier?: string | null;
  reviewNotes?: string | null;
  metadata?: Json;
  classifiedAt?: string | null;
}

export interface SaveUserPreferenceInput {
  id?: string;
  preferenceKey: string;
  preferenceValue: Json;
  userId?: string | null;
  subjectId?: string;
  source?: string;
  metadata?: Json;
}

export interface RestoreProcessedMessageInput {
  message: string;
  reply?: string | null;
  origin?: string;
  source?: string;
  externalId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  messageMetadata?: Json;
  replyMetadata?: Json;
  classification?: Omit<SaveClassificationStatusInput, "messageLogId">;
}

function ensureText(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return trimmed;
}

function buildMessageLogRow(input: SaveMessageLogInput): MessageLogInsert {
  return {
    content: ensureText(input.content, "content"),
    origin: ensureText(input.origin, "origin"),
    external_id: input.externalId ?? null,
    request_id: input.requestId ?? null,
    session_id: input.sessionId ?? null,
    role: input.role ?? "user",
    source: input.source ?? "local",
    response_text: input.responseText ?? null,
    metadata: input.metadata ?? {},
    received_at: input.receivedAt ?? new Date().toISOString(),
    processed_at: input.processedAt ?? null,
  };
}

function buildClassificationRow(input: SaveClassificationStatusInput): ClassificationStatusInsert {
  return {
    message_log_id: input.messageLogId,
    status: input.status ?? "pending",
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    confidence: input.confidence ?? null,
    classifier: input.classifier ?? null,
    review_notes: input.reviewNotes ?? null,
    metadata: input.metadata ?? {},
    classified_at: input.classifiedAt ?? null,
  };
}

function buildUserPreferenceRow(input: SaveUserPreferenceInput): UserPreferenceInsert {
  return {
    user_id: input.userId ?? null,
    subject_id: input.subjectId ?? input.userId ?? "local",
    preference_key: ensureText(input.preferenceKey, "preferenceKey"),
    preference_value: input.preferenceValue,
    source: input.source ?? "local",
    metadata: input.metadata ?? {},
  };
}

export async function saveMessageLog(input: SaveMessageLogInput): Promise<MessageLogRow> {
  const row = buildMessageLogRow(input);

  if (input.id) {
    const { data, error } = await supabase
      .from("message_logs")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  if (row.external_id) {
    const { data, error } = await supabase
      .from("message_logs")
      .upsert(row, { onConflict: "external_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from("message_logs").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function saveClassificationStatus(
  input: SaveClassificationStatusInput,
): Promise<ClassificationStatusRow> {
  const row = buildClassificationRow(input);

  if (input.id) {
    const { data, error } = await supabase
      .from("classification_status")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("classification_status")
    .upsert(row, { onConflict: "message_log_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveUserPreference(input: SaveUserPreferenceInput): Promise<UserPreferenceRow> {
  const row = buildUserPreferenceRow(input);

  if (input.id) {
    const { data, error } = await supabase
      .from("user_preferences")
      .update(row)
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(row, { onConflict: "subject_id,preference_key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveUserPreferences(inputs: SaveUserPreferenceInput[]) {
  return Promise.all(inputs.map((input) => saveUserPreference(input)));
}

// Maps the current widget/API flow of { message } -> { reply } into local tables.
export async function restoreProcessedMessage(input: RestoreProcessedMessageInput) {
  const processedAt = new Date().toISOString();
  const userMessage = await saveMessageLog({
    content: input.message,
    origin: input.origin ?? "ai-expert-widget",
    externalId: input.externalId ?? null,
    requestId: input.requestId ?? null,
    sessionId: input.sessionId ?? null,
    role: "user",
    source: input.source ?? "local",
    responseText: input.reply ?? null,
    metadata: input.messageMetadata ?? {},
    processedAt,
  });

  let aiMessage: MessageLogRow | null = null;
  if (input.reply?.trim()) {
    aiMessage = await saveMessageLog({
      content: input.reply,
      origin: input.origin ?? "ai-expert-widget",
      externalId: input.externalId ? `${input.externalId}:reply` : null,
      requestId: input.requestId ?? null,
      sessionId: input.sessionId ?? null,
      role: "ai",
      source: input.source ?? "local",
      metadata: input.replyMetadata ?? {},
      processedAt,
    });
  }

  let classification: ClassificationStatusRow | null = null;
  if (input.classification) {
    classification = await saveClassificationStatus({
      ...input.classification,
      messageLogId: userMessage.id,
      classifiedAt: input.classification.classifiedAt ?? processedAt,
    });
  }

  return {
    userMessage,
    aiMessage,
    classification,
  };
}
