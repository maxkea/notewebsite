FROM mysql:9.0

COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY permissions.sql /docker-entrypoint-initdb.d/02-permissions.sql