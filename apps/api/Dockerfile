FROM python:3.12-slim

WORKDIR /app

COPY packages/visitly_core /packages/visitly_core
COPY apps/api /app

RUN pip install --no-cache-dir -e /packages/visitly_core \
    && pip install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1
EXPOSE 3099

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3099"]
