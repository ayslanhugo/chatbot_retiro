// index.js (Versão Final Corrigida)

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { memoria, MENU_PRINCIPAL } = require('./memoria.js');
const config = require('./config.js');

// Importando os nossos novos módulos
const { iniciarAgendadores } = require('./modulos/agendador.js');
const { getSheetData, appendToSheet, detectIntent } = require('./modulos/googleServices.js');
const { respostaAleatoria, smartMatch } = require('./modulos/utils.js');

// Constantes e funções que fazem sentido continuar aqui
const botStartTime = Date.now();
const floodControl = {};
const MESSAGE_GRACE_PERIOD_SECONDS = 30;
const PALAVRAS_CHAVE_COMPROVANTE = ['comprovante', 'pagamento', 'pix', 'paguei', 'inscrição', 'recibo', 'transferência', 'transferencia', 'tá pago', 'ta pago', 'comprovando'];


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

function isUserFlooding(from) {
    const FLOOD_MESSAGE_LIMIT = 5;
    const FLOOD_TIME_WINDOW_SECONDS = 10;
    const FLOOD_COOLDOWN_SECONDS = 60;
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
    if ((msg.timestamp * 1000) < (botStartTime - (MESSAGE_GRACE_PERIOD_SECONDS * 1000))) { return; }
    if (msg.fromMe) return;
    const chat = await msg.getChat();
    if (chat.isGroup) return;
    if (msg.type === 'sticker' || msg.type === 'ptt' || (!msg.body && !msg.hasMedia)) { return; }

    const from = msg.from;
    const texto = msg.body ? msg.body.trim() : "";

    if (isUserFlooding(from)) { return; }

    if (texto.startsWith('/')) {
        if (config.ADMIN_IDS && config.ADMIN_IDS.includes(from)) {
            const command = texto.split(' ')[0];
            if (command === '/status') {
                await msg.reply(`🤖 Olá, admin! Estou online e funcionando.\n*Tempo de atividade:* ${getUptime()}.`);
            } else if (command === '/stats') {
                const data = await getSheetData();
                const totalInscritos = data ? (data.length > 1 ? data.length - 1 : 0) : 'N/A'; 
                await msg.reply(`*Total de inscritos na planilha:* ${totalInscritos}`);
            }
        }
        return; 
    }

    if (msg.hasMedia && !PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        const mimetype = msg._data.mimetype || '';
        if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
            const textoDeInstrucao = `Olá! Recebi um arquivo aqui. 😊\n\nSe este é o seu comprovante de pagamento, peço que o envie novamente, mas desta vez, escrevendo a palavra *comprovante* na legenda, como no exemplo. 👇`;
            try {
                const mediaExemplo = MessageMedia.fromFilePath('./exemplo-comprovante.jpeg');
                await client.sendMessage(msg.from, mediaExemplo, { caption: textoDeInstrucao });
            } catch (e) {
                await msg.reply(textoDeInstrucao);
            }
            return;
        }
    }

    if (!userContext[from]) {
        userContext[from] = { awaitingDetails: false, awaitingConfirmation: false, pendingRegistrationData: null, pendingReceiptMsg: null, awaitingRegistrationChoice: false, lastTopic: null, awaitingMenuChoice: false };
    }
    const context = userContext[from];
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;

   // A nova versão melhorada
    if (context.awaitingConfirmation) {
        const escolha = texto.toLowerCase();
        if (['1', 'sim', 'confirmar'].includes(escolha)) {
            const dataParaSalvar = context.pendingRegistrationData;
            const nomeCompletoInscrito = dataParaSalvar[1];
            try {
                const comprovanteMsg = context.pendingReceiptMsg;
                await comprovanteMsg.forward(config.GRUPO_ID_ADMIN);
                const tesoureiroId = config.TESOUREIRO_ID;
                const tesoureiroNumber = tesoureiroId.split('@')[0];
                const textoMencao = `📄 Inscrição confirmada!\n\n*Nome:* ${nomeCompletoInscrito}\n*Número:* ${from.replace('@c.us', '')}\n\nTesoureiro: @${tesoureiroNumber}, por favor, confirme o recebimento.`;
                await client.sendMessage(config.GRUPO_ID_ADMIN, textoMencao, { mentions: [tesoureiroId] });
            } catch (adminError) { console.error("[ERRO ADMIN] Falha ao enviar para o grupo de admin:", adminError); }
            if (await appendToSheet(dataParaSalvar)) {
                await msg.reply(`Perfeito! Inscrição confirmada e dados guardados. 🙌`);
            } else {
                await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha, mas a equipe já foi notificada.`);
            }
            // Limpa todo o contexto após o sucesso
            userContext[from] = {};

        } else if (['2', 'nao', 'não', 'corrigir'].includes(escolha)) {
            // AQUI ESTÁ A MUDANÇA PRINCIPAL
            await msg.reply('Sem problemas! O seu comprovante está guardado. Por favor, envie os seus dados novamente, com atenção, cada um numa nova linha:\n\n1. Seu nome completo\n2. Seu e-mail\n3. Nome do responsável (se for menor)');
            
            // Apenas volta para o passo de pedir os detalhes, sem apagar o comprovante
            context.awaitingDetails = true;
            context.awaitingConfirmation = false;
            context.pendingRegistrationData = null;
            
        } else {
            await msg.reply("Não entendi. Por favor, digite *1 para Confirmar* ou *2 para Corrigir*.");
        }
        return;
    }

    if (context.awaitingRegistrationChoice) {
        const escolhaOnline = ['1', 'online'];
        const escolhaPresencial = ['2', 'presencial'];
        const escolhaCancelar = ['3', 'cancelar'];
        if (smartMatch(texto, escolhaOnline)) {
            context.awaitingRegistrationChoice = false;
            const item = memoria.find(i => i.id === 'inscricao_online_detalhes');
            if (item) await msg.reply(item.resposta);
        } else if (smartMatch(texto, escolhaPresencial)) {
            context.awaitingRegistrationChoice = false;
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

// Cole este bloco de código DEPOIS do bloco "if (context.awaitingRegistrationChoice) { ... }"

    // NÍVEL 3: Lógica do Menu Principal (quando o bot espera um número)
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
        } else {
            // Se o número não está no menu
            await msg.reply("Desculpe, não encontrei essa opção no menu. Por favor, digite um dos números listados.");
        }
        return; // Termina o processamento aqui
    }
    context.awaitingMenuChoice = false; 

    if (context.awaitingDetails) {
        const detalhes = msg.body.split('\n');
        const nomeCompleto = detalhes[0] || 'Não informado';
        const email = detalhes[1] || 'Não informado';
        const responsavel = detalhes[2] || 'N/A';
        const dataParaPlanilha = [new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), nomeCompleto, email, contato.number, responsavel];
        context.pendingRegistrationData = dataParaPlanilha;
        const confirmationMessage = `Por favor, confirme se os seus dados estão corretos:\n\n*Nome:* ${nomeCompleto}\n*E-mail:* ${email}\n*Responsável:* ${responsavel}\n\nDigite *1* - Sim, confirmar\nDigite *2* - Não, quero corrigir`;
        await msg.reply(confirmationMessage);
        context.awaitingDetails = false;
        context.awaitingConfirmation = true;
        return;
    }

    if (msg.hasMedia && PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        context.pendingReceiptMsg = msg;
        const confirmacaoUsuario = respostaAleatoria([ `Obrigado, ${nomeUsuario}! Comprovante recebido. 🙏\n\nAgora, por favor, envie os seguintes dados, *cada um em uma linha*:\n\n1. Seu nome completo\n2. Seu melhor e-mail\n3. Nome do responsável (se for menor de 18 anos, senão ignore)` ]);
        await msg.reply(confirmacaoUsuario);
        context.awaitingDetails = true;
        return;
    }

    if (texto.length > 250) {
        await msg.reply("Desculpe, a sua mensagem é muito longa para eu processar. 🙏 Poderia resumi-la, por favor?");
        return;
    }

    const dfResult = await detectIntent(from, texto);
    if (dfResult && dfResult.intent) {
        let intentName = dfResult.intent.displayName;
        const isFallback = dfResult.intent.isFallback;
        if (isFallback) {
            await msg.reply(`Opa, ${nomeUsuario}! Não entendi muito bem o que você quis dizer. 🤔\n\nVocê pode tentar perguntar de outra forma ou digitar *ajuda* para ver os tópicos que conheço.`);
            return;
        }
        if (intentName === 'Default Welcome Intent') {
            intentName = 'saudacao';
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

// Substitua a sua função 'responderComItem' por esta:

// Substitua a sua função 'responderComItem' por esta versão final:

async function responderComItem(itemParaResponder, msg, context, nomeUsuario, chat) {
    // Caso especial para iniciar a inscrição
    if (itemParaResponder.id === 'fazer_inscricao') {
        const pergunta = memoria.find(i => i.id === 'fazer_inscricao').resposta(nomeUsuario);
        await msg.reply(pergunta);
        context.awaitingRegistrationChoice = true;
        return;
    }

    // Caso especial para a saudação (que mostra o menu principal)
    if (itemParaResponder.id === 'saudacao') {
        const saudacao = memoria.find(i => i.id === 'saudacao').resposta(nomeUsuario);
        await msg.reply(saudacao);
        context.awaitingMenuChoice = true; // ATIVA O MODO DE ESPERA POR NÚMERO
        return;
    }

    // Para todas as outras respostas diretas
    let respostaFinal;
    if (itemParaResponder.funcaoResposta) respostaFinal = itemParaResponder.funcaoResposta();
    else if (typeof itemParaResponder.resposta === 'function') respostaFinal = respostaAleatoria(itemParaResponder.resposta(nomeUsuario));
    else respostaFinal = respostaAleatoria(itemParaResponder.resposta);

    context.lastTopic = itemParaResponder.id;
    // A linha "awaitingMenuChoice = false" foi removida daqui, o que está correto.

    // As duas linhas abaixo trazem de volta o efeito de "a escrever..."
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
    
    await msg.reply(respostaFinal);
}

function start() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });
    const userContext = {};

    client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); });

    client.on('ready', () => {
        console.log('✅ Bot está pronto e conectado ao WhatsApp!');
        iniciarAgendadores(client); // Inicia os nossos agendadores
        client.on('message', (msg) => handleMessage(msg, userContext, client));
    });
  
    console.log("Iniciando o cliente...");
    client.initialize().catch(err => { console.error("Erro CRÍTICO ao inicializar o cliente:", err); });
}

if (require.main === module) {
    start();
}