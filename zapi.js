const axios = require('axios');

const API_URL = 'https://api.z-api.io/instances/3E126FC63F55D002CB47AAEF140028B5/token/2041E2CA4AF17D4509230A8D/send-text';

async function enviarResposta(telefone, mensagem) {
  try {
    const payload = {
      phone: telefone,
      message: mensagem
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': '2041E2CA4AF17D4509230A8D'
      }
    };

    console.log('📦 Enviando requisição...');
    console.log('URL:', API_URL);
    console.log('Payload:', JSON.stringify(payload));
    console.log('Headers:', JSON.stringify(config.headers));

    const resposta = await axios.post(API_URL, payload, config);

    console.log(`✅ Mensagem enviada com sucesso para ${telefone}`);
    return resposta.data;

  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.response?.data || err.message);
  }
}

module.exports = { enviarResposta };
