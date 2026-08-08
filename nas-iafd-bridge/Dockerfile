FROM mcr.microsoft.com/playwright:v1.62.0-noble

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    HOME=/tmp/home

WORKDIR /app

COPY --chown=pwuser:pwuser package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=pwuser:pwuser src ./src

RUN mkdir -p /data/chromium && chown -R pwuser:pwuser /data /app

USER pwuser

EXPOSE 43137

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:43137/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["xvfb-run", "-a", "node", "src/server.js"]
