const express = require('express')  
const cors = require('cors')  
const mysql = require('mysql2/promise')  
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()  
app.use(cors())  
app.use(express.json())  

const conexao = require("./db.js")
const porta = 3000  
const api_chave = "barbershop_secret_key_2024"

app.listen(porta, () => {  
    console.log(`✅ Servidor rodando em http://localhost:${porta}`)
    console.log(`📝 Documentação Swagger: http://localhost:${porta}/api-docs`)
})

// ================= CADASTRAR USUÁRIO =================
// Requisito 3c: Senha em branco no primeiro cadastro
app.post('/cadastrar', async (req, res) => {
    try {
        const { nome_completo, cep, email, senha } = req.body;
        
        // Verificar se email já existe
        const [existe] = await conexao.execute(
            'SELECT email FROM usuarios WHERE email = ?',
            [email]
        );
        
        if (existe.length > 0) {
            return res.status(400).json({ error: "Email já cadastrado!" });
        }
        
        // Se senha for vazia ou null, cadastra sem senha (primeiro acesso)
        let senhaHash = null;
        let primeiro_acesso = true;
        
        if (senha && senha.trim() !== '') {
            senhaHash = await bcrypt.hash(senha, 10);
            primeiro_acesso = false;
        }
        
        const [resultado] = await conexao.execute(
            'INSERT INTO usuarios (nome_completo, cep, email, senha, primeiro_acesso) VALUES (?, ?, ?, ?, ?)',
            [nome_completo, cep, email, senhaHash, primeiro_acesso]
        );
        
        res.json({ 
            insertId: resultado.insertId,
            mensagem: primeiro_acesso ? 
                "✅ Usuário criado! Ele precisará cadastrar uma senha no primeiro acesso." : 
                "✅ Usuário cadastrado com sucesso!"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao cadastrar usuário" });
    }
});

// ================= LOGIN =================
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [resultado] = await conexao.execute(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );

        if (resultado.length === 0) {
            return res.status(404).json({ mensagem: "❌ Email não encontrado!" });
        }

        const usuario = resultado[0];
        
        // Requisito 3c: Verificar se é primeiro acesso (senha não cadastrada)
        if (usuario.primeiro_acesso === 1 || !usuario.senha) {
            return res.status(403).json({ 
                mensagem: "🔄 Primeiro acesso! Cadastre sua senha.",
                primeiro_acesso: true,
                usuario_id: usuario.id_usuario
            });
        }

        const validou = await bcrypt.compare(senha, usuario.senha);

        if (!validou) {
            return res.status(401).json({ mensagem: "❌ Email ou senha inválidos!" });
        }

        const token = jwt.sign(
            { 
                id_usuario: usuario.id_usuario, 
                email: usuario.email, 
                nome: usuario.nome_completo 
            },
            api_chave,
            { expiresIn: "2h" }
        );

        res.json({ 
            mensagem: "✅ Login realizado com sucesso!", 
            token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nome: usuario.nome_completo,
                email: usuario.email,
                cep: usuario.cep
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ mensagem: "❌ Erro ao fazer login!" });
    }
});

