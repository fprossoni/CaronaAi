import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UFRGS_CAMPUS } from "@/types/ride";
import { Button } from "@/components/ui/Button";
import { KineticChevrons } from "@/components/ui/BrandMotifs";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const handleProtectedAction = (path: string, message: string) => {
    if (isAuthenticated) {
      navigate(path);
    } else {
      navigate("/login", {
        state: {
          returnTo: path,
          message,
        },
      });
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      <section className="rounded-[10px] p-5 sm:p-8 border border-border-strong bg-surface bg-topo-pattern relative shadow-md">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08]">
              <span className="text-text block">Mobilidade universitária</span>
              <span className="text-text-secondary block">entre campi UFRGS.</span>
            </h1>

          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() =>
              handleProtectedAction(
                "/find",
                "Entre com seu e-mail institucional UFRGS (@ufrgs.br) para pedir uma carona."
              )
            }
          >

            <span>Pedir carona</span>
            <KineticChevrons />
          </Button>
        </div>

        {!isAuthenticated && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2 text-xs text-text-muted">
            <span>Acesso exclusivo com e-mail @ufrgs.br ou institutos.</span>
            <Link
              to="/login"
              className="font-semibold text-accent-text hover:underline no-underline"
            >
              Entrar com @ufrgs.br →
            </Link>
          </div>
        )}
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {[
          {
            code: "01 · VÍNCULO UFRGS",
            desc: "Acesso restrito a e-mails @ufrgs.br e institutos.",
          },
          {
            code: "02 · OPÇÕES DE CARONA",
            desc: "Compare os horários e escolha a carona que funciona para você.",
          },
          {
            code: "03 · ENDEREÇO OCULTO",
            desc: "Apenas seu bairro é exibido até a confirmação da vaga.",
          },
        ].map((feat) => (
          <div
            key={feat.code}
            className="rounded-[10px] border border-border bg-surface p-5 flex flex-col justify-between gap-3 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold tracking-wider text-accent-text">
                {feat.code}
              </span>

            </div>
            <p className="text-sm text-text-secondary leading-snug">{feat.desc}</p>
          </div>
        ))}
      </section>
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-text">
            Campi UFRGS
          </h2>
          <span className="font-mono text-[11px] text-text-muted">06 DESTINOS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {UFRGS_CAMPUS.map((c, idx) => (
            <div
              key={c.id}
              className="p-3.5 rounded-md border border-border bg-surface text-left flex items-center gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-text-muted shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold truncate text-text">{c.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[10px] p-5 sm:p-6 border border-border-strong bg-surface bg-dot-matrix flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold text-text">
            Vai de carro para o campus?
          </h3>
        </div>

        <Button
          size="lg"
          variant="primary"
          onClick={() =>
            handleProtectedAction(
              "/offer",
              "Entre com seu e-mail UFRGS para oferecer uma carona."
            )
          }
        >

          <span>Oferecer carona</span>
          <KineticChevrons />
        </Button>
      </section>
    </div>
  );
};

