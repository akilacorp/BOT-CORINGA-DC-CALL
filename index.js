const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ DISCORD_TOKEN ou CLIENT_ID não encontrados no arquivo .env");
  console.error("Por favor, configure o arquivo .env com suas credenciais do Discord.");
  process.exit(1);
}

let stt, router, tts;

try {
  stt = require('./stt.js');
  router = require('./router.js');
  tts = require('./tts.js');
  
  if (!stt.listen || typeof stt.listen !== 'function') {
    throw new Error('Módulo STT não exporta a função listen corretamente');
  }
  
  if (!router.processar || typeof router.processar !== 'function') {
    throw new Error('Módulo Router não exporta a função processar corretamente');
  }
  
  if (!tts.speak || typeof tts.speak !== 'function') {
    throw new Error('Módulo TTS não exporta a função speak corretamente');
  }
  
  console.log("✅ Todos os módulos foram carregados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao carregar módulos:", error.message);
  process.exit(1);
}

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Diretório temp criado em ${tempDir}`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const voiceConnections = new Map();
const audioPlayers = new Map();
const listeningUsers = new Map();

const commands = [
  {
    name: 'call',
    description: 'Iniciar conversa com o bot no canal de voz',
    options: [
      {
        name: 'personalidade',
        description: 'Escolha a personalidade do bot',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'Engraçado', value: 'engraçado' },
          { name: 'Sério', value: 'sério' },
          { name: 'Malandro', value: 'malandro' },
          { name: 'Conselheiro', value: 'conselheiro' }
        ]
      }
    ]
  },
  {
    name: 'stop',
    description: 'Encerrar conversa com o bot'
  }
];

async function registerCommands() {
  try {
    console.log('Registrando comandos slash...');
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Comandos registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Bot iniciado como ${client.user.tag}`);
  await registerCommands();
  console.log('🎙️ Esperando comandos...');
});

function connectToVoiceChannel(channel, guildId) {
  try {
    if (voiceConnections.has(guildId)) {
      console.log(`Já existe uma conexão ativa no servidor ${guildId}`);
      return voiceConnections.get(guildId);
    }
    
    console.log(`Conectando ao canal de voz ${channel.id} no servidor ${guildId}...`);
    
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    
    const player = createAudioPlayer();
    connection.subscribe(player);
    
    voiceConnections.set(guildId, connection);
    audioPlayers.set(guildId, player);
      connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`✅ Conexão pronta no servidor ${guildId}`);
      console.log("Configurando receptor de voz...");
      
      if (connection.receiver) {
        console.log("Receptor de voz configurado com sucesso!");
      } else {
        console.error("Falha ao configurar receptor de voz!");
      }
    });
    
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        console.log(`Conexão de voz desconectada no servidor ${guildId}, tentando reconectar...`);
        
        await Promise.race([
          new Promise((resolve) => {
            connection.on(VoiceConnectionStatus.Signalling, () => resolve());
            connection.on(VoiceConnectionStatus.Connecting, () => resolve());
          }),
          new Promise((_, reject) => setTimeout(() => reject(), 5000))
        ]);
      } catch (error) {
        console.log(`Falha na reconexão no servidor ${guildId}, destruindo conexão...`);
        connection.destroy();
        cleanup(guildId);
      }
    });
      player.on(AudioPlayerStatus.Idle, () => {
      console.log(`Player de áudio ocioso no servidor ${guildId}`);
      startListening(guildId);
    });
    
    player.on('error', error => {
      console.error(`Erro no player de áudio: ${error.message}`);
    });
    
    console.log(`✅ Conectado ao canal de voz no servidor ${guildId}`);
    return connection;
  } catch (error) {
    console.error(`❌ Erro ao conectar ao canal de voz:`, error);
    return null;
  }
}

async function startListening(guildId) {
  try {
    const connection = voiceConnections.get(guildId);
    if (!connection) {
      console.log(`Nenhuma conexão de voz encontrada para o servidor ${guildId}`);
      return;
    }
    
    console.log(`🎤 Escutando usuários no servidor ${guildId}...`);
    
    if (!connection._speechHandlersSet) {
      console.log("Configurando eventos de fala...");
      
      connection.receiver.speaking.on('start', (userId) => {
        console.log(`🔊 Usuário ${userId} começou a falar`);
        if (userId === client.user.id) return;
        if (listeningUsers.has(userId)) {
          console.log(`Já estamos escutando o usuário ${userId}`);
          return;
        }
        
        listenToUser(connection, userId, guildId);
      });
      
      connection.receiver.speaking.on('end', (userId) => {
        console.log(`🔇 Usuário ${userId} parou de falar`);
        
        setTimeout(() => {
          if (listeningUsers.has(userId)) {
            console.log(`Removendo usuário ${userId} da lista de escuta`);
            listeningUsers.delete(userId);
          }
        }, 2000);
      });
      
      connection._speechHandlersSet = true;
      console.log("Eventos de fala configurados com sucesso!");
    }
      startActiveListening(connection, guildId);
    
    console.log(`✅ Sistema de escuta inicializado com sucesso no servidor ${guildId}`);
  } catch (error) {
    console.error(`❌ Erro ao iniciar escuta:`, error);
  }
}

