const axios = require('axios');

// Endpoint da sua instância na Z-API (SEM o token na URL)
const API_URL = 'https://api.z-api.io/instances/3E126FC63F55D002CB47AAEF140028B5/send-text';

// Token da sua instância (vai no header agora)
const TOKEN = '2041E2CA4AF17D4509230A8D';

// Função para corrigir número brasileiro (insere o 9 se faltar)
function corrigirNumero(numero) {
  if (typeof numero !== 'string') numero = numero.toString();

  // Se vier com 8 dígitos após o DDD, insere o 9
  if (/^55\d{2}\d{8}$/.test(numero)) {
    return numero.slice(0, 4) + '9' + numero.slice(4);
  }

  // Se já estiver no formato correto
  if (/^55\d{2}9\d{8}$/.test(numero)) {
    return numero;
  }

  console.warn('⚠️ Número pode estar em formato incorreto:', numero);
  return numero;
}

// Função principal para enviar a resposta
async function enviarResposta(telefone, mensagem) {
  try {
    const numeroCorrigido = corrigirNumero(telefone);
    console.log(`🔄 Enviando mensagem para ${numeroCorrigido}: ${mensagem}`);

    const resposta = await axios.post(
      API_URL,
      {
        phone: numeroCorrigido,
        message: mensagem
      },
      {
        headers: {
          'Client-Token': TOKEN
        }
      }
    );

    console.log(`✅ Mensagem enviada com sucesso para ${numeroCorrigido}`);
  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.response?.data || err.message);
  }
}

module.exports = { enviarResposta };

