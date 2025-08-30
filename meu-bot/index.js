// index.js (VERSÃO FINAL E CORRIGIDA)

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { memoria, MENU_PRINCIPAL } = require('./memoria.js');
const config = require('./config.js');
const { iniciarAgendadores, lerBlacklist, salvarBlacklist } = require('./modulos/agendador.js');
const { getSheetData, appendToSheet, detectIntent, getInscritos, getMembrosEfetivosInscritos, getMembrosVisitantesInscritos } = require('./modulos/googleServices.js');
const { botStartTime, respostaAleatoria, formatarNumeroParaEnvio, lerLeads, salvarLeads } = require('./modulos/utils.js');
const { handleAdminCommand } = require('./modulos/adminCommands.js');

const floodControl = {};
const MESSAGE_GRACE_PERIOD_SECONDS = 30;
const PALAVRAS_CHAVE_COMPROVANTE = ['comprovante', 'pagamento', 'pix', 'paguei', 'inscrição', 'recibo', 'transferência', 'transferencia', 'tá pago', 'ta pago', 'comprovando'];
const INTENTS_DE_ALTO_INTERESSE = ['fazer_inscricao', 'consultar_valor', 'consultar_local', 'consultar_data', 'prazo_inscricao', 'menor_idade'];

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

    // Bloco 1: Prioridade máxima para confirmação de admin
    if (config.ADMIN_IDS && config.ADMIN_IDS.includes(from) && userContext[from] && userContext[from].awaitingConfirmationForBroadcast) {
        await handleAdminCommand('', msg, client, userContext);
        return; 
    }

    // Bloco 2: Verifica a confirmação 'OK' dos membros efetivos
    if (texto.toLowerCase() === 'ok') {
        const membrosEfetivos = await getMembrosEfetivosInscritos();
        if (membrosEfetivos && membrosEfetivos.some(membro => membro.numero === from)) {
            await msg.reply('Obrigado pela sua confirmação! 🙏');
            return; 
        }
    }

    // Bloco 3: Verifica se o utilizador está a fazer flood
    if (isUserFlooding(from)) { return; }

    // Bloco 4: Verifica o comando 'sair'
    if (texto.toLowerCase() === 'sair') {
        const blacklist = lerBlacklist();
        if (!blacklist.includes(from)) {
            blacklist.push(from);
            salvarBlacklist(blacklist);
        }
        await msg.reply("Entendido. Você não receberá mais mensagens automáticas de lembrete. Se precisar de algo, é só chamar!");
        return;
    }

    // Bloco 5: Verifica comandos de admin que começam com '/'
    if (texto.startsWith('/')) {
        const linhasDaMensagem = texto.split('\n');
        const command = linhasDaMensagem[0].split(' ')[0]; 

        if (config.ADMIN_IDS && config.ADMIN_IDS.includes(from)) {
            await handleAdminCommand(command, msg, client, userContext);
        } else {
            console.log(`[SEGURANÇA] Comando de admin "${texto}" bloqueado para o usuário ${from}.`);
        }
        return; 
    }
    
    // --- A partir daqui, segue a lógica normal de conversa ---

    if (msg.hasMedia && !PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        const mimetype = msg._data.mimetype || '';
        if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
            const textoDeInstrucao = `Olá! Recebi um arquivo aqui. 😊\n\nSe este é o seu comprovante de pagamento, peço que o envie novamente, mas desta vez, escrevendo a palavra *comprovante* na legenda, como no exemplo. 👆🏻`;
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
        userContext[from] = { awaitingDetails: false, awaitingConfirmation: false, pendingRegistrationData: null, pendingReceiptMsg: null, awaitingRegistrationChoice: false, lastTopic: null, awaitingMenuChoice: false, awaitingPresentialPDFChoice: false };
    }
    const context = userContext[from];
    const contato = await msg.getContact();
    const nomeUsuario = contato.pushname ? contato.pushname.split(' ')[0] : contato.number;

    if (context.awaitingConfirmation) {
        const escolha = texto.toLowerCase();
        if (['1', 'sim', 'confirmar'].includes(escolha)) {
            const dataParaSalvar = context.pendingRegistrationData;
            const nomeCompletoInscrito = dataParaSalvar[1];
            
            try {
                const comprovanteMsg = context.pendingReceiptMsg;
                if (comprovanteMsg && comprovanteMsg.hasMedia) {
                    const media = await comprovanteMsg.downloadMedia();
                    const tesoureiroId = config.TESOUREIRO_ID;
                    const tesoureiroNumber = tesoureiroId.split('@')[0];
                    const textoMencao = `📄 Nova inscrição recebida!\n\n*Nome:* ${nomeCompletoInscrito}\n*Número:* ${from.replace('@c.us', '')}\n\nTesoureiro: @${tesoureiroNumber}, por favor, confirme o pagamento.`;
                    await client.sendMessage(config.GRUPO_ID_ADMIN, media, { caption: textoMencao, mentions: [tesoureiroId] });
                }
            } catch (adminError) { 
                console.error("[ERRO ADMIN] Falha ao enviar comprovante para o grupo de admin:", adminError.message);
                await client.sendMessage(config.GRUPO_ID_ADMIN, `🚨 ALERTA: Falha ao processar o anexo da inscrição de ${nomeCompletoInscrito}. Inscrição adicionada à planilha, mas o comprovante precisa de ser verificado manualmente.`);
            }

            if (await appendToSheet(dataParaSalvar)) {
                await msg.reply(`Perfeito! Inscrição confirmada e dados guardados. 🙌`);
                const leads = lerLeads();
                if (leads[from]) {
                    delete leads[from];
                    salvarLeads(leads);
                }
            } else {
                await msg.reply(`Obrigado pelos dados! Tive um problema ao guardar na nossa planilha, mas a equipe já foi notificada.`);
            }
            userContext[from] = {};
        } else if (['2', 'nao', 'não', 'corrigir'].includes(escolha)) {
            await msg.reply('Sem problemas! O seu comprovante está guardado. Por favor, envie os seus dados novamente, com atenção:\n\n1. Seu nome completo\n2. Seu melhor e-mail\n3. Nome do responsável (se for menor, ou digite N/A)\n4. Você é membro efetivo do JCC? (Responda com Sim ou Não)');
            context.awaitingDetails = true;
            context.awaitingConfirmation = false;
            context.pendingRegistrationData = null;
        } else {
            await msg.reply("Não entendi. Por favor, digite *1 para Confirmar* ou *2 para Corrigir*.");
        }
        return;
    }

    if (context.awaitingPresentialPDFChoice) {
        if (texto === '1') {
            await msg.reply("Ótimo! Preparando o envio do PDF...");
            try {
                const media = MessageMedia.fromFilePath('./ficha-inscricao.pdf');
                await client.sendMessage(msg.from, media);
            } catch (e) {
                console.error("ERRO: Falha ao enviar o PDF da ficha de inscrição.", e.message);
                await msg.reply("Peço desculpa, tive um problema para encontrar o arquivo da ficha.");
            }
        } else {
            await msg.reply("Ok, sem problemas! Se mudar de ideias, é só pedir. Estamos à sua espera no grupo de oração! 🙏");
        }
        userContext[from] = {};
        return;
    }

    if (context.awaitingRegistrationChoice) {
        if (texto === '1') {
            context.awaitingRegistrationChoice = false;
            const item = memoria.find(i => i.id === 'inscricao_online_detalhes');
            if (item) await msg.reply(item.resposta);
        } else if (texto === '2') {
            context.awaitingRegistrationChoice = false;
            const item = memoria.find(i => i.id === 'inscricao_presencial');
            if (item) await msg.reply(item.resposta);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await msg.reply("Gostaria de receber a ficha de inscrição em PDF para já ir adiantando o preenchimento?\n\nDigite *1* - Sim, quero o PDF\nDigite *2* - Não, obrigado");
            context.awaitingPresentialPDFChoice = true;
        } else if (texto === '3') {
            context.awaitingRegistrationChoice = false;
            await msg.reply("Inscrição cancelada. Se precisar de algo mais, estou por aqui! 👍");
        } else {
            await msg.reply("Desculpe, não entendi. Por favor, digite '1' para Online, '2' para Presencial ou '3' para Cancelar.");
        }
        return;
    }

    const numeroEscolhido = parseInt(texto, 10);
    if (context.awaitingMenuChoice && !isNaN(numeroEscolhido)) {
        const itemDoMenu = MENU_PRINCIPAL.find(item => item.numero === numeroEscolhido);
        if (itemDoMenu) {
            const intentName = itemDoMenu.id_intent;
            const itemParaResponder = memoria.find(m => m.id === intentName);
            if (itemParaResponder) {
                await responderComItem(itemParaResponder, msg, context, nomeUsuario, chat);
            } else {
                 await msg.reply('Ops! Encontrei a opção no menu, mas estou com dificuldade de achar a resposta.');
            }
        } else {
            await msg.reply("Desculpe, não encontrei essa opção no menu.");
        }
        return;
    }
    context.awaitingMenuChoice = false; 

    if (context.awaitingDetails) {
    const detalhes = msg.body.split('\n');

    // Voltamos a ler apenas 4 linhas
    const nomeCompleto = detalhes[0] || 'Não informado';
    const email = detalhes[1] || 'Não informado';
    const responsavel = detalhes[2] || 'N/A';
    const ehMembro = detalhes[3] || 'Não informado';

    const dataParaPlanilha = [
        new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), 
        nomeCompleto, 
        email, 
        contato.number, // AQUI: Voltamos a usar o número do remetente
        responsavel,
        ehMembro.trim()
    ];
    context.pendingRegistrationData = dataParaPlanilha;

    // Mensagem de confirmação sem o campo "Telefone"
    const confirmationMessage = `Por favor, confirme se os seus dados estão corretos:\n\n` +
                                `*Nome:* ${nomeCompleto}\n` +
                                `*E-mail:* ${email}\n` +
                                `*Responsável:* ${responsavel}\n` +
                                `*É membro do JCC?* ${ehMembro}\n\n` +
                                `Digite *1* - Sim, confirmar\n` +
                                `Digite *2* - Não, quero corrigir`;

    await msg.reply(confirmationMessage);
    context.awaitingDetails = false;
    context.awaitingConfirmation = true;
    return;
}

    if (msg.hasMedia && PALAVRAS_CHAVE_COMPROVANTE.some(p => texto.toLowerCase().includes(p))) {
        context.pendingReceiptMsg = msg;
        const confirmacaoUsuario = respostaAleatoria([ `Obrigado, ${nomeUsuario}! Comprovante recebido. 🙏\n\nAgora, por favor, envie os seguintes dados, *cada um em uma linha*:\n\n1. Seu nome completo\n2. Seu melhor e-mail\n3. Nome do responsável (se for menor, ou digite N/A)\n4. Você é membro efetivo do JCC? (Responda com Sim ou Não)` ]);
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

async function responderComItem(itemParaResponder, msg, context, nomeUsuario, chat) {
    // --- LÓGICA DE REGISTO DE LEAD ---
    if (INTENTS_DE_ALTO_INTERESSE.includes(itemParaResponder.id)) {
        const inscritos = await getInscritos();
        if (inscritos) {
            const numerosInscritos = new Set(inscritos.map(i => i.numero));
            
            // --- AJUSTE APLICADO AQUI ---
            const idUsuarioNormalizado = formatarNumeroParaEnvio(msg.from);

            if (!numerosInscritos.has(idUsuarioNormalizado)) {
                console.log(`[LEADS] Detectado alto interesse do usuário ${nomeUsuario} (${msg.from}). Adicionando/atualizando lead.`);
                const leads = lerLeads();
                leads[msg.from] = {
                    nome: nomeUsuario,
                    lastInteraction: new Date().toISOString(),
                    followUpSent: false
                };
                salvarLeads(leads);
            } else {
                console.log(`[LEADS] Usuário ${nomeUsuario} (${msg.from}) já está inscrito. Ignorando adição à lista de leads.`);
            }
        }
    }
    // --- FIM DA LÓGICA DE LEAD ---

    if (itemParaResponder.id === 'fazer_inscricao') {
        const pergunta = memoria.find(i => i.id === 'fazer_inscricao').resposta(nomeUsuario);
        await msg.reply(pergunta);
        context.awaitingRegistrationChoice = true;
        return;
    }

    if (['saudacao', 'ajuda', 'confirmacao_positiva'].includes(itemParaResponder.id)) { 
        const saudacao = memoria.find(i => i.id === 'saudacao').resposta(nomeUsuario);
        await msg.reply(saudacao);
        context.awaitingMenuChoice = true;
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
        iniciarAgendadores(client);
        client.on('message', (msg) => handleMessage(msg, userContext, client));
    });
  
    console.log("Iniciando o cliente...");
    client.initialize().catch(err => { console.error("Erro CRÍTICO ao inicializar o cliente:", err); });
}

// O programa principal inicia aqui
if (require.main === module) {
    start();
}