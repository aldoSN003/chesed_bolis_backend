import express from "express";
import {and, desc, eq, ilike, sql, getTableColumns, between, gte, lte, or} from "drizzle-orm";
import {db} from "../db";
import {ventas, detalleVentas, inventario, productos, clientes, usuarios, lotesProduccion} from "../db/schema";

const router = express.Router();

const DISCOUNTS = {
    promocion: 0.10,
    empleado: 0.15,
    regalo: 1.00,
};


/**
 * GET /
 * List sales with pagination and filters
 */
router.get("/", async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            anulada,
            date,
            startDate,
            endDate,
            metodoPago,
            search,
        } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(
            Math.max(1, parseInt(String(limit), 10) || 10),
            100
        );
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];


        // If search query exists, filter by client name
        if (search) {
            filterConditions.push(
                ilike(clientes.nombre, `%${search}%`)
            );
        }

        //filter by metodo de pago
        if(metodoPago){
            filterConditions.push(
                eq(ventas.metodoPago, String(metodoPago))
            );

        }


        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(ventas)
            .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
            .innerJoin(usuarios, eq(ventas.usuarioId, usuarios.id))
            .where(whereClause);
        const totalCount = countResult[0]?.count ?? 0;

        const ventasList = await db
            .select({
                ...getTableColumns(ventas),
                cliente: {

                    nombre: clientes.nombre,

                },
                usuario: {
                    usuarioId: usuarios.publicId,
                    rol: usuarios.rol,
                }
            })
            .from(ventas)
            .where(whereClause)
            .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
            .innerJoin(usuarios, eq(ventas.usuarioId, usuarios.id))
            .orderBy(desc(ventas.fecha))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: ventasList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    } catch (error) {
        console.error("GET /ventas error:", error);
        return res.status(500).json({
            message: "Error al obtener las ventas",
        });
    }
});


/**
 * GET /:publicId
 * Get sale details by publicId
 */
router.get("/:publicId", async (req, res) => {
    try {
        const { publicId } = req.params;

        // 1. Fetch the main Venta details (joining Users and Clients)
        const [ventaData] = await db
            .select({
                internalId: ventas.id, // We'll use this to speed up the details query
                publicId: ventas.publicId,
                fecha: ventas.fecha,
                total: ventas.total,
                metodo_pago: ventas.metodoPago,
                anulada: ventas.anulada,
                // Assuming your clients and users tables have a 'nombre' column:
                cliente_nombre: clientes.nombre,
                usuario_nombre: usuarios.nombre,
            })
            .from(ventas)
            // Left join for clients because cliente_id can be null (ON DELETE SET NULL)
            .leftJoin(clientes, eq(ventas.clienteId, clientes.id))
            // Inner join for users because usuario_id is NOT NULL
            .innerJoin(usuarios, eq(ventas.usuarioId, usuarios.id))
            .where(eq(ventas.publicId, publicId));

        // If the sale doesn't exist, return a 404 early
        if (!ventaData) {
            return res.status(404).json({ message: "Venta no encontrada" });
        }

        // 2. Fetch the Detalle items
        const details = await db
            .select({
                producto_sabor: productos.sabor,
                producto_tipo: productos.tipo,
                contenido_ml: productos.contenido_ml,
                cantidad: detalleVentas.cantidad,
                precio_unitario: detalleVentas.precioUnitario,
                tipo_descuento: detalleVentas.tipoDescuento,
                subtotal: detalleVentas.subtotal,
            })
            .from(detalleVentas)
            .innerJoin(productos, eq(detalleVentas.productoId, productos.id))
            // We use the internalId from the first query. It's much faster
            // than doing another join with the ventas table to check the publicId!
            .where(eq(detalleVentas.ventaId, ventaData.internalId))
            .orderBy(detalleVentas.detalleId);

        // 3. Construct and return the nested JSON response
        return res.status(200).json({
            data: {
                id: ventaData.publicId,
                fecha: ventaData.fecha,
                total: ventaData.total,
                metodo_pago: ventaData.metodo_pago,
                estado: ventaData.anulada ,
                cliente: ventaData.cliente_nombre || "Cliente Final", // Fallback if null
                vendedor: ventaData.usuario_nombre,
                detalles: details,
            }
        });

    } catch (error) {
        console.error("GET /ventas/:publicId error:", error);
        return res.status(500).json({
            message: "Error al obtener los detalles de la venta",
        });
    }
});


export default router;