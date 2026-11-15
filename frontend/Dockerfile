# syntax=docker/dockerfile:1
# Imagen del frontend — Global Programación III (Librería El Estante).
# Nginx sirve los archivos de public/ y reenvía /api/ al backend por la red interna.
#
# NGINX_ENVSUBST_FILTER limita la sustitución de variables a API_UPSTREAM: así
# Nginx no intenta reemplazar $uri, $host, etc. de la plantilla. El valor real de
# API_UPSTREAM se inyecta al ejecutar el contenedor (-e API_UPSTREAM=...).

FROM nginx:1.30-alpine

ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

# 1) Sitio estático donde Nginx lo sirve.
COPY public/ /usr/share/nginx/html/

# 2) Plantilla del proxy: Nginx la procesa al arrancar y genera
#    /etc/nginx/conf.d/default.conf sustituyendo API_UPSTREAM.
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
