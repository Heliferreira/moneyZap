const express = require('express');
const fs = require('fs');
const categorias = require('./categorias');
const app = express();

app.use(express.json());

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

  // Salvar no JSON
  const dados = JSON.parse(fs.readFileSync('gastos.json'));
  dados.push(gasto);
  fs.writeFileSync('gastos.json', JSON.stringify(dados, null, 2));

  console.log(`Gasto registrado: ${JSON.stringify(gasto)}`);
  res.send(`Gasto registrado!\n- Valor: R$ ${valor}\n- Categoria: ${categoriaDetectada}\n- Data: ${hoje}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bot rodando na porta ${PORT}`);
});

