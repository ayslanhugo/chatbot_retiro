// index.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dialogflow = require('@google-cloud/dialogflow');
const stringSimilarity = require('string-similarity');
const { google } = require('googleapis');
const memoria = require('./memoria');
const config = require('./config.js');

// --- Constantes de Operação e Lógica ---
const floodControl = {};
const FLOOD_MESSAGE_LIMIT = 5;
const FLOOD_TIME_WINDOW_SECONDS = 10;
const FLOOD_COOLDOWN_SECONDS = 60;
const FRASES_DE_SEGUIMENTO = ['e o que mais?', 'fale mais', 'me diga mais', 'continue', 'e depois?', 'mais detalhes'];
const TOPICOS_PRINCIPAIS = ['data', 'local', 'valor', 'horario', 'levar', 'idade', 'atividades', 'dormir_local', 'sobre_jcc', 'sobre_retiro'];
const PALAVRAS_CHAVE_COMPROVANTE = ['comprovante', 'pagamento', 'pix', 'paguei', 'inscrição', 'recibo', 'transferência', 'transferencia', 'tá pago', 'ta pago', 'comprovando'];
const MENU_MAP = {
    '1': 'sobre_retiro',
    '2': 'sobre_jcc',
    '3': 'data_e_horario', 
    '4': 'consultar_local',
    '5': 'idade',
    '6': 'fazer_inscricao',
    '7': 'consultar_valor',
    '8': 'levar',
    '9': 'uso_celular',
    '10': 'grupo_whatsapp',
    '11': 'falar_humano'
};

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
        userContext[from] = { lastOffer: null, offeredKerigma: false, awaitingDetails: false, awaitingRegistrationChoice: false, isDiscussingMinor: false, lastTopic: null };
    }
    const context = userContext[from];
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;

    const textoLimpo = texto.trim();
    if (MENU_MAP[textoLimpo]) {
        const idDoTopico = MENU_MAP[textoLimpo];
        const item = memoria.find(m => m.id === idDoTopico);

        if (item) {
            let respostaFinal;
            if (item.funcaoResposta) {
                // Passamos nomeUsuario para o caso da função precisar dele
                respostaFinal = item.funcaoResposta(nomeUsuario); 
            } else if (typeof item.resposta === 'function') {
                respostaFinal = respostaAleatoria(item.resposta(nomeUsuario));
            } else {
                respostaFinal = respostaAleatoria(item.resposta);
            }
            
            if (idDoTopico === 'fazer_inscricao') {
            context.awaitingRegistrationChoice = true;
            }
            
            await msg.reply(respostaFinal);
            return; // Para o processamento aqui, pois já encontramos a resposta
        }
    }

    if (FRASES_DE_SEGUIMENTO.includes(texto.toLowerCase())) {
        if (context.lastTopic) {
            const ultimoTopicoInfo = memoria.find(item => item.id === context.lastTopic);
            if (ultimoTopicoInfo && ultimoTopicoInfo.resposta_seguimento) {
                await msg.reply(ultimoTopicoInfo.resposta_seguimento);
                context.lastTopic = null;
                return;
            }
        }
    }

    if (context.lastOffer === 'explicar_kerigma') {
        const palavrasPositivas = ['sim', 'gostaria', 'quero', 'pode', 'explica', 'claro', 'por que', 'pq', 'qual o significado'];
        const palavrasNegativas = ['não', 'nao', 'n', 'depois', 'agora nao', 'deixa'];
        context.lastOffer = null; // Limpa o contexto para a conversa continuar
        if (smartMatch(texto, palavrasPositivas)) {
            const kerigmaInfo = memoria.find(item => item.id === 'kerigma_explicacao');
            if (kerigmaInfo) await msg.reply(kerigmaInfo.resposta);
        } else if (smartMatch(texto, palavrasNegativas)) {
            await msg.reply("Tudo bem! Se mudar de ideias, é só me perguntar sobre o significado do nome do retiro. Estou por aqui! 😉");
        }
        return;
    }
    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online'];
        const escolhaPresencial = ['2', 'presencial'];
        if (smartMatch(texto, escolhaOnline) || smartMatch(texto, escolhaPresencial)) {
            context.awaitingRegistrationChoice = false;
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
            await msg.reply(`Perfeito! Inscrição pré-confirmada e dados guardados. A equipa irá verificar o seu comprovativo e em breve receberá a confirmação final. Estamos muito felizes por tê-lo(a) connosco! 🙌`);
        } else {
            await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha. Não se preocupe, a sua pré-inscrição está registada e a equipa fará o processo manualmente. 👍`);
        }
        return;
    }
    if (msg.hasMedia && PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        const isImage = msg.type === 'image';
        const isPDF = msg.type === 'document' && msg._data.filename && msg._data.filename.toLowerCase().endsWith('.pdf');
        if (!isImage && !isPDF) {
            await msg.reply('Obrigado por enviar! No entanto, só consigo processar comprovativos em formato de imagem (JPG, PNG) ou PDF. Poderia enviar o ficheiro no formato correto, por favor? 🙏');
            return;
        }
        try {
            await msg.forward(config.GRUPO_ID_ADMIN);
            await client.sendMessage(config.GRUPO_ID_ADMIN, `📄 Novo comprovativo!\n\n*De:* ${contato.pushname || nomeUsuario}\n*Número:* ${contato.number}\n\nVerificar e confirmar.`);
            const confirmacaoUsuario = respostaAleatoria([`Obrigado, ${nomeUsuario}! Comprovativo recebido. 🙏\n\nPara finalizar, envie os seguintes dados, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu melhor e-mail\n3. Nome do responsável (se for menor de 18, senão ignore)`, `Recebido, ${nomeUsuario}! 🙌\n\nAgora, só preciso de mais alguns dados. Por favor, envie, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu e-mail\n3. Nome do responsável (apenas se for menor)`]);
            await msg.reply(confirmacaoUsuario);
            context.awaitingDetails = true;
        } catch (error) {
            console.error("[ERRO] Falha ao encaminhar comprovativo:", error);
            await msg.reply("Ops! Tive um problema ao processar o seu comprovativo...");
        }
        return;
    }

    const dfResult = await detectIntent(from, texto);
    if (dfResult && dfResult.intent) {
        const intentName = dfResult.intent.displayName;
        const isFallback = dfResult.intent.isFallback;
        console.log(`[Dialogflow] Intenção detetada: ${intentName} | Fallback: ${isFallback}`);
        if (isFallback) {
            await msg.reply(`Opa, ${nomeUsuario}! Não entendi muito bem o que você quis dizer. 🤔\n\nVocê pode tentar perguntar de outra forma ou digitar *ajuda* para ver os tópicos que conheço.`);
            return;
        }
        if (intentName === 'Default Welcome Intent') {
    const item = memoria.find(m => m.id === 'saudacao');
    if (item) {
        let respostaFinal;
        // Verifica se existe uma funcaoResposta (o nosso novo padrão para a saudação)
        if (item.funcaoResposta) {
            respostaFinal = item.funcaoResposta(nomeUsuario);
        } 
        // Lógica de fallback para outros tipos de resposta, por segurança
        else if (typeof item.resposta === 'function') {
            respostaFinal = respostaAleatoria(item.resposta(nomeUsuario));
        } else {
            respostaFinal = respostaAleatoria(item.resposta);
        }
        await msg.reply(respostaFinal);
    }
    return;
}
        if (intentName === 'cancelar_acao') {
            userContext[from] = {
                lastOffer: null,
                offeredKerigma: context.offeredKerigma,
                awaitingDetails: false,
                awaitingRegistrationChoice: false,
                isDiscussingMinor: false,
                lastTopic: null
            };
            await msg.reply('Ok, cancelado! 👍\nSe precisar de mais alguma coisa, é só perguntar.');
            return;
        }
        const itemParaResponder = memoria.find(m => m.id === intentName);
        if (itemParaResponder) {
            if (itemParaResponder.id === 'fazer_inscricao') {
                const pergunta = memoria.find(i => i.id === 'fazer_inscricao').resposta(nomeUsuario);
                await msg.reply(pergunta);
                context.awaitingRegistrationChoice = true;
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
        } else {
            console.log(`[AVISO] Intenção "${intentName}" detetada mas sem resposta correspondente em memoria.js.`);
            await msg.reply(`Desculpe, ${nomeUsuario}, entendi que você perguntou sobre um tópico, mas ainda não tenho uma resposta para ele.`);
        }
    } else {
        console.log('[ERRO] O Dialogflow não retornou um resultado válido.');
        await msg.reply(`Opa, ${nomeUsuario}! Tive um pequeno problema para me conectar à minha inteligência. Tente novamente, por favor.`);
    }
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
        const qrcode = require('qrcode-terminal');
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