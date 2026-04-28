import express from "express";
import {and, asc, between, eq, getTableColumns, gte, ilike, lte, sql} from "drizzle-orm";
import {lotesProduccion, productos, inventario} from "../db/schema";
import {db} from "../db";

const router = express.Router();
router.get('/', async (req, res) => {
    const {search, tipo, date, startDate, endDate, page = 1, limit = 10} = req.query;
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); //max 100 records per page
    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // If search query exists, filter by product flavor
    if (search) {
        filterConditions.push(ilike(productos.sabor, `%${search}%`));
    }

    if (tipo) {
        const tipoPattern = `%${String(tipo).replace(/[%_]/g, '\\$&')}%`;
        filterConditions.push(ilike(productos.tipo, tipoPattern));
    }

    // Single date (today or user-picked date): ?date=2025-04-21
    if (date) {
        filterConditions.push(eq(lotesProduccion.fechaProduccion, String(date)));
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
        .select({count: sql<number>`count(*)`})
        .from(lotesProduccion)
        .innerJoin(productos, eq(productos.id, lotesProduccion.productoId))
        .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const lotesList = await db
        .select({
            ...getTableColumns(lotesProduccion),
            producto: {
                productoId: productos.id,
                sabor: productos.sabor,
                tipo: productos.tipo,


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

router.post('/', async (req, res) => {
    try {
        const { productoPublicId, fechaProduccion, cantidadProducida, costoProduccion } = req.body;

        if (!productoPublicId || !fechaProduccion || !cantidadProducida || !costoProduccion) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        const result = await db.transaction(async (tx) => {
            // 1. Verificar si el producto existe por su publicId
            const [producto] = await tx
                .select({ id: productos.id })
                .from(productos)
                .where(eq(productos.publicId, productoPublicId));

            if (!producto) {
                throw new Error("Producto no encontrado");
            }

            const internalProductoId = producto.id;

            // 2. Insertar el nuevo lote de producción
            const [nuevoLote] = await tx
                .insert(lotesProduccion)
                .values({
                    productoId: internalProductoId,
                    fechaProduccion: fechaProduccion,
                    cantidadProducida: cantidadProducida,
                    costoProduccion: costoProduccion,
                })
                .returning();

            // 3. Actualizar o insertar en el inventario (Upsert)
            await tx
                .insert(inventario)
                .values({
                    productoId: internalProductoId,
                    cantidad: cantidadProducida,
                    actualizadoEn: new Date(),
                })
                .onConflictDoUpdate({
                    target: inventario.productoId,
                    set: {
                        cantidad: sql`${inventario.cantidad} + ${cantidadProducida}`,
                        actualizadoEn: new Date(),
                    },
                });

            return nuevoLote;
        });

        res.status(201).json({ data: result });

    } catch (e: any) {
        console.error(`POST /lotes_produccion error: ${e}`);
        if (e.message === "Producto no encontrado") {
            return res.status(404).json({ message: e.message });
        }
        res.status(500).send("Error al crear el lote de producción");
    }
});

export default router;