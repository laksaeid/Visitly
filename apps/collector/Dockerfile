FROM python:3.12-slim

WORKDIR /app

COPY packages/visitly_core /packages/visitly_core
COPY apps/collector /app

RUN pip install --no-cache-dir -e /packages/visitly_core \
    && pip install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "collector.main"]
