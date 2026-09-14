FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    SCANNER_MAX_UPLOAD_BYTES=104857600

WORKDIR /service

RUN apt-get update \
    && apt-get install --no-install-recommends -y clamav clamav-daemon clamav-freshclam gosu \
    && freshclam \
    && mkdir -p /run/clamav \
    && chown -R clamav:clamav /run/clamav /var/lib/clamav \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY app.py entrypoint.sh ./
RUN chmod 0755 /service/entrypoint.sh \
    && useradd --create-home --uid 10001 scanner \
    && chown -R scanner:scanner /service

EXPOSE 8080
ENTRYPOINT ["/service/entrypoint.sh"]
