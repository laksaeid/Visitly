FROM python:3.12-slim

WORKDIR /app

# Iran-friendly defaults (override at build time if needed)
ARG PIP_INDEX_URL=https://mirror.arvancloud.ir/pypi/simple
ARG PIP_TRUSTED_HOST=mirror.arvancloud.ir

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST} \
    PYTHONUNBUFFERED=1

COPY packages/visitly_core /packages/visitly_core
COPY apps/api /app

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 10 /packages/visitly_core \
    && pip install --no-cache-dir --retries 10 -r requirements.txt

EXPOSE 3099

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3099"]
