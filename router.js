const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENROUTER_API_KEY && !OPENAI_API_KEY) {
  console.warn('⚠️ Nem OPENROUTER_API_KEY nem OPENAI_API_KEY foram encontradas no arquivo .env. O processamento de mensagens não funcionará corretamente.');
} else {
  console.log('✅ Chave de API encontrada: ', OPENROUTER_API_KEY ? 'OpenRouter' : 'OpenAI');
}

const conversationHistory = {};

const CONVERSATION_MAX_DURATION = 30 * 60 * 1000;

const PERSONALITIES = {
  'engraçado': 'Você é um assistente divertido e bem humorado. Você deve ser engraçado, fazer piadas e usar um tom leve e descontraído. Suas respostas devem ser concisas e diretas ao ponto.',
  'sério': 'Você é um assistente profissional e objetivo. Mantenha um tom formal e técnico, evitando humor ou linguagem informal. Suas respostas devem ser claras, precisas e diretas.',
  'malandro': 'Você é um assistente com jeito malandro brasileiro. Use gírias, expressões informais do Brasil e um tom despojado e astuto. Seja esperto e sagaz em suas respostas.',
  'conselheiro': 'Você é um assistente empático e sábio. Ofereça conselhos de forma gentil e compreensiva, mostrando interesse genuíno. Use um tom acolhedor e motivacional em suas respostas.'
};

const DEFAULT_PERSONALITY = 'sério';

function cleanupOldConversations() {
  const currentTime = Date.now();
  Object.keys(conversationHistory).forEach(userId => {
    if (currentTime - conversationHistory[userId].lastUpdated > CONVERSATION_MAX_DURATION) {
      delete conversationHistory[userId];
    }
  });
}

setInterval(cleanupOldConversations, 10 * 60 * 1000);

const router = {  processar: async function(message, userId, personalityType = DEFAULT_PERSONALITY) {
    console.log(`Processando mensagem de ${userId}: "${message}"`);
    
    try {
      if (!conversationHistory[userId]) {
        conversationHistory[userId] = {
          messages: [],
          personality: personalityType in PERSONALITIES ? personalityType : DEFAULT_PERSONALITY,
          lastUpdated: Date.now()
        };
      }
      
      if (personalityType && PERSONALITIES[personalityType]) {
        conversationHistory[userId].personality = personalityType;
      }
      
      const personality = PERSONALITIES[conversationHistory[userId].personality];
      
      conversationHistory[userId].lastUpdated = Date.now();
      
      conversationHistory[userId].messages.push({
        role: 'user',
        content: message
      });
      
      if (conversationHistory[userId].messages.length > 10) {
        conversationHistory[userId].messages = conversationHistory[userId].messages.slice(-10);
      }
      
      const messages = [
        {
          role: 'system',
          content: personality
        },
        ...conversationHistory[userId].messages
      ];
      
      let response;
        if (process.env.NODE_ENV === 'test' || (!OPENROUTER_API_KEY && !OPENAI_API_KEY) || 
          (OPENROUTER_API_KEY && OPENROUTER_API_KEY.includes('sua_chave')) || 
          (OPENAI_API_KEY && OPENAI_API_KEY.includes('sua_chave'))) {
        console.log("Usando modo de simulação para geração de resposta");
        if (message.toLowerCase().includes('coringa') || message.toLowerCase().includes('bot coringa')) {
          response = "Olá! Sou o Bot Coringa, pronto para trazer caos e risadas! Por que tão sério? Como posso te ajudar hoje?";
        } else if (message.toLowerCase().includes('olá') || message.toLowerCase().includes('oi') || message.toLowerCase().includes('tudo bem')) {
          response = "Olá! Estou bem, obrigado por perguntar. Como posso ajudar você hoje?";
        } else if (message.toLowerCase().includes('piada')) {
          response = "Por que o computador foi ao médico? Porque estava com vírus! 😄";
        } else if (message.toLowerCase().includes('quem é você') || message.toLowerCase().includes('seu nome') || message.toLowerCase().includes('o que você')) {
          response = "Sou um assistente virtual criado para ajudar em diversas tarefas. Posso responder perguntas, contar piadas e muito mais!";
        } else if (message.toLowerCase().includes('tempo') || message.toLowerCase().includes('clima')) {
          response = "Não tenho acesso a informações de tempo real, mas espero que o tempo esteja bom onde você está!";
        } else {
          response = "Entendi o que você disse. Como posso ajudar com isso?";
        }
      } 
      else {
        try {
          console.log("Tentando usar OpenRouter...");
          response = await this.callOpenRouter(messages);
        } catch (error) {
          console.error("Erro no OpenRouter:", error.message);
          console.log("Tentando fallback para OpenAI...");
          
          if (OPENAI_API_KEY) {
            try {
              response = await this.callOpenAI(messages);
            } catch (openaiError) {
              console.error("Erro no OpenAI:", openaiError.message);
              response = "Desculpe, estou com dificuldades técnicas no momento. Tente novamente mais tarde.";
            }
          } else {
            response = "Desculpe, não consigo processar mensagens no momento. Verifique a configuração das APIs.";
          }
        }
      }
        conversationHistory[userId].messages.push({
        role: 'assistant',
        content: response
      });
      
      return response;
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      return "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.";
    }
  },
  callOpenRouter: async function(messages) {
    try {
      console.log('Enviando solicitação para OpenRouter...');
      
      if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('sua_chave_openrouter_aqui')) {
        throw new Error('Chave OpenRouter inválida ou não configurada corretamente');
      }
      
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: messages,
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost',
          'X-Title': 'Discord Voice Bot'
        }
      });
      
      console.log('Resposta recebida do OpenRouter');
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Erro ao chamar OpenRouter:', error.message);
      throw error;
    }
  },
    callOpenAI: async function(messages) {
    try {
      console.log('Enviando solicitação para OpenAI...');
      
      if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('sua_chave_openai_aqui')) {
        throw new Error('Chave OpenAI inválida ou não configurada corretamente');
      }
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Resposta recebida da OpenAI');
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Erro ao chamar OpenAI:', error.message);
      throw error;
    }
  },
    setPersonality: function(userId, personalityType) {
    if (!PERSONALITIES[personalityType]) {
      return false;
    }
    
    if (!conversationHistory[userId]) {
      conversationHistory[userId] = {
        messages: [],
        personality: personalityType,
        lastUpdated: Date.now()
      };
    } else {
      conversationHistory[userId].personality = personalityType;
      conversationHistory[userId].lastUpdated = Date.now();
    }
    
    return true;
  },
    clearHistory: function(userId) {
    if (conversationHistory[userId]) {
      conversationHistory[userId].messages = [];
      conversationHistory[userId].lastUpdated = Date.now();
    }
  }
};

module.exports = router;
