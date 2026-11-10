FROM python:3.12-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

COPY packages/visitly_core /packages/visitly_core
COPY apps/api /app

# Non-editable install is more reliable in Docker; long timeout for slow PyPI links.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 10 /packages/visitly_core \
    && pip install --no-cache-dir --retries 10 -r requirements.txt

EXPOSE 3099

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3099"]
