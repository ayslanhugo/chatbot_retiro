// memoria.js

const moment = require('moment');
const config = require('./config.js'); 

// --- "Memória" do Bot ---
const memoria = [
    // ==================================================================
    // TÓPICOS DE ALTA PRIORIDADE
    // ==================================================================
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
        resposta: (nome) => `Oi, ${nome}! Que bênção que o(a) jovem que você representa quer participar! 🙌\n\nPara garantir a segurança e o consentimento de todos, a regra é que *menores de 18 anos façam a inscrição presencialmente*, junto com o pai, mãe ou responsável legal.\n\n📍 **Onde?** No nosso grupo de oração, toda segunda-feira, às 19h30, no salão da Paróquia São Francisco.\n\n*Exceções são possíveis?*\nEm casos muito específicos onde a presença do responsável é impossível, a situação deve ser *previamente conversada com a organização*. Se for aprovado, será necessário enviar uma foto da ficha de inscrição impressa e devidamente assinada pelo responsável.\n\nPara tratar de uma exceção, por favor, *fale com um humano*.`
    },
    {
        id: 'roupa_modesta',
        chaves: ['roupa modesta', 'modesta', 'vestimenta', 'vestir', 'decote', 'curto', 'modestia'],
        resposta: `Ótima pergunta! A modéstia no vestir, para nós, não é sobre regras rígidas, mas sobre o respeito ao ambiente sagrado e a todos os participantes, ajudando a manter o foco na experiência com Deus. ❤️\n\nA ideia é usar roupas confortáveis que não marquem o corpo, não sejam transparentes e evitem decotes profundos ou comprimentos muito curtos.\n\nPara te ajudar a ter uma ideia:\n🙋‍♀️ *Para as mulheres:* T-shirts ou blusas sem decotes exagerados, calças confortáveis, saias ou vestidos com comprimento abaixo do joelho são ótimas opções.\n🙋‍♂️ *Para os homens:* Camisetas, camisas polo, calças e bermudas (na altura do joelho) são perfeitas.\n\nO mais importante é sentir-se bem e à vontade para viver tudo que Deus preparou para nós! 🙏`
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

    // ==================================================================
    // RESTO DOS COMANDOS
    // ==================================================================
    {
        id: 'fazer_inscricao', 
        chaves: ['ficha', 'pdf', 'formulario', 'inscrever', 'inscrição', 'participar', 'como faz', 'entrar', 'quero ir'],
        resposta: (nome) => `Que alegria saber do seu interesse, ${nome}! 😊\n\n⚠️ *ATENÇÃO: Se o participante for menor de 18 anos, a inscrição deve ser feita obrigatoriamente de forma PRESENCIAL, acompanhado(a) de um responsável.*\n\nEntendido isso, como você prefere continuar?\n\n1️⃣ *Online (Apenas para maiores de 18 anos)*\nEu envio-lhe a ficha, você preenche, paga por PIX e envia-me o comprovante.\n\n2️⃣ *Presencialmente*\nVocê pode ir ao nosso grupo de oração (toda segunda-feira, às 19h30, no salão da paróquia) e fazer a sua inscrição e pagamento diretamente com a nossa equipe.\n\nDigite *1* para Online ou *2* para Presencial.`
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
        resposta: `Combinado! O processo online é bem simples e feito em 2 passos:\n\n1️⃣ *Preencha a Ficha:*\nBaixe e preencha a ficha de inscrição neste link:\nhttp://ayslanhugo.pythonanywhere.com/static/ficha_inscricao.pdf\n\n2️⃣ *Faça o Pagamento:*\nA inscrição custa R$ ${config.VALOR_INSCRICAO}.\nO pagamento pode ser feito por PIX:\nChave: *${config.CHAVE_PIX}* (em nome de ${config.NOME_CONTATO_PIX}).\n\nDepois de pagar, é só me enviar o *comprovante* aqui no chat junto com a palavra 'comprovante' que eu finalizo para você. 😉`
    },
    {
        id: 'sobre_jcc',
        chaves: ['jcc', 'jovens a caminho do ceu'],
        resposta: `O JCC significa "Jovens a Caminho do Céu"! É o nosso grupo de oração cheio de vida, alegria e fé. Nos reunimos toda segunda-feira para rezar, conversar, crescer juntos e viver experiências incríveis com Deus. 💒✨`
    },
    {
        id: 'sobre_retiro',
        chaves: ['o que é o retiro', 'sobre o retiro', 'kerigma', 'kerigmático', 'retiro jcc', 'retiro jovens'],
        resposta: `O Retiro Kerigmático JCC é um final de semana transformador preparado por jovens, para jovens. 🙏✨`
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
        resposta: "A idade mínima para participar é de 15 anos. A partir daí, todos os jovens de coração aberto são super bem-vindos! 💙"
    },
    {
        id: 'dormir_local',
        chaves: ['dormir', 'pernoitar', 'preciso dormir', 'tenho que dormir', 'é obrigatório dormir', 'posso ir embora'],
        resposta: "O retiro é uma experiência de imersão completa, e o pernoite no local faz parte dessa vivência. Isso fortalece a comunhão e nos ajuda a viver intensamente cada momento. Por isso, pedimos que leve colchonete e roupas de cama. 😊",
        resposta_seguimento: "Com certeza! Além do colchonete, lembre-se de trazer um lençol, um travesseiro e um cobertor para garantir que você tenha uma noite de sono confortável e revigorante. 🙏"
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
    chaves: ['oi', 'oie', 'oii', 'oiii', 'olá', 'e aí', 'tudo bem', 'opa', 'bom dia', 'boa tarde', 'boa noite'],
    funcaoResposta: (nomeUsuario) => {
        // Encontra o texto da ajuda que acabámos de formatar
        const menuDeAjuda = memoria.find(item => item.id === 'ajuda').resposta;

        // Monta a mensagem de boas-vindas completa
        const saudacaoInicial = `Olá, ${nomeUsuario}! A paz de Cristo! 🙏\nEu sou o RCC (robô a caminho do céu), e estou aqui para te auxiliar na preparação para o retiro Kerigmático JCC.\n\n`;

        return saudacaoInicial + menuDeAjuda;
    }
    },
    {
        id: 'confirmacao_positiva',
        chaves: ['vamos', 'bora', 'bora la', 'sim', 'pode ser', 'claro', 'vamoss', 'ok', 'demorou'],
        resposta: `Legal! Você pode perguntar sobre qualquer um desses tópicos:\n\n- O que é o *JCC*?\n- *Atividades* do retiro\n- *Idade* mínima\n- Preciso *dormir* no local?\n- Posso usar *celular*?\n- O que é *roupa modesta*?\n- *Data* e *Horário*\n- *Local* do retiro\n- *Valor* da inscrição\n- Como fazer minha *inscrição*\n- Falar com a *organização*\n- Entrar no *grupo do WhatsApp*\n- Ver a *contagem* regressiva ⏳\n\nÉ só mandar uma palavra que eu explico tudo! 😉`
    },
    {
        id: 'despedida',
        chaves: ['tchau', 'até mais', 'obrigado', 'obg', 'vlw', 'valeu', 'falou', 'de nada', 'disponha'],
        resposta: (nome) => [`Disponha, ${nome}! Que Deus te abençoe muito! 🙌`, `Foi uma alegria te ajudar, ${nome}! Já aproveita e segue nosso Insta: ${config.INSTAGRAM_LINK} 😉`, `Fico feliz em poder ajudar! Te espero no retiro com o coração aberto! ❤️`, `Tamo junto, ${nome}! E se quiser ir entrando no clima, ouve nossa playlist especial: ${config.PLAYLIST_LINK}`, `Até logo, ${nome}! Se precisar, é só chamar. E entra no nosso grupo: ${config.WHATSAPP_GROUP_LINK}`]
    },
    {
        id: 'consultar_data',
        chaves: ['data', 'quando', 'datas', 'calendário', 'que dia'],
        resposta: "O retiro vai acontecer nos dias 22, 23 e 24 de agosto de 2025. Já anota aí no seu coração (e na agenda também)! 😄"
    },
    {
        id: 'horario',
        chaves: ['horário', 'horas', 'começa', 'termina', 'início', 'fim', 'encerramento', 'que horas'],
        resposta: "O retiro começa na sexta-feira (22/08) às 19h e termina no domingo (24/08) às 18h, com a Santa Missa. ✨"
    },
    {
        id: 'levar',
        chaves: ['levar', 'mala', 'trazer', 'roupa', 'preciso', 'o que levar', 'na mala'],
        resposta: "Ótimo que você quer se preparar! Leve: Bíblia, caderno, caneta, colchonete, roupas de cama e banho, roupas modestas (inclusive para o banho), sua garrafinha, prato, copo, talheres, terço e itens de higiene pessoal. 😊",
        resposta_seguimento: "Claro! Além do básico, um detalhe importante é trazer um terço para os momentos de oração. Se você gosta de anotar, um caderno extra ou diário espiritual também é uma ótima ideia! Outro ponto é não se esquecer de remédios de uso pessoal, se precisar."
    },
    {
        id: 'consultar_local',
        chaves: ['local', 'endereço', 'onde', 'lugar', 'escola', 'vai ser onde', 'em que lugar'],
        resposta: "O retiro será na escola João Bosco aqui em Paulo Afonso, no centro da cidade! \n Vila Poty, Paulo Afonso - BA, 48601-430 - *Escola Municipal João Bosco Ribeiro*📍"
    },
    {
        id: 'consultar_valor',
        chaves: ['valor', 'pagamento', 'preço', 'custa', 'pagar', 'taxa', 'pago alguma coisa', 'é de graça', 'quanto custa', 'qual o valor'],
        funcaoResposta: () => `A inscrição custa R$ ${config.VALOR_INSCRICAO}.\n\n💸 O pagamento pode ser feito por PIX:\nChave: *${config.CHAVE_PIX}* (em nome de ${config.NOME_CONTATO_PIX}).\n\nDepois é só mandar o comprovante aqui mesmo no chat que eu cuido do resto por você! 😉`
    },
    {
    id: 'data_e_horario',
    chaves: [], // Não precisa de chaves, será acionado apenas pelo menu
    funcaoResposta: () => {
        // Busca as respostas de data e horário que já existem
        const data = memoria.find(i => i.id === 'consultar_data').resposta;
        const horario = memoria.find(i => i.id === 'horario').resposta;
        // Junta as duas numa única mensagem
        return `${data}\n\n${horario}`;
    }
    },
    {
        id: 'ajuda',
        chaves: ['ajuda', 'comandos', 'opções', 'menu', 'começar'],
        resposta: `Aqui está uma lista de como posso ajudar:\n\n` +
        `*INFORMAÇÕES GERAIS* 📢\n` +
        `1️⃣ Sobre o retiro 🏕️\n` +
        `2️⃣ O que é o JCC? 🤔\n` +
        `3️⃣ Data e Horário 🗓️\n` +
        `4️⃣ Local do retiro 📍\n` +
        `5️⃣ Idade mínima 👶\n\n` +
        `*INSCRIÇÃO* 📝\n` +
        `6️⃣ Como fazer a minha inscrição ✍️\n` +
        `7️⃣ Valor e Pagamento 💰\n\n` +
        `*PREPARAÇÃO* 🎒\n` +
        `8️⃣ O que levar 🎽\n` +
        `9️⃣ Regras sobre o uso de celulares 📵\n\n` +
        `*OUTROS* ✨\n` +
        `🔟 Entrar no grupo do WhatsApp 💬\n` +
        `1️⃣1️⃣ Falar com a organização 📞\n\n` +
        `Basta enviar o número da sua dúvida!`
    },
];
module.exports = memoria;