// index.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dialogflow = require('@google-cloud/dialogflow');
const stringSimilarity = require('string-similarity');
const { google } = require('googleapis');
const { memoria, MENU_PRINCIPAL } = require('./memoria');
const config = require('./config.js');

// --- Constantes de Operação e Lógica ---
const floodControl = {};
const FLOOD_MESSAGE_LIMIT = 5;
const FLOOD_TIME_WINDOW_SECONDS = 10;
const FLOOD_COOLDOWN_SECONDS = 60;
const FRASES_DE_SEGUIMENTO = ['e o que mais?', 'fale mais', 'me diga mais', 'continue', 'e depois?', 'mais detalhes'];
const TOPICOS_PRINCIPAIS = ['data', 'local', 'valor', 'horario', 'levar', 'idade', 'atividades', 'dormir_local', 'sobre_jcc', 'sobre_retiro'];
const PALAVRAS_CHAVE_COMPROVANTE = ['comprovante', 'pagamento', 'pix', 'paguei', 'inscrição', 'recibo', 'transferência', 'transferencia', 'tá pago', 'ta pago', 'comprovando'];


// --- Funções Auxiliares ---
function respostaAleatoria(respostas) {
    if (Array.isArray(respostas)) return respostas[Math.floor(Math.random() * respostas.length)];
    return respostas;
}

function normalizeText(text) {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function smartMatch(texto, chaves) {
    const textoNormalizado = normalizeText(texto);
    if (!chaves || chaves.length === 0) return false;
    if (chaves.some(chave => textoNormalizado === normalizeText(chave))) return true;
    if (chaves.some(chave => normalizeText(chave).length >= 3 && textoNormalizado.includes(normalizeText(chave)))) return true;
    const palavrasDoTexto = textoNormalizado.split(' ');
    const SIMILARITY_THRESHOLD = 0.80;
    for (let palavra of palavrasDoTexto) {
        palavra = palavra.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
        if (palavra.length < 4) continue;
        for (const chave of chaves) {
            if (chave.includes(' ')) continue;
            const chaveNormalizada = normalizeText(chave);
            if (stringSimilarity.compareTwoStrings(palavra, chaveNormalizada) >= SIMILARITY_THRESHOLD) return true;
        }
    }
    return false;
}

async function appendToSheet(data) {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: 'credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets' });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({ spreadsheetId: config.SPREADSHEET_ID, range: 'Página1!A:E', valueInputOption: 'USER_ENTERED', requestBody: { values: [data] } });
        return true;
    } catch (error) {
        console.error('[SHEETS] Erro ao escrever na planilha:', error.message);
        return false;
    }
}

function isUserFlooding(from) {
    const currentTime = Date.now();
    if (!floodControl[from]) {
        floodControl[from] = { count: 1, startTime: currentTime, isBlocked: false, blockedUntil: 0 };
        return false;
    }
    const userData = floodControl[from];
    if (userData.isBlocked && currentTime < userData.blockedUntil) return true;
    if (userData.isBlocked) userData.isBlocked = false;
    if (currentTime - userData.startTime > FLOOD_TIME_WINDOW_SECONDS * 1000) {
        userData.count = 1;
        userData.startTime = currentTime;
    } else {
        userData.count++;
    }
    if (userData.count > FLOOD_MESSAGE_LIMIT) {
        userData.isBlocked = true;
        userData.blockedUntil = currentTime + FLOOD_COOLDOWN_SECONDS * 1000;
        return true;
    }
    return false;
}

async function detectIntent(sessionId, query) {
    const sessionClient = new dialogflow.SessionsClient({ keyFilename: './dialogflow-credentials.json' });
    const sessionPath = sessionClient.projectAgentSessionPath(config.GCLOUD_PROJECT_ID, sessionId);
    const request = {
        session: sessionPath,
        queryInput: { text: { text: query, languageCode: 'pt-BR' } },
    };
    try {
        console.log(`[Dialogflow] Enviando texto: "${query}"`);
        const responses = await sessionClient.detectIntent(request);
        console.log('[Dialogflow] Resposta recebida.');
        return responses[0].queryResult;
    } catch (error) {
        console.error('[Dialogflow] ERRO:', error);
        return null;
    }
}


