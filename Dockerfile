FROM node:20-slim
WORKDIR /app
COPY package.json tsconfig.json mcp.json ./
RUN npm install
COPY src ./src
COPY tools ./tools
RUN npm run build
ENTRYPOINT ["node", "dist/agent.js"]
CMD []
