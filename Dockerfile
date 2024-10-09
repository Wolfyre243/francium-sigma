FROM node:20

# ENV NODE_ENV production

COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3030
# Build the app for production and launch
RUN npx remix vite:build
CMD npm run start