// --- LÓGICA PRINCIPAL DO BOT ---
async function handleMessage(msg, userContext, client) {
    if (msg.fromMe) return;
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (msg.type === 'sticker') return;
    if (!msg.body && !msg.hasMedia) return;
    const from = msg.from;
    const texto = msg.body ? msg.body.trim() : "";
    if (isUserFlooding(from)) {
        if (floodControl[from].count === FLOOD_MESSAGE_LIMIT + 1) await msg.reply('Você enviou muitas mensagens rapidamente. Por favor, aguarde um minuto antes de tentar novamente. 🙏');
        return;
    }
    if (!userContext[from]) {
        userContext[from] = { lastOffer: null, offeredKerigma: false, awaitingDetails: false, awaitingRegistrationChoice: false, isDiscussingMinor: false, lastTopic: null, awaitingMenuChoice: false };
    }
    const context = userContext[from];
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;

    // ==================================================================
    // ORDEM DE VERIFICAÇÃO DE ESTADO (DO MAIS ESPECÍFICO PARA O GERAL)
    // ==================================================================

    // NÍVEL 1: Respostas a perguntas diretas do bot (contextos de alta prioridade)
    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online'];
        const escolhaPresencial = ['2', 'presencial'];
        if (smartMatch(texto, escolhaOnline) || smartMatch(texto, escolhaPresencial)) {
            context.awaitingRegistrationChoice = false; // Desativa este estado
            context.awaitingMenuChoice = false; // Também desativa o modo menu para evitar conflitos
            if (smartMatch(texto, escolhaOnline)) {
                const item = memoria.find(i => i.id === 'inscricao_online_detalhes');
                if (item) await msg.reply(item.resposta);
                else await msg.reply("Processo de inscrição online iniciado! (Resposta a ser configurada em memoria.js com id: inscricao_online_detalhes)");
            } else {
                const item = memoria.find(i => i.id === 'inscricao_presencial');
                if (item) await msg.reply(item.resposta);
            }
        } else {
            await msg.reply("Desculpe, não entendi a sua escolha. Por favor, digite '1' para Online ou '2' para Presencial.");
        }
        return;
    }
    
    if (context.awaitingDetails) {
        const detalhes = msg.body.split('\n');
        const dataParaPlanilha = [new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), detalhes[0] || 'Não informado', detalhes[1] || 'Não informado', contato.number, detalhes[2] || 'N/A'];
        context.awaitingDetails = false;
        if (await appendToSheet(dataParaPlanilha)) {
            await msg.reply(`Perfeito! Inscrição pré-confirmada e dados guardados. A equipa irá verificar o seu comprovante e em breve receberá a confirmação final. Estamos muito felizes por tê-lo(a) connosco! 🙌`);
        } else {
            await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha. Não se preocupe, a sua pré-inscrição está registada e a equipa fará o processo manualmente. 👍`);
        }
        return;
    }

    // NÍVEL 2: Comandos com gatilhos específicos (envio de mídia, frases de seguimento)
    if (msg.hasMedia && PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        // ... (código de encaminhar comprovante continua o mesmo)
        const isImage = msg.type === 'image';
        const isPDF = msg.type === 'document' && msg._data.filename && msg._data.filename.toLowerCase().endsWith('.pdf');
        if (!isImage && !isPDF) {
            await msg.reply('Obrigado por enviar! No entanto, só consigo processar comprovantes em formato de imagem (JPG, PNG) ou PDF. Poderia enviar o ficheiro no formato correto, por favor? 🙏');
            return;
        }
        try {
            await msg.forward(config.GRUPO_ID_ADMIN);
            await client.sendMessage(config.GRUPO_ID_ADMIN, `📄 Novo comprovante!\n\n*De:* ${contato.pushname || nomeUsuario}\n*Número:* ${contato.number}\n\nVerificar e confirmar.`);
            const confirmacaoUsuario = respostaAleatoria([`Obrigado, ${nomeUsuario}! Comprovante recebido. 🙏\n\nPara finalizar, envie os seguintes dados, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu melhor e-mail\n3. Nome do responsável (se for menor de 18, senão ignore)`, `Recebido, ${nomeUsuario}! 🙌\n\nAgora, só preciso de mais alguns dados. Por favor, envie, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu e-mail\n3. Nome do responsável (apenas se for menor)`]);
            await msg.reply(confirmacaoUsuario);
            context.awaitingDetails = true;
        } catch (error) {
            console.error("[ERRO] Falha ao encaminhar comprovante:", error);
            await msg.reply("Ops! Tive um problema ao processar o seu comprovante...");
        }
        return;
    }
    
    if (FRASES_DE_SEGUIMENTO.includes(texto.toLowerCase())) {
        if (context.lastTopic) {
            const ultimoTopicoInfo = memoria.find(item => item.id === context.lastTopic);
            if (ultimoTopicoInfo && ultimoTopicoInfo.resposta_seguimento) {
                await msg.reply(ultimoTopicoInfo.resposta_seguimento);
                context.lastTopic = null; // Responde e limpa o tópico
                return;
            }
        }
    }

    // NÍVEL 3: Lógica do Menu Principal (contexto mais geral)
    const numeroEscolhido = parseInt(texto, 10);
    if (context.awaitingMenuChoice && !isNaN(numeroEscolhido)) {
        const itemDoMenu = MENU_PRINCIPAL.find(item => item.numero === numeroEscolhido);
        if (itemDoMenu) {
            const intentName = itemDoMenu.id_intent;
            const itemParaResponder = memoria.find(m => m.id === intentName);
            if (itemParaResponder) {
                await responderComItem(itemParaResponder, msg, context, nomeUsuario, chat);
            } else {
                 await msg.reply('Ops! Encontrei a opção no menu, mas estou com dificuldade de achar a resposta. Tente perguntar com outras palavras, por favor.');
            }
            return; 
        }
    }
    
    // NÍVEL 4: Se nada acima foi tratado, processa com Dialogflow
    context.awaitingMenuChoice = false;
    const dfResult = await detectIntent(from, texto);
    if (dfResult && dfResult.intent) {
        const intentName = dfResult.intent.displayName;
        const isFallback = dfResult.intent.isFallback;
        console.log(`[Dialogflow] Intenção detetada: ${intentName} | Fallback: ${isFallback}`);
        if (isFallback) {
            await msg.reply(`Opa, ${nomeUsuario}! Não entendi muito bem o que você quis dizer. 🤔\n\nVocê pode tentar perguntar de outra forma ou digitar *ajuda* para ver os tópicos que conheço.`);
            return;
        }
        
        if (intentName === 'Default Welcome Intent' || intentName === 'ajuda' || intentName === 'confirmacao_positiva') {
            const itemSaudacao = memoria.find(m => m.id === 'saudacao');
            await msg.reply(itemSaudacao.resposta(nomeUsuario));
            context.awaitingMenuChoice = true;
            return;
        }
        if (intentName === 'cancelar_acao') {
            userContext[from] = {
                lastOffer: null, offeredKerigma: context.offeredKerigma, awaitingDetails: false,
                awaitingRegistrationChoice: false, isDiscussingMinor: false, lastTopic: null, awaitingMenuChoice: false 
            };
            await msg.reply('Ok, cancelado! 👍\nSe precisar de mais alguma coisa, é só perguntar.');
            return;
        }
        const itemParaResponder = memoria.find(m => m.id === intentName);
        if (itemParaResponder) {
            await responderComItem(itemParaResponder, msg, context, nomeUsuario, chat);
        } else {
            console.log(`[AVISO] Intenção "${intentName}" detetada mas sem resposta correspondente em memoria.js.`);
            await msg.reply(`Desculpe, ${nomeUsuario}, entendi que você perguntou sobre um tópico, mas ainda não tenho uma resposta para ele.`);
        }
    } else {
        console.log('[ERRO] O Dialogflow não retornou um resultado válido.');
        await msg.reply(`Opa, ${nomeUsuario}! Tive um pequeno problema para me conectar à minha inteligência. Tente novamente, por favor.`);
    }
}

async function responderComItem(itemParaResponder, msg, context, nomeUsuario, chat) {
    if (itemParaResponder.id === 'fazer_inscricao') {
        const pergunta = memoria.find(i => i.id === 'fazer_inscricao').resposta(nomeUsuario);
        await msg.reply(pergunta);
        context.awaitingRegistrationChoice = true; // Ativa o estado de espera pela escolha da inscrição
        return;
    }

    let respostaFinal;
    if (itemParaResponder.funcaoResposta) respostaFinal = itemParaResponder.funcaoResposta();
    else if (typeof itemParaResponder.resposta === 'function') respostaFinal = respostaAleatoria(itemParaResponder.resposta(nomeUsuario));
    else respostaFinal = respostaAleatoria(itemParaResponder.resposta);

    context.lastTopic = itemParaResponder.id;
    if (TOPICOS_PRINCIPAIS.includes(itemParaResponder.id) && !context.offeredKerigma && !respostaFinal.includes('https://wa.me/')) {
        respostaFinal += `\n\nA propósito, gostaria de saber por que o nosso retiro se chama 'Kerigmático'?`;
        context.offeredKerigma = true;
        context.lastOffer = 'kerigma_explicacao';
    }

    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
    await msg.reply(respostaFinal);
}

function start() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'],
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });
    const userContext = {};
    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
    });
    client.on('ready', () => {
        console.log('✅ Bot está pronto e conectado ao WhatsApp!');
        client.on('message', (msg) => handleMessage(msg, userContext, client));
    });
    console.log("Iniciando o cliente...");
    client.initialize().catch(err => { console.error("Erro CRÍTICO ao inicializar o cliente:", err); });
}

if (require.main === module) {
    start();
}

module.exports = { handleMessage, smartMatch, normalizeText };