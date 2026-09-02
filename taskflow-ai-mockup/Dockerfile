FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_APP_ENV
ENV VITE_APP_ENV=$VITE_APP_ENV
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
