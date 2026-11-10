FROM node:22-alpine AS build
WORKDIR /app

ARG NPM_REGISTRY=https://mirror.arvancloud.ir/npm/

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" \
    && npm install
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/stats
EXPOSE 80
