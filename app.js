const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const categorias = require('./categorias');
const { enviarResposta } = require('./zapi');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para garantir leitura correta do corpo da requisição
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Funções auxiliares
function lerGastos() {
  if (!fs.existsSync('gastos.json')) return [];
  const dados = fs.readFileSync('gastos.json');
  return JSON.parse(dados);
}

function salvarGasto(gasto) {
  const gastos = lerGastos();
  gastos.push(gasto);
  fs.writeFileSync('gastos.json', JSON.stringify(gastos, null, 2));
}

function gerarResumo(gastos, tipo) {
  if (!gastos.length) return 'Nenhum gasto encontrado.';
  let total = 0;
  let texto = '📊 *Resumo de Gastos*\n';

  gastos.forEach(g => {
    total += g.valor;
    texto += `\n📅 ${g.data} | 💸 R$ ${g.valor.toFixed(2)} | 📂 ${g.categoria}`;
  });

  texto += `\n\n🔢 Total: R$ ${total.toFixed(2)}`;
  return texto;
}

// 🟢 Webhook 
// ✅ Webhook da Z-API
app.post('/webhook', async (req, res) => {
  console.log('🔍 REQ.BODY INTEIRO 🔍');
  console.dir(req.body, { depth: null });

  // Extrai os dados principais
  const textoRaw = req.body.texto;
  const numero = req.body.telefone || req.body.from || 'NÚMERO_NÃO_ENCONTRADO';

  console.log('📱 Número final utilizado:', numero);

  // Garante que a mensagem seja tratada como string
  let mensagem = '';
  if (typeof textoRaw === 'object' && (textoRaw.message || textoRaw.mensagem)) {
    mensagem = (textoRaw.message || textoRaw.mensagem).toLowerCase().trim();
  } else if (typeof textoRaw === 'string') {
    mensagem = textoRaw.toLowerCase().trim();
  }

  const hoje = new Date();
  const gastos = lerGastos();

  // ✅ Cadastro de gasto
  if (mensagem.startsWith('gastei')) {
    const valor = parseFloat(mensagem.replace(/[^0-9,.]/g, '').replace(',', '.'));
    const categoria = identificarCategoria(mensagem);

    const novoGasto = {
      usuario: numero,
      valor,
      categoria,
      data: hoje.toISOString().split('T')[0]
    };

    gastos.push(novoGasto);
    salvarGastos(gastos);

    const resposta = `✅ Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoria}\n- Data: ${novoGasto.data}`;
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ✅ Relatório geral
  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    const resposta = meusGastos.length === 0
      ? '❗ Nenhum gasto encontrado para você ainda.'
      : gerarResumo(meusGastos, 'geral');

    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ❌ Mensagem inválida
  const respostaErro = '❌ Não entendi sua mensagem. Envie por exemplo: "gastei 25 no mercado" ou "meu relatório".';
  await enviarResposta(numero, respostaErro);
  return res.sendStatus(200);
});


app.listen(PORT, () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
