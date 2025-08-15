// modulos/googleServices.js

const { google } = require('googleapis');
const dialogflow = require('@google-cloud/dialogflow');
const config = require('../config.js'); // Atenção ao '../' para voltar uma pasta
const { normalizarTelefoneBrasil } = require('./utils.js');

/**
 * Lê a planilha e retorna uma lista formatada de inscritos.
 * @returns {Promise<Array<{nome: string, numero: string}>|null>}
 */
async function getInscritos() {
    console.log('[SHEETS] Lendo a lista de inscritos para lembretes...');
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!B2:D', 
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('[SHEETS] Nenhum inscrito encontrado na planilha.');
            return [];
        }

        const inscritos = rows.map(row => {
            const nome = row[0];
            const numeroTelefone = row[2];
            
            if (nome && numeroTelefone) {
                // Corrige o número de telefone (adiciona o 9 se faltar)
                const numeroCorrigido = normalizarTelefoneBrasil(numeroTelefone);
                const numeroFormatado = `${numeroCorrigido}@c.us`;
                return { nome: nome.trim(), numero: numeroFormatado };
            }
            return null;
        }).filter(Boolean);

        console.log(`[SHEETS] ${inscritos.length} inscritos encontrados e formatados.`);
        return inscritos;

    } catch (error) {
        console.error('[SHEETS] Erro ao ler a lista de inscritos da planilha:', error.message);
        return null;
    }
}

/**
 * Lê a primeira coluna da planilha para obter uma contagem de linhas.
 * @returns {Promise<Array<any>|null>}
 */
async function getSheetData() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!A:F',
        });
        return response.data.values || [];
    } catch (error) {
        console.error('[SHEETS] Erro ao ler a planilha:', error.message);
        return null;
    }
}

/**
 * Adiciona uma nova linha de dados à planilha.
 * @param {Array<string>} data - Array com os dados a serem adicionados.
 * @returns {Promise<boolean>}
 */
async function appendToSheet(data) {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets' });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({ 
            spreadsheetId: config.SPREADSHEET_ID, 
            range: 'Página1!A:F', 
            valueInputOption: 'USER_ENTERED', 
            requestBody: { values: [data] } 
        });
        return true;
    } catch (error) {
        console.error('[SHEETS] Erro ao escrever na planilha:', error.message);
        return false;
    }
}

/**
 * Envia uma consulta para a API do Dialogflow.
 * @param {string} sessionId - ID da sessão do usuário.
 * @param {string} query - Texto da mensagem do usuário.
 * @returns {Promise<object|null>}
 */
async function detectIntent(sessionId, query) {
    try {
        const sessionClient = new dialogflow.SessionsClient({ keyFilename: '../dialogflow-credentials.json' });
        const sessionPath = sessionClient.projectAgentSessionPath(config.GCLOUD_PROJECT_ID, sessionId);
        const request = {
            session: sessionPath,
            queryInput: { text: { text: query, languageCode: 'pt-BR' } },
        };
        const responses = await sessionClient.detectIntent(request);
        return responses[0].queryResult;
    } catch (error) {
        console.error('[Dialogflow] ERRO:', error);
        return null;
    }
}

async function appendMultipleToSheet(dataRows) {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets' });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({ 
            spreadsheetId: config.SPREADSHEET_ID, 
            range: 'Página1!A:F', 
            valueInputOption: 'USER_ENTERED', 
            requestBody: { values: dataRows } // "values" agora recebe uma lista de linhas
        });
        return true;
    } catch (error) {
        console.error('[SHEETS] Erro ao escrever múltiplas linhas na planilha:', error.message);
        return false;
    }
}

// Atualize a sua linha module.exports para incluir a nova função
module.exports = {
    getInscritos,
    getSheetData,
    appendToSheet,
    appendMultipleToSheet, // Adicione esta linha
    detectIntent
};