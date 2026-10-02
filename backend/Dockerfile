FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml ./
RUN uv pip install --system -r pyproject.toml

COPY . .

CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
