// modulos/adminCommands.js (VERSÃO FINAL E CORRIGIDA)

const config = require('../config.js');
const { getSheetData, getInscritos, appendMultipleToSheet, getMembrosEfetivosInscritos, getMembrosVisitantesInscritos } = require('./googleServices.js');
const { getUptime } = require('./utils.js');
const { lerLeads } = require('./agendador.js');

// Função auxiliar para criar a pausa entre os envios
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleAdminCommand(command, msg, client, userContext) {
    const from = msg.from;

    // LÓGICA DE CONFIRMAÇÃO DE DISPARO
    if (userContext && userContext[from] && userContext[from].awaitingConfirmationForBroadcast) {
        const context = userContext[from];
        
        if (msg.body.toLowerCase() === 'sim') {
            const { members, messageToSend } = context.pendingBroadcast;
            // Mensagem de feedback um pouco mais genérica para funcionar para ambos os grupos
            await msg.reply(`✅ Ok, confirmação recebida.\n\nIniciando o disparo para *${members.length} membros*. Isso pode levar alguns minutos...`);
            
            let successfulSends = 0;
            for (const member of members) {
                try {
                    await client.sendMessage(member.numero, messageToSend);
                    successfulSends++;
                    
                    const randomDelay = 5000 + Math.random() * 5000;
                    await delay(randomDelay);

                } catch (e) {
                    console.error(`[DISPARO] Falha ao enviar para ${member.numero}: ${e.message}`);
                }
            }
            await msg.reply(`🚀 Disparo concluído!\n*${successfulSends} de ${members.length}* mensagens foram enviadas com sucesso.`);
        
        } else {
            await msg.reply("❌ Envio cancelado pelo administrador.");
        }
        
        delete userContext[from];
        return; 
    }

    // Lógica normal dos comandos
    switch (command) {
        case '/status':
            await msg.reply(`🤖 Olá, admin! Estou online e funcionando.\n*Tempo de atividade:* ${getUptime()}.`);
            break;
        
        case '/stats': {
            await msg.reply('📊 Consultando as estatísticas... um momento.');
            const data = await getSheetData();
            if (!data || data.length <= 1) { return await msg.reply("Ainda não há inscritos na planilha."); }
            const inscricoes = data.slice(1);
            let efetivos = 0;
            let naoEfetivos = 0;
            for (const row of inscricoes) {
                if (row[5] && row[5].toLowerCase().trim() === 'sim') { efetivos++; } else { naoEfetivos++; }
            }
            const resposta = `📊 *Estatísticas de Inscrição*\n\n` +
                             `*Total de Inscritos:* ${inscricoes.length}\n` +
                             `--------------------------\n` +
                             `🔵 *Membros Efetivos JCC:* ${efetivos}\n` +
                             `⚪️ *Membros Visitantes:* ${naoEfetivos}`;
            await msg.reply(resposta);
            break;
        }
        
        case '/list': {
            await msg.reply('📄 Gerando a lista de nomes dos inscritos... um momento.');
            const data = await getSheetData();
            if (!data || data.length <= 1) { return await msg.reply("Ainda não há inscritos para listar."); }
            const inscricoes = data.slice(1);
            let efetivos = [];
            let naoEfetivos = [];
            for (const row of inscricoes) {
                const nome = row[1] || 'Nome não preenchido';
                const statusMembro = row[5];
                if (statusMembro && statusMembro.toLowerCase().trim() === 'sim') { efetivos.push(nome); } else { naoEfetivos.push(nome); }
            }
            let resposta = `📋 *Lista de Nomes dos Inscritos*\n\n`;
            resposta += `🔵 *Membros Efetivos JCC (${efetivos.length}):*\n`;
            efetivos.forEach((nome, i) => { resposta += `${i + 1}. ${nome}\n`; });
            resposta += `\n--------------------------\n\n`;
            resposta += `⚪️ *Membros Visitantes (${naoEfetivos.length}):*\n`;
            naoEfetivos.forEach((nome, i) => { resposta += `${i + 1}. ${nome}\n`; });
            if (resposta.length > 4000) { await msg.reply("A lista de nomes é muito longa para ser enviada aqui."); } 
            else { await msg.reply(resposta); }
            break;
        }

        case '/add': {
            const linhas = msg.body.split('\n').slice(1);
            if (linhas.length === 0 || (linhas[0] && linhas[0].trim() === '')) {
                return await msg.reply("❌ Erro: Faltam os dados. Utilize o formato:\n\n/add\nNome,email,telefone,responsável,membro(Sim/Não)");
            }
            const rowsParaAdicionar = [];
            const errosDeFormato = [];
            for (let i = 0; i < linhas.length; i++) {
                const linha = linhas[i];
                if (linha.trim() === '') continue;
                const colunas = linha.split(',').map(c => c.trim());
                if (colunas.length === 5) {
                    const dataParaPlanilha = [ new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), colunas[0], colunas[1], colunas[2], colunas[3], colunas[4] ];
                    rowsParaAdicionar.push(dataParaPlanilha);
                } else {
                    errosDeFormato.push(i + 1);
                }
            }
            if (rowsParaAdicionar.length > 0) {
                await msg.reply(`🔄 A processar ${rowsParaAdicionar.length} inscrições. Aguarde...`);
                const sucesso = await appendMultipleToSheet(rowsParaAdicionar);
                if (sucesso) {
                    await msg.reply(`✅ ${rowsParaAdicionar.length} inscrições foram adicionadas à planilha com sucesso!`);
                } else {
                    await msg.reply(`❌ Ocorreu um erro ao tentar adicionar as inscrições à planilha.`);
                }
            }
            if (errosDeFormato.length > 0) {
                await msg.reply(`⚠️ *Atenção:* As seguintes linhas foram ignoradas por erro de formato: ${errosDeFormato.join(', ')}.`);
            }
            break;
        }

        case '/leads': {
            await msg.reply('📋 Consultando a lista de interessados (leads)...');
            const leads = lerLeads();
            const chavesLeads = Object.keys(leads);
            if (!chavesLeads || chavesLeads.length === 0) {
                return await msg.reply("✅ Nenhum lead pendente encontrado no momento.");
            }
            let resposta = '🤵 Lista de Interessados (Leads):\n\n';
            chavesLeads.forEach((leadId, index) => {
                const lead = leads[leadId];
                const numero = leadId.split('@')[0];
                resposta += `${index + 1}. *Nome:* ${lead.nome} - *Tel:* ${numero}\n`;
            });
            resposta += `\n*Total de Leads:* ${chavesLeads.length}`;
            await msg.reply(resposta);
            break;
        }
        
        case '/disparar_efetivos': {
            const adminMessage = msg.body.substring(command.length).trim();
            if (!adminMessage) {
                return await msg.reply("❌ Erro: Faltou a mensagem a ser enviada.\n\nUse o formato:\n*/disparar_efetivos* _<sua mensagem aqui>_");
            }
            const confirmationInstruction = "\n\n-------------------------\nPor favor, responda a esta mensagem com a palavra *OK* para confirmar a sua leitura.";
            const messageToSend = adminMessage + confirmationInstruction;

            await msg.reply('🔎 Buscando a lista de membros efetivos na planilha...');
            const members = await getMembrosEfetivosInscritos();

            if (!members || members.length === 0) {
                return await msg.reply("Nenhum membro efetivo foi encontrado na lista de inscritos.");
            }
            
            if (!userContext[from]) userContext[from] = {};
            userContext[from].awaitingConfirmationForBroadcast = true;
            userContext[from].pendingBroadcast = { members, messageToSend };
            
            const confirmationMessage = `⚠️ *CONFIRMAÇÃO DE ENVIO*\n\n` +
                                        `Você está prestes a enviar a seguinte mensagem para *${members.length} membros efetivos*:\n\n` +
                                        `-------------------------\n` +
                                        `${messageToSend}\n` +
                                        `-------------------------\n\n` +
                                        `Para confirmar o envio, responda com a palavra *sim*. Para cancelar, responda qualquer outra coisa.`;
            
            await msg.reply(confirmationMessage);
            break;
        }

        case '/disparar_visitantes': {
            const adminMessage = msg.body.substring(command.length).trim();
            if (!adminMessage) {
                return await msg.reply("❌ Erro: Faltou a mensagem a ser enviada.\n\nUse o formato:\n*/disparar_visitantes* _<sua mensagem aqui>_");
            }
            const messageToSend = adminMessage;

            await msg.reply('🔎 Buscando a lista de membros visitantes na planilha...');
            const members = await getMembrosVisitantesInscritos();

            if (!members || members.length === 0) {
                return await msg.reply("Nenhum membro visitante foi encontrado na lista de inscritos.");
            }

            if (!userContext[from]) userContext[from] = {};
            userContext[from].awaitingConfirmationForBroadcast = true;
            userContext[from].pendingBroadcast = { members, messageToSend };

            const confirmationMessage = `⚠️ *CONFIRMAÇÃO DE ENVIO*\n\n` +
                                        `Você está prestes a enviar a seguinte mensagem para *${members.length} membros visitantes*:\n\n` +
                                        `-------------------------\n` +
                                        `${messageToSend}\n` +
                                        `-------------------------\n\n` +
                                        `*Observação: Esta mensagem não solicitará confirmação de leitura.*\n\n` +
                                        `Para confirmar o envio, responda com a palavra *sim*. Para cancelar, responda qualquer outra coisa.`;
            
            await msg.reply(confirmationMessage);
            break;
        }

        case '/ajuda': {
            const ajuda = `🤖 *Painel de Ajuda - Admin*\n\nAqui estão os comandos disponíveis:\n
*/status* - Verifica se o bot está online.
*/stats* - Mostra as estatísticas de inscritos.
*/list* - Lista o nome de todos os inscritos.
*/add* - Adiciona múltiplas inscrições de uma vez.
*/leads* - Lista os interessados que ainda não se inscreveram.
*/disparar_efetivos* <msg> - Envia uma mensagem para todos os membros efetivos.
*/disparar_visitantes* <msg> - Envia uma mensagem para todos os membros visitantes.
*/ajuda* - Mostra esta mensagem de ajuda.`;
            await msg.reply(ajuda);
            break;
        }
        
        default:
            await msg.reply(`Comando de admin "${command}" não reconhecido. Digite */ajuda* para ver a lista de comandos.`);
            break;
    }
}

module.exports = { handleAdminCommand };