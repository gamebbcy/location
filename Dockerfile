# read the doc: https://huggingface.co/docs/hub/spaces-sdks-docker
# you will also find guides on how best to write your Dockerfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder --chown=node /app/dist /app/dist
USER node
ENV NODE_ENV=production
ENV FORCE_AUTHN_INNERAPI_DOMAIN=http://platform.local
ENV DEPRECATED_SKIP_INIT_DB_CONNECTION=1
EXPOSE 7860
CMD ["sh", "-c", "cd dist && node server/main.js"]