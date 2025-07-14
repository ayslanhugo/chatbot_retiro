// index.js - VERSÃO FINAL, OTIMIZADA E CORRIGIDA

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const stringSimilarity = require('string-similarity');
const { google } = require('googleapis');
const memoria = require('./memoria');
const config = require('./config.js'); // Importa as configurações centralizadas

// --- Constantes de Operação e Lógica ---
const floodControl = {};
const FLOOD_MESSAGE_LIMIT = 5;
const FLOOD_TIME_WINDOW_SECONDS = 10;
const FLOOD_COOLDOWN_SECONDS = 60;

// AJUSTE: Constantes de lógica movidas para o topo do ficheiro
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
        await sheets.spreadsheets.values.append({
            spreadsheetId: config.SPREADSHEET_ID, // AJUSTE: Usando a configuração centralizada
            range: 'Página1!A:E',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [data] },
        });
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


// --- LÓGICA PRINCIPAL DO BOT ---
async function handleMessage(msg, userContext, client) {
    // --- FILTROS INICIAIS ---
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

    // --- FLUXOS DE CONVERSA COM CONTEXTO ---
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

    if (context.lastOffer === 'sobre_retiro') {
        const palavrasPositivas = ['sim', 'gostaria', 'quero', 'pode', 'explica', 'claro', 'por que', 'pq', 'qual o significado'];
        const palavrasNegativas = ['não', 'nao', 'n', 'depois', 'agora nao', 'deixa'];
        context.lastOffer = null;
        if (smartMatch(texto, palavrasPositivas)) {
            const sobreInfo = memoria.find(item => item.id === 'sobre_retiro');
            if (sobreInfo) await msg.reply(sobreInfo.resposta);
        } else if (smartMatch(texto, palavrasNegativas)) {
            await msg.reply("Tudo bem! Se mudar de ideias, é só me perguntar sobre o significado do nome do retiro. Estou por aqui! 😉");
        }
        return;
    }
    
    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online', 'zap', 'whatsapp'];
        const escolhaPresencial = ['2', 'presencial', 'pessoalmente', 'grupo'];
        if (smartMatch(texto, escolhaOnline) || smartMatch(texto, escolhaPresencial)) {
            context.awaitingRegistrationChoice = false;
            if (smartMatch(texto, escolhaOnline)) {
                const infoPagamento = memoria.find(item => item.id === 'valor')?.funcaoResposta();
                const fichaLink = "http://ayslanhugo.pythonanywhere.com/static/ficha_inscricao.pdf";
                let resposta = "Combinado! O processo online é bem simples e feito em 2 passos:\n\n1️⃣ *Preencha a Ficha:*\nBaixe e preencha a ficha de inscrição neste link:\n" + fichaLink + "\n\n2️⃣ *Faça o Pagamento:*\n" + infoPagamento + "\n\nDepois de pagar, é só me enviar o *comprovante* aqui no chat junto com a palavra 'comprovante' que eu finalizo para você. 😉";
                await msg.reply(resposta);
            } else {
                const presencialInfo = memoria.find(item => item.id === 'inscricao_presencial');
                await msg.reply(presencialInfo.resposta);
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
        if (await appendToSheet(dataParaPlanilha)) await msg.reply(`Perfeito! Inscrição pré-confirmada e dados guardados. A equipe irá verificar o seu comprovante e em breve receberá a confirmação final. Estamos muito felizes por tê-lo(a) connosco! 🙌`);
        else await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha. Não se preocupe, a sua pré-inscrição está registada e a equipe fará o processo manualmente. 👍`);
        return;
    }
    
    // --- LÓGICA DE COMPROVANTE ---
    if (msg.hasMedia && smartMatch(texto, PALAVRAS_CHAVE_COMPROVANTE)) {

    // Nova lógica de validação
    const isImage = msg.type === 'image';
    // Verifica se é um documento E se o nome do ficheiro termina com .pdf
    const isPDF = msg.type === 'document' && msg._data.filename && msg._data.filename.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPDF) {
        await msg.reply('Obrigado por enviar! No entanto, só consigo processar comprovantes em formato de imagem (JPG, PNG) ou PDF. Poderia enviar o ficheiro no formato correto, por favor? 🙏');
        return;
    }

    // Se passou na validação, o resto do código continua igual.
    try {
        await msg.forward(config.GRUPO_ID_ADMIN);
        await client.sendMessage(config.GRUPO_ID_ADMIN, `📄 Novo comprovante!\n\n*De:* ${contato.pushname || nomeUsuario}\n*Número:* ${contato.number}\n\nVerificar e confirmar.`);
        const confirmacaoUsuario = respostaAleatoria([
            `Obrigado, ${nomeUsuario}! Comprovante recebido. 🙏\n\nPara finalizar, envie os seguintes dados, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu melhor e-mail\n3. Nome do responsável (se for menor de 18, senão ignore)`,
            `Recebido, ${nomeUsuario}! 🙌\n\nAgora, só preciso de mais alguns dados. Por favor, envie, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu e-mail\n3. Nome do responsável (apenas se for menor)`
        ]);
        await msg.reply(confirmacaoUsuario);
        context.awaitingDetails = true;
    } catch (error) {
        console.error("[ERRO] Falha ao encaminhar comprovante:", error);
        await msg.reply("Ops! Tive um problema ao processar o seu comprovante. Tente novamente ou envie para um organizador.");
    }
    return;
}

    // --- LÓGICA DE FAQ (PRIMEIRA CORRESPONDÊNCIA) ---
    for (const item of memoria) {
        if (smartMatch(texto, item.chaves)) {
            if (item.id === 'menor_idade') context.isDiscussingMinor = true;
            
            if (item.id === 'ficha') {
                if (context.isDiscussingMinor) {
                    const respostaDiretaMenor = memoria.find(i => i.id === 'menor_idade').resposta(nomeUsuario);
                    await msg.reply("Notei que estamos a falar sobre a inscrição de um menor. Nesse caso, a orientação é específica. Segue novamente:\n\n" + respostaDiretaMenor);
                    return;
                }
                const pergunta = memoria.find(i => i.id === 'ficha').resposta(nomeUsuario);
                await msg.reply(pergunta);
                context.awaitingRegistrationChoice = true;
                return;
            }

            let respostaFinal;
            if (item.funcaoResposta) respostaFinal = item.funcaoResposta();
            else if (typeof item.resposta === 'function') respostaFinal = respostaAleatoria(item.resposta(nomeUsuario));
            else respostaFinal = respostaAleatoria(item.resposta);
            
            context.lastTopic = item.id;
            // AJUSTE: Usando a constante definida no topo do ficheiro
            const isMainTopic = TOPICOS_PRINCIPAIS.includes(item.id);
            if (isMainTopic && !context.offeredKerigma && !respostaFinal.includes('https://wa.me/')) {
                respostaFinal += `\n\nA propósito, gostaria de saber por que o nosso retiro se chama 'Kerigmático'?`;
                context.offeredKerigma = true;
                context.lastOffer = 'sobre_retiro';
            }
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
            await msg.reply(respostaFinal);
            return;
        }
    }

    // Se o loop terminar sem encontrar nada
    context.lastTopic = null;
    await msg.reply(`Opa, ${nomeUsuario}! Não encontrei nada sobre "${texto}" nos meus registos. 🤔\n\nPara ver a lista de comandos, digite *ajuda*.`);
}

// --- PONTO DE PARTIDA DA APLICAÇÃO ---
function start() {
    const client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'] } });
    const userContext = {};
    client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
    client.on('ready', () => console.log('✅ Bot está pronto e conectado ao WhatsApp!'));
    client.on('message', (msg) => handleMessage(msg, userContext, client));
    client.initialize().catch(err => { console.error("Erro CRÍTICO ao inicializar o cliente:", err); });
}

if (require.main === module) {
    start();
}

module.exports = { handleMessage, smartMatch, normalizeText };