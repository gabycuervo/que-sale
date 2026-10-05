# ¿Qué sale?

Aplicación web para descubrir y crear planes con otras personas.

## Stack

- Next.js 14 + React 18
- Supabase para autenticación y datos
- Leaflet / React Leaflet para el mapa
- Lucide React para iconos

## Desarrollo

1. Instala dependencias:

   `npm install`

2. Copia `.env.local.example` a `.env.local` y completa las variables de Supabase.

3. Arranca el proyecto:

   `npm run dev`

## Estructura principal

- `app/`: entrada de Next.js y layout global.
- `components/`: pantallas y componentes visuales.
- `lib/`: autenticación, cliente de Supabase, categorías y funciones reutilizables.

## Rama de pruebas

Las refactorizaciones se están haciendo en una rama separada de `main`. La idea es mantener cambios pequeños y fáciles de revisar antes de integrarlos.

## Nota sobre seguridad

Las variables públicas de Supabase usadas por el navegador no deben contener secretos de servidor. La seguridad real de los datos depende también de las políticas RLS configuradas en Supabase.
