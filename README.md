<div align="center">
  <img src="icons/icon.svg" alt="Logo" width="120" height="120" />
  <h1>🏛️ Archivo Histórico Digital PWA</h1>
  <p><em>Sistema de digitalización y gestión documental ultrarrápido con capacidades offline.</em></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/PWA-Ready-blue?style=for-the-badge&logo=pwa" alt="PWA Ready" />
    <img src="https://img.shields.io/badge/IndexedDB-Powered-green?style=for-the-badge&logo=database" alt="IndexedDB" />
    <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS" />
  </p>
</div>

---

## 📖 Descripción

El **Archivo Histórico Digital** es una Aplicación Web Progresiva (PWA) diseñada para instituciones que necesitan digitalizar, consultar y archivar documentos históricos de manera eficiente y segura. 

Destaca por su capacidad para manejar miles de registros en memoria mediante la implementación de motores nativos **IndexedDB**, garantizando que el navegador mantenga un rendimiento fluido, permitiendo guardar el progreso automáticamente y buscar registros a velocidades increíbles.

## ✨ Características Principales

- 📦 **Soporte Nativo de Paquetes:** Abre y visualiza paquetes estructurados (`.xlb`) directamente en el navegador.
- ⚡ **Rendimiento Extremo:** Gestión de memoria delegada a IndexedDB. No se congela incluso con cargas masivas.
- 🔍 **Buscador General Unificado:** Búsqueda instantánea por nombre, fecha, folio, libro o notas en el catálogo histórico central.
- 📱 **PWA Completa:** Instalable en computadoras de escritorio, tablets y dispositivos móviles.
- 🛠️ **Herramientas de Digitalización:** Incluye scripts nativos automatizados (`.bat` para Windows y `.sh` para Linux/macOS) que preparan las carpetas de imágenes y las empaquetan en archivos ofuscados `.xlb`.
- 🔒 **Modo Archivista Restringido:** Zona administrativa secreta para creación y edición de metadatos (accesible vía triple-tap y clave).

## 🚀 Empezando

Dado que es una PWA basada en tecnologías frontend estándar (HTML, CSS Vanilla y JS), el despliegue es sumamente sencillo.

### 1. Despliegue
Simplemente levanta el proyecto en cualquier servidor web estático (Apache, Nginx, Live Server, GitHub Pages, Vercel, etc.):

```bash
# Ejemplo usando Python (solo para pruebas en desarrollo local)
python3 -m http.server 8000
```
Visita `http://localhost:8000` en tu navegador.

### 2. Uso para Digitalizadores
El sistema permite que los operarios descarguen la **Herramienta de Empaquetado Automático** desde la misma pantalla de inicio (detectando automáticamente su sistema operativo). Esta herramienta:
1. Toma una carpeta de imágenes escaneadas (`.jpg`).
2. Transforma la extensión a un formato ofuscado (`.pag`).
3. Comprime la carpeta usando algoritmos ZIP nativos.
4. Renombra el resultado a la extensión propia del sistema (`.xlb`), dejándolo listo para su ingesta en el visualizador.

## 📁 Estructura del Proyecto

```text
├── index.html           # Punto de entrada principal y vistas UI
├── manifest.json        # Manifiesto PWA
├── sw.js                # Service Worker para capacidades offline
├── css/
│   └── styles.css       # Estilos base
├── js/
│   ├── config/          # Configuración de UI (Tailwind tokens)
│   ├── core/            # Núcleo de la app (Base de datos e Interfaz)
│   ├── app/             # Lógica modular: Visor, Archivos, UI
│   └── main.js          # Inicialización
├── icons/               # Iconografía vectorial y logos
└── convertir_a_xlb.*    # Scripts de utilería (Shell y Batch)
```

## 🔐 Zona Administrativa (Archivista)
Para acceder a los controles de edición y escritura de paquetes:
1. Haga **tres toques (o clics) rápidos** sobre el ícono superior izquierdo (Templo).
2. Ingrese la clave de administrador para desbloquear los formularios de metadatos, funciones de autocompletado en lote y finalización de digitalizaciones.

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Eres libre de usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias de este software.

> Desarrollado y mantenido por [crgm.app](https://crgm.app) | Repositorio Original: [robindanilo2218/digitalizacion](https://github.com/robindanilo2218/digitalizacion)
