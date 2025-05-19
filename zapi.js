const axios = require('axios');

const INSTANCIA_ID = '3E126FC63F55D002CB47AAEF140028B5';
const TOKEN = 'B32E1BEB50B816C33D2C27FD';
const CLIENT_TOKEN = 'F7db7c86c49774947a0988d171f317f82S';

const API_URL = `https://api.z-api.io/instances/${INSTANCIA_ID}/token/${TOKEN}/send-text`;

async function enviarResposta(telefone, mensagem) {
  try {
    const payload = {
      phone: telefone,
      message: mensagem
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': CLIENT_TOKEN
      }
    };

    console.log('📦 Enviando requisição...');
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
