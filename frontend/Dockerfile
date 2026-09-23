# Build the static site, then hand the output to nginx. Two stages so the final
# image carries no node_modules and no toolchain — just nginx and dist/.
FROM node:20-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
# The server block itself is mounted from docker/ at run time, so it can differ
# between production (TLS) and local (plain HTTP) without rebuilding the image.
COPY --from=build /app/dist /usr/share/nginx/html
