FROM python:3.12.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN useradd --create-home --uid 10001 legaleye
COPY pyproject.toml ./
RUN pip install --disable-pip-version-check \
    fastapi==0.141.1 httpx==0.28.1 langgraph==1.2.11 pydantic==2.12.5 'uvicorn[standard]==0.52.4'
COPY app.py ./
USER 10001
EXPOSE 8080
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8080","--proxy-headers","--no-server-header"]
