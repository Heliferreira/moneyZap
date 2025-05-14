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
app.post('/webhook', async (req, res) => {
  console.log('\n🔍 REQ.BODY INTEIRO 🔍');
  console.dir(req.body, { depth: null });

  const textoRaw = req.body.texto || req.body.text;
  const numero = (req.body.telefone || req.body.from || '').toString().trim();
  console.log('📱 Número recebido:', numero);

  let mensagem = '';
  if (typeof textoRaw === 'object' && (textoRaw.message || textoRaw.mensagem)) {
    mensagem = (textoRaw.message || textoRaw.mensagem).toLowerCase().trim();
  }

  const hoje = new Date().toISOString().split('T')[0];
  const gastos = lerGastos();

  // 🧾 Captura valor numérico da mensagem
  const valorMatch = mensagem.match(/(\d+[\.,]?\d*)/);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null;

  // 🏷️ Detectar categoria
  let categoriaDetectada = 'Outros';
  for (const palavra in categorias) {
    if (mensagem.includes(palavra)) {
      categoriaDetectada = categorias[palavra];
      break;
    }
  }

  if (mensagem.includes('relatório semanal')) {
    const hojeObj = new Date();
    const diaSemana = hojeObj.getDay(); // 0 = domingo
    const inicioSemana = new Date(hojeObj);
    inicioSemana.setDate(hojeObj.getDate() - diaSemana);

    const gastosSemana = gastos.filter(g => {
      const dataGasto = new Date(g.data);
      return g.usuario === numero && dataGasto >= inicioSemana && dataGasto <= hojeObj;
    });

    const resposta = gerarResumo(gastosSemana, 'semanal');
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  if (mensagem.includes('relatório mensal')) {
    const hojeObj = new Date();
    const ano = hojeObj.getFullYear();
    const mes = hojeObj.getMonth();
    const inicioMes = new Date(ano, mes, 1);

    const gastosMes = gastos.filter(g => {
      const dataGasto = new Date(g.data);
      return g.usuario === numero && dataGasto >= inicioMes && dataGasto <= hojeObj;
    });

    const resposta = gerarResumo(gastosMes, 'mensal');
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);
    const resposta = gerarResumo(meusGastos, 'geral');
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // Registrar gasto se valor for reconhecido
  if (valor) {
    const gasto = {
      usuario: numero,
      valor,
      categoria: categoriaDetectada,
      data: hoje
    };

    salvarGasto(gasto);

    const resposta = `✅ Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${hoje}`;
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ❌ Mensagem inválida
  const respostaErro = '❌ Não entendi sua mensagem. Envie por exemplo: "gastei 25 no mercado" ou "relatório semanal".';
  await enviarResposta(numero, respostaErro);
  return res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
