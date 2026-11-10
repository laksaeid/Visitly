ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm config set registry "$NPM_REGISTRY" \
    && npm install
COPY apps/web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/stats
EXPOSE 80
