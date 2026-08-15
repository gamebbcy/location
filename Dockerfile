# read the doc: https://huggingface.co/docs/hub/spaces-sdks-docker
# you will also find guides on how best to write your Dockerfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN useradd -m -u 1000 user
WORKDIR /app
COPY --from=builder --chown=user /app/dist /app/dist
USER user
ENV NODE_ENV=production
EXPOSE 7860
CMD ["sh", "-c", "cd dist && node server/main.js"]