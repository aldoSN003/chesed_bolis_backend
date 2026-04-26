import {
    pgTable,
    serial,
    uuid,
    varchar,
    integer,
    boolean,
    timestamp,
    date,
    numeric,
    text,
    index,
    uniqueIndex,
    check,
} from "drizzle-orm/pg-core";
import {relations, sql} from "drizzle-orm";

// =========================================
// PRODUCTOS
// =========================================
export const productos = pgTable(
    "productos",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        sabor: varchar("sabor", { length: 100 }).notNull(),
        contenido_ml: integer("contenido_ml").notNull(),
        tipo: varchar("tipo", { length: 20 }).notNull(),
        precio_venta: numeric("precio_venta", { precision: 10, scale: 2 }).notNull(),
        costo_produccion_actual: numeric("costo_produccion_actual", {
            precision: 10,
            scale: 2,
        })
            .notNull()
            .default("0"),
        activo: boolean("activo").notNull().default(true),
        creado_en: timestamp("creado_en", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        actualizado_en: timestamp("actualizado_en", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => [
        check("productos_contenido_ml_check", sql`${t.contenido_ml} > 0`),
        check("productos_tipo_check", sql`${t.tipo} IN ('leche', 'agua')`),
        check("productos_precio_venta_check", sql`${t.precio_venta} >= 0`),
        check(
            "productos_costo_produccion_actual_check",
            sql`${t.costo_produccion_actual} >= 0`
        ),
    ]
);

// =========================================
// LOTES DE PRODUCCIÓN
// =========================================
export const lotesProduccion = pgTable(
    "lotes_produccion",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        productoId: integer("producto_id")
            .notNull()
            .references(() => productos.id, { onDelete: "cascade" }),
        fechaProduccion: date("fecha_produccion").notNull(),
        cantidadProducida: integer("cantidad_producida").notNull(),
        costoProduccion: numeric("costo_produccion", {
            precision: 10,
            scale: 2,
        }).notNull(),
    },
    (t) => [
        index("idx_lotes_producto").on(t.productoId),
        check("lotes_cantidad_producida_check", sql`${t.cantidadProducida} > 0`),
        check("lotes_costo_produccion_check", sql`${t.costoProduccion} >= 0`),
    ]
);

// =========================================
// INVENTARIO
// =========================================
export const inventario = pgTable(
    "inventario",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        productoId: integer("producto_id")
            .unique()
            .notNull()
            .references(() => productos.id, { onDelete: "cascade" }),
        cantidad: integer("cantidad").notNull(),
        actualizadoEn: timestamp("actualizado_en", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => [
        index("idx_inventario_producto").on(t.productoId),
        check("inventario_cantidad_check", sql`${t.cantidad} >= 0`),
    ]
);

// =========================================
// CLIENTES
// =========================================
export const clientes = pgTable(
    "clientes",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        nombre: varchar("nombre", { length: 100 }).notNull(),
        email: varchar("email", { length: 100 }).unique(),
        telefono: varchar("telefono", { length: 20 }),
        fechaNacimiento: date("fecha_nacimiento"),
        direccion: text("direccion"),
        activo: boolean("activo").notNull().default(true),
        creadoEn: timestamp("creado_en", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => [
        index("idx_clientes_nombre")
            .on(t.nombre)
            .where(sql`${t.activo} = TRUE`),
    ]
);

// =========================================
// USUARIOS
// =========================================
export const usuarios = pgTable(
    "usuarios",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        nombre: varchar("nombre", { length: 100 }).notNull(),
        email: varchar("email", { length: 100 }).unique().notNull(),
        password: text("password").notNull(),
        rol: varchar("rol", { length: 20 }).notNull(),
        activo: boolean("activo").notNull().default(true),
        creadoEn: timestamp("creado_en", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => [
        uniqueIndex("idx_usuarios_email").on(t.email),
        check("usuarios_rol_check", sql`${t.rol} IN ('admin', 'cajero')`),
        check("usuarios_password_check", sql`length(${t.password}) >= 60`),
    ]
);

// =========================================
// VENTAS
// =========================================
export const ventas = pgTable(
    "ventas",
    {
        id: serial("id").primaryKey(),
        publicId: uuid("public_id")
            .unique()
            .notNull()
            .default(sql`gen_random_uuid()`),
        clienteId: integer("cliente_id").references(() => clientes.id, {
            onDelete: "set null",
        }),
        usuarioId: integer("usuario_id")
            .notNull()
            .references(() => usuarios.id, { onDelete: "restrict" }),
        fecha: timestamp("fecha", { mode: "date" })
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        total: numeric("total", { precision: 10, scale: 2 })
            .notNull()
            .default("0"),
        metodoPago: varchar("metodo_pago", { length: 20 }).notNull(),
        anulada: boolean("anulada").notNull().default(false),
    },
    (t) => [
        index("idx_ventas_cliente").on(t.clienteId),
        index("idx_ventas_usuario").on(t.usuarioId),
        index("idx_ventas_fecha").on(sql`${t.fecha} DESC`),
        index("idx_ventas_activas")
            .on(sql`${t.fecha} DESC`)
            .where(sql`NOT ${t.anulada}`),
        index("idx_ventas_usuario_fecha").on(t.usuarioId, sql`${t.fecha} DESC`),
        check("ventas_total_check", sql`${t.total} >= 0`),
        check(
            "ventas_metodo_pago_check",
            sql`${t.metodoPago} IN ('efectivo', 'tarjeta', 'transferencia')`
        ),
    ]
);

// =========================================
// DETALLE VENTAS
// =========================================
export const detalleVentas = pgTable(
    "detalle_ventas",
    {
        detalleId: serial("detalle_id").primaryKey(),
        ventaId: integer("venta_id")
            .notNull()
            .references(() => ventas.id, { onDelete: "cascade" }),
        productoId: integer("producto_id")
            .notNull()
            .references(() => productos.id, { onDelete: "restrict" }),
        cantidad: integer("cantidad").notNull(),
        tipoDescuento: varchar("tipo_descuento", { length: 20 }),
        precioUnitario: numeric("precio_unitario", {
            precision: 10,
            scale: 2,
        }).notNull(),
        subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    },
    (t) => [
        index("idx_detalle_venta").on(t.ventaId),
        index("idx_detalle_producto").on(t.productoId),
        check("detalle_cantidad_check", sql`${t.cantidad} > 0`),
        check("detalle_subtotal_check", sql`${t.subtotal} >= 0`),
        check(
            "detalle_tipo_descuento_check",
            sql`${t.tipoDescuento} IS NULL OR ${t.tipoDescuento} IN ('promocion', 'regalo', 'empleado')`
        ),
    ]
);

// =========================================
// RELATIONS
// =========================================

export const productosRelations = relations(productos, ({ many, one }) => ({
    lotes: many(lotesProduccion),
    inventario: one(inventario),
    detallesVenta: many(detalleVentas),
}));

export const lotesProduccionRelations = relations(lotesProduccion, ({ one }) => ({
    producto: one(productos, {
        fields: [lotesProduccion.productoId],
        references: [productos.id],
    }),
}));

export const inventarioRelations = relations(inventario, ({ one }) => ({
    producto: one(productos, {
        fields: [inventario.productoId],
        references: [productos.id],
    }),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
    ventas: many(ventas),
}));

export const usuariosRelations = relations(usuarios, ({ many }) => ({
    ventas: many(ventas),
}));

export const ventasRelations = relations(ventas, ({ one, many }) => ({
    cliente: one(clientes, {
        fields: [ventas.clienteId],
        references: [clientes.id],
    }),
    usuario: one(usuarios, {
        fields: [ventas.usuarioId],
        references: [usuarios.id],
    }),
    detalles: many(detalleVentas),
}));

export const detalleVentasRelations = relations(detalleVentas, ({ one }) => ({
    venta: one(ventas, {
        fields: [detalleVentas.ventaId],
        references: [ventas.id],
    }),
    producto: one(productos, {
        fields: [detalleVentas.productoId],
        references: [productos.id],
    }),
}));

// =========================================
// INFERRED TYPES
// =========================================
export type Producto = typeof productos.$inferSelect;
export type NewProducto = typeof productos.$inferInsert;

export type LoteProduccion = typeof lotesProduccion.$inferSelect;
export type NewLoteProduccion = typeof lotesProduccion.$inferInsert;

export type Inventario = typeof inventario.$inferSelect;
export type NewInventario = typeof inventario.$inferInsert;

export type Cliente = typeof clientes.$inferSelect;
export type NewCliente = typeof clientes.$inferInsert;

export type Usuario = typeof usuarios.$inferSelect;
export type NewUsuario = typeof usuarios.$inferInsert;

export type Venta = typeof ventas.$inferSelect;
export type NewVenta = typeof ventas.$inferInsert;

export type DetalleVenta = typeof detalleVentas.$inferSelect;
export type NewDetalleVenta = typeof detalleVentas.$inferInsert;