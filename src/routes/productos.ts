import express from "express";
import {and, asc, eq, getTableColumns, ilike, sql} from "drizzle-orm";
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



router.get('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const [producto] = await db
            .select()
            .from(productos)
            .where(eq(productos.publicId, publicId))
            .limit(1);

        if (!producto) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        res.status(200).json({ data: producto });

    } catch (e) {
        console.log(`GET /productos/:publicId error: ${e}`);
        res.status(500).send("Error al obtener el producto");
    }
});

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


router.delete('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const [deleted] = await db
            .delete(productos)
            .where(eq(productos.publicId, publicId))
            .returning({ id: productos.id });

        if (!deleted) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        res.status(200).json({ message: "Producto eliminado correctamente" });

    } catch (e) {
        console.log(`DELETE /productos/:publicId error: ${e}`);
        res.status(500).send("Error al eliminar el producto");
    }
});




router.put('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        const { sabor, contenido_ml, tipo, precio_venta, costo_produccion_actual } = req.body;

        // Build only the fields that were provided
        const updates: Partial<typeof productos.$inferInsert> = {};
        if (sabor !== undefined)                     updates.sabor = sabor;
        if (contenido_ml !== undefined)               updates.contenido_ml = contenido_ml;
        if (tipo !== undefined)                       updates.tipo = tipo;
        if (precio_venta !== undefined)               updates.precio_venta = precio_venta;
        if (costo_produccion_actual !== undefined)    updates.costo_produccion_actual = costo_produccion_actual;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No se proporcionaron campos para actualizar" });
        }

        const [updated] = await db
            .update(productos)
            .set(updates)
            .where(eq(productos.publicId, publicId))
            .returning({
                id: productos.id,
                public_id: productos.publicId,
                sabor: productos.sabor,
                tipo: productos.tipo,
                precio_venta: productos.precio_venta,
                costo_produccion_actual: productos.costo_produccion_actual
            });

        if (!updated) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        res.status(200).json({ data: updated });

    } catch (e) {
        console.log(`PUT /productos/:publicId error: ${e}`);
        res.status(500).send("Error al actualizar el producto");
    }
});



router.patch("/:publicId", async (req, res) => {
    try {
        const { publicId } = req.params;
        const {
            sabor,
            contenido_ml,
            tipo,
            precio_venta,
            costo_produccion_actual,
        } = req.body;

        const updates: any = {};

        if (sabor !== undefined) updates.sabor = sabor;
        if (contenido_ml !== undefined)
            updates.contenido_ml = contenido_ml;
        if (tipo !== undefined) updates.tipo = tipo;
        if (precio_venta !== undefined)
            updates.precio_venta = precio_venta;
        if (costo_produccion_actual !== undefined)
            updates.costo_produccion_actual =
                costo_produccion_actual;

        const [updated] = await db
            .update(productos)
            .set(updates)
            .where(eq(productos.publicId, publicId))
            .returning();

        if (!updated) {
            return res
                .status(404)
                .json({ message: "Producto no encontrado" });
        }

        res.status(200).json({ data: updated });
    } catch (error) {
        res.status(500).json({
            message: "Error actualizando producto",
        });
    }
});






export default router;