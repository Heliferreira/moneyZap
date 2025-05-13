const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const categorias = require('./categorias');
const app = express();

app.use(express.json());

const arquivoGastos = path.join(__dirname, 'gastos.json');

if (!fs.existsSync(arquivoGastos)) {
  fs.writeFileSync(arquivoGastos, '[]');
}

function lerGastos() {
  try {
    const dados = fs.readFileSync(arquivoGastos);
    return JSON.parse(dados);
  } catch (err) {
    console.error('Erro ao ler gastos.json:', err);
    return [];
  }
}

function salvarGasto(gasto) {
  const dados = lerGastos();
  dados.push(gasto);
  fs.writeFileSync(arquivoGastos, JSON.stringify(dados, null, 2));
}

// 🔁 Função que envia mensagem de volta via Z-API
async function enviarResposta(numero, mensagem) {
  const instanciaId = '3E126FC63F55D002CB47AAEF140028B5';
  const token = '2041E2CA4AF17D4509230A8D';

  const url = `https://api.z-api.io/instances/${instanciaId}/token/${token}/send-text`;

  try {
    await axios.post(url, {
      phone: numero,
      message: mensagem
    });
    console.log('✅ Mensagem enviada para o usuário:', numero);
  } catch (err) {
    console.error('❌ Erro ao enviar resposta ao WhatsApp:', err.message);
  }
}

function gerarResumo(gastos, tipo) {
  let total = 0;
  const categorias = {};

  for (const gasto of gastos) {
    total += gasto.valor;
    if (!categorias[gasto.categoria]) {
      categorias[gasto.categoria] = 0;
    }
    categorias[gasto.categoria] += gasto.valor;
  }

  let resposta = `📊 *Seu relatório ${tipo}:*\n- Total: R$ ${total.toFixed(2)}\n`;
  for (const cat in categorias) {
    resposta += `- ${cat}: R$ ${categorias[cat].toFixed(2)}\n`;
  }
  resposta += `- Lançamentos: ${gastos.length}`;
  return resposta;
}

// 🟢 Webhook da Z-API
app.post('/webhook', async (req, res) => {
  console.log('Recebido da Z-API:', JSON.stringify(req.body, null, 2));

  let mensagem = '';
  try {
    mensagem = String(req.body.texto?.message || '').toLowerCase().trim();
  } catch (err) {
    console.log('❌ Erro ao extrair mensagem:', err.message);
  }

  console.log('📨 Mensagem recebida:', mensagem);

  const numero = req.body.telefone || 'desconhecido';
  console.log('📱 Número recebido:', numero);

  const hoje = new Date();
  const gastos = lerGastos();

  // Relatório semanal
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

    console.log(`🔄 Enviando para Z-API: ${numero} => ${resposta}`);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // Relatório mensal
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

    console.log(`🔄 Enviando para Z-API: ${numero} => ${resposta}`);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // Relatório geral
  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    const resposta = meusGastos.length === 0
      ? 'Nenhum gasto encontrado para você ainda 😕'
      : gerarResumo(meusGastos, 'geral');

    console.log(`🔄 Enviando para Z-API: ${numero} => ${resposta}`);
    await enviarResposta(numero, resposta);
    return res.sendStatus(200);
  }

  // Cadastro de gasto
  const textoLimpo = mensagem.replace(/\s+/g, ' ').trim();
  console.log('🧾 Texto limpo:', textoLimpo);

  const valorMatch = textoLimpo.match(/\d+(?:[\.,]\d{1,2})?/);
  console.log('🔍 Resultado do match:', valorMatch);

  const valor = valorMatch ? parseFloat(valorMatch[0].replace(',', '.')) : null;

  if (!valor) {
    console.log('🔴 Nenhum valor reconhecido na mensagem:', textoLimpo);
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
  console.log(`✅ Gasto registrado: ${JSON.stringify(gasto)}`);

  const resposta = `✅ Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${gasto.data}`;
  console.log(`🔄 Enviando para Z-API: ${numero} => ${resposta}`);
  await enviarResposta(numero, resposta);
  res.sendStatus(200);
});

// 🔎 Relatório por navegador
app.get('/relatorio/:usuario', (req, res) => {
  const usuario = req.params.usuario;
  const gastos = lerGastos();
  const gastosUsuario = gastos.filter(g => g.usuario === usuario);

  if (gastosUsuario.length === 0) {
    return res.send(`Nenhum gasto encontrado para o usuário ${usuario}`);
  }

  let total = 0;
  const categorias = {};

  for (const gasto of gastosUsuario) {
    total += gasto.valor;
    if (!categorias[gasto.categoria]) {
      categorias[gasto.categoria] = 0;
    }
    categorias[gasto.categoria] += gasto.valor;
  }

  const resposta = {
    usuario,
    total: `R$ ${total.toFixed(2)}`,
    categorias,
    quantidade: gastosUsuario.length
  };

  res.json(resposta);
});

// 💾 Rota de backup
app.get('/backup', (req, res) => {
  try {
    const dados = fs.readFileSync(arquivoGastos);
    const nomeArquivo = `gastos-backup-${Date.now()}.json`;

    res.header('Content-Type', 'application/json');
    res.attachment(nomeArquivo);
    res.send(dados);
  } catch (err) {
    console.error('Erro ao gerar backup:', err);
    res.status(500).send('Erro ao gerar backup.');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
