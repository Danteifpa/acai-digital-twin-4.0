# Painel estático: build com Node, servido pelo Nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_ENGINE_URL=http://localhost:8000
ENV VITE_ENGINE_URL=${VITE_ENGINE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
