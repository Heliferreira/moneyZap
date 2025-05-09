const express = require('express');
const fs = require('fs');
const path = require('path');
const categorias = require('./categorias');
const app = express();

app.use(express.json());

// ✅ Rota básica
app.get('/', (req, res) => {
  res.send('MoneyZap rodando 🔥');
});

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

// ✅ Webhook
app.post('/webhook', (req, res) => {
  const mensagem = req.body.message?.toLowerCase() || '';
  const numero = req.body.from || 'desconhecido';
  const hoje = new Date().toISOString().split('T')[0];

  // ✅ Relatório via comando
  if (mensagem.includes('meu relatório')) {
    const gastos = lerGastos();
    const meusGastos = gastos.filter(g => g.usuario === numero);

    if (meusGastos.length === 0) {
      return res.send('Nenhum gasto encontrado para você ainda 😕');
    }

    let total = 0;
    const categorias = {};

    for (const gasto of meusGastos) {
      total += gasto.valor;
      if (!categorias[gasto.categoria]) {
        categorias[gasto.categoria] = 0;
      }
      categorias[gasto.categoria] += gasto.valor;
    }

    let resposta = `📊 *Seu relatório:*\n- Total: R$ ${total.toFixed(2)}\n`;
    for (const cat in categorias) {
      resposta += `- ${cat}: R$ ${categorias[cat].toFixed(2)}\n`;
    }
    resposta += `- Lançamentos: ${meusGastos.length}`;

    return res.send(resposta);
  }

  // ✅ Registrar gasto
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
    data: hoje
  };

  salvarGasto(gasto);

  console.log(`Gasto registrado: ${JSON.stringify(gasto)}`);
  res.send(`Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${hoje}`);
});

// ✅ Relatório via navegador
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

// ✅ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
