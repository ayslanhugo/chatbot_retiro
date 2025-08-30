// modulos/googleServices.js (VERSÃO AJUSTADA)

const { google } = require('googleapis');
const dialogflow = require('@google-cloud/dialogflow');
const config = require('../config.js');
const { formatarNumeroParaEnvio } = require('./utils.js');

async function getInscritos() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!B2:D', 
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) { return []; }
        const inscritos = rows.map(row => {
            const nome = row[0];
            const numeroTelefone = row[2];
            if (nome && numeroTelefone) {
                // --- AJUSTE APLICADO AQUI ---
                const numeroFormatado = formatarNumeroParaEnvio(numeroTelefone);
                return { nome: nome.trim(), numero: `${numeroFormatado}@c.us` };
            }
            return null;
        }).filter(Boolean);
        return inscritos;
    } catch (error) {
        console.error('[SHEETS] Erro ao ler a lista de inscritos:', error.message);
        return null;
    }
}

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
            requestBody: { values: dataRows }
        });
        return true;
    } catch (error) {
        console.error('[SHEETS] Erro ao escrever múltiplas linhas:', error.message);
        return false;
    }  
}

async function getMembrosEfetivosInscritos() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!A2:F',
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) { return []; }
        const membrosEfetivos = rows
            .filter(row => row[5] && row[5].toLowerCase().trim() === 'sim')
            .map(row => {
                const nome = row[1];
                const numeroTelefone = row[3];
                if (nome && numeroTelefone) {
                    // --- AJUSTE APLICADO AQUI ---
                    const numeroFormatado = formatarNumeroParaEnvio(numeroTelefone);
                    return { nome: nome.trim(), numero: `${numeroFormatado}@c.us` };
                }
                return null;
            })
            .filter(Boolean);
        return membrosEfetivos;
    } catch (error) {
        console.error('[SHEETS] Erro ao ler a lista de membros efetivos:', error.message);
        return null;
    }
}

async function getMembrosVisitantesInscritos() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: '../credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!A2:F',
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) { return []; }
        const membrosVisitantes = rows
            .filter(row => !row[5] || row[5].toLowerCase().trim() !== 'sim')
            .map(row => {
                const nome = row[1];
                const numeroTelefone = row[3];
                if (nome && numeroTelefone) {
                    // --- AJUSTE APLICADO AQUI ---
                    const numeroFormatado = formatarNumeroParaEnvio(numeroTelefone);
                    return { nome: nome.trim(), numero: `${numeroFormatado}@c.us` };
                }
                return null;
            })
            .filter(Boolean);
        return membrosVisitantes;
    } catch (error) {
        console.error('[SHEETS] Erro ao ler a lista de membros visitantes:', error.message);
        return null;
    }
}

module.exports = {
    getInscritos,
    getSheetData,
    appendToSheet,
    appendMultipleToSheet,
    detectIntent,
    getMembrosEfetivosInscritos,
    getMembrosVisitantesInscritos,
};