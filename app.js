const express = require('express');
const fs = require('fs');
const path = require('path');
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
app.post('/webhook', (req, res) => {
  console.log('Recebido da Z-API:', JSON.stringify(req.body, null, 2));

  const mensagem = req.body.texto?.message?.toLowerCase() || '';
  const numero = req.body.telefone || 'desconhecido';
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

    if (meusGastos.length === 0) {
      return res.send('Nenhum gasto registrado entre domingo e hoje 🗓️');
    }

    return res.send(gerarResumo(meusGastos, 'semanal (domingo a hoje)'));
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

    if (meusGastos.length === 0) {
      return res.send('Nenhum gasto registrado neste mês 🗓️');
    }

    return res.send(gerarResumo(meusGastos, 'mensal (1º até hoje)'));
  }

  // Relatório geral
  if (mensagem.includes('meu relatório')) {
    const meusGastos = gastos.filter(g => g.usuario === numero);

    if (meusGastos.length === 0) {
      return res.send('Nenhum gasto encontrado para você ainda 😕');
    }

    return res.send(gerarResumo(meusGastos, 'geral'));
  }

  // Cadastro de gasto
  const valorMatch = mensagem.match(/(\d+[\.,]?\d*)/);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null;

  let categoriaDetectada = 'Outros';
  for (const palavra in categorias) {
    if (mensagem.includes(palavra)) {
      categoriaDetectada = categorias[palavra];
      break;
    }
  }

  if (!valor) {
    return res.send('Não consegui entender o valor. Tente algo como: "gastei 35 no mercado".');
  }

  const gasto = {
    usuario: numero,
    valor,
    categoria: categoriaDetectada,
    data: hoje.toISOString().split('T')[0]
  };

  salvarGasto(gasto);
  console.log(`Gasto registrado: ${JSON.stringify(gasto)}`);

  res.send(`Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${gasto.data}`);
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
