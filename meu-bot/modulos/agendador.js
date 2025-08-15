// modulos/agendador.js

const fs = require('fs');
const moment = require('moment-timezone');
const config = require('../config.js');

// --- Funções de Leitura e Escrita de Estado (continuam iguais) ---

function lerEstadoLembretes() {
    try {
        if (fs.existsSync('./estado_lembretes.json')) {
            const data = fs.readFileSync('./estado_lembretes.json', 'utf-8');
            return data.trim() ? JSON.parse(data) : {};
        }
    } catch (error) { console.error('Erro ao ler o estado dos lembretes:', error); }
    return {};
}

function salvarEstadoLembretes(estado) {
    try {
        fs.writeFileSync('./estado_lembretes.json', JSON.stringify(estado, null, 2));
    } catch (error) { console.error('Erro ao salvar o estado dos lembretes:', error); }
}

// --- Função Principal que Inicia o Agendador ---

function iniciarAgendadores(client) {
    
    console.log('[AGENDADOR] Iniciando agendador de lembrete diário com contagem regressiva.');

    // --- CONFIGURAÇÕES ---
    const HORA_DE_ENVIO_DIARIO = 10;
    const intervaloDeVerificacao = 1000 * 60 * 5;

    // --- LISTA DE MENSAGENS (agora são funções) ---
    const mensagensDiarias = [
        (dias) => `A contagem decrescente oficial começou! ⏳\n\nFaltam apenas *${dias} dias* para o nosso Retiro. Não fique de fora da experiência que pode marcar o seu ano.`,
        (dias) => `Em apenas *${dias} dias*, estaremos juntos para um fim de semana de renovação e fé. ✨\n\nSentindo o chamado? As inscrições estão abertas!`,
        (dias) => `Faltam *${dias} dias*!\n\nMais que um evento, o Retiro é uma fábrica de amizades verdadeiras! 💛 Venha construir laços que vão muito além de um fim de semana.`,
        (dias) => `Ei, você! Faltam só *${dias} dias* para o melhor fim de semana do ano. 🤔\n\nÉ essa a promessa do nosso Retiro: uma imersão de fé, alegria e comunidade. Topa o desafio?`,
        (dias) => `Estamos na reta final! Faltam *${dias} dias* e a nossa expectativa está a mil! 🤩\n\nA sua vaga ainda está à sua espera. Bora?`,
        (dias) => `Em *${dias} dias*, teremos a oportunidade de desligar o barulho do mundo lá fora e ouvir a voz de Deus no silêncio do coração. 🌿 Permita-se viver isso.`,
        (dias) => `Você tem *${dias} dias* para dar o 'sim' que pode abrir portas para algo incrível na sua vida. 🤗\n\nO Retiro JCC espera por você sem medo e com muito amor!`,
        (dias) => `*${dias} dias* para um 'antes e depois'. 🚀\n\nO encontro com o amor de Deus tem o poder de transformar tudo. Este não é apenas mais um retiro, é um ponto de partida.`,
    ];

    setInterval(() => {
        const dataAtual = moment().tz("America/Bahia");
        const dataRetiro = moment(config.DATA_RETIRO, 'YYYY-MM-DD');
        
        // Se a data do retiro já passou, não faz mais nada.
        if (dataAtual.isAfter(dataRetiro, 'day')) {
            return;
        }

        const chaveLembreteHoje = `lembrete_diario_${dataAtual.format('YYYY-MM-DD')}`;
        const estado = lerEstadoLembretes();
        
        if (dataAtual.hour() === HORA_DE_ENVIO_DIARIO && !estado[chaveLembreteHoje]) {
            
            console.log(`[AGENDADOR] Hora de enviar o lembrete diário com contagem regressiva.`);
            
            // Calcula os dias restantes
const diasRestantes = dataRetiro.startOf('day').diff(dataAtual.startOf('day'), 'days');
            let mensagemFinal;

            // --- LÓGICA ESPECIAL PARA OS ÚLTIMOS DIAS ---
            if (diasRestantes === 0) {
                mensagemFinal = "É HOJE! 🙌 O grande dia chegou!\n\nQue a sua viagem até aqui seja abençoada. Estamos à sua espera de braços abertos!";
            } else if (diasRestantes === 1) {
                mensagemFinal = "É AMANHÃ! 😱 A ansiedade está a mil!\n\nPrepare o seu coração e a sua mala para o nosso encontro. Mal podemos esperar para ver você!";
            } else if (diasRestantes > 1) {
                // Sorteia uma função da lista de mensagens
                const funcaoMensagemAleatoria = mensagensDiarias[Math.floor(Math.random() * mensagensDiarias.length)];
                // Executa a função, passando os dias restantes para criar a mensagem
                mensagemFinal = funcaoMensagemAleatoria(diasRestantes);
            } else {
                // Se diasRestantes for negativo, não faz nada
                return;
            }

            if (!config.GRUPOS_DIVULGACAO_IDS || config.GRUPOS_DIVULGACAO_IDS.length === 0) {
                return;
            }
            
            for (const grupoId of config.GRUPOS_DIVULGACAO_IDS) {
                client.sendMessage(grupoId, mensagemFinal)
                    .catch(err => console.error(`- Falha ao enviar para o grupo ${grupoId}:`, err));
            }

            estado[chaveLembreteHoje] = true;
            salvarEstadoLembretes(estado);
        }
    }, intervaloDeVerificacao);
}

module.exports = { 
    iniciarAgendadores
};