# Carona Aí 🚗

O Carona Aí é uma plataforma web responsiva desenvolvida para facilitar o compartilhamento de viagens entre estudantes da UFRGS. Focado em resolver problemas de mobilidade urbana, segurança e custo de deslocamento, o sistema conecta motoristas e passageiros que compartilham trajetos em comum com destino ou origem nos campi da universidade.

Além disso, visando aumentar a segurança, existe uma validação exclusiva via e-mail institucional (`@ufrgs.br`), priorizando a segurança e oferecendo usabilidade eficiente com precisão no match de rotas.

---

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- [Python 3.13+](https://www.python.org/) e [uv](https://docs.astral.sh/uv/) (para dev local)
- [Node.js 20+](https://nodejs.org/) (para o frontend)

---

## Configuração

```bash
# 1. Clone o repositório e entre na branch
git clone <url-do-repo>
cd CaronaAi

# 2. Copie o arquivo de variáveis de ambiente
cp .env.example .env
# O .env já funciona com os valores padrão para desenvolvimento local.
# Apenas ajuste se necessário (ex.: porta do banco, credenciais de e-mail).
```

---

## Opção A — Docker completo (recomendado)

Sobe banco de dados, executa as migrações e inicia o backend automaticamente:

```bash
docker compose up --build
```

- API disponível em: http://localhost:8000
- Documentação Swagger: http://localhost:8000/docs

Para o frontend (em outro terminal):

```bash
cd frontend
npm install
npm run dev
```

- Frontend disponível em: http://localhost:5173

---

## Opção B — Backend local + banco no Docker

```bash
# 1. Sobe apenas o banco
docker compose up db -d

# 2. Instala dependências e roda as migrações
cd backend
uv pip install --system -r pyproject.toml
alembic upgrade head

# 3. Inicia o servidor de desenvolvimento
fastapi dev app/main.py
```

---

## Solução de problemas comuns

| Problema | Causa | Solução |
|---|---|---|
| `Connection refused` ao conectar no banco | Porta errada no `DATABASE_URL` | Fora do Docker use `localhost:5433`; dentro do Docker use `db:5432` |
| `could not read env file: .env` | `.env` não existe | Copiar `.env.example` para `.env` |
| `CREATE EXTENSION postgis` falha | PostgreSQL comum sem PostGIS | Use a imagem `postgis/postgis:16-3.4-alpine` do Docker |
| Frontend não consegue acessar a API | CORS bloqueando | Verifique `ALLOWED_ORIGINS` no `.env` |
