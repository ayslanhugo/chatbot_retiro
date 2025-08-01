// modulos/agendador.js (Versão Final com Lembretes do Grupo de Oração)

const fs = require('fs');
const moment = require('moment-timezone');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config.js');
const { getInscritos } = require('./googleServices.js');

// --- Funções de Controlo de Estado ---
function lerEstadoLembretes() {
    try {
        if (fs.existsSync('./estado_lembretes.json')) {
            const data = fs.readFileSync('./estado_lembretes.json');
            return JSON.parse(data);
        }
    } catch (error) { console.error('Erro ao ler o estado dos lembretes:', error); }
    return {};
}

function salvarEstadoLembretes(estado) {
    try {
        fs.writeFileSync('./estado_lembretes.json', JSON.stringify(estado, null, 2));
    } catch (error) { console.error('Erro ao salvar o estado dos lembretes:', error); }
}

function lerLeads() {
    try {
        if (fs.existsSync('./leads.json')) {
            const data = fs.readFileSync('./leads.json');
            return JSON.parse(data);
        }
    } catch (error) { console.error('Erro ao ler o arquivo de leads:', error); }
    return {};
}

function salvarLeads(leads) {
    try {
        fs.writeFileSync('./leads.json', JSON.stringify(leads, null, 2));
    } catch (error) { console.error('Erro ao salvar o arquivo de leads:', error); }
}

