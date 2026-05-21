const state = {
    isAdmin: false,
    mode: 'local',

    folders: {},
    activeFolder: '',
    images: [],
    currentIndex: 0,
    subRecordIndex: 0,
    records: {},
    collectionPasswords: null,

    schema: [
        { id: 'nombre_libro', label: 'Libro / Expediente', type: 'text' },
        { id: 'ubicacion_fisica', label: 'Ubicación Física', type: 'text' },
        { id: 'codigo_rastreo', label: 'Código de Rastreo (Serial)', type: 'text' },
        { id: 'nombres', label: 'Nombre(s) Registrado(s)', type: 'text' },
        { id: 'fecha', label: 'Fecha / Época', type: 'text' },
        { id: 'tipo_doc', label: 'Tipo de Documento', type: 'text' },
        { id: 'folio', label: 'Número de Folio / Página', type: 'text' },
        { id: 'notas', label: 'Transcripción / Notas', type: 'textarea' }
    ],

    view: 'workspace',
    leftTab: 'folders',
    zoom: 1, rotation: 0, currentObjectUrl: null
};
