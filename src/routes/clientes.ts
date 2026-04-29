import express from "express";
import { and, asc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { clientes } from "../db/schema";
import { db } from "../db";

const router = express.Router();

/**
 * GET /
 * List all clients with search, filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const { search, activo, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(ilike(clientes.nombre, `%${search}%`));
        }

        if (activo !== undefined) {
            filterConditions.push(eq(clientes.activo, activo === 'true'));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(clientes)
            .where(whereClause);
        
        const totalCount = countResult[0]?.count ?? 0;
        
        const clientesList = await db
            .select({ ...getTableColumns(clientes) })
            .from(clientes)
            .where(whereClause)
            .orderBy(asc(clientes.nombre))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: clientesList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        });

    } catch (e) {
        console.error(`GET /clientes error: ${e}`);
        res.status(500).json({ message: "Error al obtener los clientes" });
    }
});

/**
 * GET /:publicId
 * Get a single client by publicId
 */
router.get('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const [cliente] = await db
            .select()
            .from(clientes)
            .where(eq(clientes.publicId, publicId))
            .limit(1);

        if (!cliente) {
            return res.status(404).json({ message: "Cliente no encontrado" });
        }

        res.status(200).json({ data: cliente });

    } catch (e) {
        console.error(`GET /clientes/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al obtener el cliente" });
    }
});

/**
 * POST /
 * Create a new client
 */
router.post('/', async (req, res) => {
    try {
        const { nombre, email, telefono, fechaNacimiento, direccion, activo } = req.body;
        
        const [createdCliente] = await db
            .insert(clientes)
            .values({
                nombre,
                email,
                telefono,
                fechaNacimiento,
                direccion,
                activo: activo ?? true
            })
            .returning();

        res.status(201).json({ data: createdCliente });

    } catch (e) {
        console.error(`POST /clientes error: ${e}`);
        res.status(500).json({ message: "Error al crear el cliente" });
    }
});

/**
 * PATCH /:publicId
 * Update an existing client
 */
router.patch('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        const { nombre, email, telefono, fechaNacimiento, direccion, activo } = req.body;

        const [updatedCliente] = await db
            .update(clientes)
            .set({
                nombre,
                email,
                telefono,
                fechaNacimiento,
                direccion,
                activo,
                // Do not update creadoEn
            })
            .where(eq(clientes.publicId, publicId))
            .returning();

        if (!updatedCliente) {
            return res.status(404).json({ message: "Cliente no encontrado" });
        }

        res.status(200).json({ data: updatedCliente });

    } catch (e) {
        console.error(`PATCH /clientes/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al actualizar el cliente" });
    }
});

/**
 * DELETE /:publicId
 * Soft delete or hard delete a client
 * Based on the schema 'activo' field, soft delete is often preferred.
 * Here we'll do a hard delete as it's common for basic CRUD unless specified.
 */
router.delete('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const [deletedCliente] = await db
            .delete(clientes)
            .where(eq(clientes.publicId, publicId))
            .returning();

        if (!deletedCliente) {
            return res.status(404).json({ message: "Cliente no encontrado" });
        }

        res.status(200).json({ message: "Cliente eliminado correctamente", data: deletedCliente });

    } catch (e) {
        console.error(`DELETE /clientes/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al eliminar el cliente" });
    }
});

export default router;
