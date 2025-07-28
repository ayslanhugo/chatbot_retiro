// modulos/agendador.js (Versão Corrigida)

const fs = require('fs');
const moment = require('moment');
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

// --- Função Principal que Inicia os Agendadores ---
function iniciarAgendadores(client) {
    
    // 1. AGENDADOR DE DIVULGAÇÃO EM GRUPO
    console.log('[AGENDADOR] Iniciando agendador de mensagens de divulgação.');
    const mensagensGerais = [
        "Paz e bem! 🙏 \nJá imaginou um final de semana para renovar a fé, fazer amigos e viver algo que só Deus pode proporcionar? Esse é o nosso Retiro Kerigmático! As inscrições estão abertas. Fale comigo no privado para saber como participar!",
        "Ei, você! \nSentindo o chamado para algo novo? ✨ O Retiro Kerigmático do JCC foi pensado para você. Um tempo de pausa, oração e encontro. Venha viver essa alegria com a gente!",
        "🎶 Muita música, louvor, adoração, partilhas e amizades para a vida toda!\nO Retiro Kerigmático do JCC está chegando e as vagas já estão sendo preenchidas. Garanta a sua e venha fazer parte desta família!",
        `O retiro acontece nos dias 22, 23 e 24 de agosto! Já marcou na sua agenda?\n A inscrição custa apenas R$${config.VALOR_INSCRICAO} e você pode pagar por PIX. Mais informações? É só me perguntar!`,
        "Às vezes, tudo o que precisamos é de uma pausa para ouvir a voz de Deus.\n✝️ O Retiro JCC é essa oportunidade de se reconectar e transformar a sua vida. As inscrições estão abertas!",
        "Procurando um lugar para fazer amigos que partilham da mesma fé? 😊\nO nosso retiro é sobre isso: comunidade, partilha e muita alegria. Não venha só, traga um amigo! Chame no privado para mais detalhes.",
        "Está pensando 'será que este retiro é para mim?'\nA resposta é SIM! Se você tem um coração aberto, Deus tem algo para ti. Dê o primeiro passo, a sua vaga está à sua espera. Inscrições abertas!",
        "Prepare-se para um fim de semana com pregações que tocam a alma, momentos de oração profunda e louvores que nos elevam. 🔥\nO Retiro Kerigmático é uma experiência completa. Já se inscreveu?"
    ];
    const mensagensDeUrgencia = [
        "⚠️ ATENÇÃO! O tempo está voando e as vagas para o nosso retiro estão diminuindo! Não deixe para a última hora. O prazo para se inscrever é até 18 de agosto. Garanta já o seu lugar!",
        "Contagem regressiva para o fim das inscrições!\n 🔥 Você não vai querer correr o risco de ficar de fora, não é? O seu 'sim' pode transformar o seu final de semana. #VagasLimitadas #RetiroJCC",
    ];
    const mensagensDeAquecimento = [
        "É ESSA SEMANA!\n😱 É isso mesmo! Daqui a poucos dias estaremos juntos para viver o nosso tão esperado retiro. Já começou a arrumar a mala e o coração?",
        "Apenas alguns dias nos separam de uma experiência que vai marcar a sua vida.\nA equipe está em oração por cada um de vocês. Que venha o Retiro Kerigmático! 🙌",
    ];
    
    const HORAS_DE_ENVIO = [7, 13, 20, 3];
    let ultimaHoraDeEnvio = -1;
    const intervaloDeVerificacao = 1000 * 60 * 5;

    setInterval(() => {
        const dataAtual = moment();
        const horaAtual = dataAtual.hour();
        if (HORAS_DE_ENVIO.includes(horaAtual) && horaAtual !== ultimaHoraDeEnvio) {
            ultimaHoraDeEnvio = horaAtual;
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
                // A arte agora será enviada no primeiro horário do dia: 7h da manhã
                if (horaAtual === 7) {
                    console.log(`[AGENDADOR] Enviando ARTE para o grupo ${grupoId}`);
                    try {
                        const media = MessageMedia.fromFilePath('./arte-retiro.png');
                        client.sendMessage(grupoId, media, { caption: mensagemAleatoria });
                    } catch (e) { client.sendMessage(grupoId, mensagemAleatoria); }
                } else {
                    console.log(`[AGENDADOR] Enviando TEXTO para o grupo ${grupoId}`);
                    client.sendMessage(grupoId, mensagemAleatoria);
                }
            }
        }
    }, intervaloDeVerificacao);

    // 2. AGENDADOR DE LEMBRETES PARA INSCRITOS
    const intervaloLembretes = 1000 * 60 * 60 * 4;
    setInterval(async () => {
        console.log('[LEMBRETES] Verificando se há lembretes para enviar...');
        const mensagens = {
            lembrete_7_dias: (nome) => `Paz e bem, ${nome}! 🙏 Falta exatamente 1 SEMANA para o nosso retiro!`,
            lembrete_3_dias: (nome) => `Olá, ${nome}! 🔥 Faltam apenas 3 DIAS para o nosso encontro.`,
            lembrete_1_dia: (nome) => `É AMANHÃ, ${nome}! 😱 Que alegria! Estamos nos últimos preparativos.`,
            lembrete_dia_0: (nome) => `É HOJE, ${nome}! 🙌 Chegou o grande dia!`
        };
        const hoje = moment();
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
                    const mensagem = mensagens[chaveDoLembrete](inscrito.nome);
                    await client.sendMessage(inscrito.numero, mensagem);
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
                } catch (err) { console.error(`- Falha ao enviar lembrete para ${inscrito.numero}: ${err.message}`); }
            }
            estado[chaveDoLembrete] = true;
            salvarEstadoLembretes(estado);
            console.log(`[LEMBRETES] Finalizado o envio de '${chaveDoLembrete}'. Estado salvo.`);
        }
    }, intervaloLembretes);
}

module.exports = { iniciarAgendadores };