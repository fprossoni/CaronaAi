/**
 * ReportsManager Component
 */

import React, { useEffect, useState } from "react";
import { usersApi } from "@/api/auth";
import type { ReportPublic, ReportStatus } from "@/types/report";
import { AlertTriangleIcon } from "@/components/ui/Icons";

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Em análise",
  reviewed: "Analisada",
  dismissed: "Arquivada",
};

const STATUS_CLASS: Record<ReportStatus, string> = {
  pending: "bg-warning-bg text-warning-text border-warning/40",
  reviewed: "bg-secondary/15 text-secondary border-secondary/35",
  dismissed: "bg-surface-2 text-text-muted border-border",
};

function formatReportDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const ReportsManager: React.FC = () => {
  const [reports, setReports] = useState<ReportPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    usersApi
      .getMyReports()
      .then((res) => {
        if (active) setReports(res.data);
      })
      .catch(() => {
        // Silent fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-[10px] border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md border border-danger/30 bg-danger/10 text-danger shrink-0">
            <AlertTriangleIcon size={16} />
          </div>
          <h2 className="font-display text-base font-bold text-text">Denúncias</h2>
        </div>
        <span className="font-mono text-xs text-text-muted">{reports.length}</span>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-text-muted">Carregando…</p>
      ) : reports.length === 0 ? (
        <p className="text-xs text-text-muted">Nenhuma denúncia enviada.</p>
      ) : (
        <ul className="space-y-2.5">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-md border border-border bg-surface-2 p-3.5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-text">
                    {report.reported_name ?? `Usuário #${report.reported_id}`}
                  </p>
                  <p className="font-mono text-[10px] text-text-muted">
                    {formatReportDate(report.created_at)}
                    {report.ride_id ? ` · Carona #${report.ride_id}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold uppercase border ${STATUS_CLASS[report.status]}`}
                >
                  {STATUS_LABEL[report.status]}
                </span>
              </div>
              <p className="text-xs text-text-secondary">{report.reason}</p>
              {report.details && (
                <p className="text-xs whitespace-pre-line text-text-muted">{report.details}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
