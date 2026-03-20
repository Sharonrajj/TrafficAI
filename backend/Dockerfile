FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (python-magic needs libmagic, ClamAV for virus scan)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    clamav \
    clamav-daemon \
    && rm -rf /var/lib/apt/lists/*

# Update ClamAV signatures
RUN freshclam --quiet || true

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Non-root user for security
RUN adduser --disabled-password --no-create-home appuser
USER appuser

# Cloud Run uses PORT env var
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-keep-alive 65"]
