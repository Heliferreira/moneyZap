const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const categorias = require('./categorias');
const { enviarResposta } = require('./zapi');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Utilitários
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

function identificarCategoria(mensagem) {
  for (const palavra in categorias) {
    if (mensagem.includes(palavra)) {
      return categorias[palavra];
    }
  }
  return 'Outros';
}

function gerarResumo(gastos) {
  if (!gastos.length) return 'Nenhum gasto encontrado.';
  let total = 0;
  let texto = '📊 *Resumo de Gastos*';


  gastos.forEach(g => {
    total += g.valor;
    texto += `\n📅 ${g.data} | 💸 R$ ${g.valor.toFixed(2)} | 📂 ${g.categoria}`;
  });

  texto += `\n\n🔢 Total: R$ ${total.toFixed(2)}`;
  return texto;
}

function filtrarPorPeriodo(gastos, inicio, fim) {
  return gastos.filter(g => {
    const data = new Date(g.data);
    return data >= inicio && data <= fim;
  });
}

function obterInicioDaSemana(data = new Date()) {
  const dia = data.getDay();
  const inicio = new Date(data);
  inicio.setDate(data.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function obterInicioDoMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function obterInicioDoDia(data = new Date()) {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

// 🟢 Webhook da Z-API
app.post('/webhook', async (req, res) => {
  console.log('🔍 REQ.BODY INTEIRO 🔍');
  console.dir(req.body, { depth: null });

  const textoRaw = req.body.texto || req.body.text?.mensagem || req.body.text?.message;
  const numero = req.body.telefone || req.body.Telefone || req.body.phone || req.body.from || 'NÚMERO_NÃO_ENCONTRADO';

  if (!numero) {
    console.error('❌ Número do remetente não encontrado.');
    return res.sendStatus(400);
  }

  console.log('📱 Número final utilizado:', numero);

  let mensagem = '';
  if (typeof textoRaw === 'object' && (textoRaw.message || textoRaw.mensagem)) {
    mensagem = (textoRaw.message || textoRaw.mensagem)
      .toLowerCase()
      .replace(/^"+|"+$/g, '')
      .trim();
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

    salvarGasto(novoGasto);

    const resposta = `✅ Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoria}\n- Data: ${novoGasto.data}`;
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ✅ Relatórios por período
  const meusGastos = gastos.filter(g => g.usuario === numero);

  if (mensagem.includes('relatório semanal')) {
    const inicio = obterInicioDaSemana();
    const fim = hoje;
    const filtrados = filtrarPorPeriodo(meusGastos, inicio, fim);
    const resposta = gerarResumo(filtrados);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  if (mensagem.includes('relatório mensal')) {
    const inicio = obterInicioDoMes();
    const fim = hoje;
    const filtrados = filtrarPorPeriodo(meusGastos, inicio, fim);
    const resposta = gerarResumo(filtrados);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  if (mensagem.includes('relatório diário')) {
    const inicio = obterInicioDoDia();
    const fim = hoje;
    const filtrados = filtrarPorPeriodo(meusGastos, inicio, fim);
    const resposta = gerarResumo(filtrados);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  if (mensagem.includes('meu relatório')) {
    const resposta = meusGastos.length === 0
      ? '❗ Nenhum gasto encontrado para você ainda.'
      : gerarResumo(meusGastos);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ❌ Comando inválido
  const respostaErro = '❌ Não entendi sua mensagem. Envie por exemplo: "gastei 25 no mercado", "relatório semanal", "relatório mensal" ou "relatório diário".';
  await enviarResposta(numero, respostaErro);
  return res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Bot rodando na porta ${PORT}`);
});
