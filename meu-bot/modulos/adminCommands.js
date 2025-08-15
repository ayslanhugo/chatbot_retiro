// modulos/adminCommands.js 

const config = require('../config.js');
const { getSheetData, getInscritos, appendMultipleToSheet } = require('./googleServices.js');
const { getUptime } = require('./utils.js');
const { lerLeads } = require('./agendador.js');

async function handleAdminCommand(command, msg, client) {
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
            // 1. Separa a mensagem em linhas, ignorando a primeira linha que contém o comando '/add'.
            const linhas = msg.body.split('\n').slice(1);

            // 2. Verifica se foram enviados dados após o comando. Se não, envia uma mensagem de erro com instruções.
            if (linhas.length === 0 || (linhas[0] && linhas[0].trim() === '')) {
                return await msg.reply("❌ Erro: Faltam os dados. Utilize o formato:\n\n/add\nNome,email,telefone,responsável,membro(Sim/Não)");
            }

            // 3. Inicializa arrays para guardar as linhas válidas e os números das linhas com erro.
            const rowsParaAdicionar = [];
            const errosDeFormato = [];

            // 4. Itera sobre cada linha de dados enviada.
            for (let i = 0; i < linhas.length; i++) {
                const linha = linhas[i];

                // Ignora linhas completamente vazias.
                if (linha.trim() === '') continue;

                // 5. Divide a linha em colunas usando a vírgula como separador e remove espaços em branco.
                const colunas = linha.split(',').map(c => c.trim());

                // 6. Verifica se a linha tem exatamente 5 colunas.
                if (colunas.length === 5) {
                    // 7. Se o formato estiver correto, cria a linha de dados para a planilha.
                    // Adiciona a data e hora atuais no fuso horário da Bahia como a primeira coluna.
                    const dataParaPlanilha = [
                        new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), // Coluna 'Carimbo de data/hora'
                        colunas[0], // Nome
                        colunas[1], // Email
                        colunas[2], // Telefone
                        colunas[3], // Responsável
                        colunas[4]  // Membro (Sim/Não)
                    ];
                    // Adiciona a linha formatada ao array de linhas para adicionar.
                    rowsParaAdicionar.push(dataParaPlanilha);
                } else {
                    // 8. Se o formato estiver incorreto, guarda o número da linha para informar o usuário.
                    errosDeFormato.push(i + 1);
                }
            }

            // 9. Se houver linhas válidas para adicionar, processa-as.
            if (rowsParaAdicionar.length > 0) {
                // Informa ao usuário que o processamento começou.
                await msg.reply(`🔄 Processando ${rowsParaAdicionar.length} inscrições. Aguarde...`);
                
                // Chama a função para adicionar múltiplas linhas na planilha de uma só vez.
                const sucesso = await appendMultipleToSheet(rowsParaAdicionar);
                
                // Informa o resultado da operação.
                if (sucesso) {
                    await msg.reply(`✅ ${rowsParaAdicionar.length} inscrições foram adicionadas à planilha com sucesso!`);
                } else {
                    await msg.reply(`❌ Ocorreu um erro ao tentar adicionar as inscrições à planilha.`);
                }
            }

            // 10. Se houver linhas com erro de formato, informa o usuário.
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
        
        case '/ajuda': {
            const ajuda = `🤖 *Painel de Ajuda - Admin*\n\nAqui estão os comandos disponíveis:\n
*/status* - Verifica se o bot está online.
*/stats* - Mostra as estatísticas de inscritos.
*/list* - Lista o nome de todos os inscritos.
*/add* - Adiciona múltiplas inscrições de uma vez.
*/leads* - Lista os interessados que ainda não se inscreveram.
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