// ================= BUSCAR TODOS USUÁRIOS =================
app.get('/buscar', async (req, res) => {
    try {
        const [resultado] = await conexao.query(
            'SELECT id_usuario, nome_completo, email, cep, primeiro_acesso FROM usuarios ORDER BY id_usuario DESC'
        );
        res.json(resultado);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

// ================= ATUALIZAR USUÁRIO =================
// Requisito 3a: Edição de usuários (nome, email, senha)
app.put('/atualizar', async (req, res) => {
    try {
        const { id_usuario, nome_completo, cep, email, senha } = req.body;
        
        let query = 'UPDATE usuarios SET nome_completo = ?, cep = ?, email = ?';
        const params = [nome_completo, cep, email];
        
        // Se senha foi fornecida, atualiza também
        if (senha && senha.trim() !== '') {
            const hash = await bcrypt.hash(senha, 10);
            query += ', senha = ?, primeiro_acesso = 0';
            params.push(hash);
        }
        
        query += ' WHERE id_usuario = ?';
        params.push(id_usuario);
        
        const [resultado] = await conexao.execute(query, params);
        
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        
        res.json({ 
            affectedRows: resultado.affectedRows,
            mensagem: "✅ Usuário atualizado com sucesso!"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
});

// ================= DELETAR USUÁRIO =================
app.delete('/deletar', async (req, res) => {
    try {
        const { id_usuario } = req.body;
        
        const [resultado] = await conexao.execute(
            'DELETE FROM usuarios WHERE id_usuario = ?',
            [id_usuario]
        );
        
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        
        res.json({ 
            affectedRows: resultado.affectedRows,
            mensagem: "✅ Usuário deletado com sucesso!"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao deletar usuário" });
    }
});

// ================= ESQUECI MINHA SENHA - SOLICITAR RECUPERAÇÃO =================
// Requisito 3b: Recuperação de senha
app.post('/esqueci-senha', async (req, res) => {
    const { email } = req.body;
    
    try {
        const [usuario] = await conexao.execute(
            'SELECT id_usuario, email, nome_completo FROM usuarios WHERE email = ?',
            [email]
        );
        
        if (usuario.length === 0) {
            return res.status(404).json({ mensagem: "❌ Email não encontrado!" });
        }
        
        // Gerar token único para troca de senha
        const resetToken = jwt.sign(
            { id_usuario: usuario[0].id_usuario, email: usuario[0].email },
            api_chave,
            { expiresIn: "30min" }
        );
        
        // Remover tokens antigos deste usuário
        await conexao.execute(
            'DELETE FROM reset_tokens WHERE id_usuario = ?',
            [usuario[0].id_usuario]
        );
        
        // Salvar novo token no banco
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 30);
        
        await conexao.execute(
            'INSERT INTO reset_tokens (id_usuario, token, expira_em) VALUES (?, ?, ?)',
            [usuario[0].id_usuario, resetToken, expiraEm]
        );
        
        // Retornar token para demonstração (em produção enviaria por email)
        res.json({ 
            mensagem: "✅ Link de recuperação gerado! (Em produção seria enviado por email)",
            token: resetToken,
            link_demo: `http://localhost:3000/resetar.html?token=${resetToken}`
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao processar solicitação" });
    }
});

// ================= RESETAR SENHA =================
// Requisito 3b: Trocar senha
app.post('/resetar-senha', async (req, res) => {
    const { token, nova_senha } = req.body;
    
    if (!nova_senha || nova_senha.trim() === '') {
        return res.status(400).json({ error: "❌ Senha não pode estar vazia!" });
    }
    
    if (nova_senha.length < 6) {
        return res.status(400).json({ error: "❌ Senha deve ter no mínimo 6 caracteres!" });
    }
    
    try {
        // Verificar se token existe e não foi usado
        const [tokenValido] = await conexao.execute(
            'SELECT * FROM reset_tokens WHERE token = ? AND usado = 0 AND expira_em > NOW()',
            [token]
        );
        
        if (tokenValido.length === 0) {
            return res.status(400).json({ error: "❌ Token inválido ou expirado! Solicite nova recuperação." });
        }
        
        // Decodificar token
        const decoded = jwt.verify(token, api_chave);
        
        // Hash da nova senha
        const hash = await bcrypt.hash(nova_senha, 10);
        
        // Atualizar senha do usuário
        await conexao.execute(
            'UPDATE usuarios SET senha = ?, primeiro_acesso = 0 WHERE id_usuario = ?',
            [hash, decoded.id_usuario]
        );
        
        // Marcar token como usado
        await conexao.execute(
            'UPDATE reset_tokens SET usado = 1 WHERE token = ?',
            [token]
        );
        
        res.json({ mensagem: "✅ Senha alterada com sucesso! Agora você pode fazer login." });
    } catch (error) {
        console.log(error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: "❌ Token inválido!" });
        }
        res.status(500).json({ error: "Erro ao resetar senha" });
    }
});

// ================= CADASTRAR SENHA NO PRIMEIRO ACESSO =================
app.post('/primeiro-acesso', async (req, res) => {
    const { id_usuario, nova_senha } = req.body;
    
    if (!nova_senha || nova_senha.trim() === '') {
        return res.status(400).json({ error: "❌ Senha não pode estar vazia!" });
    }
    
    if (nova_senha.length < 6) {
        return res.status(400).json({ error: "❌ Senha deve ter no mínimo 6 caracteres!" });
    }
    
    try {
        const hash = await bcrypt.hash(nova_senha, 10);
        
        const [resultado] = await conexao.execute(
            'UPDATE usuarios SET senha = ?, primeiro_acesso = 0 WHERE id_usuario = ? AND primeiro_acesso = 1',
            [hash, id_usuario]
        );
        
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Usuário não encontrado ou já possui senha!" });
        }
        
        res.json({ mensagem: "✅ Senha cadastrada com sucesso! Agora você pode fazer login." });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Erro ao cadastrar senha" });
    }
});