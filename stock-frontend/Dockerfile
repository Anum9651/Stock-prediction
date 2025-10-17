# ---- Build stage (Debian avoids musl native headaches) ----
FROM node:20-bullseye-slim AS build
WORKDIR /app

# copy manifests first (must include package-lock.json)
COPY package*.json ./

# deterministic install
RUN npm ci

# now copy the rest and build
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
