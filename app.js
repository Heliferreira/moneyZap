const express = require('express');
const fs = require('fs');
const path = require('path');
const categorias = require('./categorias');
const app = express();

app.use(express.json());

// ✅ Rota padrão de status
app.get('/', (req, res) => {
  res.send('MoneyZap rodando 🔥');
});

// ✅ Caminho para o arquivo de dados
const arquivoGastos = path.join(__dirname, 'gastos.json');

// ✅ Criar arquivo se não existir
if (!fs.existsSync(arquivoGastos)) {
  fs.writeFileSync(arquivoGastos, '[]');
}

// ✅ Função para ler gastos com segurança
function lerGastos() {
  try {
    const dados = fs.readFileSync(arquivoGastos);
    return JSON.parse(dados);
  } catch (err) {
    console.error('Erro ao ler gastos.json:', err);
    return [];
  }
}

// ✅ Função para salvar gasto
function salvarGasto(gasto) {
  const dados = lerGastos();
  dados.push(gasto);
  fs.writeFileSync(arquivoGastos, JSON.stringify(dados, null, 2));
}

// ✅ Rota principal do webhook
app.post('/webhook', (req, res) => {
  const mensagem = req.body.message?.toLowerCase() || '';
  const numero = req.body.from || 'desconhecido';
  const hoje = new Date().toISOString().split('T')[0];

  // Extrair valor
  const valorMatch = mensagem.match(/(\d+[\.,]?\d*)/);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null;

  // Detectar categoria
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

  // Criar gasto
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

// ✅ NOVA ROTA: Relatório por usuário
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
