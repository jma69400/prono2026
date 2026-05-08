# =====================================================
# United Pronos — Frontend React/Vite
# Stage 1 : build avec Node
# Stage 2 : Nginx léger pour servir les fichiers statiques
# =====================================================

FROM node:20-alpine AS builder

WORKDIR /build

# Copie package.json en premier pour profiter du cache Docker
COPY package.json ./
RUN npm install

# Copie le reste du code et build
COPY . .

# Variables d'environnement Vite (préfixe VITE_)
ARG VITE_API_URL=/api
ARG VITE_STRIPE_LINK=
ARG VITE_PAYPAL_LINK=
ARG VITE_KOFI_LINK=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STRIPE_LINK=$VITE_STRIPE_LINK
ENV VITE_PAYPAL_LINK=$VITE_PAYPAL_LINK
ENV VITE_KOFI_LINK=$VITE_KOFI_LINK

RUN npm run build

# =====================================================
FROM nginx:1.27-alpine

# Config Nginx custom (proxy vers backend, gestion SPA, gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fichiers statiques buildés
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
