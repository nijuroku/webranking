# Astro + Tailwind + Bun

Sistema de Clasificación migrado a **Astro** con **Tailwind CSS** y **Bun** como package manager.

## 🚀 Inicio Rápido

### Instalación

```bash
bun install
```

### Desarrollo

```bash
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### Build

```bash
bun run build
```

### Preview

```bash
bun run preview
```

## 📁 Estructura del Proyecto

```
src/
├── components/    # Componentes Astro reutilizables
├── layouts/       # Layouts base
├── pages/         # Rutas y páginas
├── styles/        # Estilos CSS globales
└── utils/         # Utilidades y funciones

public/           # Archivos estáticos
```

## 🔧 Configuración

- **Astro** - Framework meta
- **Tailwind CSS** - Utility-first CSS
- **Bun** - Package manager y runtime
- **Supabase** - Backend (mantener referencias)

## 📝 Variables de Entorno

Crea un archivo `.env.local`:

```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

## 🎨 Personalización

Los estilos están centralizados en `src/styles/global.css` con Tailwind CSS.

## 📦 Dependencias

- `astro` - Framework
- `@astrojs/tailwind` - Integración Tailwind
- `tailwindcss` - Framework CSS
- `autoprefixer` - PostCSS plugin
