FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir httpx==0.28.1
COPY services/open-corpus/worker.py services/open-corpus/worker.py
COPY scripts/cloudflare/ingest_sources.py scripts/cloudflare/run_rebuild.py scripts/cloudflare/
CMD ["python", "scripts/cloudflare/run_rebuild.py"]
