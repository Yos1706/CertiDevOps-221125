const express = require('express');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env (archivo creado por la pipeline)
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a PostgreSQL usando variables de entorno
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'myapp_db',
    port: 5432,
    ssl: false 
};

// Middleware para permitir que el Frontend (Nginx en 128) acceda
app.use((req, res, next) => {
    // Permite acceso desde el origen del frontend
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Ruta de prueba que consulta la Base de Datos
app.get('/api/test', async (req, res) => {
    const client = new Client(dbConfig);

    try {
        await client.connect();
        
        // Consultar la tabla creada por la pipeline: deployment_test
        const result = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
        
        const tables = result.rows.map(row => row.tablename);
        const hasTestTable = tables.includes('deployment_test');

        res.json({
            status: 'success',
            message: 'Conexión a la DB exitosa. Las tres capas están comunicadas.',
            db_host: dbConfig.host,
            db_user: dbConfig.user,
            table_found: hasTestTable,
            tables_in_public_schema: tables
        });

    } catch (err) {
        console.error("Error al conectar o consultar la base de datos:", err.message);
        res.status(500).json({
            status: 'error',
            message: 'Fallo al conectar con la Base de Datos o ejecutar consulta.',
            db_config: { host: dbConfig.host, user: dbConfig.user, database: dbConfig.database },
            error_details: err.message
        });
    } finally {
        if (client) {
            await client.end();
        }
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Backend API Gateway corriendo en el puerto ${PORT}`);
});
