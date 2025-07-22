FROM node:24-slim
WORKDIR /app
COPY package.json tsconfig.json mcp.json ./
RUN npm install
#RUN npm i -g npx
COPY src ./src
COPY tools ./tools
COPY web ./web
RUN npm run build

# Expose port 3000 for web interface
EXPOSE 3000

ENTRYPOINT ["node", "dist/agent.js"]
# Default to interactive mode, but can be overridden
CMD ["--interactive"]
