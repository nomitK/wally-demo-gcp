# Usar a imagem oficial do Node.js
FROM node:14

# Definir o diretório de trabalho
WORKDIR /usr/src/app

# Copiar as dependências do seu projeto
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta que a aplicação vai usar
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
