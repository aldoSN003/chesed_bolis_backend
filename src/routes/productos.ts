import express from "express";
import {and, asc, getTableColumns, ilike, sql} from "drizzle-orm";
import {productos} from "../db/schema";
import {db} from "../db";

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const {search, tipo, page = 1, limit = 10} = req.query;
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); //max 100 records per page
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // If search query exists, filter by product flavor
        if (search) {
            filterConditions.push(
                ilike(productos.sabor, `%${search}%`)
            );
        }

        // if tipo query exists, filter by product type
        if (tipo) {
            const tipoPattern = `%${String(tipo).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(productos.tipo, tipoPattern));
        }

        // combine all conditions using AND
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(productos)
            .where(whereClause);
        const totalCount = countResult[0]?.count ?? 0;
        const productosList = await db
            .select({...getTableColumns(productos)})
            .from(productos)
            .where(whereClause)
            .orderBy(asc(productos.sabor))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json(
            {
                data: productosList,
                pagination: {
                    page: currentPage,
                    limit: limitPerPage,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limitPerPage)
                }
            }
        )


    } catch (e) {
        console.log(`GET /productos error: ${e}`);
        res.status(500).send("Error al obtener los productos");
    }
})
//productos (sabor, contenido_ml, tipo, precio_venta, costo_produccion_actual)
//('Oreo', 300, 'leche', 23, 11.53),
router.post('/', async (req, res) => {
    try {
        const {sabor, contenido_ml, tipo, precio_venta, costo_produccion_actual} = req.body;
        const [createdProduct] = await db
            .insert(productos)
            .values({sabor, contenido_ml, tipo, precio_venta, costo_produccion_actual})
            .returning({
                id: productos.id,
                public_id: productos.publicId,
                sabor: productos.sabor,
                tipo: productos.tipo,
                precio_venta: productos.precio_venta,
                costo_produccion_actual: productos.costo_produccion_actual
            });

        if (!createdProduct) throw Error;

        res.status(201).json({data: createdProduct});

    } catch (e) {
        console.log(`POST /productos error: ${e}`);
        res.status(500).send("Error al crear el producto");
    }
})

export default router;