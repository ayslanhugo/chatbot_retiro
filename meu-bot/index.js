// --- Importações ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const stringSimilarity = require('string-similarity');
const { google } = require('googleapis');
const memoria = require('./memoria'); // A "inteligência" do bot agora vem daqui

// --- Configurações e Constantes de Operação ---
const GRUPO_ID_ADMIN = "120363417850316288@g.us";
const SPREADSHEET_ID = "1EMo7FlITs6MUzk8ODsLbjn4mroTnO3_thRkr0TfJylw";
const floodControl = {};
const FLOOD_MESSAGE_LIMIT = 5;
const FLOOD_TIME_WINDOW_SECONDS = 10;
const FLOOD_COOLDOWN_SECONDS = 60;
const userContext = {};

// Cliente ajustado para rodar em servidor
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ Bot está pronto e conectado ao WhatsApp!'));

// --- Funções Auxiliares ---
function respostaAleatoria(respostas) {
    if (Array.isArray(respostas)) {
        return respostas[Math.floor(Math.random() * respostas.length)];
    }
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
    if (chaves.some(chave => normalizeText(chave).length > 3 && textoNormalizado.includes(normalizeText(chave)))) return true;
    const palavrasDoTexto = textoNormalizado.split(' ');
    const SIMILARITY_THRESHOLD = 0.85;
    for (const palavra of palavrasDoTexto) {
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
        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: 'https://www.googleapis.com/auth/spreadsheets',
        });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Página1!A:E',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [data] },
        });
        console.log(`[SHEETS] Dados adicionados: ${data.join(', ')}`);
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
    if (userData.isBlocked && currentTime < userData.blockedUntil) {
        console.log(`[FLOOD] Mensagem de ${from} ignorada (cooldown).`);
        return true;
    }
    if (userData.isBlocked) userData.isBlocked = false;
    if (currentTime - userData.startTime > FLOOD_TIME_WINDOW_SECONDS * 1000) {
        userData.count = 1;
        userData.startTime = currentTime;
    } else {
        userData.count++;
    }
    if (userData.count > FLOOD_MESSAGE_LIMIT) {
        console.log(`[FLOOD] Usuário ${from} bloqueado.`);
        userData.isBlocked = true;
        userData.blockedUntil = currentTime + FLOOD_COOLDOWN_SECONDS * 1000;
        return true;
    }
    return false;
}

// --- LÓGICA PRINCIPAL DO BOT ---

