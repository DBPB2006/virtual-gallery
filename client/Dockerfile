# Stage 1: Build the React client
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the React client using Nginx
FROM nginx:alpine
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static files to Nginx public folder
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]