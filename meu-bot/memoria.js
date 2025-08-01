// memoria.js 

const moment = require('moment');
const config = require('./config.js');


// ESTRUTURA DO MENU PRINCIPAL

const MENU_PRINCIPAL = [
    { numero: 1, secao: 'INFORMAÇÕES ESSENCIAIS', emoji: '🗓️', titulo: 'Data e Horário', id_intent: 'consultar_data' },
    { numero: 2, secao: 'INFORMAÇÕES ESSENCIAIS', emoji: '📍', titulo: 'Local do Retiro', id_intent: 'consultar_local' },
    { numero: 3, secao: 'INFORMAÇÕES ESSENCIAIS', emoji: '💰', titulo: 'Valor e forma de pagamento', id_intent: 'consultar_valor' },
    { numero: 4, secao: 'INFORMAÇÕES ESSENCIAIS', emoji: '📝', titulo: 'Como fazer a inscrição', id_intent: 'fazer_inscricao' },
    
    { numero: 5, secao: 'VIDA NO RETIRO', emoji: '🎒', titulo: 'O que levar para o retiro', id_intent: 'levar' },
    { numero: 6, secao: 'VIDA NO RETIRO', emoji: '🍔', titulo: 'Alimentação no retiro', id_intent: 'comida_bebida' },
    { numero: 7, secao: 'VIDA NO RETIRO', emoji: '🎉', titulo: 'Atividades e programação', id_intent: 'saber_atividades' },
    { numero: 8, secao: 'VIDA NO RETIRO', emoji: '📜', titulo: 'O que é roupa modesta?', id_intent: 'roupa_modesta' },

    { numero: 9, secao: 'SOBRE E CONTATO', emoji: '❓', titulo: 'O que é o Retiro?', id_intent: 'sobre_retiro' },
    { numero: 10, secao: 'SOBRE E CONTATO', emoji: '⏳', titulo: 'Quanto tempo falta?', id_intent: 'contagem' },
    { numero: 11, secao: 'SOBRE E CONTATO', emoji: '💬', titulo: 'Falar com um organizador', id_intent: 'falar_humano' },
    { numero: 12, secao: 'SOBRE E CONTATO', emoji: '🔗', titulo: 'Entrar no grupo do WhatsApp', id_intent: 'grupo_whatsapp' },
];

// Função que constrói a string do menu com seções e formatação
const construirTextoMenu = () => {
    let textoMenu = 'Como posso te ajudar hoje? 😊\n';
    textoMenu += '_Por favor, digite o número da opção desejada:_\n\n';

    let secaoAtual = '';
    MENU_PRINCIPAL.forEach(item => {
        // Se a seção do item atual for diferente da anterior, imprime o novo título de seção
        if (item.secao !== secaoAtual) {
            textoMenu += `*${item.secao}*\n`;
            secaoAtual = item.secao;
        }
        textoMenu += `${item.emoji} *${item.numero}* - ${item.titulo}\n`;
    });
    
    return textoMenu;
};


