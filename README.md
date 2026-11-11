# Carona Aí 🚗

O Carona Aí é uma plataforma web responsiva desenvolvida para facilitar o compartilhamento de viagens entre estudantes da UFRGS. Focado em resolver problemas de mobilidade urbana, segurança e custo de deslocamento, o sistema conecta motoristas e passageiros que compartilham trajetos em comum com destino ou origem nos campi da universidade.

Além disso, visando aumentar a segurança, existe uma validação exclusiva via e-mail institucional (`@ufrgs.br`), priorizando a segurança e oferecendo usabilidade eficiente com precisão no match de rotas.

---

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- [Python 3.13+](https://www.python.org/) e [uv](https://docs.astral.sh/uv/) (para dev local)
- [Node.js](https://nodejs.org/) 20.19+ na série 20 ou 22.12+ (para o frontend)

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
npm ci
npm run dev
```

- Frontend disponível em: http://localhost:5173

Com o frontend e o backend em execução, abra [http://localhost:5173/dev](http://localhost:5173/dev) para criar uma conta de teste com nome e sexo. A conta já entra no app e usa os mesmos mapas, APIs e banco de dados que uma conta comum. Use o botão **Dev** para trocar de conta. As contas criadas ficam disponíveis no mesmo navegador após recarregar ou sair da sessão.

Em um ambiente local existente, adicione `DEV_ACCOUNTS_ENABLED=true` ao `.env`, aplique `alembic upgrade head` e reinicie o backend. A opção vem ativada no `.env.example` de desenvolvimento. Mantenha-a desativada fora do ambiente de testes.

---

## Opção B — Backend local + banco no Docker

```bash
# 1. Sobe apenas o banco
docker compose up -d --wait db

# 2. Instala dependências e roda as migrações
cd backend
uv sync --locked
uv run --locked alembic upgrade head

# 3. Inicia o servidor de desenvolvimento
uv run --locked fastapi dev app/main.py
```

---

## Solução de problemas comuns

### Mensagens nas caronas

- Após confirmar ao menos um passageiro, motorista ou passageiro podem usar **Mensagens** em **Minhas caronas** para criar/abrir o grupo. Há apenas um grupo por carona; novos passageiros confirmados entram automaticamente.
- O botão **Mensagens** no canto inferior direito abre as conversas ativas. No celular, fica acima da navegação inferior.
- No grupo, abra **Participantes · Conversas privadas** para conversar somente com o motorista ou, para motoristas, com um passageiro. Cada conversa privada pertence àquela carona.
- O motorista usa **Iniciar carona** e **Concluir carona**. Concluir ou cancelar encerra o acesso às conversas, que deixam de aparecer na lista ativa. Cancelar uma participação remove o acesso daquele passageiro imediatamente. Apenas chegar ao horário de partida não conclui a viagem.
- As mensagens são armazenadas no banco. A tela busca atualizações a cada cinco segundos enquanto está visível, com paginação para mensagens anteriores. Não há notificações push nesta versão.
- Para experimentar os dois lados, crie duas contas em `/dev`, ofereça uma carona com uma delas e solicite a vaga com a outra. Depois da confirmação, as duas contas podem acessar a mesma conversa.

Em um backend já em execução, aplique a migração antes de usar mensagens:

```bash
docker compose exec backend alembic upgrade head
```

Validação (os testes do backend usam um esquema temporário e fazem rollback):

```bash
docker compose exec backend python -m unittest discover -s tests -p test_messages.py -v
cd frontend
npm run test:messages
```

### Ambiente

| Problema | Causa | Solução |
|---|---|---|
| `Connection refused` ao conectar no banco | Porta errada no `DATABASE_URL` | Fora do Docker use `localhost:5433`; dentro do Docker use `db:5432` |
| `could not read env file: .env` | `.env` não existe | Copiar `.env.example` para `.env` |
| `CREATE EXTENSION postgis` falha | PostgreSQL comum sem PostGIS | Use a imagem `postgis/postgis:16-3.4-alpine` do Docker |
| Frontend não consegue acessar a API | CORS bloqueando | Verifique `ALLOWED_ORIGINS` no `.env` |
