# Bot de WhatsApp para Retiro Kerigmático JCC

Este é um bot de WhatsApp desenvolvido em Node.js para automatizar as respostas e o processo de inscrição para o Retiro Kerigmático do grupo de jovens JCC.

## Funcionalidades Principais

- Responde a perguntas frequentes (FAQ) sobre o retiro.
- Lida com o fluxo de inscrição, oferecendo opções online e presencial.
- Recebe comprovativos de pagamento e encaminha para um grupo de administradores.
- Integra-se com o Google Sheets para guardar os dados dos inscritos automaticamente.
- Possui controlo de flood para evitar spam.
- Utiliza uma lógica de conversa contextual para uma melhor experiência do utilizador.

## Instalação

1.  Clone este repositório:
    ```bash
    git clone [https://github.com/seu-usuario/seu-repositorio.git](https://github.com/seu-usuario/seu-repositorio.git)
    ```
2.  Navegue até a pasta do projeto:
    ```bash
    cd seu-repositorio
    ```
3.  Instale as dependências:
    ```bash
    npm install
    ```

## Configuração

Antes de iniciar o bot, são necessários alguns passos de configuração:

1.  **Credenciais do Google:**
    - É necessário ter um ficheiro de credenciais da API do Google Sheets.
    - Obtenha o seu ficheiro `credentials.json` no Google Cloud Platform e coloque-o na raiz do projeto.
    - **Importante:** Este ficheiro está listado no `.gitignore` e não deve ser partilhado publicamente por motivos de segurança.

2.  **Variáveis no Código:**
    - Abra o ficheiro `index.js` e ajuste as seguintes constantes no início do ficheiro, se necessário:
      - `GRUPO_ID_ADMIN`
      - `SPREADSHEET_ID`
    - Abra o ficheiro `memoria.js` e ajuste as constantes de conteúdo (links, chave PIX, etc.) conforme a necessidade.

## Como Executar o Bot

Após a instalação e configuração, inicie o bot com o seguinte comando:

```bash
node index.js
```

Na primeira vez que executar, um QR Code aparecerá no terminal. Leia-o com o seu WhatsApp para conectar o bot.