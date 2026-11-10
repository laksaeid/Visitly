# Frontend build (npmmirror for IR)
FROM docker.arvancloud.ir/library/node:22-alpine AS webbuild
WORKDIR /web
ARG NPM_REGISTRY=https://registry.npmmirror.com
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" && npm install
COPY apps/web/ ./
RUN npm run build

# API + static UI
FROM docker.arvancloud.ir/library/python:3.12-slim

WORKDIR /app

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST} \
    PYTHONUNBUFFERED=1 \
    VISITLY_WEB_DIST=/app/web/dist

COPY packages/visitly_core /packages/visitly_core
COPY apps/api /app
COPY --from=webbuild /web/dist /app/web/dist

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 10 /packages/visitly_core \
    && pip install --no-cache-dir --retries 10 -r requirements.txt

EXPOSE 3099

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3099"]
