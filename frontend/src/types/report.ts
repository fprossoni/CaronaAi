export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface ReportCreate {
  reason: string;
  details?: string | null;
  ride_id?: number | null;
  match_id?: number | null;
  block?: boolean;
}

export interface ReportPublic {
  id: number;
  reporter_id: number;
  reported_id: number;
  reported_name: string | null;
  ride_id: number | null;
  match_id: number | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}
