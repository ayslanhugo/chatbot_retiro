// index.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dialogflow = require('@google-cloud/dialogflow');
const stringSimilarity = require('string-similarity');
const { google } = require('googleapis');
const { memoria, MENU_PRINCIPAL } = require('./memoria');
const config = require('./config.js');

//  Constantes de Operação e Lógica
const botStartTime = Date.now();
const MESSAGE_GRACE_PERIOD_SECONDS = 30;
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

async function getSheetData() {
    try {
        const auth = new google.auth.GoogleAuth({ keyFile: 'credentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets.readonly' });
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Página1!A:A', // Lê apenas a primeira coluna para contar as linhas
        });
        return response.data.values || [];
    } catch (error) {
        console.error('[SHEETS] Erro ao ler a planilha:', error.message);
        return null;
    }
}

function getUptime() {
    const uptimeSeconds = Math.floor((Date.now() - botStartTime) / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m`;
    return uptimeString.trim() || 'menos de um minuto';
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
    // Filtro de mensagens antigas
    if ((msg.timestamp * 1000) < (botStartTime - (MESSAGE_GRACE_PERIOD_SECONDS * 1000))) {
        console.log(`[INFO] Mensagem antiga de ${msg.from} ignorada.`);
        return; 
    }

    if (msg.fromMe) return;
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (msg.type === 'sticker') return;

    if (msg.type === 'ptt') {
        await msg.reply('Desculpe, ainda não consigo ouvir mensagens de áudio. 🙏 Por favor, envie sua dúvida por texto.');
        return;
    }

    if (!msg.body && !msg.hasMedia) return;
    const from = msg.from;
    const texto = msg.body ? msg.body.trim() : "";
    if (isUserFlooding(from)) {
        if (floodControl[from].count === FLOOD_MESSAGE_LIMIT + 1) await msg.reply('Você enviou muitas mensagens rapidamente. Por favor, aguarde um minuto antes de tentar novamente. 🙏');
        return;
    }
    
    if (texto.startsWith('/')) {
        if (config.ADMIN_IDS && config.ADMIN_IDS.includes(from)) {
            const command = texto.split(' ')[0];

            if (command === '/status') {
                const uptime = getUptime();
                await msg.reply(`🤖 Olá, admin! Estou online e funcionando.\n*Tempo de atividade:* ${uptime}.`);
            } else if (command === '/stats') {
                await msg.reply('📊 Consultando as estatísticas... um momento.');
                const data = await getSheetData();
                if (data) {
                    // Assumindo que a planilha tem um cabeçalho, o total de inscritos é o total de linhas - 1
                    const totalInscritos = data.length > 1 ? data.length - 1 : 0; 
                    await msg.reply(`*Total de inscritos na planilha:* ${totalInscritos}`);
                } else {
                    await msg.reply('❌ Desculpe, não consegui aceder à planilha para obter as estatísticas.');
                }
            } else {
                await msg.reply(`Comando de admin "${command}" não reconhecido. Comandos disponíveis:\n\n*/status* - Verifica se o bot está online.\n*/stats* - Mostra o número de inscritos.`);
            }
        } else {
            console.log(`[SEGURANÇA] Comando de admin "${texto}" bloqueado para o usuário ${from}.`);
        }
        return; 
    }

    if (!userContext[from]) {
        userContext[from] = { 
            lastOffer: null, 
            offeredKerigma: false, 
            awaitingDetails: false, 
            awaitingRegistrationChoice: false, 
            isDiscussingMinor: false, 
            lastTopic: null, 
            awaitingMenuChoice: false, 
            awaitingConfirmation: false, 
            pendingRegistrationData: null,
            pendingReceiptMsg: null
        };
    }
    const context = userContext[from];
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;

    // ORDEM DE VERIFICAÇÃO DE ESTADO (DO MAIS ESPECÍFICO PARA O GERAL)

    // NÍVEL 1: Respostas a perguntas diretas do bot (contextos de alta prioridade)

    if (context.awaitingConfirmation) {
    const escolha = texto.toLowerCase();
    if (['1', 'sim', 'confirmar'].includes(escolha)) {
        
        const dataParaSalvar = context.pendingRegistrationData;
        const nomeCompletoInscrito = dataParaSalvar[1];

        try {
            const comprovanteMsg = context.pendingReceiptMsg;
            if (comprovanteMsg) {
                await comprovanteMsg.forward(config.GRUPO_ID_ADMIN);

                const tesoureiroId = config.TESOUREIRO_ID;
                const tesoureiroNumber = tesoureiroId.split('@')[0];
                const textoMencao = `📄 Inscrição confirmada!\n\n*Nome:* ${nomeCompletoInscrito}\n*Número:* ${from.replace('@c.us', '')}\n\nTesoureiro: @${tesoureiroNumber}, por favor, confirme o recebimento.`;
                
                await client.sendMessage(config.GRUPO_ID_ADMIN, textoMencao, { mentions: [tesoureiroId] });
            } else {
                throw new Error("Mensagem de comprovante não encontrada no contexto.");
            }
        } catch (adminError) {
            console.error("[ERRO ADMIN] Falha ao enviar para o grupo de admin:", adminError);
            await msg.reply("Tive um problema para notificar a equipe, mas não se preocupe, sua inscrição foi recebida e será tratada manualmente.");
        }

        if (await appendToSheet(dataParaSalvar)) {
            await msg.reply(`Perfeito! Inscrição confirmada e dados guardados. A equipe irá verificar o seu comprovante e em breve você receberá a confirmação final. 🙌`);
        } else {
            await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha, mas a equipe já foi notificada. Sua inscrição está segura! 👍`);
        }
        
        // Resetando o contexto após conclusão
        context.awaitingConfirmation = false;
        context.pendingRegistrationData = null;
        context.pendingReceiptMsg = null;

    } else if (['2', 'nao', 'não', 'corrigir', 'corrijir'].includes(escolha)) {
        await msg.reply('Entendido. Para garantir que o comprovante correto seja associado aos dados corretos, vamos recomeçar. Por favor, envie a imagem do comprovante novamente.');
        context.awaitingConfirmation = false;
        context.pendingRegistrationData = null;
        context.pendingReceiptMsg = null;
        context.awaitingDetails = false;
    } else {
        await msg.reply("Não entendi a sua resposta. Por favor, digite *1 para Confirmar* ou *2 para Corrigir* os dados.");
    }
    return;
}


    // Bloco para escolher entre Inscrição Online, Presencial ou Cancelar
    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online'];
        const escolhaPresencial = ['2', 'presencial'];
        const escolhaCancelar = ['3', 'cancelar'];

        if (smartMatch(texto, escolhaOnline)) {
            context.awaitingRegistrationChoice = false;
            context.awaitingMenuChoice = false;
            const item = memoria.find(i => i.id === 'inscricao_online_detalhes');
            if (item) await msg.reply(item.resposta);
            else await msg.reply("Processo de inscrição online iniciado! (Resposta a ser configurada em memoria.js com id: inscricao_online_detalhes)");
        } else if (smartMatch(texto, escolhaPresencial)) {
            context.awaitingRegistrationChoice = false;
            context.awaitingMenuChoice = false;
            const item = memoria.find(i => i.id === 'inscricao_presencial');
            if (item) await msg.reply(item.resposta);
        } else if (smartMatch(texto, escolhaCancelar)) {
            context.awaitingRegistrationChoice = false;
            await msg.reply("Inscrição cancelada. Se precisar de algo mais, estou por aqui! 👍");
        } else {
            await msg.reply("Desculpe, não entendi. Por favor, digite '1' para Online, '2' para Presencial ou '3' para Cancelar.");
        }
        return;
    }
    
    if (context.awaitingDetails) {
        const detalhes = msg.body.split('\n');
        const nomeCompleto = detalhes[0] || 'Não informado';
        const email = detalhes[1] || 'Não informado';
        const responsavel = detalhes[2] || 'N/A';
        
        const dataParaPlanilha = [new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), nomeCompleto, email, contato.number, responsavel];
        context.pendingRegistrationData = dataParaPlanilha;

        const confirmationMessage = `Por favor, confirme se os seus dados estão corretos:\n\n*Nome:* ${nomeCompleto}\n*E-mail:* ${email}\n*Responsável:* ${responsavel}\n\nPosso confirmar e guardar estes dados?\n\nDigite *1* - Sim, confirmar\nDigite *2* - Não, quero corrigir`;
        await msg.reply(confirmationMessage);

        context.awaitingDetails = false;
        context.awaitingConfirmation = true;
        
        return;
    }

    // NÍVEL 2: Comandos com gatilhos específicos (envio de mídia, frases de seguimento)
    if (msg.hasMedia && PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
    const mimetype = msg._data.mimetype || '';
    const filename = msg._data.filename || '';
    const isImage = msg.type === 'image' || mimetype.startsWith('image/');
    const isPDF = mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPDF) {
        await msg.reply('Obrigado por enviar! No entanto, só consigo processar comprovantes em formato de imagem (JPG, PNG) ou PDF. Poderia enviar o ficheiro no formato correto, por favor? 🙏');
        return;
    }

    try {
        context.pendingReceiptMsg = msg;

        const confirmacaoUsuario = respostaAleatoria([
            `Obrigado, ${nomeUsuario}! Comprovante recebido. 🙏\n\nAgora, por favor, envie os seguintes dados, *cada um em uma linha*:\n\n1. Seu nome completo\n2. Seu melhor e-mail\n3. Nome do responsável (caso seja menor de 18 anos, senão ignore)`,
            `Recebido, ${nomeUsuario}! 🙌\n\nPara concluir, envie os seguintes dados, *um por linha*:\n\n1. Seu nome completo\n2. Seu e-mail\n3. Nome do responsável (se for menor)`
        ]);
        await msg.reply(confirmacaoUsuario);
        context.awaitingDetails = true;
    } catch (error) {
        console.error("[ERRO] Falha ao processar comprovante inicial:", error);
        await msg.reply("Ops! Tive um problema ao processar o seu comprovante. Por favor, tente novamente ou envie outro formato.");
    }
    return;
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
        context.awaitingRegistrationChoice = true;
        return;
    }

    let respostaFinal;
    if (itemParaResponder.funcaoResposta) respostaFinal = itemParaResponder.funcaoResposta();
    else if (typeof itemParaResponder.resposta === 'function') respostaFinal = respostaAleatoria(itemParaResponder.resposta(nomeUsuario));
    else respostaFinal = respostaAleatoria(itemParaResponder.resposta);

    context.lastTopic = itemParaResponder.id;

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