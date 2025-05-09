const express = require('express');
const fs = require('fs');
const path = require('path');
const categorias = require('./categorias');
const app = express();

app.use(express.json());

// ✅ Mensagem padrão na raiz (confirma que tá online)
app.get('/', (req, res) => {
  res.send('MoneyZap rodando 🔥');
});

// ✅ Caminho absoluto para o arquivo de gastos
const arquivoGastos = path.join(__dirname, 'gastos.json');

// ✅ Garante que o arquivo exista
if (!fs.existsSync(arquivoGastos)) {
  fs.writeFileSync(arquivoGastos, '[]');
}

// ✅ Função segura para ler o arquivo de gastos
function lerGastos() {
  try {
    const dados = fs.readFileSync(arquivoGastos);
    return JSON.parse(dados);
  } catch (err) {
    console.error('Erro ao ler gastos.json:', err);
    return [];
  }
}

// ✅ Função para salvar novo gasto
function salvarGasto(gasto) {
  const dados = lerGastos();
  dados.push(gasto);
  fs.writeFileSync(arquivoGastos, JSON.stringify(dados, null, 2));
}

app.post('/webhook', (req, res) => {
  const mensagem = req.body.message?.toLowerCase() || '';
  const numero = req.body.from || 'desconhecido';
  const hoje = new Date().toISOString().split('T')[0];

  // Extrair valor (número com ou sem vírgula)
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

  // Criar objeto do gasto
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

// Porta dinâmica para rodar no Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
