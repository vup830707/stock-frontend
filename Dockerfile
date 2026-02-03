# Step 1: 使用 Node 官方映像建構前端
FROM node:20-alpine AS build

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci

# 複製所有前端程式碼
COPY . .

# 建構 React 應用
RUN npm run build

# Step 2: 使用輕量 Nginx 映像提供服務
FROM nginx:alpine

# 複製 build 出來的靜態檔到 nginx 的 default 目錄
COPY --from=build /app/build /usr/share/nginx/html

# 複製自訂 nginx 配置（選擇性）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 對外暴露 80 port
EXPOSE 80

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"]
