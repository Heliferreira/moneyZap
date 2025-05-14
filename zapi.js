const axios = require('axios');

// Dados reais da sua instância Z-API
const API_URL = 'https://api.z-api.io/instances/3E126FC63F55D002CB47AAEF140028B5/token/2041E2CA4AF17D4509230A8D/send-text';

// Função para corrigir número brasileiro (adiciona o 9 se faltar)
function corrigirNumero(numero) {
  if (typeof numero !== 'string') numero = numero.toString();

  // Ex: 554198765432 (sem o 9) → insere o 9 depois do DDD
  if (/^55\d{2}\d{8}$/.test(numero)) {
    return numero.slice(0, 4) + '9' + numero.slice(4);
  }

  // Ex: já vem com 13 dígitos corretos (DDI+DDD+9+Número)
  if (/^55\d{2}9\d{8}$/.test(numero)) {
    return numero;
  }

  // Qualquer outro formato → retorna como está (mas loga)
  console.warn('⚠️ Número pode estar em formato incorreto:', numero);
  return numero;
}

async function enviarResposta(telefone, mensagem) {
  try {
    const numeroCorrigido = corrigirNumero(telefone);
    console.log(`🔄 Enviando mensagem para ${numeroCorrigido}: ${mensagem}`);

    const resposta = await axios.post(API_URL, {
      phone: numeroCorrigido,
      message: mensagem
    });

    console.log(`✅ Mensagem enviada com sucesso para ${numeroCorrigido}`);
  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.response?.data || err.message);
  }
}

module.exports = { enviarResposta };