client.on('message', async (msg) => {
    // --- FILTROS INICIAIS ---
    if (msg.fromMe) return;
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (!msg.body && !msg.hasMedia) return;

    const from = msg.from;
    const texto = msg.body ? msg.body.trim() : "";

    // --- LÓGICA DE CONTROLE DE FLOOD ---
    if (isUserFlooding(from)) {
        if (floodControl[from].count === FLOOD_MESSAGE_LIMIT + 1) {
            await msg.reply('Você enviou muitas mensagens rapidamente. Por favor, aguarde um minuto antes de tentar novamente. 🙏');
        }
        return;
    }

    // Inicializa o contexto do usuário se não existir
    if (!userContext[from]) {
        userContext[from] = { lastOffer: null, offeredKerigma: false, awaitingDetails: false, awaitingRegistrationChoice: false, isDiscussingMinor: false, lastTopic: null };
    }
    const context = userContext[from];
    
    // --- FLUXOS DE CONVERSA ESPECÍFICOS ---

    // 1. Resposta a uma oferta proativa (ex: explicar o que é Kerigma)
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

    // 2. Resposta à escolha do tipo de inscrição (Online vs. Presencial)
    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online', 'zap', 'whatsapp'];
        const escolhaPresencial = ['2', 'presencial', 'pessoalmente', 'grupo'];
        context.awaitingRegistrationChoice = false;
        if (smartMatch(texto, escolhaOnline)) {
            const infoPagamento = memoria.find(item => item.id === 'valor')?.funcaoResposta();
            const fichaLink = "http://ayslanhugo.pythonanywhere.com/static/ficha_inscricao.pdf";
            let resposta = "Combinado! O processo online é bem simples e feito em 2 passos:\n\n";
            resposta += `1️⃣ *Preencha a Ficha:*\nBaixe e preencha a ficha de inscrição neste link:\n${fichaLink}\n\n`;
            resposta += `2️⃣ *Faça o Pagamento:*\n${infoPagamento}\n\n`;
            resposta += "Depois de pagar, é só me enviar o *comprovativo* aqui no chat junto com a palavra 'comprovante' que eu finalizo para você. 😉";
            await msg.reply(resposta);
        } else if (smartMatch(texto, escolhaPresencial)) {
            const presencialInfo = memoria.find(item => item.id === 'inscricao_presencial');
            await msg.reply(presencialInfo.resposta);
        } else {
            await msg.reply("Desculpe, não entendi a sua escolha. Por favor, digite '1' para Online ou '2' para Presencial.");
            context.awaitingRegistrationChoice = true;
        }
        return;
    }

    // 3. Captura dos detalhes após envio do comprovativo
    if (context.awaitingDetails) {
        context.awaitingDetails = false;
        const contato = await msg.getContact();
        const detalhes = msg.body.split('\n');
        const nomeParticipante = detalhes[0] || 'Não informado';
        const emailParticipante = detalhes[1] || 'Não informado';
        const nomeResponsavel = detalhes[2] || 'N/A';
        const dataParaPlanilha = [ new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), nomeParticipante, emailParticipante, contato.number, nomeResponsavel ];
        if (await appendToSheet(dataParaPlanilha)) {
            await msg.reply(`Perfeito! Inscrição pré-confirmada e dados guardados. A equipa irá verificar o seu comprovativo e em breve receberá a confirmação final. Estamos muito felizes por tê-lo(a) connosco! 🙌`);
        } else {
            await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha. Não se preocupe, a sua pré-inscrição está registada e a equipa fará o processo manualmente. 👍`);
        }
        return;
    }
    
    // 4. Lógica de recebimento de comprovativo
    const palavrasChaveComprovante = [ 'comprovante', 'pagamento', 'pix', 'paguei', 'inscrição', 'recibo', 'transferência', 'transferencia', 'tá pago', 'ta pago', 'comprovando' ];
    if (msg.hasMedia && smartMatch(texto, palavrasChaveComprovante)) {
        const contato = await msg.getContact();
        const nomeUsuario = (await msg.getContact()).pushname.split(' ')[0] || contato.number;
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(msg.mimetype)) {
            await msg.reply('Obrigado por enviar! No entanto, só consigo processar comprovativos em formato de imagem (JPG, PNG) ou PDF. Poderia enviar o ficheiro no formato correto, por favor? 🙏');
            return;
        }
        console.log(`[LOG] Recebido comprovativo VÁLIDO de ${nomeUsuario} (${contato.number}). A encaminhar...`);
        try {
            await msg.forward(GRUPO_ID_ADMIN);
            await client.sendMessage(GRUPO_ID_ADMIN, `📄 Novo comprovativo!\n\n*De:* ${contato.pushname || nomeUsuario}\n*Número:* ${contato.number}\n\nVerificar e confirmar.`);
            const confirmacaoUsuario = respostaAleatoria([
                `Obrigado, ${nomeUsuario}! Comprovativo recebido. 🙏\n\nPara finalizar, envie os seguintes dados, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu melhor e-mail\n3. Nome do responsável (se for menor de 18, senão ignore)`,
                `Recebido, ${nomeUsuario}! 🙌\n\nAgora, só preciso de mais alguns dados. Por favor, envie, *cada um numa linha*:\n\n1. O seu nome completo\n2. O seu e-mail\n3. Nome do responsável (apenas se for menor)`
            ]);
            await msg.reply(confirmacaoUsuario);
            context.awaitingDetails = true;
        } catch (error) {
            console.error("[ERRO] Falha ao encaminhar comprovativo:", error);
            await msg.reply("Ops! Tive um problema ao processar o seu comprovativo. Tente novamente ou envie para um organizador.");
        }
        return;
    }

    // AJUSTE NÍVEL 1: Lógica para perguntas de seguimento
    const frasesDeSeguimento = ['e o que mais?', 'fale mais', 'me diga mais', 'continue', 'e depois?', 'mais detalhes'];
    if (frasesDeSeguimento.includes(texto.toLowerCase())) {
        if (context.lastTopic) {
            const ultimoTopicoInfo = memoria.find(item => item.id === context.lastTopic);
            if (ultimoTopicoInfo && ultimoTopicoInfo.resposta_seguimento) {
                await msg.reply(ultimoTopicoInfo.resposta_seguimento);
                context.lastTopic = null; 
                return;
            }
        }
    }

    // --- LÓGICA GERAL DE PERGUNTAS E RESPOSTAS (FAQ) ---
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;
    const itensEncontrados = []; // AJUSTE: Mudança de nome para clareza
    const topicosPrincipais = ['data', 'local', 'valor', 'horario', 'levar', 'idade', 'atividades', 'dormir_local', 'sobre_jcc', 'sobre_retiro'];

    for (const item of memoria) {
        if (smartMatch(texto, item.chaves)) {
            if (item.id === 'menor_idade') context.isDiscussingMinor = true;
            if (item.id === 'ficha') {
                if (context.isDiscussingMinor) {
                    const respostaDiretaMenor = memoria.find(i => i.id === 'menor_idade').resposta(nomeUsuario);
                    await msg.reply("Notei que estamos a falar sobre a inscrição de um menor. Nesse caso, a orientação é específica. Segue novamente:\n\n" + respostaDiretaMenor);
                    return;
                }
                const pergunta = item.resposta(nomeUsuario);
                await msg.reply(pergunta);
                context.awaitingRegistrationChoice = true;
                return;
            }
            itensEncontrados.push(item); // AJUSTE: Adiciona o item inteiro, não apenas a resposta
        }
    }

    if (itensEncontrados.length > 0) {
        // AJUSTE: Gera as respostas a partir dos itens encontrados e define o lastTopic
        const respostasEncontradas = itensEncontrados.map(item => {
            if (item.funcaoResposta) return item.funcaoResposta();
            if (typeof item.resposta === 'function') return respostaAleatoria(item.resposta(nomeUsuario));
            return respostaAleatoria(item.resposta);
        });

        const respostaFinal = [...new Set(respostasEncontradas)].join('\n\n');
        
        if (itensEncontrados.length === 1) {
            context.lastTopic = itensEncontrados[0].id;
            const isMainTopic = topicosPrincipais.includes(itensEncontrados[0].id);
            if (isMainTopic && !context.offeredKerigma && !respostaFinal.includes('https://wa.me/')) {
                respostaFinal += `\n\nA propósito, gostaria de saber por que o nosso retiro se chama 'Kerigmático'?`;
                context.offeredKerigma = true;
                context.lastOffer = 'sobre_retiro';
            }
        } else {
            context.lastTopic = null;
        }

        await chat.sendStateTyping();
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
        await msg.reply(respostaFinal);

    } else {
        context.lastTopic = null; // Limpa o tópico se nada for encontrado
        const respostaFinal = `Opa, ${nomeUsuario}! Não encontrei nada sobre "${msg.body}" nos meus registos. 🤔\n\nPara ver a lista de comandos, digite *ajuda*. Se a sua dúvida for específica, tente "falar com a *organização*".`;
        await msg.reply(respostaFinal);
    }
});

client.initialize();