FROM node:slim AS app

# We don't need the standalone Chromium
FROM ghcr.io/puppeteer/puppeteer:latest
RUN npm i objects-to-csv
COPY test.js .

