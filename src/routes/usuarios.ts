import express from "express";
import { and, asc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { usuarios } from "../db/schema";
import { db } from "../db";

const router = express.Router();

/**
 * GET /
 * List all users with search, filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const { search, rol, activo, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(ilike(usuarios.nombre, `%${search}%`));
        }

        if (rol) {
            filterConditions.push(eq(usuarios.rol, String(rol)));
        }

        if (activo !== undefined) {
            filterConditions.push(eq(usuarios.activo, activo === 'true'));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(usuarios)
            .where(whereClause);
        
        const totalCount = countResult[0]?.count ?? 0;
        
        // Exclude password from the select for security
        const { password, ...columnsToSelect } = getTableColumns(usuarios);

        const usuariosList = await db
            .select({ ...columnsToSelect })
            .from(usuarios)
            .where(whereClause)
            .orderBy(asc(usuarios.nombre))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: usuariosList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        });

    } catch (e) {
        console.error(`GET /usuarios error: ${e}`);
        res.status(500).json({ message: "Error al obtener los usuarios" });
    }
});

/**
 * GET /:publicId
 * Get a single user by publicId
 */
router.get('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const { password, ...columnsToSelect } = getTableColumns(usuarios);

        const [usuario] = await db
            .select({ ...columnsToSelect })
            .from(usuarios)
            .where(eq(usuarios.publicId, publicId))
            .limit(1);

        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.status(200).json({ data: usuario });

    } catch (e) {
        console.error(`GET /usuarios/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al obtener el usuario" });
    }
});

/**
 * POST /
 * Create a new user
 * Note: Password should be hashed before saving. 
 * The schema has a check: length(password) >= 60, which implies hashed passwords.
 */
router.post('/', async (req, res) => {
    try {
        const { nombre, email, password, rol, activo } = req.body;
        
        // In a real scenario, hash the password here if not already hashed.
        // For now, assuming the client sends a hashed password or we handle it here.
        // If the schema requires >= 60 chars, a plain text '123456' will fail.
        
        const [createdUsuario] = await db
            .insert(usuarios)
            .values({
                nombre,
                email,
                password, 
                rol,
                activo: activo ?? true
            })
            .returning();

        if (!createdUsuario) {
            throw new Error("Error al crear el usuario");
        }

        // Remove password from response
        const { password: _, ...result } = createdUsuario;

        res.status(201).json({ data: result });

    } catch (e) {
        console.error(`POST /usuarios error: ${e}`);
        res.status(500).json({ message: "Error al crear el usuario" });
    }
});

/**
 * PATCH /:publicId
 * Update an existing user
 */
router.patch('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        const { nombre, email, password, rol, activo } = req.body;

        const updateData: any = {
            nombre,
            email,
            rol,
            activo
        };

        if (password) {
            updateData.password = password;
        }

        const [updatedUsuario] = await db
            .update(usuarios)
            .set(updateData)
            .where(eq(usuarios.publicId, publicId))
            .returning();

        if (!updatedUsuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const { password: _, ...result } = updatedUsuario;

        res.status(200).json({ data: result });

    } catch (e) {
        console.error(`PATCH /usuarios/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al actualizar el usuario" });
    }
});

/**
 * DELETE /:publicId
 */
router.delete('/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;

        const [deletedUsuario] = await db
            .delete(usuarios)
            .where(eq(usuarios.publicId, publicId))
            .returning();

        if (!deletedUsuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const { password: _, ...result } = deletedUsuario;

        res.status(200).json({ message: "Usuario eliminado correctamente", data: result });

    } catch (e) {
        console.error(`DELETE /usuarios/:publicId error: ${e}`);
        res.status(500).json({ message: "Error al eliminar el usuario" });
    }
});

export default router;
