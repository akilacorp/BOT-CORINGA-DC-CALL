const { EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { pipeline } = require('stream');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const TEMP_DIR = path.join(__dirname, 'temp');

const WIT_AI_KEY = process.env.WIT_AI_KEY;
if (!WIT_AI_KEY) {
  console.warn('⚠️ Chave WIT_AI_KEY não encontrada no arquivo .env. O reconhecimento de fala pode não funcionar corretamente.');
}

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`Diretório temp criado em ${TEMP_DIR}`);
  }
}

ensureTempDir();

const stt = {
  listen: async function(connection, userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const timestamp = Date.now();
        const filename = path.join(TEMP_DIR, `${userId}-${timestamp}.pcm`);
        console.log(`Escutando áudio do usuário ${userId}...`);
          const receiver = connection.receiver;
        
        if (!receiver) {
          console.error("Receptor não encontrado");
          reject(new Error("Receptor não encontrado"));
          return;
        }

        const timeout = setTimeout(() => {
          console.log(`Timeout de escuta para o usuário ${userId}`);
          
          if (fs.existsSync(filename)) {
            const stats = fs.statSync(filename);
            if (stats.size > 5000) {
              console.log("Arquivo tem conteúdo, tentando processar mesmo com timeout");
              clearTimeout(timeout);
              
              if (audioStream && !audioStream.destroyed) {
                audioStream.destroy();
              }
              
              if (outputStream && !outputStream.closed) {
                outputStream.end();
              }
              
              this.convertSpeechToText(filename)
                .then(text => {
                  if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                  }
                  resolve(text);
                })
                .catch(err => {
                  console.error("Erro ao converter fala para texto após timeout:", err);
                  if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                  }
                  resolve("");
                });
            } else {
              console.log("Arquivo muito pequeno, descartando");
              if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
              }
              resolve("");
            }
          } else {
            console.log("Nenhum arquivo gerado, resolvendo com string vazia");
            resolve("");
          }
        }, 7000);
          const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        });
        
        if (!audioStream) {
          console.error(`Não foi possível criar stream de áudio para o usuário ${userId}`);
          clearTimeout(timeout);
          reject(new Error("Stream de áudio não criado"));
          return;
        }
        
        let packetCount = 0;
        
        audioStream.on('data', (chunk) => {
          packetCount++;
          if (packetCount % 10 === 0) {
            console.log(`Recebidos ${packetCount} pacotes de áudio do usuário ${userId}`);
          }
        });
        
        audioStream.on('end', () => {
          console.log(`Stream de áudio do usuário ${userId} finalizado. Total de pacotes: ${packetCount}`);
        });
        
        const outputStream = fs.createWriteStream(filename);
        
        const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
        
        pipeline(audioStream, opusDecoder, outputStream, async (error) => {
          clearTimeout(timeout);
          
          if (error) {
            console.error("Erro no pipeline de áudio:", error);
            
            if (fs.existsSync(filename)) {
              const stats = fs.statSync(filename);
              if (stats.size > 5000) {
                console.log("Pipeline falhou, mas arquivo tem conteúdo. Tentando processar...");
                
                this.convertSpeechToText(filename)
                  .then(text => {
                    fs.unlinkSync(filename);
                    resolve(text);
                  })
                  .catch(err => {
                    console.error("Erro ao converter fala para texto após erro no pipeline:", err);
                    if (fs.existsSync(filename)) {
                      fs.unlinkSync(filename);
                    }
                    resolve("");
                  });
              } else {
                console.log("Arquivo muito pequeno, descartando");
                fs.unlinkSync(filename);
                resolve("");
              }
            } else {
              reject(error);
            }
            return;
          }
            console.log("Gravação de áudio concluída, convertendo para texto...");
          
          try {
            const stats = fs.statSync(filename);
            if (stats.size < 5000) {
              console.log("Arquivo muito pequeno, provavelmente sem fala");
              fs.unlinkSync(filename);
              resolve("");
              return;
            }
            
            const text = await this.convertSpeechToText(filename);
            
            fs.unlinkSync(filename);
            
            resolve(text);
          } catch (err) {
            console.error("Erro ao converter fala para texto:", err);
            
            if (fs.existsSync(filename)) {
              fs.unlinkSync(filename);
            }
            
            resolve("");
          }
        });
      } catch (error) {
        console.error("Erro ao escutar áudio:", error);
        resolve("");
      }
    });
  },
    convertSpeechToText: async function(filePath) {
    try {
      console.log(`Analisando arquivo de áudio ${filePath}...`);
      
      const fileStats = fs.statSync(filePath);
      if (fileStats.size < 1000) {
        return "";
      }
      
      const wavFilePath = filePath.replace(".pcm", ".wav");
      
      try {
        execSync(`"${ffmpegStatic}" -y -f s16le -ar 48000 -ac 2 -i "${filePath}" "${wavFilePath}"`);
      } catch (error) {
        console.error("Erro ao converter PCM para WAV:", error);
        return "";
      }
      
      const wavStats = fs.statSync(wavFilePath);
      console.log("Tamanho do arquivo WAV:", wavStats.size, "bytes");
      
      if (wavStats.size < 50000) {
        console.log("Arquivo muito pequeno, provavelmente sem fala");
        
        if (fs.existsSync(wavFilePath)) {
          fs.unlinkSync(wavFilePath);
        }
        return "";
      }
      
      try {
        console.log("Transcrevendo áudio com Wit.ai...");
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(wavFilePath), {
          filename: path.basename(wavFilePath),
          contentType: 'audio/wav'
        });
        
        const response = await axios.post('https://api.wit.ai/speech', formData, {
          headers: {
            'Authorization': `Bearer ${WIT_AI_KEY}`,
            ...formData.getHeaders()
          }
        });
          const transcricao = response.data.text || "";
        console.log("Texto transcrito pelo Wit.ai:", transcricao);
        
        if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath);
        
        return transcricao;
      } catch (witError) {
        console.error("Erro ao transcrever com Wit.ai:", witError.message);
        console.log("Tentando usar OpenAI como fallback...");
        
        if (process.env.OPENAI_API_KEY) {
          try {
            console.log("Transcrevendo áudio com OpenAI API...");
            
            const mp3FilePath = wavFilePath.replace(".wav", ".mp3");
            execSync(`"${ffmpegStatic}" -i "${wavFilePath}" -codec:a libmp3lame -qscale:a 2 "${mp3FilePath}"`);
            
            const formData = new FormData();
            formData.append('file', fs.createReadStream(mp3FilePath));
            formData.append('model', 'whisper-1');
            formData.append('language', 'pt');
            
            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders()
              }
            });
            
            const transcricao = response.data.text;
            console.log("Texto transcrito pela OpenAI:", transcricao);
            
            if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath);
            if (fs.existsSync(mp3FilePath)) fs.unlinkSync(mp3FilePath);
            
            return transcricao || "";
          } catch (apiError) {
            console.error("Erro ao transcrever com OpenAI API:", apiError.message);
            
            if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath);
            
            return "Desculpe, não consegui transcrever o que você disse. Pode tentar novamente?";
          }
        } else {
          console.log("Nenhuma API de fallback configurada");
          
          if (fs.existsSync(wavFilePath)) fs.unlinkSync(wavFilePath);
          
          return "Não consegui entender o que você disse. Por favor, tente novamente.";
        }
      }
    } catch (error) {
      console.error("Erro geral na conversão de fala para texto:", error);
      return "";
    }
  },
    checkAudioFile: async function(filePath) {
    try {
      const fileStats = fs.statSync(filePath);
      if (fileStats.size > 10000) {
        return "valid";
      } else {
        console.log("Arquivo de áudio muito pequeno ou vazio");
        return "empty";
      }
    } catch (error) {
      console.error("Erro ao verificar arquivo de áudio:", error);
      return "error";
    }
  }
};

module.exports = stt;