async function startActiveListening(connection, guildId) {
  console.log("🎧 Iniciando escuta ativa para todos os usuários no canal...");
  
  const voiceChannel = connection.joinConfig.channelId;
  const guild = client.guilds.cache.get(guildId);
  
  if (!guild) {
    console.log("Guild não encontrada");
    return;
  }
  
  const channel = guild.channels.cache.get(voiceChannel);
  
  if (!channel) {
    console.log("Canal não encontrado");
    return;
  }
  
  try {
    const checkInterval = setInterval(async () => {
      try {
        const members = channel.members;
        
        if (!members || members.size === 0) {
          console.log("Não há usuários no canal de voz");
          return;
        }
        
        console.log(`${members.size} usuários encontrados no canal de voz`);
        
        const speakingUsers = Array.from(connection.receiver.speaking.users.keys());
        console.log(`Usuários falando: ${speakingUsers.length ? speakingUsers.join(', ') : 'nenhum'}`);
        
        if (!voiceConnections.has(guildId)) {
          console.log("Conexão encerrada, parando escuta ativa");
          clearInterval(checkInterval);
          return;
        }
          if (speakingUsers.length === 0 && listeningUsers.size === 0) {
          const nonBotMembers = members.filter(m => !m.user.bot);
          
          if (nonBotMembers.size > 0) {
            const randomMember = Array.from(nonBotMembers.values())[Math.floor(Math.random() * nonBotMembers.size)];
            const randomUserId = randomMember.id;
            
            if (!listeningUsers.has(randomUserId)) {
              console.log(`Tentando escutar o usuário ${randomUserId} proativamente...`);
              
              listenToUser(connection, randomUserId, guildId);
            }
          }
        }
      } catch (innerError) {
        console.error("Erro na verificação de usuários falando:", innerError);
      }
    }, 5000);
    
    connection.once(VoiceConnectionStatus.Disconnected, () => {
      clearInterval(checkInterval);
      console.log("Conexão encerrada, parando escuta ativa");
    });
  } catch (error) {
    console.error("Erro ao configurar escuta ativa:", error);
  }
}

async function listenToUser(connection, userId, guildId) {
  if (listeningUsers.has(userId)) {
    console.log(`Já estamos escutando o usuário ${userId}, ignorando`);
    return;
  }
  
  listeningUsers.set(userId, true);
  console.log(`🎤 Começando a escutar usuário ${userId}...`);
  
  try {
    const texto = await stt.listen(connection, userId);
    
    if (!texto || texto.trim() === '') {
      console.log(`Nenhum texto detectado do usuário ${userId}`);
      listeningUsers.delete(userId);
      
      setTimeout(() => {
        if (voiceConnections.has(guildId)) {
          console.log(`Tentando escutar o usuário ${userId} novamente...`);
          listenToUser(connection, userId, guildId);
        }
      }, 3000);
      
      return;
    }
    
    console.log(`🔊 Usuário ${userId} disse: "${texto}"`);
    
    const resposta = await router.processar(texto, userId);
    console.log(`🤖 Resposta: "${resposta}"`);
    
    await speakResponse(guildId, resposta);
    
    setTimeout(() => {
      if (voiceConnections.has(guildId)) {
        startListening(guildId);
      }
    }, 1000);
  } catch (error) {
    console.error(`❌ Erro ao escutar usuário ${userId}:`, error);
  } finally {
    listeningUsers.delete(userId);
  }
}

function speakResponse(guildId, texto) {
  return new Promise((resolve, reject) => {
    try {
      const player = audioPlayers.get(guildId);
      if (!player) {
        console.log(`Nenhum player de áudio encontrado para o servidor ${guildId}`);
        reject(new Error("Player de áudio não encontrado"));
        return;
      }
      
      console.log(`🔊 Reproduzindo resposta no servidor ${guildId}...`);
      
      tts.speak(texto, (err, audioPath) => {
        if (err) {
          console.error(`❌ Erro no TTS:`, err);
          reject(err);
          return;
        }
        
        try {
          const resource = createAudioResource(audioPath);
          
          player.play(resource);
          
          player.once(AudioPlayerStatus.Idle, () => {
            try {
              if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
              }
              resolve();
            } catch (error) {
              console.error(`❌ Erro ao limpar arquivo temporário:`, error);
              resolve();
            }
          });
        } catch (error) {
          console.error(`❌ Erro ao reproduzir áudio:`, error);
          reject(error);
        }
      });
    } catch (error) {
      console.error(`❌ Erro ao falar resposta:`, error);
      reject(error);
    }
  });
}