const memoria = [

    // TÓPICOS DE ALTA PRIORIDADE

    {
        id: 'inclusividade_lgbt',
        chaves: ['homossexual', 'homosexual', 'gay', 'lgbt', 'lgbtqia', 'lésbica', 'lesbica', 'trans', 'não-binário', 'nao-binario'],
        resposta: "Você é muito bem-vindo(a) ao nosso retiro! Aqui acreditamos no amor e na acolhida. Nosso maior desejo é que cada pessoa viva uma experiência real com Deus, do jeitinho que é. 💛🙏"
    },
    {
        id: 'inclusividade_religiao',
        chaves: ['igreja', 'evangélico', 'evangelico', 'outra religião', 'sou de outra igreja', 'não sou católico', 'nao sou catolico', 'espírita', 'espirita'],
        resposta: "Claro que sim! O retiro é para todos os jovens que desejam viver uma experiência com Deus, independentemente da igreja ou religião. Você será acolhido(a) com todo amor! 🙌❤️"
    },
    {
        id: 'menor_idade',
        chaves: ['filho', 'filha', 'menor', 'autorização', 'autorizacao', 'responsável', 'responsavel'],
        resposta: (nome) => `Oi, ${nome}! Que bênção que o(a) jovem que você representa quer participar! 🙌\n\nPara garantir a segurança e o consentimento de todos, a regra é que *menores de 18 anos façam a inscrição presencialmente*, junto com o pai, mãe ou responsável legal.\n\n📍 **Onde?** No nosso grupo de oração, toda segunda-feira, às 19h30, no salão da Paróquia São Francisco.\n\n*Exceções são possíveis?*\nEm casos muito específicos onde a presença do responsável é impossível, a situação deve ser *previamente conversada com a organização*. Para tratar de uma exceção, por favor, *fale com um humano*.`
    },
    {
        id: 'roupa_modesta',
        chaves: ['roupa modesta', 'modesta', 'vestimenta', 'vestir', 'decote', 'curto', 'modestia'],
        resposta: `Ótima pergunta! A modéstia no vestir, para nós, não é sobre regras rígidas, mas sobre o respeito ao ambiente sagrado e a todos os participantes, ajudando a manter o foco na experiência com Deus. ❤️\n\nA ideia é usar roupas confortáveis que não marquem o corpo, não sejam transparentes e evitem decotes profundos ou comprimentos muito curtos.\n\nPara te ajudar a ter uma ideia:\n🙋‍♀️ *Para as mulheres:* T-shirts ou blusas sem decotes exagerados, calças confortáveis, saias ou vestidos com comprimento abaixo do joelho são ótimas opções.\n🙋‍♂️ *Para os homens:* Camisetas, camisas polo, calças e bermudas (na altura do joelho) são perfeitas.\n\nSe tiver dúvidas sobre o uso de celular ou outras regras, pode perguntar também!\n\nO mais importante é sentir-se bem e à vontade para viver tudo que Deus preparou para nós! 🙏`
    },
    {
        id: 'comida_bebida',
        chaves: ['comida', 'levar comida', 'lanche', 'bebida', 'posso levar comida', 'fome', 'alimentação', 'refeição', 'refeicao'],
        resposta: "Ótima pergunta! Todas as refeições principais (café da manhã, almoço e jantar) e lanches já estão inclusos e serão preparados com muito carinho pela nossa equipe. ❤️ Você não precisa se preocupar em levar comida.\n\nNo entanto, se você tiver alguma restrição alimentar específica ou quiser trazer um snack de sua preferência (como um chocolate ou biscoito), sinta-se à vontade!"
    },
    {
        id: 'colchonete',
        chaves: ['colchonete', 'colchão', 'levar colchonete', 'precisa de colchonete', 'tem colchão'],
        resposta: "Sim, é preciso levar! Para garantir o seu conforto durante a noite, pedimos que cada participante providencie o seu próprio colchonete ou um item similar para dormir. Não se esqueça também da roupa de cama! 😉"
    },

    {
        id: 'prazo_inscricao',
        chaves: ['prazo', 'data limite', 'até quando', 'último dia', 'ultimo dia', 'encerra', 'acaba', 'termina a inscrição', 'até que dia'],
        funcaoResposta: () => {
            const hoje = moment().startOf('day');
            // Usamos a nova variável do config.js
            const dataLimite = moment(config.DATA_LIMITE_INSCRICAO, 'YYYY-MM-DD');
            const dataFormatada = dataLimite.format('DD/MM/YYYY');
            
            if (hoje.isAfter(dataLimite)) {
                // Se a data de hoje já passou da data limite
                return `O prazo para as inscrições online encerrou no dia ${dataFormatada}. 😕\n\nMas não desanime! Recomendamos que você entre em contato com um organizador para verificar se ainda há vagas remanescentes. Para isso, digite "falar com um organizador".`;
            } else {
                // Se ainda estamos dentro do prazo
                const diasRestantes = dataLimite.diff(hoje, 'days');
                if (diasRestantes === 0) {
                    return `É HOJE! 😱 As inscrições encerram-se hoje, dia ${dataFormatada}. Corra para não perder a sua vaga!`;
                }
                if (diasRestantes === 1) {
                    return `Atenção! O prazo para se inscrever termina AMANHÃ, dia ${dataFormatada}. Garanta já a sua vaga! 🔥`;
                }
                return `As inscrições vão até o dia ${dataFormatada} (${diasRestantes} dias restantes).\n\nNão deixe para a última hora, pois as vagas são limitadas! 😉`;
            }
        }
    },

    {
        id: 'fazer_inscricao',
        chaves: ['ficha', 'pdf', 'formulario', 'inscrever', 'inscrição', 'participar', 'como faz', 'entrar', 'quero ir'],
            resposta: (nome) => `Que alegria saber do seu interesse, ${nome}! 😊\n\n⚠️ *ATENÇÃO: Se o participante for menor de 18 anos, a inscrição deve ser feita obrigatoriamente de forma PRESENCIAL, acompanhado(a) de um responsável.*\n\nEntendido isso, como você prefere continuar?\n\n1️⃣ *Online (Apenas para maiores de 18 anos)*\nEu envio-lhe a ficha, você preenche, paga por PIX e envia-me o comprovante.\n\n2️⃣ *Presencialmente*\nVocê pode ir ao nosso grupo de oração e fazer a sua inscrição diretamente com a nossa equipe.\n\n3️⃣ *Cancelar*\nVoltar ao menu anterior.\n\nDigite *1* para Online, *2* para Presencial ou *3* para Cancelar.`

        },

    {
        id: 'contagem',
        chaves: ['quanto falta', 'contagem', 'faltam quantos dias'],
        funcaoResposta: () => {
            const hoje = moment().startOf('day');
            const dataRetiro = moment(config.DATA_RETIRO, 'YYYY-MM-DD');
            const diasFaltantes = dataRetiro.diff(hoje, 'days');
            if (diasFaltantes > 1) return `Faltam apenas ${diasFaltantes} dias para o nosso retiro! Que a contagem já comece com muita expectativa e oração! 🔥`;
            if (diasFaltantes === 1) return "Falta só 1 dia! 😱 Já separou a mala? Amanhã começa nossa grande aventura com Deus!";
            if (diasFaltantes === 0) return "É HOJE! Chegou o dia tão esperado! Estamos prontos para viver algo lindo com você. 🙌";
            return "O retiro já passou — e que bênção que foi! Em breve teremos mais momentos lindos como esse. 💛";
        }
    },
    {
        id: 'inscricao_presencial',
        chaves: [],
        resposta: "Perfeito! Você pode se inscrever presencialmente no nosso grupo de oração, que acontece toda segunda-feira, a partir das 19h30, no salão da Paróquia São Francisco. Estaremos lá para te receber com alegria! 🙏"
    },
    {
        id: 'inscricao_online_detalhes',
        chaves: [],
        resposta: `Combinado! O processo online é bem simples e feito em 2 passos:\n\n1️⃣ *Preencha a Ficha:*\nPreencha a ficha de inscrição neste link:\n https://forms.gle/JaGuPgwzHoCesr5Z9 \n\n2️⃣ *Faça o Pagamento:*\nA inscrição custa R$ ${config.VALOR_INSCRICAO}.\nO pagamento pode ser feito por PIX:\nChave: *${config.CHAVE_PIX}* (em nome de ${config.NOME_CONTATO_PIX}).\n\nDepois de pagar, é só me enviar o *comprovante* aqui no chat junto com a palavra 'comprovante' na legenda do arquivo que eu finalizo para você. 😉`
    },
    {
        id: 'sobre_jcc',
        chaves: ['jcc', 'jovens a caminho do ceu'],
        resposta: `O JCC significa "Jovens a Caminho do Céu"! É o nosso grupo de oração cheio de vida, alegria e fé. Nos reunimos toda segunda-feira para rezar, conversar, crescer juntos e viver experiências incríveis com Deus. 💒✨`
    },
    {
        id: 'sobre_retiro',
        chaves: ['o que é o retiro', 'sobre o retiro', 'kerigma', 'kerigmático', 'retiro jcc', 'retiro jovens'],
        resposta: `O Retiro Kerigmático JCC é um final de semana transformador preparado por jovens, para jovens. 🙏✨ O foco dele é o Kerigma, que é o primeiro e mais fundamental anúncio do amor de Deus por nós. Além disso, o JCC (Jovens a Caminho do Céu) é o nosso grupo de oração que se reúne toda segunda-feira!`
    },
    {
    id: 'kerigma_explicacao',
    chaves: ['kerigma', 'o que significa kerigma', 'significado kerigma', 'o que é kerigma'],
    resposta: "Que bom que perguntou! 'Kerigma' é uma palavra grega que significa 'proclamação' ou 'o primeiro anúncio'. O nosso retiro é 'Kerigmático' porque o seu foco é anunciar a mensagem mais fundamental do Cristianismo: o amor de Deus manifestado em Jesus Cristo. É um encontro com este primeiro e mais poderoso anúncio da fé. ❤️"
    },
    {
        id: 'saber_atividades',
        chaves: ['atividades', 'programação', 'o que vai ter', 'como vai ser', 'o que acontece', 'cronograma', 'o que rola'],
        resposta: "Vai ter muita coisa boa! Momentos profundos de oração, pregações, adoração ao Santíssimo, música, louvor, Santa Missa... e também partilhas, dinâmicas, surpresas e MUITA alegria! 💥🙏🎶",
        resposta_seguimento: "Sim! Teremos momentos de partilha em pequenos grupos, dinâmicas divertidas para nos conhecermos melhor e, claro, intervalos para um café e um bom bate-papo. A programação foi pensada para equilibrar os momentos de espiritualidade profunda com a alegria da convivência."
    },
    {
        id: 'idade',
        chaves: ['idade', 'quantos anos', 'limite de idade', 'classificação', 'a partir de que idade', 'faixa etária', 'idade mínima'],
        resposta: "A idade mínima para participar é de 14 anos. A partir daí, todos os jovens de coração aberto são super bem-vindos! 💙"
    },
    // Substitua o bloco 'dormir_local' antigo por este:

{
    id: 'dormir_local',
    chaves: ['dormir', 'pernoitar', 'preciso dormir', 'tenho que dormir', 'é obrigatório dormir', 'posso ir embora', 'não posso dormir', 'nao posso dormir', 'sem dormir', 'ir pra casa a noite'],
    resposta: "O retiro é uma experiência de imersão completa, e o pernoite no local faz parte dessa vivência. A proposta é que todos permaneçam juntos, pois isso fortalece a comunhão e nos ajuda a viver intensamente cada momento. 🙏\n\n" +
              "Entendemos, porém, que podem existir casos muito específicos que dificultem o pernoite. Se essa é a sua situação, pedimos que você converse diretamente com a nossa equipe de organização para que possamos entender o seu caso e encontrar a melhor solução juntos. ❤️\n\n" +
              "Para isso, digite *\"falar com um organizador\"* que eu te passo o contato.",
    resposta_seguimento: "Com certeza! Para quem for pernoitar, além do colchonete, lembre-se de trazer um lençol, um travesseiro e um cobertor para garantir que você tenha uma noite de sono confortável e revigorante. 😊"
},
    {
        id: 'uso_celular',
        chaves: ['celular', 'telemóvel', 'telefone', 'usar o celular', 'internet', 'wifi'],
        resposta: "Durante o retiro, a proposta é desconectar do mundo pra se conectar com Deus e com os irmãos. Então pedimos que evite o uso do celular. Teremos horários específicos para fotos e comunicação com os familiares, se necessário. 🤳⛪"
    },
    {
        id: 'falar_humano',
        chaves: ['humano', 'pessoa', 'organizador', 'organização', 'atendente', 'falar com'],
        resposta: `Claro! Se quiser conversar diretamente com alguém da equipe, pode chamar a *${config.CONTATO_HUMANO_NOME}*, uma das organizadoras. Ela vai te ajudar com muito carinho! 💬❤️\n\n📲 Clique aqui para falar com ela:\nhttps://wa.me/${config.CONTATO_HUMANO_NUMERO}`
    },
    {
        id: 'grupo_whatsapp',
        chaves: ['grupo', 'whatsapp', 'link do grupo', 'grupo de avisos'],
        resposta: `Entre no nosso grupo do WhatsApp para não perder nenhuma novidade! Vai ser ótimo ter você com a gente lá. 💌\n\n📲 ${config.WHATSAPP_GROUP_LINK}`
    },
    {
        id: 'saudacao',
        chaves: ['oi', 'oie', 'oii', 'oiii', 'olá', 'e aí', 'tudo bem', 'opa', 'bom dia', 'boa tarde', 'boa noite', 'oi jcc', 'olá jcc', 'oi retiro', 'olá retiro', 'bom dia retiro', 'boa tarde retiro', 'boa noite retiro', 'oi assistente', 'olá assistente', 'bom dia assistente', 'boa tarde assistente', 'boa noite assistente', 'olá jcc', 'oi jcc', 'bom dia jcc', 'boa tarde jcc', 'boa noite jcc'],
        resposta: (nome) => {
            const saudacaoInicial = `Olá, ${nome}! Paz e bem! 🙏 Eu sou o assistente virtual do retiro Kerigmático, do grupo JCC.\n\n`;
            return saudacaoInicial + construirTextoMenu();
        }
    },
    {
        id: 'confirmacao_positiva',
        chaves: ['vamos', 'bora', 'bora la', 'sim', 'pode ser', 'claro', 'vamoss', 'ok', 'demorou'],
        resposta: construirTextoMenu
    },
    {
        id: 'despedida',
        chaves: ['tchau', 'até mais', 'obrigado', 'obg', 'vlw', 'valeu', 'falou', 'de nada', 'disponha'],
        resposta: (nome) => [`Disponha, ${nome}! Que Deus te abençoe muito! 🙌`, `Foi uma alegria te ajudar, ${nome}! Já aproveita e segue nosso Insta: ${config.INSTAGRAM_LINK} 😉`, `Fico feliz em poder ajudar! Te espero no retiro com o coração aberto! ❤️`, `Tamo junto, ${nome}!`, `Até logo, ${nome}! Se precisar, é só chamar. E entra no nosso grupo: ${config.WHATSAPP_GROUP_LINK}`]
    },
    {
        id: 'consultar_data',
        chaves: ['data', 'quando', 'datas', 'calendário', 'que dia'],
        resposta: "O retiro vai acontecer nos dias 22, 23 e 24 de agosto de 2025. Já anota aí no seu coração (e na agenda também)! 😄\n\nEle começa na sexta-feira (22/08) às 19h e termina no domingo (24/08) às 18h. ✨"
    },
    {
        id: 'horario',
        chaves: ['horário', 'horas', 'começa', 'termina', 'início', 'fim', 'encerramento', 'que horas'],
        resposta: "O retiro começa na sexta-feira (22/08) às 19h e termina no domingo (24/08) às 18h, com a Santa Missa. ✨"
    },
    {
        id: 'levar',
        chaves: ['levar', 'mala', 'trazer', 'roupa', 'preciso', 'o que levar', 'na mala'],
        resposta: "✨ Que bom saber que você quer se preparar bem! Aqui vai uma lista com tudo o que você deve levar para o retiro:\n\n" +
              "🧳 *Itens essenciais:*\n" +
              "❤️ Um coração aberto, para viver esse final de semana com intensidade!\n" +
              "📖 Bíblia\n" +
              "📝 Caderno e caneta\n" +
              "🛏️ Colchonete ou isolante térmico\n" +
              "🛌 Roupas de cama (lençol, travesseiro e cobertor)\n" +
              "🚿 Toalha de banho\n" +
              "👕 Roupas modestas para todas as ocasiões (inclusive para dormir)\n" +
              "👟 Tênis ou sandália confortável\n" +
              "💧 Garrafinha de água\n" +
              "🍽️ Prato, copo e talheres\n" +
              "📿 Terço\n" +
              "🧼 Itens de higiene pessoal (sabonete, shampoo, escova e pasta de dente, desodorante, etc.)\n",
    resposta_seguimento: "💊 *Não se esqueça de:*\n" +
                         "- Remédios de uso pessoal, se necessário\n" +
                         "- 🗒️ Um diário espiritual ou caderno extra, se gostar de anotar reflexões\n\n" +
                         "🙏 Tudo isso vai te ajudar a viver o retiro com mais profundidade e conforto! Se tiver dúvidas, pode perguntar! 😊"
    },
    {
        id: 'consultar_local',
        chaves: ['local', 'endereço', 'onde', 'lugar', 'escola', 'vai ser onde', 'em que lugar'],
        resposta: "O retiro será na escola João Bosco, em Paulo Afonso - BA.\nEndereço: Vila Poty, Paulo Afonso - BA, 48601-430 📍"
    },
    {
        id: 'consultar_valor',
        chaves: ['valor', 'pagamento', 'preço', 'custa', 'pagar', 'taxa', 'pago alguma coisa', 'é de graça', 'quanto custa', 'qual o valor'],
        funcaoResposta: () => `A inscrição custa R$ ${config.VALOR_INSCRICAO}.\n\n💸 O pagamento pode ser feito por PIX:\nChave: *${config.CHAVE_PIX}* (em nome de ${config.NOME_CONTATO_PIX}).😉`
    },
    {
        id: 'ajuda',
        chaves: ['ajuda', 'comandos', 'opções', 'menu', 'começar'],
        resposta: construirTextoMenu
    },
];

module.exports = { memoria, MENU_PRINCIPAL };