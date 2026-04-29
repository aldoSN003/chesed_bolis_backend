import express from 'express';
import cors from "cors";
import morgan from "morgan";
import productosRouter from "./routes/productos";
import lotesProduccionRouter from "./routes/lotes_produccion"
import inventarioRouter from "./routes/inventario"
import ventasRouter from "./routes/ventas"
import clientesRouter from "./routes/clientes"
import usuariosRouter from "./routes/usuarios"

const app = express();
const port = 8000;
// if(!process.env.FRONTEND_URL){
//     throw new Error("FRONTEND_URL is not defined");
// }

const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.HOST_FRONTEND_URL
].filter(Boolean); // .filter(Boolean) removes any undefined values if an env is missing

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
}));
// app.use(cors({
//     origin: process.env.FRONTEND_URL,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
// }))
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/productos",productosRouter)
app.use("/api/lotes",lotesProduccionRouter)
app.use("/api/inventario",inventarioRouter)
app.use("/api/ventas",ventasRouter)
app.use("/api/clientes", clientesRouter)
app.use("/api/usuarios", usuariosRouter)

app.get('/', (req, res) => {
    res.send('Welcome to the Chesed API!');
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

