/**
 * Admin panel type definitions.
 *
 * Covers auth, bot configs, sessions, cron jobs, and gateway stats.
 */

// --- Auth ---

export interface AdminConnection {
  url: string;
  token: string;
}

// --- Bot ---

export interface BotConfigEntry {
  name: string;
  platform: string;
  bot_id: string;
  status: string;
  connected_at?: string;
  config?: BotConfigAttrs;
  agent_configs?: AgentConfigSummary;
}

export interface BotConfigAttrs {
  worker_type?: string;
  work_dir?: string;
  dm_policy?: string;
  group_policy?: string;
  require_mention?: boolean;
  allow_from?: string[];
  allow_dm_from?: string[];
  allow_group_from?: string[];
  stt?: { provider?: string };
  tts?: { provider?: string; voice?: string };
}

export interface AgentConfigSummary {
  soul?: AgentConfigMeta;
  agents?: AgentConfigMeta;
  skills?: AgentConfigMeta;
  user?: AgentConfigMeta;
  memory?: AgentConfigMeta;
}

export interface AgentConfigMeta {
  source: string;
  size: number;
}

export interface AgentConfigFile {
  content: string;
  source: string;
  size: number;
  file: string;
}

// --- Session ---

export interface AdminSessionInfo {
  id: string;
  user_id: string;
  state: string;
  created_at: string;
  updated_at: string;
  worker_type?: string;
  work_dir?: string;
  title?: string;
  turn_count?: number;
}

// --- Cron ---

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  message: string;
  bot_id: string;
  owner_id: string;
  enabled: boolean;
  max_runs?: number;
  runs_count?: number;
  next_run_at?: string;
  last_run_at?: string;
  expires_at?: string;
}

/** Fields accepted when creating or updating a cron job (no server-managed fields). */
export interface CronJobInput {
  name: string;
  schedule: string;
  message: string;
  bot_id: string;
  owner_id: string;
  enabled: boolean;
  max_runs?: number;
  expires_at?: string;
}

export interface TurnStatItem {
  turn_num: number;
  seq: number;
  success: boolean;
  duration_ms: number;
  cost_usd: number;
  tokens_in: number;
  tokens_input: number;
  tokens_cache_write: number;
  tokens_cache_read: number;
  tokens_out: number;
  model: string;
  source: string;
  created_at: number;
}

export interface TurnStats {
  session_id: string;
  generation: number;
  total_turns: number;
  success_turns: number;
  failed_turns: number;
  total_duration_ms: number;
  total_cost_usd: number;
  total_tokens_in: number;
  total_tokens_input: number;
  total_tokens_cache_write: number;
  total_tokens_cache_read: number;
  total_tokens_out: number;
  turns: TurnStatItem[];
}

// --- Stats ---

export interface GatewayStats {
  uptime_seconds: number;
  websocket_connections: number;
  sessions_active: number;
  sessions_total: number;
}

export interface WorkerStats {
  sessions: number;
  avg_memory_mb: number;
  avg_cpu_percent: number;
}

export interface DatabaseStats {
  sessions_count: number;
  db_size_mb: number;
}

export interface GatewayStatsResponse {
  gateway: GatewayStats;
  workers: Record<string, WorkerStats>;
  database: DatabaseStats;
}
