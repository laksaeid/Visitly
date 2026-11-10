FROM python:3.12-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

COPY packages/visitly_core /packages/visitly_core
COPY apps/collector /app

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 10 /packages/visitly_core \
    && pip install --no-cache-dir --retries 10 -r requirements.txt

CMD ["python", "-m", "collector.main"]
