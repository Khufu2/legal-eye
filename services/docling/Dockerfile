FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DOCLING_ARTIFACTS_PATH=/models/docling

WORKDIR /service
COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY app.py pipeline.py worker.py ./

RUN useradd --create-home --uid 10001 parser && mkdir -p /models/docling && chown -R parser:parser /service /models/docling
USER parser
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--proxy-headers", "--no-server-header"]
