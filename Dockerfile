FROM node:24-slim
WORKDIR /app
COPY package.json tsconfig.json mcp.json ./
RUN npm install
#RUN npm i -g npx
COPY src ./src
COPY tools ./tools
RUN npm run build
ENTRYPOINT ["node", "dist/agent.js"]
# Default to interactive mode, but can be overridden
CMD ["--interactive"]
