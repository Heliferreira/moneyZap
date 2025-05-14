const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const categorias = require('./categorias');
const { enviarResposta } = require('./zapi');

const app = express();

// 🛠️ Garante que o corpo da requisição será interpretado corretamente
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function lerGastos() {
  try {
    const dados = fs.readFileSync('gastos.json', 'utf-8');
    return JSON.parse(dados);
  } catch (err) {
    return [];
  }
}

function salvarGastos(novosGastos) {
  fs.writeFileSync('gastos.json', JSON.stringify(novosGastos, null, 2));
}

function gerarResumo(gastos, tipo) {
  const total = gastos.reduce((soma, g) => soma + g.valor, 0);
  const categoriasResumo = {};
  for (const gasto of gastos) {
    if (!categoriasResumo[gasto.categoria]) {
      categoriasResumo[gasto.categoria] = 0;
    }
    categoriasResumo[gasto.categoria] += gasto.valor;
  }

  let resposta = `📊 *Seu relatório ${tipo}:*\n- Total: R$ ${total.toFixed(2)}\n`;
  for (const cat in categoriasResumo) {
    resposta += `- ${cat}: R$ ${categoriasResumo[cat].toFixed(2)}\n`;
  }
  resposta += `\n🧾 Lançamentos: ${gastos.length}`;
  return resposta;
}

  // 🟢 Webhook da Z-API
// 🟢 Webhook da Z-API
app.post('/webhook', async (req, res) => {
  console.log('📦 REQ.BODY INTEIRO:');
  console.dir(req.body, { depth: null });

  // 📱 Captura o número corretamente (pode vir em campos diferentes)
  const numero =
    (req.body.telefone ?? req.body.from ?? req.body.connectedPhone ?? '').toString().trim();

  if (!numero) {
    console.warn('⚠️ Número pode estar em formato incorreto:', numero);
  }
  console.log('📱Número recebido:', numero);

  // 🧾 Captura o texto da mensagem
  const textoRaw = req.body.texto;
  let mensagem = '';
  if (typeof textoRaw === 'object' && (textoRaw.message || textoRaw.mensagem)) {
    mensagem = (textoRaw.message || textoRaw.mensagem).toLowerCase().trim();
  }

  console.log('📨 Mensagem recebida:', mensagem);

  const hoje = new Date();
  const gastos = lerGastos();

  // 💵 Detectar valor
  const valorMatch = mensagem.match(/(\d+[\.,]?\d*)/);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null;

  // 🗂️ Detectar categoria
  let categoriaDetectada = 'Outros';
  for (const palavra in categorias) {
    if (mensagem.includes(palavra)) {
      categoriaDetectada = categorias[palavra];
      break;
    }
  }

  // 📤 Responder com base na mensagem
  let resposta = '';
  if (mensagem.includes('relatório semanal')) {
    const diaDaSemana = hoje.getDay();
    const domingo = new Date(hoje);
    domingo.setDate(hoje.getDate() - diaDaSemana);

    const meusGastos = gastos.filter(g => {
      const data = new Date(g.data);
      return g.usuario === numero && data >= domingo && data <= hoje;
    });

    resposta =
      meusGastos.length === 0
        ? '📊 Nenhum gasto registrado entre domingo e hoje 💤'
        : gerarResumo(meusGastos, 'semanal (domingo a hoje)');
  } else if (mensagem.includes('relatório mensal')) {
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const primeiroDia = new Date(anoAtual, mesAtual, 1);

    const meusGastos = gastos.filter(g => {
      const data = new Date(g.data);
      return g.usuario === numero && data >= primeiroDia && data <= hoje;
    });

    resposta =
      meusGastos.length === 0
        ? '📊 Nenhum gasto registrado neste mês 💤'
        : gerarResumo(meusGastos, 'mensal (1º até hoje)');
  } else if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    resposta =
      meusGastos.length === 0
        ? '📊 Nenhum gasto encontrado para você ainda 😬'
        : gerarResumo(meusGastos, 'geral');
  } else if (valor) {
    const novoGasto = {
      usuario: numero,
      valor,
      categoria: categoriaDetectada,
      data: hoje.toISOString().split('T')[0],
    };

    const dados = lerGastos();
    dados.push(novoGasto);
    salvarGastos(dados);

    resposta = `✅ Gasto registrado com sucesso!\n💰 Valor: R$ ${valor}\n📂 Categoria: ${categoriaDetectada}`;
  } else {
    resposta =
      '❌ Não entendi sua mensagem. Envie por exemplo: "gastei 25 no mercado" ou "relatório semanal".';
  }

  console.log(`🔄 Enviando mensagem para ${numero}: ${resposta}`);
  await enviarResposta(numero, resposta);

  res.sendStatus(200);
});

  // 📋 Relatório geral
  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    const resposta = meusGastos.length === 0
      ? '📉 Nenhum gasto encontrado para você ainda.'
      : gerarResumo(meusGastos, 'geral');

    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // ❌ Mensagem inválida
else {
  const respostaErro = '❌ Não entendi sua mensagem. Envie por exemplo: "gastei 25 no mercado" ou "relatório semanal".';
  await enviarResposta(numero, respostaErro);
  return res.sendStatus(200);
};

// 📦 Rota de backup
app.get('/backup', (req, res) => {
  try {
    const dados = fs.readFileSync('gastos.json');
    const nomeArquivo = `gastos-backup-${Date.now()}.json`;
    res.header('Content-Type', 'application/json');
    res.attachment(nomeArquivo);
    res.send(dados);
  } catch (err) {
    console.error('Erro ao gerar backup:', err);
    res.status(500).send('Erro ao gerar backup.');
  }
});

// 🌐 Rota padrão para teste no navegador
app.get('/', (req, res) => {
  res.send('🚀 API MoneyZap está rodando com sucesso!');
});

// 🟢 Inicia o servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
