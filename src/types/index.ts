export type SessionStatus = "pending" | "running" | "done" | "failed";

export type AgentStatus = "running" | "done" | "failed";

export interface ResearchSession {
  id: string;
  query: string;
  status: SessionStatus;
  final_report: string | null;
  created_at: string | null;
}

export interface Source {
  id: string;
  url: string | null;
  title: string | null;
  snippet: string | null;
  credibility_score: number | null;
}

export interface AgentUpdate {
  agent: string;
  status: AgentStatus;
  output?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
