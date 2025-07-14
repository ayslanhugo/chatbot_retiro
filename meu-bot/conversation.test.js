// conversation.test.js (versão de depuração)

jest.mock('./memoria', () => ([
    { id: 'valor', chaves: ['valor'], funcaoResposta: () => 'A inscrição custa R$ 50,00.' },
    { id: 'levar', chaves: ['levar'], resposta: 'Leve Bíblia, caderno e caneta.', resposta_seguimento: 'Não se esqueça também do colchonete!' }
]), { virtual: true });

const { handleMessage } = require('./index.js');

describe('Testes de Fluxo de Conversa', () => {
    let userContext;

    beforeEach(() => {
        userContext = {};
    });

    it('deve responder com informações de seguimento', async () => {
        const userId = 'user456@c.us';
        const mockClient = { sendMessage: jest.fn() };

        console.log('\n--- INÍCIO DO TESTE DE SEGUIMENTO ---');
        console.log('1. Estado INICIAL do contexto:', JSON.stringify(userContext));

        // --- PARTE 1 DA CONVERSA ---
        const msg1 = { from: userId, body: 'o que levar?', reply: jest.fn(), getChat: jest.fn().mockResolvedValue({ isGroup: false, sendStateTyping: jest.fn() }), getContact: jest.fn().mockResolvedValue({ pushname: 'Tester' }) };
        await handleMessage(msg1, userContext, mockClient);
        console.log('2. Estado do contexto APÓS msg1:', JSON.stringify(userContext));
        
        expect(userContext[userId].lastTopic).toBe('levar');

        // --- PARTE 2 DA CONVERSA ---
        const msg2 = { from: userId, body: 'e o que mais?', reply: jest.fn(), getChat: jest.fn().mockResolvedValue({ isGroup: false, sendStateTyping: jest.fn() }), getContact: jest.fn().mockResolvedValue({ pushname: 'Tester' }) };
        console.log('3. Chamando handleMessage para msg2...');
        
        await handleMessage(msg2, userContext, mockClient);
        
        console.log('4. Fim da chamada para msg2.');
        expect(msg2.reply).toHaveBeenCalledTimes(1);
        expect(msg2.reply).toHaveBeenCalledWith('Não se esqueça também do colchonete!');
        console.log('--- FIM DO TESTE DE SEGUIMENTO ---');
    });
});