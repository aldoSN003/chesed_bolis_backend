import express from "express";
import {and, asc, between, eq, getTableColumns, gte, ilike, lte, sql} from "drizzle-orm";
import {lotesProduccion, productos} from "../db/schema";
import {db} from "../db";

const router = express.Router();
router.get('/',async (req, res) => {
    const {search,tipo, date,startDate,endDate, page = 1, limit = 10} = req.query;
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); //max 100 records per page
    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // If search query exists, filter by product flavor
    if (search) {
        filterConditions.push(ilike(productos.sabor, `%${search}%`));
    }

    if(tipo){
        const tipoPattern = `%${String(tipo).replace(/[%_]/g, '\\$&')}%`;
        filterConditions.push(ilike(productos.tipo, tipoPattern));
    }

    // Single date (today or user-picked date): ?date=2025-04-21
    if(date){
        filterConditions.push(eq(lotesProduccion.fechaProduccion,String(date)));
    }

    // Date range: ?startDate=2025-04-01&endDate=2025-04-21
    if (startDate && endDate) {
        filterConditions.push(
            between(lotesProduccion.fechaProduccion, String(startDate), String(endDate))
        );
    } else if (startDate) {
        filterConditions.push(gte(lotesProduccion.fechaProduccion, String(startDate)));
    } else if (endDate) {
        filterConditions.push(lte(lotesProduccion.fechaProduccion, String(endDate)));
    }


    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(lotesProduccion)
        .innerJoin(productos, eq(productos.id, lotesProduccion.productoId))
        .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const lotesList = await db
        .select({
            ...getTableColumns(lotesProduccion),
      producto:{
                productoId:productos.id,
          sabor:productos.sabor,
          tipo:productos.tipo,


      }
        })
        .from(lotesProduccion)
        .innerJoin(productos, eq(productos.id, lotesProduccion.productoId))
        .where(whereClause)
        .orderBy(asc(lotesProduccion.fechaProduccion))
        .limit(limitPerPage)
        .offset(offset);



    res.status(200).json({
        data: lotesList,
        pagination: {
            page: currentPage,
            limit: limitPerPage,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitPerPage)
        }
    });

})

export default router;