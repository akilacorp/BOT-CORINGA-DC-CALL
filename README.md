# BOT FALADOR DISCORD 🤖🎙️

![Bot Coringa](https://cdn6.campograndenews.com.br/uploads/noticias/2020/03/10/ckogiso33h5e.jpg)

Um bot de Discord avançado com capacidade de reconhecimento de voz, processamento de linguagem natural e síntese de voz para criar interações de voz completas entre usuários e o bot.

## Funcionalidades 🌟

- **Reconhecimento de voz** usando Wit.ai
- **Processamento de mensagens** usando OpenRouter/OpenAI
- **Síntese de voz** usando ElevenLabs
- **Várias personalidades** para o bot (Engraçado, Sério, Malandro, Conselheiro)
- **Conexão automática** aos canais de voz
- **Detecção de fala em tempo real**

## Tecnologias Utilizadas 💻

- **Node.js** - Ambiente de execução JavaScript
- **Discord.js** - API para integração com Discord
- **Wit.ai** - Reconhecimento de fala
- **OpenRouter/OpenAI** - Processamento de linguagem natural
- **ElevenLabs** - Síntese de voz natural e expressiva
- **FFmpeg** - Processamento de áudio

## Preparação Inicial 🚀

### 1. Crie um Bot no Discord

1. Acesse o [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)
2. Clique em "New Application" e dê um nome para seu aplicativo
3. Navegue até a seção "Bot" e clique em "Add Bot"
4. Em "Privileged Gateway Intents", ative:
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
5. Vá para a seção "OAuth2" > "URL Generator"
6. Selecione os escopos: `bot` e `applications.commands`
7. Nas permissões do bot, selecione:
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity
   - Use Slash Commands
8. Copie a URL gerada e abra em um navegador para adicionar o bot ao seu servidor
9. Copie o TOKEN do bot na seção "Bot" (clique em "Reset Token" se necessário)

### 2. Obtenha as Chaves de API

#### Wit.ai para Reconhecimento de Fala
1. Acesse [Wit.ai](https://wit.ai/) e crie uma conta
2. Crie um novo aplicativo Wit.ai
3. Configure o idioma desejado (português-Brasil)
4. Vá para configurações e copie o "Server Access Token"

#### OpenRouter para Processamento de Mensagens
1. Crie uma conta no [OpenRouter](https://openrouter.ai/)
2. Gere uma chave de API na seção de API Keys
3. Copie a chave de API

#### ElevenLabs para Síntese de Voz
1. Crie uma conta no [ElevenLabs](https://beta.elevenlabs.io/)
2. Vá para a seção de perfil e copie sua chave de API
3. Escolha uma voz que deseja usar e anote o ID da voz

### 3. Configuração do Ambiente

1. Clone este repositório:
```
git clone https://github.com/seu-usuario/bot-falador-discord.git
cd bot-falador-discord
```

2. Instale as dependências:
```
npm install
```

3. Configure o arquivo `.env` com suas chaves de API:
```
# Credenciais Discord
DISCORD_TOKEN=seu_token_do_discord
CLIENT_ID=seu_client_id_do_discord

# Chave de API do Wit.ai para reconhecimento de fala (STT)
WIT_AI_KEY=sua_chave_wit_ai

# Chave de API da OpenAI (usada para fallback de STT e geração de respostas)
OPENAI_API_KEY=sua_chave_openai

# OpenRouter API (alternativa à OpenAI com limites maiores)
OPENROUTER_API_KEY=sua_chave_openrouter

# Chave da ElevenLabs para síntese de voz
ELEVENLABS_API_KEY=sua_chave_elevenlabs
ELEVENLABS_VOICE_ID=id_da_voz_escolhida
```

## Como Usar o Bot 🎮

### Iniciar o Bot
Execute o arquivo `iniciar.bat` ou rode diretamente através do Node.js:
```
node index.js
```

### Comandos Disponíveis
- `/call [personalidade]` - Conecta o bot ao seu canal de voz atual
  - Opções de personalidade: engraçado, sério, malandro, conselheiro
- `/stop` - Desconecta o bot do canal de voz

### Interação por Voz
1. Use o comando `/call` para conectar o bot ao seu canal de voz
2. Fale normalmente no canal de voz - o bot irá:
   - Detectar quando você está falando
   - Converter sua fala em texto usando Wit.ai
   - Processar o texto e gerar uma resposta adequada
   - Converter a resposta em fala usando ElevenLabs
   - Reproduzir a resposta no canal de voz

## Solução de Problemas 🔧

### O Bot não Detecta Minha Voz
- Verifique se você não está mutado no Discord
- Confirme que seu microfone é o dispositivo de entrada padrão
- Certifique-se de que o Discord tem permissão para acessar seu microfone
- Verifique os logs para ver se há erros específicos

### Problemas com Reconhecimento de Fala
- Fale claramente e evite ruído de fundo
- Verifique se a chave do Wit.ai está correta
- Tente ajustar o volume do microfone

### Problemas com Síntese de Voz
- Confirme que a chave da ElevenLabs está correta
- Verifique se o ID da voz existe e está acessível
- Verifique se você possui créditos suficientes na sua conta ElevenLabs

## Recursos e Limitações 📋

- O bot funciona em qualquer servidor Discord onde tenha sido adicionado
- Suporta reconhecimento de fala em português brasileiro
- Processamento de linguagem natural multilíngue
- Síntese de voz natural e expressiva
- Limitações de uso podem se aplicar dependendo das cotas gratuitas das APIs

## Estrutura do Projeto 📁

- `index.js`: Arquivo principal que gerencia conexões com Discord e fluxo de áudio
- `router.js`: Processamento de mensagens e gerenciamento de personalidades
- `stt.js`: Módulo de Speech-to-Text usando Wit.ai para reconhecimento de voz
- `tts.js`: Módulo de Text-to-Speech usando ElevenLabs para síntese de voz
- `package.json`: Dependências e configurações do projeto
- `.env`: Variáveis de ambiente (tokens e chaves de API)
- `iniciar.bat`: Script para iniciar o bot facilmente

## Contribuição e Feedback 👥

Para contribuir com o projeto, enviar feedback ou relatar problemas:
1. Abra uma Issue neste repositório
2. Faça um Fork do projeto e envie seu Pull Request

## Créditos e Links 🔗

Desenvolvido por [Akila](https://github.com/akila) e [AesCorp](https://whatsapp.com/channel/0029VbB1a77545ussjB7uu1s)

- Canal do WhatsApp: [AesCorp](https://whatsapp.com/channel/0029VbB1a77545ussjB7uu1s)
- Página do Projeto: [GitHub](https://github.com/akilacorp/BOT-CORINGA-DC-CALL/tree/main)

## Licença 📄

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

---

💬 **"A tecnologia deve aproximar pessoas, e o que melhor que fazer isso através da voz?"**
   