function cleanup(guildId) {
  voiceConnections.delete(guildId);
  audioPlayers.delete(guildId);
  
  for (const [userId, listening] of listeningUsers.entries()) {
    listeningUsers.delete(userId);
  }
  
  console.log(`🧹 Recursos limpos para o servidor ${guildId}`);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  
  const { commandName, options, guild, member, channel } = interaction;
  
  if (commandName === 'call') {
    try {
      await interaction.deferReply();
      
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        await interaction.editReply('❌ Você precisa estar em um canal de voz para usar este comando.');
        return;
      }
      
      const personality = options.getString('personalidade');
      if (personality) {
        router.setPersonality(member.id, personality);
        console.log(`🎭 Personalidade definida para ${personality}`);
      }
        const connection = connectToVoiceChannel(voiceChannel, guild.id);
      if (!connection) {
        await interaction.editReply('❌ Não foi possível conectar ao canal de voz.');
        return;
      }
      
      await interaction.editReply(`✅ Conectado ao canal de voz! Use sua voz para falar comigo.${personality ? ` Personalidade: **${personality}**` : ''}`);
      
      setTimeout(() => {
        startListening(guild.id);
      }, 1000);
    } catch (error) {
      console.error('❌ Erro no comando /call:', error);
      await interaction.editReply('❌ Ocorreu um erro ao processar o comando.');
    }
  }
  
  else if (commandName === 'stop') {
    try {
      if (!voiceConnections.has(guild.id)) {
        await interaction.reply('❌ O bot não está conectado a nenhum canal de voz.');
        return;
      }
        const connection = voiceConnections.get(guild.id);
      connection.destroy();
      
      cleanup(guild.id);
      
      await interaction.reply('👋 Desconectado do canal de voz!');
    } catch (error) {
      console.error('❌ Erro no comando /stop:', error);
      await interaction.reply('❌ Ocorreu um erro ao processar o comando.');
    }
  }
});

process.on('unhandledRejection', error => {
  console.error('Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando bot...');
  
  for (const [guildId, connection] of voiceConnections.entries()) {
    connection.destroy();
  }
  
  voiceConnections.clear();
  audioPlayers.clear();
  listeningUsers.clear();
  
  client.destroy();
  console.log('👋 Bot encerrado.');
  process.exit(0);
});

client.login(TOKEN).catch(error => {
  console.error('❌ Erro ao fazer login:', error);
  process.exit(1);
});

console.log('🤖 Iniciando Bot Discord...');
console.log('🔊 STT: Wit.ai - Reconhecimento de fala');
console.log('💬 Router: OpenRouter - Processamento de mensagens');
console.log('🎙️ TTS: ElevenLabs - Síntese de voz');

if (process.argv.includes('--demo')) {
  console.log('\n===== MODO DEMONSTRAÇÃO =====');
  
  async function demonstrarFluxo(textoSimulado) {
    console.log(`\n===== DEMONSTRAÇÃO DE FLUXO =====`);
    console.log(`Texto simulado: "${textoSimulado}"`);
    
    try {
      console.log("\n>> Enviando para o router...");
      const resposta = await router.processar(textoSimulado, "usuario-demo");
      console.log(`<< Resposta do router: "${resposta}"`);
      
      console.log("\n>> Enviando para o TTS...");
      tts.speak(resposta, (err, audioPath) => {
        if (err) {
          console.error("Erro no TTS:", err);
          return;
        }
        
        console.log(`<< Áudio gerado em: ${audioPath}`);
        console.log("\n===== DEMONSTRAÇÃO CONCLUÍDA =====");
        console.log("O fluxo completo foi executado com sucesso!");
      });
    } catch (error) {
      console.error("Erro na demonstração:", error);
    }
  }
  
  const frasesDemo = [
    "Olá, tudo bem?",
    "Me conte uma piada",
    "O que você sabe fazer?",
    "Como está o tempo hoje?"
  ];
  
  const fraseAleatoria = frasesDemo[Math.floor(Math.random() * frasesDemo.length)];
  
  console.log("\nIniciando demonstração em 2 segundos...");
  setTimeout(() => {
    demonstrarFluxo(fraseAleatoria);
  }, 2000);
}
