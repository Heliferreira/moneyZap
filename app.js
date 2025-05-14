const express = require('express');
const fs = require('fs');
const categorias = require('./categorias');
const { enviarResposta } = require('./zapi'); // se você criou esse arquivo separado

const app = express();
app.use(express.json());

// Utilitário: ler e salvar gastos
const lerGastos = () => {
  try {
    return JSON.parse(fs.readFileSync('gastos.json'));
  } catch {
    return [];
  }
};
const salvarGasto = (gasto) => {
  const dados = lerGastos();
  dados.push(gasto);
  fs.writeFileSync('gastos.json', JSON.stringify(dados, null, 2));
};

// Utilitário: gerar resumo por categoria
const gerarResumo = (gastos, tipo) => {
  const categoriasResumo = {};
  let total = 0;

  for (const g of gastos) {
    total += g.valor;
    categoriasResumo[g.categoria] = (categoriasResumo[g.categoria] || 0) + g.valor;
  }

  let resposta = `📊 *Seu relatório ${tipo}:*\n- Total: R$ ${total.toFixed(2)}\n`;
  for (const cat in categoriasResumo) {
    resposta += `- ${cat}: R$ ${categoriasResumo[cat].toFixed(2)}\n`;
  }

  resposta += `\n📌 Lançamentos: ${gastos.length}`;
  return resposta;
};

// 🟢 Webhook da Z-API
app.post('/webhook', async (req, res) => {
  console.log('Recebido da Z-API:', JSON.stringify(req.body, null, 2));

  const textoRaw = req.body.texto;
  let mensagem = '';

  if (typeof textoRaw === 'string') {
    mensagem = textoRaw.toLowerCase().trim();
  } else if (typeof textoRaw === 'object' && textoRaw.message) {
    mensagem = textoRaw.message.toLowerCase().trim();
  }

  const numero = req.body.telefone || 'desconhecido';
  const hoje = new Date();
  const gastos = lerGastos();

  // 📅 Relatório semanal
  if (mensagem.includes('relatório semanal')) {
    const diaDaSemana = hoje.getDay();
    const domingo = new Date(hoje);
    domingo.setDate(hoje.getDate() - diaDaSemana);

    const meusGastos = gastos.filter(g => {
      const data = new Date(g.data);
      return g.usuario === numero && data >= domingo && data <= hoje;
    });

    const resposta = meusGastos.length === 0
      ? 'Nenhum gasto registrado entre domingo e hoje 🗓️'
      : gerarResumo(meusGastos, 'semanal (domingo a hoje)');

    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // 📆 Relatório mensal
  if (mensagem.includes('relatório mensal')) {
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const primeiroDia = new Date(anoAtual, mesAtual, 1);

    const meusGastos = gastos.filter(g => {
      const data = new Date(g.data);
      return g.usuario === numero && data >= primeiroDia && data <= hoje;
    });

    const resposta = meusGastos.length === 0
      ? 'Nenhum gasto registrado neste mês 🗓️'
      : gerarResumo(meusGastos, 'mensal (1º até hoje)');

    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // 📋 Relatório geral
  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    const resposta = meusGastos.length === 0
      ? 'Nenhum gasto encontrado para você ainda 😕'
      : gerarResumo(meusGastos, 'geral');

    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // 💸 Cadastro de gasto
  const textoLimpo = mensagem.replace(/\s+/g, ' ').trim();
  const valorMatch = textoLimpo.match(/\d+(?:[\.,]\d{1,2})?/);
  const valor = valorMatch ? parseFloat(valorMatch[0].replace(',', '.')) : null;

  if (!valor) {
    await enviarResposta(numero, '❌ Não consegui entender o valor. Tente algo como: "gastei 35 no mercado".');
    return res.sendStatus(200);
  }

  let categoriaDetectada = 'Outros';
  for (const palavra in categorias) {
    if (mensagem.includes(palavra)) {
      categoriaDetectada = categorias[palavra];
      break;
    }
  }

  const gasto = {
    usuario: numero,
    valor,
    categoria: categoriaDetectada,
    data: hoje.toISOString().split('T')[0]
  };

  salvarGasto(gasto);

  const resposta = `✅ Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${gasto.data}`;
  await enviarResposta(numero, resposta);
  res.sendStatus(200);
});

// 🔒 Porta do servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
});
