import express from "express";
import { and, asc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { inventario, productos } from "../db/schema";
import { db } from "../db";

const router = express.Router();

router.get('/', async (req, res) => {
    const { search, tipo, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // Filter by product flavor
    if (search) {
        filterConditions.push(ilike(productos.sabor, `%${search}%`));
    }

    // Filter by product type
    if (tipo) {
        const tipoPattern = `%${String(tipo).replace(/[%_]/g, '\\$&')}%`;
        filterConditions.push(ilike(productos.tipo, tipoPattern));
    }

    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(inventario)
        .innerJoin(productos, eq(productos.id, inventario.productoId))
        .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const inventarioList = await db
        .select({
            ...getTableColumns(inventario),
            producto: {
                productoId: productos.id,
                sabor: productos.sabor,
                tipo: productos.tipo,
            }
        })
        .from(inventario)
        .innerJoin(productos, eq(productos.id, inventario.productoId))
        .where(whereClause)
        .orderBy(asc(productos.sabor))
        .limit(limitPerPage)
        .offset(offset);

    res.status(200).json({
        data: inventarioList,
        pagination: {
            page: currentPage,
            limit: limitPerPage,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitPerPage)
        }
    });
});

export default router;