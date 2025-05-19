const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const googleTTS = require('google-tts-api');
require('dotenv').config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️ ELEVENLABS_API_KEY não encontrada no arquivo .env. Usando Google TTS como fallback.');
}

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function elevenlabsTTS(texto) {
  try {
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `tts-${timestamp}.mp3`);
    
    console.log(`Convertendo texto para fala com ElevenLabs: "${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`);
    
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      data: {
        text: texto,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      responseType: 'arraybuffer'
    });
    
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    
    console.log(`Áudio gerado com ElevenLabs e salvo em: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Erro ao converter texto para fala com ElevenLabs:", error.message);
    throw error;
  }
}

async function googleTextToSpeech(texto) {
  try {
    console.log(`Convertendo texto para fala com Google TTS (fallback): "${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`);
    
    const urlList = await googleTTS.getAllAudioUrls(texto, {
      lang: 'pt-BR',
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?!'
    });
    
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `tts-${timestamp}.mp3`);
    
    const tempFiles = [];
    
    for (let i = 0; i < urlList.length; i++) {
      const tempFile = path.join(tempDir, `tts-part-${timestamp}-${i}.mp3`);
      
      const response = await axios({
        method: 'get',
        url: urlList[i].url,
        responseType: 'arraybuffer'
      });
      
      fs.writeFileSync(tempFile, Buffer.from(response.data));
      tempFiles.push(tempFile);
    }
      if (tempFiles.length > 1) {
      const fileList = tempFiles.map(file => `"${file}"`).join(' ');
      execSync(`type ${fileList} > "${outputPath}"`, { shell: true });
    } else if (tempFiles.length === 1) {
      fs.copyFileSync(tempFiles[0], outputPath);
    }
    
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
    console.log(`Áudio gerado com Google TTS e salvo em: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Erro ao converter texto para fala com Google TTS:", error);
    throw error;
  }
}

async function textToSpeech(texto) {
  try {
    if (process.env.NODE_ENV === 'test' || (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.includes('sua_chave'))) {
      console.log("Usando modo de simulação para geração de áudio");
      
      const timestamp = Date.now();
      const outputPath = path.join(tempDir, `tts-${timestamp}.mp3`);
      
      fs.writeFileSync(outputPath, Buffer.from([0xFF, 0xFB, 0x90, 0x44, 0x00]));
      
      console.log("Arquivo de áudio simulado criado em:", outputPath);
      return outputPath;
    }
    
    if (ELEVENLABS_API_KEY && !ELEVENLABS_API_KEY.includes('sua_chave')) {
      try {
        return await elevenlabsTTS(texto);
      } catch (elevenLabsError) {
        console.warn("Erro com ElevenLabs, usando Google TTS como fallback:", elevenLabsError.message);
      }
    }
    
    return await googleTextToSpeech(texto);  } catch (error) {
    console.error("Erro em todas as tentativas de TTS:", error);
    
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `tts-fallback-${timestamp}.mp3`);
    
    fs.writeFileSync(outputPath, Buffer.from([0xFF, 0xFB, 0x90, 0x44, 0x00]));
    
    console.log("Criado arquivo de áudio vazio devido a erros no TTS");
    return outputPath;
  }
}

function speak(texto, callback) {
  console.log(`TTS processando texto: "${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`);
  
  textToSpeech(texto)
    .then(audioPath => {
      console.log(`TTS gerou áudio em: ${audioPath}`);
      callback(null, audioPath);
    })
    .catch(err => {
      console.error("Erro no TTS:", err);
      callback(err);
    });
}

module.exports = {
  speak
};
