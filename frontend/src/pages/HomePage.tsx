import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { UFRGS_CAMPUS, type CampusId } from "@/types/ride";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import heroImg from "@/assets/hero-carona.jpg";
import styles from "./HomePage.module.css";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [campusPoint, setCampusPoint] = useState<CampusId>(UFRGS_CAMPUS[0].id);
  const [direction, setDirection] = useState<"to_campus" | "from_campus">("to_campus");
  const [addressInput, setAddressInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAuthenticated) {
      // Directs to the projected app search page with prefilled options
      navigate("/find", {
        state: {
          campus: campusPoint,
          direction,
        },
      });
    } else {
      // Directs to login with helpful state
      navigate("/login", {
        state: {
          returnTo: "/find",
          prefill: { campus: campusPoint, direction },
          message: "Faça login com seu e-mail institucional @ufrgs.br para pesquisar e solicitar caronas.",
        },
      });
    }
  };

  const handleProtectedAction = (path: string, message: string) => {
    if (isAuthenticated) {
      navigate(path);
    } else {
      navigate("/login", {
        state: { returnTo: path, message },
      });
    }
  };

  return (
    <div className={styles.page}>
      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <div className={styles.heroBadge}>
              <Icon name="shield" size={14} />
              <span>Rede Exclusiva UFRGS</span>
            </div>

            <h1 className={styles.heroTitle}>
              Viaje inteligente:{" "}
              <span className={styles.heroTitleAccent}>carona universitária</span>, sempre com economia
            </h1>

            <p className={styles.heroSubtitle}>
              Conecte sua rota diária a outros estudantes e servidores da UFRGS. Menos trânsito,
              mais segurança e caronas com desvio mínimo calculado por rota real.
            </p>
          </div>

          <div className={styles.heroImageWrapper}>
            <img
              src={heroImg}
              alt="Estudantes da UFRGS compartilhando carona"
              className={styles.heroImage}
            />
          </div>
        </div>

        {/* ─── Search Bar (BlaBlaCar inspired) ────────────────────────────── */}
        <div className={styles.searchBarWrapper}>
          <form onSubmit={handleSearchSubmit} className={styles.searchBar}>
            {/* Origem / Endereço */}
            <div className={styles.searchSegment}>
              <div className={styles.searchIconWrapper}>
                <Icon name="pin" size={20} />
              </div>
              <div className={styles.searchFieldGroup}>
                <label className={styles.searchLabel}>
                  {direction === "to_campus" ? "Sua Partida" : "Campus Origem"}
                </label>
                {direction === "to_campus" ? (
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Seu bairro ou endereço"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                  />
                ) : (
                  <select
                    className={styles.searchSelect}
                    value={campusPoint}
                    onChange={(e) => setCampusPoint(e.target.value as CampusId)}
                  >
                    {UFRGS_CAMPUS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Destino */}
            <div className={styles.searchSegment}>
              <div className={styles.searchIconWrapper}>
                <Icon name="flag" size={20} />
              </div>
              <div className={styles.searchFieldGroup}>
                <label className={styles.searchLabel}>
                  {direction === "to_campus" ? "Campus Destino" : "Seu Destino"}
                </label>
                {direction === "to_campus" ? (
                  <select
                    className={styles.searchSelect}
                    value={campusPoint}
                    onChange={(e) => setCampusPoint(e.target.value as CampusId)}
                  >
                    {UFRGS_CAMPUS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Seu bairro ou endereço"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Sentido da Viagem */}
            <div className={styles.searchSegment}>
              <div className={styles.searchIconWrapper}>
                <Icon name="route" size={20} />
              </div>
              <div className={styles.searchFieldGroup}>
                <label className={styles.searchLabel}>Sentido</label>
                <select
                  className={styles.searchSelect}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "to_campus" | "from_campus")}
                >
                  <option value="to_campus">Indo para a UFRGS</option>
                  <option value="from_campus">Saindo da UFRGS</option>
                </select>
              </div>
            </div>

            {/* Botão de Busca */}
            <button type="submit" className={styles.searchBtn} aria-label="Procurar caronas">
              <Icon name="search" size={18} strokeWidth={2.4} />
              <span>Procurar</span>
            </button>
          </form>
        </div>
      </section>

      {/* ─── Informative Banner when not logged in ─────────────────────────── */}
      {!isAuthenticated && (
        <div className={styles.authNotice}>
          <Icon name="info" size={20} />
          <p>
            O Carona Aí é uma plataforma segura exclusiva para a comunidade da UFRGS.{" "}
            <Link to="/login" className={styles.authNoticeLink}>
              Faça login
            </Link>{" "}
            ou{" "}
            <Link to="/register" className={styles.authNoticeLink}>
              cadastre-se
            </Link>{" "}
            com seu e-mail institucional para acessar todos os trajetos.
          </p>
        </div>
      )}

      {/* ─── Vantagens / Diferenciais ───────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Vantagens</span>
            <h2 className={styles.sectionTitle}>Como funciona o Carona Aí?</h2>
            <p className={styles.sectionSubtitle}>
              Desenvolvido com tecnologia de mapas OSRM e PostGIS sob medida para os deslocamentos
              entre a Região Metropolitana e os campi da UFRGS.
            </p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconBox}>
                <Icon name="shield" size={24} />
              </div>
              <h3 className={styles.featureTitle}>100% Comunidade UFRGS</h3>
              <p className={styles.featureDescription}>
                Todos os usuários têm o e-mail institucional @ufrgs.br verificado antes de poder
                oferecer ou solicitar caronas, garantindo segurança entre colegas de faculdade.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={[styles.featureIconBox, styles.featureIconBoxAccent].join(" ")}>
                <Icon name="route" size={24} />
              </div>
              <h3 className={styles.featureTitle}>Matching com Menor Desvio</h3>
              <p className={styles.featureDescription}>
                O algoritmo analisa o trajeto real do motorista e só propõe passageiros cujo ponto de
                embarque adicione menos de 3 km e 15 minutos ao tempo de viagem.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconBox}>
                <Icon name="lock" size={24} />
              </div>
              <h3 className={styles.featureTitle}>Privacidade Protegida</h3>
              <p className={styles.featureDescription}>
                Seu endereço de casa nunca é exibido publicamente no mapa. Apenas o bairro aproximado
                aparece na lista e o local exato só é revelado após o aceite mútuo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Campi Conectados ──────────────────────────────────────────────── */}
      <section className={styles.campusesSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Destinos</span>
          <h2 className={styles.sectionTitle}>Campi da UFRGS atendidos</h2>
          <p className={styles.sectionSubtitle}>
            Rotas diretas para todos os campi em Porto Alegre e no Litoral Norte.
          </p>
        </div>

        <div className={styles.campusGrid}>
          {UFRGS_CAMPUS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.campusCard}
              onClick={() => {
                setCampusPoint(c.id);
                handleProtectedAction("/find", "Faça login para ver caronas com destino a este campus.");
              }}
            >
              <div className={styles.campusIcon}>
                <Icon name="school" size={22} />
              </div>
              <div>
                <h4 className={styles.campusName}>{c.name}</h4>
                <p className={styles.campusDesc}>Clique para pesquisar caronas</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Motorista CTA ─────────────────────────────────────────────────── */}
      <section className={styles.driverBanner}>
        <div className={styles.driverBannerCard}>
          <div className={styles.driverBannerText}>
            <h3 className={styles.driverBannerTitle}>Você vai de carro para a UFRGS?</h3>
            <p className={styles.driverBannerSubtitle}>
              Economize combustível, ajude seus colegas e reduza o número de carros nas ruas. Publique
              sua carona em menos de 1 minuto.
            </p>
          </div>
          <Button
            size="lg"
            variant="primary"
            onClick={() =>
              handleProtectedAction(
                "/offer",
                "Entre com seu e-mail institucional @ufrgs.br para oferecer carona."
              )
            }
          >
            <Icon name="car" size={18} />
            <span>Oferecer uma carona</span>
          </Button>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <strong>Carona Aí UFRGS</strong> · Projeto acadêmico de mobilidade universitária
          </div>
          <div className={styles.footerLinks}>
            <button
              type="button"
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit" }}
              onClick={() => handleProtectedAction("/find", "Faça login para pedir carona.")}
            >
              Pedir carona
            </button>
            <button
              type="button"
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit" }}
              onClick={() => handleProtectedAction("/offer", "Faça login para oferecer carona.")}
            >
              Oferecer carona
            </button>
            <Link to="/login">Entre</Link>
            <Link to="/register">Cadastre-se</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
