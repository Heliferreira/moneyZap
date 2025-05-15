const axios = require('axios');

const INSTANCIA_ID = '3E126FC63F55D002CB47AAEF140028B5';
const TOKEN = '2041E2CA4AF17D4509230A8D';

const API_URL = `https://api.z-api.io/instances/${INSTANCIA_ID}/token/${TOKEN}/send-text`;

async function enviarResposta(telefone, mensagem) {
  try {
    const config = {
  headers: {
    'Client-Token': TOKEN
  }
};

console.log('📦 Enviando payload:', {
  url: API_URL,
  phone: telefone,
  message: mensagem,
  headers: config.headers
});

const resposta = await axios.post(API_URL, {
  phone: telefone,
  message: mensagem
}, config);


    console.log(`✅ Mensagem enviada com sucesso para ${telefone}`);
    return resposta.data;
  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.response?.data || err.message);
  }
}

module.exports = { enviarResposta };
