FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    SCANNER_MAX_UPLOAD_BYTES=104857600

WORKDIR /service

RUN apt-get update \
    && apt-get install --no-install-recommends -y clamav clamav-freshclam \
    && freshclam \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY app.py ./

RUN useradd --create-home --uid 10001 scanner && chown -R scanner:scanner /service
USER scanner

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --no-server-header"]

