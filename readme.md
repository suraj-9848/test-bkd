### Prerun to setup DBs with Docker
docker compose --profile vacademy up -d

pnpm i
pnpm run watch //terminal 1
### For Windows:
pnpm run win-dev-build //terminal 2
### For Linux or Mac:
pnpm run mac-dev-build //terminal 2
