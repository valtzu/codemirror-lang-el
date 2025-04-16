FROM node:22
RUN npm i -g @openai/codex
WORKDIR "/app"
COPY . .
ENV HOME=/tmp
CMD ["codex"]
