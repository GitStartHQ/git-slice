FROM node:10
COPY . .
RUN yarn install
ENTRYPOINT ["node", "./bin/cli.js"]