// --- Função Principal que Inicia os Agendadores ---
function iniciarAgendadores(client) {
    
    // 1. AGENDADOR DE DIVULGAÇÃO EM GRUPO
    console.log('[AGENDADOR] Iniciando agendador de mensagens de divulgação.');
const mensagensGerais = [
    // --- MENSAGENS APRIMORADAS COM QUEBRAS DE LINHA ---
    "Paz e bem! 🙏\nJá pensou em um fim de semana para renovar sua fé, fazer amizades incríveis e viver algo transformador com Deus? 💛\nEsse é o nosso *Retiro Kerigmático*!\nInscrições abertas — fale comigo no privado e descubra como participar.",

    "Sente que Deus está te chamando para algo novo? ✨\nO *Retiro Kerigmático do JCC* é esse lugar de pausa, reencontro e renovação.\nVocê não está aqui por acaso… vem com a gente viver essa experiência única!",

    "🎶 Louvor, oração, amizade e momentos que marcam para sempre!\nNosso retiro está chegando, e as vagas estão voando!\nGaranta já a sua e venha viver um fim de semana com Deus como você nunca viveu.",

    `🗓 Já marcou aí?\nO Retiro será nos dias 22, 23 e 24 de agosto!\nO investimento é de apenas R$${config.VALOR_INSCRICAO} e o pagamento pode ser feito via PIX.\nQuer saber mais? Só me chamar!`,

    "✝️ Às vezes, tudo o que a alma precisa é de silêncio e presença.\nO *Retiro Kerigmático do JCC* é esse respiro — um encontro profundo com Deus.\nInscrições abertas. Venha dar esse passo!",

    "👥 Quer conhecer pessoas que compartilham da mesma fé?\nO retiro é lugar de partilha, comunhão e amizade verdadeira.\nChama um amigo e venham juntos viver essa alegria!",

    "🤔 \"Será que esse retiro é para mim?\"\nSim, é pra você que quer algo novo, verdadeiro e profundo com Deus.\nSeja qual for sua caminhada, sua vaga está aqui.\nDê o primeiro passo!",

    "🔥 Pregações que tocam, orações que renovam e louvores que nos elevam!\nO *Retiro Kerigmático* é uma vivência completa de fé.\nVocê não vai sair o mesmo.\nJá fez sua inscrição?",

    "⏸️ Na correria da vida, que tal apertar o “pause”?\nO *Retiro JCC* é esse tempo de respiro, silêncio e reconexão.\nDê espaço para o que realmente importa.\nEstamos te esperando!",

    "❤️‍🔥 Você já ouviu falar do *Kerigma*?\nÉ o primeiro e mais poderoso anúncio do amor de Deus.\nNosso retiro é centrado nessa verdade que transforma vidas.\nQuer experimentar?\nAs inscrições estão abertas!",

    "🌿 Está procurando paz, respostas ou um novo recomeço?\nTalvez o que você procura esteja nesse final de semana com Deus.\nO *Retiro Kerigmático* é um convite ao encontro.\nTopa?",

    "❄️ A gente sabe: dar o primeiro passo dá medo.\nMas prometemos que você será acolhido com carinho e alegria.\nDê esse \"sim\" e deixe Deus surpreender você. 🤗",

    "⚡️ Um retiro feito por jovens e para jovens!\nCheio de energia, verdade e fé vivida de forma autêntica.\nSe é isso que você busca, o seu lugar é com a gente.\nBora?",

    "💸 Não é um gasto. É um investimento na sua vida com Deus.\nUm fim de semana que pode transformar seu coração e renovar seus dias.\nE o melhor? Com valor acessível.\nVamos juntos?"
];


    const mensagensDeUrgencia = [
        "⚠️ ATENÇÃO! O tempo está voando e as vagas para o nosso retiro estão diminuindo! Não deixe para a última hora. O prazo para se inscrever é até 18 de agosto. Garanta já o seu lugar!",
        "Contagem regressiva para o fim das inscrições!\n 🔥 Você não vai querer correr o risco de ficar de fora, não é? O seu 'sim' pode transformar o seu final de semana. #VagasLimitadas #RetiroJCC",
    ];
    const mensagensDeAquecimento = [
        "É ESSA SEMANA!\n😱 É isso mesmo! Daqui a poucos dias estaremos juntos para viver o nosso tão esperado retiro. Já começou a arrumar a mala e o coração?",
        "Apenas alguns dias nos separam de uma experiência que vai marcar a sua vida.\nA equipe está em oração por cada um de vocês. Que venha o Retiro Kerigmático! 🙌",
    ];
// A NOVA VERSÃO CORRIGIDA

    const HORAS_DE_ENVIO = [9, 13, 20, 3]; // Horários que você ajustou
    const intervaloDeVerificacao = 1000 * 60 * 1;

    setInterval(() => {
        const dataAtual = moment().tz("America/Bahia");
        const horaAtual = dataAtual.hour();

        const estado = lerEstadoLembretes();
        // Removemos a declaração duplicada daqui e usamos a do arquivo de estado
        const ultimaHoraDeEnvio = estado.ultima_hora_grupo || -1; 

        if (HORAS_DE_ENVIO.includes(horaAtual) && horaAtual !== ultimaHoraDeEnvio) {
            
            console.log(`[AGENDADOR] Hora de envio (${horaAtual}h) detectada! Preparando mensagem.`);
            
            const dataLimiteInscricao = moment(config.DATA_LIMITE_INSCRICAO, 'YYYY-MM-DD');
            const dataRetiro = moment(config.DATA_RETIRO, 'YYYY-MM-DD');
            let listaDeMensagensParaUsar = [];
            if (dataAtual.isAfter(dataRetiro)) { return; }
            if (dataAtual.isAfter(dataLimiteInscricao)) {
                listaDeMensagensParaUsar = mensagensDeAquecimento;
            } else if (dataLimiteInscricao.diff(dataAtual, 'days') <= 7) {
                listaDeMensagensParaUsar = mensagensDeUrgencia;
            } else {
                listaDeMensagensParaUsar = mensagensGerais;
            }
            if (listaDeMensagensParaUsar.length === 0) { return; }
            const mensagemAleatoria = listaDeMensagensParaUsar[Math.floor(Math.random() * listaDeMensagensParaUsar.length)];
            if (!config.GRUPOS_DIVULGACAO_IDS || config.GRUPOS_DIVULGACAO_IDS.length === 0) { return; }
            
            for (const grupoId of config.GRUPOS_DIVULGACAO_IDS) {
                // Ajustado para o novo horário de envio da arte (9h)
                if (horaAtual === 9) {
                    try {
                        const media = MessageMedia.fromFilePath('./arte-retiro.jpeg');
                        client.sendMessage(grupoId, media, { caption: mensagemAleatoria });
                    } catch (e) { client.sendMessage(grupoId, mensagemAleatoria); }
                } else {
                    client.sendMessage(grupoId, mensagemAleatoria);
                }
            }

            // APÓS ENVIAR, ATUALIZA O ARQUIVO DE ESTADO
            console.log(`[AGENDADOR] Mensagem enviada às ${horaAtual}h. Atualizando estado permanente.`);
            estado.ultima_hora_grupo = horaAtual;
            salvarEstadoLembretes(estado);
        }
    }, intervaloDeVerificacao);
    
    // 2. AGENDADOR DE LEMBRETES PARA INSCRITOS
    const intervaloLembretes = 1000 * 60 * 60 * 4;
    setInterval(async () => {
        const hoje = moment().tz("America/Bahia");
        const dataRetiro = moment(config.DATA_RETIRO, 'YYYY-MM-DD');
        const diasRestantes = dataRetiro.diff(hoje, 'days');
        let chaveDoLembrete = null;
        switch (diasRestantes) {
            case 7: chaveDoLembrete = 'lembrete_7_dias'; break;
            case 3: chaveDoLembrete = 'lembrete_3_dias'; break;
            case 1: chaveDoLembrete = 'lembrete_1_dia'; break;
            case 0: chaveDoLembrete = 'lembrete_dia_0'; break;
        }
        if (!chaveDoLembrete) { return; }
        const estado = lerEstadoLembretes();
        if (estado[chaveDoLembrete]) { return; }
        console.log(`[LEMBRETES] INICIANDO ENVIO para '${chaveDoLembrete}'!`);
        const inscritos = await getInscritos();
        if (inscritos && inscritos.length > 0) {
            for (const inscrito of inscritos) {
                try {
                    const mensagem = {
                        lembrete_7_dias: (nome) => `Paz e bem, ${nome}! 🙏 Falta exatamente 1 SEMANA para o nosso retiro!`,
                        lembrete_3_dias: (nome) => `Olá, ${nome}! 🔥 Faltam apenas 3 DIAS para o nosso encontro.`,
                        lembrete_1_dia: (nome) => `É AMANHÃ, ${nome}! 😱 Que alegria! Estamos nos últimos preparativos.`,
                        lembrete_dia_0: (nome) => `É HOJE, ${nome}! 🙌 Chegou o grande dia!`
                    }[chaveDoLembrete](inscrito.nome);
                    await client.sendMessage(inscrito.numero, mensagem);
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
                } catch (err) { console.error(`- Falha ao enviar lembrete para ${inscrito.numero}: ${err.message}`); }
            }
            estado[chaveDoLembrete] = true;
            salvarEstadoLembretes(estado);
            console.log(`[LEMBRETES] Finalizado o envio de '${chaveDoLembrete}'. Estado salvo.`);
        }
    }, intervaloLembretes);

    // 3. AGENDADOR DE REPESCAGEM (FOLLOW-UP) DE LEADS
    const intervaloLancamento = 1000 * 60 * 60 * 2;
    const HORAS_LIMITE_FOLLOWUP = 48;
    const mensagemDeFollowUp = (nome) => `Olá, ${nome}! Paz e bem! 🙏 Vi que você demonstrou interesse no nosso Retiro JCC há uns dias. Só estou a passar para saber se ficou com alguma dúvida ou se precisa de ajuda para finalizar a sua inscrição. As vagas são limitadas e gostaríamos muito de ter você connosco! ✨ Se precisar de algo, é só responder a esta mensagem.`;
    setInterval(async () => {
        const agora = moment().tz("America/Bahia");
        const leads = lerLeads();
        let leadsAtualizado = false;
        const inscritos = await getInscritos();
        if (!inscritos) { return; }
        const numerosInscritos = new Set(inscritos.map(i => i.numero));
        for (const leadId of Object.keys(leads)) {
            const lead = leads[leadId];
            if (numerosInscritos.has(leadId)) {
                delete leads[leadId];
                leadsAtualizado = true;
                continue;
            }
            if (!lead.followUpSent) {
                const ultimaInteracao = moment(lead.lastInteraction);
                const horasDesdeInteracao = agora.diff(ultimaInteracao, 'hours');
                if (horasDesdeInteracao >= HORAS_LIMITE_FOLLOWUP) {
                    try {
                        const mensagem = mensagemDeFollowUp(lead.nome);
                        await client.sendMessage(leadId, mensagem);
                        lead.followUpSent = true;
                        leadsAtualizado = true;
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 3000));
                    } catch (err) { console.error(`- Falha ao enviar follow-up para ${lead.nome}: ${err.message}`); }
                }
            }
        }
        if (leadsAtualizado) {
            salvarLeads(leads);
        }
    }, intervaloLancamento);

    // =============================================================
    //      4. NOVO: AGENDADOR DE LEMBRETE DO GRUPO DE ORAÇÃO
    // =============================================================
    const intervaloGrupoOracao = 1000 * 60 * 60; // Verifica a cada hora
    setInterval(() => {
        const agora = moment().tz("America/Bahia");
        const diaDaSemana = agora.day();
        const horaAtual = agora.hour();
        if (!((diaDaSemana === 0 && horaAtual >= 9) || (diaDaSemana === 1 && horaAtual < 18))) {
            return;
        }
        const dataRetiro = moment(config.DATA_RETIRO, 'YYYY-MM-DD');
        const segundasDoTriduo = [
            dataRetiro.clone().subtract(1, 'weeks').startOf('isoWeek'),
            dataRetiro.clone().subtract(2, 'weeks').startOf('isoWeek'),
            dataRetiro.clone().subtract(3, 'weeks').startOf('isoWeek')
        ];
        const hojeEhSemanaDeTriduo = segundasDoTriduo.some(d => d.isSame(agora.clone().startOf('isoWeek')));
        let mensagem;
        let chaveLembrete = `lembrete_grupo_${agora.format('YYYY-MM-DD')}`;
        if (diaDaSemana === 0) {
            if (hojeEhSemanaDeTriduo) {
                mensagem = "Paz e bem, pessoal! 🙏 Passando para lembrar que AMANHÃ, segunda-feira, temos um encontro muito especial: a nossa noite do Tríduo de preparação para o Retiro Kerigmático! 🔥 Não falte, vai ser uma bênção. Às 19h30, no salão da paz!";
            } else {
                mensagem = "Paz e bem, pessoal! 🙏 Lembrança especial: AMANHÃ é dia do nosso Grupo de Oração JCC! Uma semana abençoada começa com Jesus. Esperamos por vocês às 19h30 no salão da paz!";
            }
        } else if (diaDaSemana === 1) {
            if (hojeEhSemanaDeTriduo) {
                mensagem = "É HOJE! 🔥 Nossa noite do Tríduo de preparação para o Retiro Kerigmático é hoje à noite! Venha com o coração aberto para receber tudo o que Deus preparou. Nos vemos às 19h30 no salão da paz!";
            } else {
                mensagem = "É HOJE! 🙌 O dia mais esperado da semana chegou! Nosso Grupo de Oração JCC acontece hoje à noite, às 19h30. Chame um amigo e venha rezar connosco!";
            }
        }
        if (!mensagem) { return; }
        const estado = lerEstadoLembretes();
        if (estado[chaveLembrete]) {
            return;
        }
        console.log(`[GRUPO DE ORAÇÃO] Enviando lembrete: ${chaveLembrete}`);
        if (config.GRUPOS_DIVULGACAO_IDS && config.GRUPOS_DIVULGACAO_IDS.length > 0) {
            for (const grupoId of config.GRUPOS_DIVULGACAO_IDS) {
                client.sendMessage(grupoId, mensagem);
            }
            estado[chaveLembrete] = true;
            salvarEstadoLembretes(estado);
        }
    }, intervaloGrupoOracao);
}

module.exports = { 
    iniciarAgendadores,
    lerLeads,
    salvarLeads
};