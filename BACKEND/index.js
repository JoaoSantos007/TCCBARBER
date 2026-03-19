const express = require('express')   
const cors = require('cors')  
const mysql = require('mysql2/promise')  
const app = express()   

app.use(cors())  
app.use(express.json())  

const conexao = require("./db.js") 
const porta = 3000   


const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


 
app.listen(porta,()=>(   
    console.log(`servidor rodando em http://localhost:${porta}`)   
)) 


app.post('/cadastrar',async (req,res)=>{ 

    try { 
        const {nome_completo,cep, email, senha} = req.body 
        const [resultado] = await conexao.query(`INSERT INTO usuarios (nome_completo,cep, email, senha) VALUES ("${nome_completo}","${cep}","${email}","${senha}")`) 
        res.send(resultado) 
    } catch (error) { 
        console.log(error) 
    } 
}) 

app.get('/buscar',async(req,res)=>{ 

    try { 
        const [resultado] = await conexao.query(`SELECT * FROM usuarios`) 
        res.send(resultado) 
    } catch (error) { 
        console.log(error) 
    } 
}) 

app.put('/atualizar', async (req,res)=>{ 

    try { 
        const {id, nome_completo,cep, email, senha} = req.body 
        const [resultado] = await conexao.query(`UPDATE usuarios SET nome_completo = '${nome_completo}', cep = '${cep}', email ='${email}', email ='${senha}' WHERE id = ${id} `) 
        res.send(resultado) 
    } catch (error) { 
        console.log(error) 
    } 
}) 

 

app.delete('/deletar',async(req,res)=>{ 

    try { 
        const {id} = req.body 
        const [resultado] = await conexao.query(`DELETE FROM usuarios WHERE id = ${id} `) 
        res.send(resultado) 
    } catch (error) { 
        console.log(error) 
    } 
}) 