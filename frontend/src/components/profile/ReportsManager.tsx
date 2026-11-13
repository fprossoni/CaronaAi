/**
 * ReportsManager Component
 *
 * Lists the moderation reports the current user has filed
 * (`GET /users/me/reports`), showing status and reported user.
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
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reviewed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-slate-500/15 text-slate-400 border-slate-500/30",
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
        // Silent fallback if backend is unreachable
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="rounded-3xl border p-6 space-y-4"
      style={{
        background: "var(--gradient-card)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            Denúncias enviadas
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Acompanhe as ocorrências registradas e o status da análise.
          </p>
        </div>
        <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
          <AlertTriangleIcon size={18} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Carregando denúncias...
        </p>
      ) : reports.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Você ainda não registrou nenhuma denúncia.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-2xl border p-4 space-y-2"
              style={{
                backgroundColor: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {report.reported_name ?? `Usuário #${report.reported_id}`}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {formatReportDate(report.created_at)}
                    {report.ride_id ? ` • Carona #${report.ride_id}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_CLASS[report.status]}`}>
                  {STATUS_LABEL[report.status]}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {report.reason}
              </p>
              {report.details && (
                <p className="text-xs whitespace-pre-line" style={{ color: "var(--color-text-muted)" }}>
                  {report.details}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
