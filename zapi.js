// ✅ zapi.js - Corrigido com Client-Token no cabeçalho
const axios = require('axios');

const INSTANCIA_ID = '3E126FC63F55D002CB47AAEF140028B5';
const TOKEN = '2041E2CA4AF17D4509230A8D';
const API_URL = `https://api.z-api.io/instances/${INSTANCIA_ID}/send-text`;


async function enviarResposta(telefone, mensagem) {
  try {
    const payload = {
      phone: telefone,
      message: mensagem
    };

    const config = {
      headers: {
        'Client-Token': TOKEN
      }
    };

    console.log('📦 Enviando requisição bruta com headers fixos:');
    console.log('URL:', API_URL);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Headers:', JSON.stringify(config.headers, null, 2));

    const resposta = await axios.post(API_URL, payload, config);

    console.log(`✅ Mensagem enviada com sucesso para ${telefone}`);
    return resposta.data;

  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.response?.data || err.message);
  }
}

module.exports = { enviarResposta };
