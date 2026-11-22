"use strict";

// Almacenamiento local.
// Todavía no hay sincronización real con un servidor.

const CLAVES = {
    estudiantes: "edugestion_estudiantes",
    asistencias: "edugestion_asistencias",
    calificaciones: "edugestion_calificaciones",
    vinculacionDemo: "edugestion_vinculacion_demo",
    pruebasAsistencia: "edugestion_pruebas_asistencia",
    pruebasExperimentales: "edugestion_pruebas_experimentales",
    metasPruebas: "edugestion_metas_pruebas"
};

// Criterios del reporte académico
const NOTA_MINIMA = 3;
const PREFIJO_EJECUCION_PRUEBAS = "edugestion_ejecucion_pruebas:";
const ASISTENCIA_MINIMA = 80;
const META_PRUEBA_ASISTENCIA = 120;
const GRADOS = ["Sexto", "Séptimo", "Octavo", "Noveno", "Décimo", "Undécimo"];
const CURSOS = GRADOS.flatMap((_, indice) =>
    [1, 2, 3].map(seccion => `${indice + 6}-${seccion}`)
);
const NOTAS = Array.from({ length: 41 }, (_, indice) => ((indice + 10) / 10).toFixed(1));
const ASIGNATURAS = ["Matemáticas", "Lengua Castellana", "Ciencias Naturales", "Ciencias Sociales",
    "Inglés", "Educación Física", "Educación Artística", "Tecnología e Informática",
    "Ética y Valores", "Educación Religiosa", "Física", "Química", "Filosofía",
    "Ciencias Económicas y Políticas"];
const ESTADOS_ASISTENCIA = ["Presente", "Ausente"];
const CLAVE_CARGA_CURSOS = "edugestion_carga_demo_10_por_curso";
const CLAVE_CARGA_HISTORIAL = "edugestion_historial_demo";
const CLAVE_ESTUDIANTE = "Estudiante2026!";
const DOCUMENTO_DEMO_ANTERIOR = "DEMO-EST-001";
const NOMBRES_DEMO = ["Valentina", "Mateo", "Isabella", "Samuel", "Mariana", "Santiago",
    "Luciana", "Nicolás", "Gabriela", "Emiliano"];
const APELLIDOS_DEMO = ["Rojas Mendoza", "Torres Salcedo", "Pérez Ospino", "Ruiz Navarro",
    "Castro Villarreal", "Díaz Herrera", "Morales Pacheco", "Vargas Romero", "Cabrera Acosta",
    "Gómez Martínez", "López Jiménez", "Álvarez Serrano", "Ortiz Molina", "Ríos Delgado",
    "Suárez Fernández", "Medina Vega", "Soto Blanco", "Mora Rincón"];

// ======================================
// ALMACENAMIENTO DE DATOS
// ======================================

function leerDatos(clave) {
    try {
        const valor = JSON.parse(
            localStorage.getItem(clave) || "[]"
        );

        return Array.isArray(valor)
            ? valor.filter(r => r && typeof r === "object")
            : [];

    } catch (error) {
        console.error(
            "No se pudieron leer los datos:",
            clave,
            error
        );

        return [];
    }
}

function guardarDatos(clave, datos) {
    try {
        localStorage.setItem(
            clave,
            JSON.stringify(datos)
        );

        return true;

    } catch (error) {
        console.error("Error al guardar:", error);

        avisar(
            "No se pudo guardar. Comprueba el almacenamiento del navegador.",
            true
        );

        return false;
    }
}

// Cargar información guardada

let estudiantes = leerDatos(CLAVES.estudiantes);
let asistencias = leerDatos(CLAVES.asistencias);
let calificaciones = leerDatos(CLAVES.calificaciones);
let vinculacionDemo = leerDatos(CLAVES.vinculacionDemo);
let pruebasAsistencia = leerDatos(CLAVES.pruebasAsistencia);

let moduloActual = "inicio";
let cursoConsulta = "";
let eliminando = false;
let sesion = null;

const CUENTAS_DEMO = [
    { usuario: "admin", clave: "Admin2026!", rol: "administrador", nombreRol: "Administrador" },
    { usuario: "docente", clave: "Docente2026!", rol: "docente", nombreRol: "Docente" },
    {
        usuario: "estudiante", clave: CLAVE_ESTUDIANTE, rol: "estudiante",
        nombreRol: "Estudiante"
    }
];

const MODULOS = {
    administrador: ["inicio", "estudiantes", "asistencia", "calificaciones", "boletines", "reportes", "pruebas"],
    docente: ["inicio", "estudiantes", "asistencia", "calificaciones", "boletines", "reportes"],
    estudiante: ["calificaciones", "asistencia", "boletines", "reportes"]
};

function puedeAbrirModulo(rol, modulo) {
    return MODULOS[rol]?.includes(modulo) === true;
}

function puedeEditarEstudiantes(rol) {
    return rol === "administrador";
}

function puedeRegistrarActividad(rol) {
    return rol === "administrador" || rol === "docente";
}

function puedeConsultarDocumento(cuenta, documento, documentoPropio = documentoCuentaEstudiante()) {
    return Boolean(cuenta && (cuenta.rol !== "estudiante" || documento === documentoPropio));
}

function documentoCuentaEstudiante() {
    if (sesion?.rol === "estudiante" && sesion.documento) return sesion.documento;

    return vinculacionDemo[0]?.documento ??
        DOCUMENTO_DEMO_ANTERIOR;
}

function autenticarCuenta(usuario, clave) {
    const cuenta = CUENTAS_DEMO.find(cuenta => cuenta.usuario === usuario && cuenta.clave === clave);
    if (cuenta) return cuenta;

    const estudiante = clave === CLAVE_ESTUDIANTE && obtenerEstudiante(usuario);
    if (estudiante?.cuentaDemo) {
        return { usuario, rol: "estudiante", nombreRol: "Estudiante", documento: estudiante.documento };
    }
}

function registrosVisibles(registros) {
    if (sesion.rol !== "estudiante") {
        const documentos = new Set(estudiantesDelCurso(cursoConsulta).map(estudiante => estudiante.documento));
        return registros.filter(registro => documentos.has(registro.documento));
    }

    const documento = documentoCuentaEstudiante();
    return obtenerEstudiante(documento)
        ? registros.filter(registro => registro.documento === documento)
        : [];
}

function configurarAcceso() {
    const acceso = document.getElementById("acceso");
    const panel = document.querySelector(".aplicacion");
    const formulario = document.getElementById("formAcceso");
    const usuario = document.getElementById("usuarioAcceso");
    const clave = document.getElementById("claveAcceso");
    const alternar = document.getElementById("alternarClave");
    const enviar = document.getElementById("enviarAcceso");
    const estado = document.getElementById("estadoAcceso");
    const roles = formulario.querySelector(".acceso-roles");
    const guardarClave = document.getElementById("guardarClaveAcceso");
    const usarClave = document.getElementById("usarClaveGuardada");
    const gestor = window.isSecureContext && /^https?:$/.test(location.protocol) &&
        typeof window.PasswordCredential === "function" && navigator.credentials;
    document.getElementById("opcionesClaveGuardada").hidden = !gestor;

    document.getElementById("cuentasDemo").innerHTML = CUENTAS_DEMO.map(cuenta => `
        <p><strong>${cuenta.nombreRol}</strong> <code>${cuenta.usuario}</code> / <code>${cuenta.clave}</code></p>
    `).join("") + `<p>Para ingresar a una cuenta individual de prueba, elige Estudiante
        y usa su número de documento con <code>${CLAVE_ESTUDIANTE}</code>.</p>`;

    function mostrarClave(visible) {
        clave.type = visible ? "text" : "password";
        alternar.textContent = visible ? "Ocultar" : "Mostrar";
    }

    function cambiarEstado(tipo = "", mensaje = "") {
        enviar.dataset.estado = tipo;
        enviar.textContent = {
            verificando: "Verificando acceso...",
            correcto: "✓ ¡Bienvenido!",
            error: "Volver a intentar"
        }[tipo] || "Iniciar sesión";
        estado.textContent = mensaje;
    }

    alternar.addEventListener("click", () => mostrarClave(clave.type === "password"));
    formulario.addEventListener("input", () => {
        if (enviar.dataset.estado === "error") cambiarEstado();
    });

    if (gestor) usarClave.addEventListener("click", async () => {
        bloquearAcceso(true);
        try {
            const guardada = await gestor.get({ password: true, mediation: "required" });
            if (!guardada) {
                cambiarEstado("", "El gestor no devolvió una contraseña guardada.");
                return;
            }
            usuario.value = guardada.id;
            clave.value = guardada.password;
            mostrarClave(false);
            const cuenta = autenticarCuenta(guardada.id.trim().toLowerCase(), guardada.password);
            if (cuenta) formulario.elements.rol.value = cuenta.rol;
            cambiarEstado("", "Credenciales completadas. Pulsa Iniciar sesión para continuar.");
            enviar.focus();
        } catch {
            cambiarEstado("", "No se pudo abrir el gestor de contraseñas.");
        } finally {
            bloquearAcceso(false);
        }
    });

    function bloquearAcceso(bloqueado) {
        roles.disabled = bloqueado;
        usuario.readOnly = bloqueado;
        clave.readOnly = bloqueado;
        guardarClave.disabled = bloqueado;
        usarClave.disabled = bloqueado;
        enviar.setAttribute("aria-disabled", String(bloqueado));
    }

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (enviar.getAttribute("aria-disabled") === "true" || sesion) return;

        const datos = new FormData(formulario);
        const nombre = usuario.value.trim().toLowerCase();
        const rol = datos.get("rol");

        if (!rol || !nombre || !clave.value) {
            cambiarEstado("error", "Selecciona un rol e ingresa tu usuario y contraseña.");
            const campo = !rol ? roles.querySelector("input") : !nombre ? usuario : clave;
            campo.focus();
            return;
        }

        const cuenta = autenticarCuenta(nombre, clave.value);
        bloquearAcceso(true);
        cambiarEstado("verificando", "Verificando acceso...");
        await new Promise(resolve => setTimeout(resolve, 650));

        if (!cuenta || cuenta.rol !== rol) {
            cambiarEstado("error", cuenta
                ? "El rol seleccionado no corresponde a esta cuenta."
                : "Usuario o contraseña incorrectos.");
            bloquearAcceso(false);
            return;
        }

        sesion = cuenta;
        if (gestor && guardarClave.checked) {
            try {
                gestor.store(new PasswordCredential({ id: nombre, password: clave.value })).catch(() =>
                    avisar("El gestor del navegador no pudo guardar la contraseña.", true));
            } catch {
                avisar("El gestor del navegador no pudo guardar la contraseña.", true);
            }
        }
        cambiarEstado("correcto", "¡Bienvenido!");
        await new Promise(resolve => setTimeout(resolve, 450));
        acceso.hidden = true;
        panel.hidden = false;
        document.getElementById("usuarioPanel").textContent = cuenta.nombreRol;
        if (cuenta.rol === "administrador") {
            cargarEstudiantesDemo();
            cargarHistorialDemo();
        }
        mostrarModulo(MODULOS[cuenta.rol][0]);
        formulario.reset();
        mostrarClave(false);
        cambiarEstado();
        bloquearAcceso(false);
        document.getElementById("contenido").focus();
    });

    document.getElementById("cerrarSesion").addEventListener("click", () => {
        if (eliminando || document.querySelector('[role="alertdialog"]')) return;
        sesion = null;
        cursoConsulta = "";
        panel.hidden = true;
        document.getElementById("contenido").replaceChildren();
        document.getElementById("usuarioPanel").textContent = "";
        document.getElementById("avisos").replaceChildren();
        acceso.hidden = false;
        usuario.focus();
    });
}

function guardarEstudiantes() {
    return guardarDatos(
        CLAVES.estudiantes,
        estudiantes
    );
}

function cargarEstudiantesDemo() {
    const [carga] = leerDatos(CLAVE_CARGA_CURSOS);
    if (carga?.conDocumentos) return;

    const demo = CURSOS.flatMap((grado, curso) => NOMBRES_DEMO.map((nombre, indice) => {
        const numero = String(indice + 1).padStart(2, "0");
        return {
            documento: `DEMO-${grado}-${numero}`,
            nombre,
            apellido: APELLIDOS_DEMO[(curso + indice) % APELLIDOS_DEMO.length],
            grado,
            nombreAnterior: `Estudiante ${numero}`
        };
    }));

    const porDocumento = new Map(demo.map(estudiante => [estudiante.documento, estudiante]));
    const ocupados = new Set([estudiantes, asistencias, calificaciones, vinculacionDemo]
        .flatMap(registros => registros.map(registro => String(registro.documento))));
    const cambios = new Map();
    let siguiente = 9000000000;

    function asignarDocumento(documentoAnterior) {
        do {
            siguiente++;
        } while (ocupados.has(String(siguiente)));
        const documento = String(siguiente);
        cambios.set(documentoAnterior, documento);
        return documento;
    }

    const nuevos = carga?.completada ? [] : demo
        .filter(estudiante => !ocupados.has(estudiante.documento))
        .map(({ documento, nombre, apellido, grado }) =>
            ({ documento: asignarDocumento(documento), nombre, apellido, grado, cuentaDemo: true }));
    const registros = estudiantes.map(estudiante => {
        const datos = porDocumento.get(estudiante.documento);
        const anterior = estudiante.documento === DOCUMENTO_DEMO_ANTERIOR;
        if (!anterior && (!datos || estudiante.grado !== datos.grado)) return estudiante;

        const generico = datos && estudiante.nombre === datos.nombreAnterior &&
            estudiante.apellido === `Demo ${datos.grado}`;
        return {
            ...estudiante,
            documento: asignarDocumento(estudiante.documento),
            nombre: generico ? datos.nombre : estudiante.nombre,
            apellido: generico ? datos.apellido : estudiante.apellido,
            cuentaDemo: true
        };
    });

    function actualizarDocumentos(registros) {
        return registros.map(registro => cambios.has(registro.documento)
            ? { ...registro, documento: cambios.get(registro.documento) }
            : registro);
    }

    const estudiantesActualizados = registros.concat(nuevos);
    const asistenciasActualizadas = actualizarDocumentos(asistencias);
    const calificacionesActualizadas = actualizarDocumentos(calificaciones);
    const documentoPredeterminado = cambios.get(DOCUMENTO_DEMO_ANTERIOR) ??
        estudiantesActualizados.find(estudiante => estudiante.cuentaDemo)?.documento;
    const vinculacionActualizada = vinculacionDemo.length ? actualizarDocumentos(vinculacionDemo)
        : documentoPredeterminado ? [{ documento: documentoPredeterminado }] : [];
    const escrituras = [
        [CLAVES.estudiantes, estudiantesActualizados, estudiantes],
        [CLAVES.asistencias, asistenciasActualizadas, asistencias],
        [CLAVES.calificaciones, calificacionesActualizadas, calificaciones],
        [CLAVES.vinculacionDemo, vinculacionActualizada, vinculacionDemo],
        [CLAVE_CARGA_CURSOS, [{ completada: true, conNombres: true, conDocumentos: true }], []]
    ];
    for (const [indice, [clave, datos]] of escrituras.entries()) {
        if (guardarDatos(clave, datos)) continue;
        for (const [claveGuardada, , anterior] of escrituras.slice(0, indice).reverse()) {
            guardarDatos(claveGuardada, anterior);
        }
        return;
    }

    estudiantes = estudiantesActualizados;
    asistencias = asistenciasActualizadas;
    calificaciones = calificacionesActualizadas;
    vinculacionDemo = vinculacionActualizada;
    avisar("Documentos ficticios y cuentas estudiantiles vinculados.");
}

function guardarAsistencias() {
    return guardarDatos(
        CLAVES.asistencias,
        asistencias
    );
}

function cargarHistorialDemo() {
    const [carga] = leerDatos(CLAVE_CARGA_HISTORIAL);
    if (carga?.boletinCompleto) return;
    const cuentas = estudiantes.filter(estudiante => estudiante.cuentaDemo);
    if (!cuentas.length) return;

    const fechasPeriodos = ["2026-03-20", "2026-06-19", "2026-09-18", "2026-11-20"];
    const conAsistencia = new Set(asistencias.map(registro => registro.documento));
    const claveNota = (documento, asignatura, periodo) => JSON.stringify([documento, asignatura, periodo]);
    const periodosConNotas = new Set(calificaciones.filter(tieneNotaNumerica).map(registro =>
        claveNota(registro.documento, registro.asignatura, periodoCalificacion(registro))));
    const fechas = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
    const nuevasAsistencias = [];
    const nuevasNotas = [];

    cuentas.forEach(({ documento }, indice) => {
        if (!carga?.completada && !conAsistencia.has(documento)) {
            fechas.forEach((fecha, dia) => nuevasAsistencias.push({
                documento,
                fecha,
                estado: (indice + dia) % 7 < 2 ? "Ausente" : "Presente"
            }));
        }
        ASIGNATURAS.forEach((asignatura, materia) => {
            fechasPeriodos.forEach((fecha, trimestre) => {
                const periodo = trimestre + 1;
                if (periodosConNotas.has(claveNota(documento, asignatura, periodo))) return;
                const nota = (23 + (indice * 7 + materia * 3 + trimestre * 11) % 28) / 10;
                nuevasNotas.push({
                    documento, asignatura, nota, fecha, periodo, ficticia: true,
                    descripcion: motivoNotaDemo(asignatura, nota)
                });
            });
        });
    });

    if (nuevasAsistencias.length) {
        const datos = asistencias.concat(nuevasAsistencias);
        if (!guardarDatos(CLAVES.asistencias, datos)) return;
        asistencias = datos;
    }
    if (nuevasNotas.length) {
        const datos = calificaciones.concat(nuevasNotas);
        if (!guardarDatos(CLAVES.calificaciones, datos)) return;
        calificaciones = datos;
    }

    guardarDatos(CLAVE_CARGA_HISTORIAL, [{ completada: true, boletinCompleto: true }]);
    if (nuevasAsistencias.length || nuevasNotas.length) {
        avisar(`Datos ficticios cargados: ${nuevasAsistencias.length} asistencias y ${nuevasNotas.length} notas.`);
    }
}

function motivoNotaDemo(asignatura, nota) {
    if (nota < NOTA_MINIMA) {
        return `En ${asignatura}, entregó parte de la actividad y dejó respuestas sin justificar. Debe completar los ejercicios y explicar sus respuestas.`;
    }
    if (nota < 4) {
        return `En ${asignatura}, resolvió los ejercicios básicos. Debe corregir errores de aplicación y justificar mejor sus respuestas.`;
    }
    return `En ${asignatura}, completó la actividad, aplicó los conceptos correctamente y justificó sus respuestas con ejemplos.`;
}

function guardarCalificaciones() {
    return guardarDatos(
        CLAVES.calificaciones,
        calificaciones
    );
}

// ======================================
// FUNCIONES AUXILIARES
// ======================================

function escapar(valor) {
    return String(valor ?? "").replace(
        /[&<>"']/g,
        caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[caracter])
    );
}

function avisar(mensaje, error = false, eliminacion = false) {
    const area = document.getElementById("avisos");

    if (!area) return;

    const aviso = document.createElement("div");

    aviso.className = "aviso" + (
        error || eliminacion ? " error" : ""
    );

    aviso.textContent = mensaje;

    area.appendChild(aviso);

    setTimeout(() => {
        aviso.remove();
    }, 3600);
}

function obtenerEstudiante(documento) {
    return estudiantes.find(
        e => e.documento === String(documento)
    );
}

function nombreEstudiante(documento) {
    const estudiante = obtenerEstudiante(documento);

    if (!estudiante) {
        return "Estudiante no encontrado";
    }

    return (
        estudiante.nombre + " " + estudiante.apellido
    ).trim();
}

function opcionesEstudiantes(registros = estudiantes) {
    return registros.map(estudiante => `
        <option value="${escapar(estudiante.documento)}">
            ${escapar(estudiante.nombre)}
            ${escapar(estudiante.apellido)}
            (${escapar(estudiante.documento)})
        </option>
    `).join("");
}

function opcionesCursos(incluirAnteriores = false) {
    const actuales = GRADOS.map((grado, indice) => `
        <optgroup label="${grado}">
            ${CURSOS.slice(indice * 3, indice * 3 + 3).map(curso =>
                `<option value="${curso}">${curso}</option>`).join("")}
        </optgroup>
    `).join("");
    const anteriores = [...new Set(estudiantes.map(estudiante => estudiante.grado))]
        .filter(curso => typeof curso === "string" && curso && !CURSOS.includes(curso));
    return '<option value="">Selecciona un curso</option>' + actuales +
        (incluirAnteriores && anteriores.length ? `<optgroup label="Cursos de registros anteriores">
            ${anteriores.map(curso => `<option value="${escapar(curso)}">${escapar(curso)}</option>`).join("")}
        </optgroup>` : "");
}

function estudiantesDelCurso(curso) {
    return curso ? estudiantes.filter(estudiante => estudiante.grado === curso) : [];
}

function campoCurso(id) {
    return `<div class="campo"><label for="${id}">Curso</label>
        <select id="${id}" required>${opcionesCursos(true)}</select></div>`;
}

function campoConsultaCurso() {
    return `<div class="consulta-curso">${campoCurso("cursoConsulta")}</div>`;
}

function configurarConsultaCurso(actualizar) {
    const selector = document.getElementById("cursoConsulta");
    if (selector) {
        selector.value = cursoConsulta;
        cursoConsulta = selector.value;
        selector.addEventListener("change", () => {
            cursoConsulta = selector.value;
            actualizar();
        });
    }
    actualizar();
}

function seleccionarCursoConsulta(curso) {
    cursoConsulta = curso;
    const selector = document.getElementById("cursoConsulta");
    if (selector) selector.value = curso;
}

function mensajeConsultaVacia(mensaje) {
    if (sesion.rol === "estudiante") return mensaje;
    if (!cursoConsulta) return "Selecciona un curso para consultar sus registros.";
    if (!estudiantesDelCurso(cursoConsulta).length) return "Este curso no tiene estudiantes matriculados.";
    return mensaje;
}

function filtrarSelectorEstudiantes(curso, selector, mensaje) {
    const registros = estudiantesDelCurso(curso);
    selector.innerHTML = '<option value="">Selecciona un estudiante</option>' +
        opcionesEstudiantes(registros);
    selector.disabled = !registros.length;
    mensaje.textContent = curso && !registros.length ? "Este curso no tiene estudiantes matriculados." : "";
}

function opcionesEstadoAsistencia() {
    return '<option value="">Selecciona un estado</option>' + ESTADOS_ASISTENCIA.map(estado =>
        `<option value="${estado}">${estado}</option>`).join("");
}

function mostrarGuardado(boton) {
    boton.classList.remove("btn-confirmado");
    void boton.offsetWidth;
    boton.classList.add("btn-confirmado");
}

function fechaHoy() {
    const hoy = new Date();

    const anio = hoy.getFullYear();

    const mes = String(
        hoy.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        hoy.getDate()
    ).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function formatoNota(nota) {
    if (nota === null || !Number.isFinite(Number(nota))) return "Sin datos";
    return Number(nota).toFixed(1);
}

function formatoNumero(numero, decimales = 2) {
    if (numero === null) {
        return "Sin datos";
    }

    return Number(numero).toLocaleString("es-CO", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

// ======================================
// CÁLCULOS ACADÉMICOS
// ======================================

function promedio(documento, asignatura = "", fecha = "", registros = calificaciones) {
    const notas = registros.filter(
        calificacion =>
            calificacion.documento === documento &&
            (!asignatura || calificacion.asignatura === asignatura) &&
            coincideFechaCalificacion(calificacion, fecha)
    );

    return media(notas.map(calificacion => Number(calificacion.nota)));
}

function media(valores) {
    return valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : null;
}

function promedioGeneral() {
    return media(calificaciones.map(calificacion => Number(calificacion.nota)));
}

function porcentajeAsistencia(documento, datos = asistencias) {
    const registros = datos.filter(
        asistencia =>
            asistencia.documento === documento
    );

    if (!registros.length) {
        return null;
    }

    const presentes = registros.filter(
        asistencia =>
            asistencia.estado === "Presente"
    ).length;

    return presentes / registros.length * 100;
}

// ======================================
// INDICADOR DE CONEXIÓN
// ======================================

function actualizarEstadoConexion() {
    const indicador = document.getElementById(
        "estadoConexion"
    );

    const texto = document.getElementById(
        "textoConexion"
    );

    if (!indicador || !texto) return;

    if (navigator.onLine) {
        indicador.className =
            "estado-conexion conectado";

        texto.textContent = "En línea · datos locales";

    } else {
        indicador.className =
            "estado-conexion desconectado";

        texto.textContent = "Sin conexión · datos locales";
    }
}

// ======================================
// NAVEGACIÓN ENTRE MÓDULOS
// ======================================

function mostrarModulo(modulo) {
    if (!sesion || eliminando) return;

    const permitidos = MODULOS[sesion.rol];

    if (!puedeAbrirModulo(sesion.rol, modulo)) return;
    moduloActual = modulo;

    document.querySelectorAll(
        ".menu-opcion"
    ).forEach(boton => {
        boton.hidden = !permitidos.includes(boton.dataset.modulo);

        const activo =
            boton.dataset.modulo === moduloActual;

        boton.classList.toggle(
            "activo",
            activo
        );

        boton.setAttribute(
            "aria-current",
            activo ? "page" : "false"
        );
    });

    const titulos = {
        inicio: "Panel de inicio",
        estudiantes: "Gestión de estudiantes",
        asistencia: sesion.rol === "estudiante" ? "Mi asistencia" : "Control de asistencia",
        calificaciones: sesion.rol === "estudiante" ? "Mis calificaciones" : "Gestión de calificaciones",
        boletines: sesion.rol === "estudiante" ? "Mi boletín académico" : "Boletines académicos",
        pruebas: "Pruebas experimentales",
        reportes: "Reportes académicos"
    };

    document.getElementById(
        "tituloPagina"
    ).textContent = titulos[moduloActual];

    switch (moduloActual) {
        case "inicio":
            mostrarInicio();
            break;

        case "estudiantes":
            mostrarEstudiantes();
            break;

        case "asistencia":
            mostrarAsistencia();
            break;

        case "calificaciones":
            mostrarCalificaciones();
            break;

        case "boletines":
            mostrarBoletines();
            break;

        case "pruebas":
            mostrarPruebasExperimentales();
            break;

        case "reportes":
            mostrarReportes();
            break;
    }
}

// ======================================
//  INICIO
// ======================================

function mostrarInicio() {
    const prom = promedioGeneral();

    const presentes = asistencias.filter(
        asistencia =>
            asistencia.estado === "Presente"
    ).length;

    document.getElementById(
        "contenido"
    ).innerHTML = `
        <h2 class="seccion-titulo">
            Bienvenido a Plataforma Académica
        </h2>

        <p class="descripcion">
            Consulta los indicadores generales
            y administra la información académica
            desde un solo lugar.
        </p>

        <div class="tarjetas">

            <div class="tarjeta">

                <div class="numero">
                    ${estudiantes.length}
                </div>

                <div class="etiqueta">
                    Estudiantes registrados
                </div>
            </div>

            <div class="tarjeta">

                <div class="numero">
                    ${asistencias.length}
                </div>

                <div class="etiqueta">
                    Registros de asistencia
                </div>
            </div>

            <div class="tarjeta">

                <div class="numero">
                    ${calificaciones.length}
                </div>

                <div class="etiqueta">
                    Calificaciones registradas
                </div>
            </div>

            <div class="tarjeta">

                <div class="numero">
                    ${prom === null
                        ? "—"
                        : formatoNota(prom)}
                </div>

                <div class="etiqueta">
                    Promedio de notas
                </div>
            </div>

        </div>

        <section class="panel">

            <h3>Resumen académico</h3>

            <p class="descripcion">
                Asistencias presentes:
                <strong>${presentes}</strong>
                de ${asistencias.length} registros.
            </p>

            <div class="ayuda">
                Los datos se guardan en este navegador
                mediante <strong>localStorage</strong>.

                El indicador de conexión refleja el
                estado informado por el navegador.

                Todavía no existe sincronización real
                con una base de datos central.
            </div>

        </section>
    `;
}

// ======================================
//  ESTUDIANTES
// ======================================

function mostrarEstudiantes() {
    const administra = sesion.rol === "administrador";
    document.getElementById(
        "contenido"
    ).innerHTML = `
        <h2 class="seccion-titulo">
            ${administra ? "Registro de estudiantes" : "Consulta de estudiantes"}
        </h2>

        <p class="descripcion">
            ${administra ? "Agrega estudiantes y consulta los registros guardados localmente."
                : "Consulta los registros guardados localmente."}
        </p>

        ${administra ? `<section class="panel">

            <h3>Nuevo estudiante</h3>

            <form id="formEstudiante" class="form-grid">

                <div class="campo">
                    <label for="documento">
                        Documento de identidad
                    </label>

                    <input
                        id="documento"
                        name="documento"
                        required
                        maxlength="30"
                        placeholder="Número de documento"
                    >
                </div>

                <div class="campo">
                    <label for="nombre">Nombre</label>

                    <input
                        id="nombre"
                        name="nombre"
                        required
                        maxlength="70"
                        placeholder="Nombre del estudiante"
                    >
                </div>

                <div class="campo">
                    <label for="apellido">Apellido</label>

                    <input
                        id="apellido"
                        name="apellido"
                        required
                        maxlength="70"
                        placeholder="Apellido del estudiante"
                    >
                </div>

                <div class="campo">
                    <label for="grado">
                        Grado / curso
                    </label>

                    <select id="grado" name="grado" required>${opcionesCursos()}</select>
                </div>

                <div class="acciones-form">
                    <button
                        type="submit"
                        class="btn btn-primario"
                    >
                        Registrar estudiante
                    </button>
                </div>

            </form>

        </section>

        <section class="panel">
            <h3>Cuenta de estudiante de demostración</h3>
            <p class="descripcion">La cuenta <strong>estudiante</strong> mostrará las notas, asistencias
                y reportes del registro vinculado aquí.</p>
            <p class="descripcion">Los estudiantes ficticios ya tienen acceso individual con su
                número de documento como usuario.</p>
            <form id="formVinculacionDemo" class="form-grid">
                <div class="campo">
                    <label for="documentoDemo">Estudiante vinculado</label>
                    <select id="documentoDemo" required>
                        <option value="">Selecciona un estudiante</option>
                        ${opcionesEstudiantes()}
                    </select>
                </div>
                <div class="acciones-form">
                    <button type="submit" class="btn btn-primario" ${!estudiantes.length ? "disabled" : ""}>
                        Vincular cuenta
                    </button>
                </div>
            </form>
        </section>` : ""}

        <section class="panel">

            <h3>Estudiantes por curso</h3>
            ${campoConsultaCurso()}

            <div class="tabla-contenedor">

                <table id="tablaEstudiantes">
                    <thead>
                        <tr>
                            <th scope="col">Documento</th>
                            <th scope="col">Nombre</th>
                            <th scope="col">Apellido</th>
                            <th scope="col">Grado</th>
                            ${administra ? '<th scope="col">Acciones</th>' : ""}
                        </tr>
                    </thead>

                    <tbody id="cuerpoEstudiantes">
                    </tbody>
                </table>

            </div>

        </section>
    `;

    document.getElementById(
        "formEstudiante"
    )?.addEventListener(
        "submit",
        registrarEstudiante
    );

    const formularioDemo = document.getElementById("formVinculacionDemo");
    if (formularioDemo) {
        const selector = document.getElementById("documentoDemo");
        selector.value = obtenerEstudiante(documentoCuentaEstudiante())?.documento ?? "";
        formularioDemo.addEventListener("submit", evento => {
            evento.preventDefault();
            if (sesion?.rol !== "administrador" || eliminando || !obtenerEstudiante(selector.value)) return;

            const vinculacion = [{ documento: selector.value }];
            if (!guardarDatos(CLAVES.vinculacionDemo, vinculacion)) return;
            vinculacionDemo = vinculacion;
            mostrarGuardado(formularioDemo.querySelector('button[type="submit"]'));
            avisar("Cuenta de demostración vinculada a " + nombreEstudiante(selector.value) + ".");
        });
    }

    configurarConsultaCurso(actualizarTabla);
}

// MOSTRAR TABLA DE ESTUDIANTES

function actualizarTabla() {
    const administra = sesion.rol === "administrador";
    const cuerpo = document.getElementById(
        "cuerpoEstudiantes"
    );

    if (!cuerpo) return;

    const visibles = registrosVisibles(estudiantes);
    if (!visibles.length) {
        cuerpo.innerHTML = `
            <tr>
                <td colspan="${administra ? 5 : 4}" class="vacio">
                    ${mensajeConsultaVacia("No hay estudiantes registrados.")}
                </td>
            </tr>
        `;

        return;
    }

    cuerpo.innerHTML = visibles.map(
        estudiante => `
            <tr>
                <td>
                    ${escapar(estudiante.documento)}
                </td>

                <td>
                    ${escapar(estudiante.nombre)}
                </td>

                <td>
                    ${escapar(estudiante.apellido)}
                </td>

                <td>
                    ${escapar(estudiante.grado)}
                </td>

                ${administra ? `<td>
                    <div class="acciones-tabla">

                        <button
                            type="button"
                            class="btn btn-peligro"
                            data-documento="${escapar(estudiante.documento)}"
                        >
                            Eliminar
                        </button>

                    </div>
                </td>` : ""}
            </tr>
        `
    ).join("");

    cuerpo.querySelectorAll(
        "button[data-documento]"
    ).forEach(boton => {

        boton.addEventListener("click", () => {
            eliminarEstudiante(
                boton.dataset.documento,
                boton
            );
        });

    });
}

// REGISTRAR ESTUDIANTE

function registrarEstudiante(evento) {
    evento.preventDefault();
    if (!puedeEditarEstudiantes(sesion?.rol)) return;

    const formulario = evento.currentTarget;

    const documento = formulario.querySelector(
        "#documento"
    ).value.trim();

    const nombre = formulario.querySelector(
        "#nombre"
    ).value.trim();

    const apellido = formulario.querySelector(
        "#apellido"
    ).value.trim();

    const grado = formulario.querySelector(
        "#grado"
    ).value.trim();

    if (!documento || !nombre || !apellido) {
        avisar(
            "Completa todos los campos.",
            true
        );

        return;
    }

    if (!CURSOS.includes(grado)) {
        avisar("Selecciona un curso de la lista.", true);
        return;
    }

    if (obtenerEstudiante(documento)) {
        avisar(
            "Ya existe un estudiante con ese documento.",
            true
        );

        return;
    }

    const nuevoEstudiante = {
        documento,
        nombre,
        apellido,
        grado
    };

    estudiantes.push(nuevoEstudiante);

    if (!guardarEstudiantes()) {
        estudiantes.pop();
        return;
    }
    seleccionarCursoConsulta(grado);

    // ANIMACIÓN VERDE DE REGISTRO

    const boton = formulario.querySelector(
        'button[type="submit"]'
    );

    boton.disabled = true;
    boton.classList.add("btn-registrando");

    boton.innerHTML = `
        <span class="spinner-registro"></span>
        Registrando...
    `;

    setTimeout(() => {
        if (!boton.isConnected) return;

        boton.classList.remove(
            "btn-registrando"
        );

        boton.classList.add(
            "btn-registrado"
        );

        boton.textContent = "✓ ¡Registrado!";

        avisar(
            "Estudiante registrado correctamente."
        );

        setTimeout(() => {
            if (boton.isConnected) mostrarModulo("estudiantes");
        }, 1000);

    }, 700);
}

// ELIMINAR ESTUDIANTE

// VENTANA DE CONFIRMACIÓN PROPIA (reemplaza al confirm() del navegador)

function confirmarAccion({ titulo, mensaje, textoConfirmar = "Confirmar" }) {
    return new Promise(resolve => {
        const anterior = document.activeElement;
        const fondo = document.createElement("div");

        fondo.className = "modal-fondo";

        fondo.innerHTML = `
            <div class="modal" role="alertdialog" aria-modal="true"
                 aria-labelledby="modalTitulo"
                 aria-describedby="modalMensaje">

                <div class="modal-icono" aria-hidden="true">!</div>

                <h3 id="modalTitulo">${escapar(titulo)}</h3>
                <p id="modalMensaje">${escapar(mensaje)}</p>

                <div class="modal-acciones">
                    <button type="button" class="btn btn-secundario"
                            data-resp="no">
                        Cancelar
                    </button>

                    <button type="button" class="btn btn-peligro"
                            data-resp="si">
                        ${escapar(textoConfirmar)}
                    </button>
                </div>
            </div>
        `;

        const botonNo = fondo.querySelector('[data-resp="no"]');
        const botonSi = fondo.querySelector('[data-resp="si"]');

        function cerrar(valor) {
            document.removeEventListener("keydown", teclas);
            fondo.remove();

            if (anterior && anterior.focus) anterior.focus();

            resolve(valor);
        }

        function teclas(evento) {
            if (evento.key === "Escape") {
                cerrar(false);
                return;
            }

            // El foco se queda dentro de la ventana
            if (evento.key === "Tab") {
                if (evento.shiftKey && document.activeElement === botonNo) {
                    evento.preventDefault();
                    botonSi.focus();
                } else if (!evento.shiftKey && document.activeElement === botonSi) {
                    evento.preventDefault();
                    botonNo.focus();
                }
            }
        }

        fondo.addEventListener("click", evento => {
            if (evento.target === fondo) cerrar(false);
        });

        botonNo.addEventListener("click", () => cerrar(false));
        botonSi.addEventListener("click", () => cerrar(true));

        document.addEventListener("keydown", teclas);
        document.body.appendChild(fondo);

        // Por seguridad, el foco empieza en "Cancelar"
        botonNo.focus();
    });
}

async function eliminarEstudiante(documento, boton) {
    if (sesion?.rol !== "administrador" || eliminando) return;

    const confirmar = await confirmarAccion({
        titulo: "Eliminar estudiante",
        mensaje:
            "Se eliminará a " + nombreEstudiante(documento) +
            " junto con sus notas y asistencias. " +
            "Esta acción no se puede deshacer.",
        textoConfirmar: "Sí, eliminar"
    });

    if (!confirmar || sesion?.rol !== "administrador" || eliminando) return;

    eliminando = true;
    const salir = document.getElementById("cerrarSesion");
    salir.disabled = true;

    const botones = document.querySelectorAll(
        "#tablaEstudiantes button"
    );

    botones.forEach(b => {
        b.disabled = true;
    });

    // ANIMACIÓN DE ELIMINACIÓN

    boton.classList.add("btn-eliminando");

    boton.innerHTML = `
        <span class="spinner-eliminar"></span>
        Eliminando...
    `;

    setTimeout(() => {
        const respaldo = {
            estudiantes,
            asistencias,
            calificaciones
        };

        estudiantes = estudiantes.filter(
            e => e.documento !== documento
        );

        asistencias = asistencias.filter(
            a => a.documento !== documento
        );

        calificaciones = calificaciones.filter(
            c => c.documento !== documento
        );

        const guardado =
            guardarEstudiantes() &&
            guardarAsistencias() &&
            guardarCalificaciones();

        if (!guardado) {
            ({ estudiantes, asistencias, calificaciones } = respaldo);

            guardarEstudiantes();
            guardarAsistencias();
            guardarCalificaciones();
            eliminando = false;
            salir.disabled = false;
            mostrarEstudiantes();
            return;
        }

        boton.classList.remove(
            "btn-eliminando"
        );

        boton.classList.add(
            "btn-eliminado"
        );

        boton.textContent = "✓ ¡Eliminado!";

        avisar(
            "Estudiante eliminado correctamente.", false, true
        );

        setTimeout(() => {
            eliminando = false;
            salir.disabled = false;
            mostrarEstudiantes();
        }, 700);

    }, 1000);
}

// ======================================
//  ASISTENCIA
// ======================================

function mostrarAsistencia() {
    const personal = sesion.rol === "estudiante";
    document.getElementById(
        "contenido"
    ).innerHTML = `
        <h2 class="seccion-titulo">
            ${personal ? "Mi asistencia" : "Registro de asistencia"}
        </h2>

        <p class="descripcion">
            ${personal ? "Consulta tu historial de asistencia."
                : "Registra la asistencia de un estudiante o de todo el curso por fecha."}
        </p>

        ${personal ? "" : `<section class="panel">

            <h3>Nueva asistencia</h3>
            <div class="acciones-superiores">
                <button id="iniciarPruebaAsistencia" class="btn btn-secundario" type="button">Iniciar prueba cronometrada</button>
                <span id="estadoPruebaAsistencia" role="status"></span>
            </div>
            <p class="nota">Usa un curso con datos ficticios y una fecha nueva. El cronómetro termina al intentar guardar el curso completo.</p>

            <form id="formAsistencia" class="form-grid" novalidate>
                ${campoCurso("cursoAsistencia")}
                <div class="campo">
                    <label for="modoAsistencia">Registro</label>
                    <select id="modoAsistencia" disabled>
                        <option value="individual">Un estudiante</option>
                        <option value="curso">Curso completo</option>
                    </select>
                </div>
                <div class="campo">
                    <label for="fechaAsistencia">Fecha</label>
                    <input type="date" id="fechaAsistencia" value="${fechaHoy()}" required disabled>
                </div>
                <p id="mensajeCursoAsistencia" class="nota formulario-ancho" role="status"></p>
                <div id="seleccionIndividual" class="campo">
                    <label for="asistenciaEstudiante">Estudiante</label>
                    <select id="asistenciaEstudiante" required disabled></select>
                </div>
                <div id="estadoIndividual" class="campo">
                    <label for="estadoAsistencia">Estado</label>
                    <select id="estadoAsistencia" required disabled>${opcionesEstadoAsistencia()}</select>
                </div>
                <fieldset id="asistenciaCursoLista" class="asistencia-curso formulario-ancho" hidden>
                    <legend>Asistencia del curso</legend>
                    <div id="filasAsistenciaCurso"></div>
                </fieldset>
                <div class="acciones-form formulario-ancho">
                    <button id="guardarAsistencia" class="btn btn-primario" type="submit" disabled>
                        Guardar asistencia
                    </button>
                </div>
            </form>

        </section>
        <section class="panel">
            <div class="acciones-superiores">
                <h3>Pruebas de asistencia grupal</h3>
                <button id="descargarPruebasAsistencia" class="btn btn-secundario" type="button">Descargar Excel</button>
            </div>
            <p class="descripcion">Meta de la Etapa 3 · Guardar todo el grupo en 120 segundos o menos.</p>
            <div id="resultadosPruebasAsistencia"></div>
        </section>`}

        <section class="panel">

            <h3>${personal ? "Historial de asistencia" : "Historial de asistencia por curso"}</h3>
            ${personal ? "" : campoConsultaCurso()}

            <div class="tabla-contenedor">

                <table>
                    <thead>
                        <tr>
                            <th scope="col">Fecha</th>
                            <th scope="col">Estudiante</th>
                            <th scope="col">Estado</th>
                        </tr>
                    </thead>

                    <tbody id="cuerpoAsistencias">
                    </tbody>
                </table>

            </div>

        </section>
    `;

    if (!personal) {
        configurarFormularioAsistencia();
        mostrarPruebasAsistencia();
        document.getElementById("descargarPruebasAsistencia").addEventListener("click", descargarPruebasAsistencia);
    }
    configurarConsultaCurso(actualizarTablaAsistencia);
}

function configurarFormularioAsistencia() {
    const formulario = document.getElementById("formAsistencia");
    const curso = document.getElementById("cursoAsistencia");
    const modo = document.getElementById("modoAsistencia");
    const fecha = document.getElementById("fechaAsistencia");
    const estudiante = document.getElementById("asistenciaEstudiante");
    const estado = document.getElementById("estadoAsistencia");
    const mensaje = document.getElementById("mensajeCursoAsistencia");
    const lista = document.getElementById("asistenciaCursoLista");
    const filas = document.getElementById("filasAsistenciaCurso");
    const guardar = document.getElementById("guardarAsistencia");
    const iniciar = document.getElementById("iniciarPruebaAsistencia");
    const estadoPrueba = document.getElementById("estadoPruebaAsistencia");
    let inicioPrueba = null;

    iniciar.addEventListener("click", () => {
        if (inicioPrueba !== null) {
            inicioPrueba = null;
            iniciar.textContent = "Iniciar prueba cronometrada";
            estadoPrueba.textContent = "Medición cancelada.";
            return;
        }
        curso.value = "";
        modo.value = "curso";
        curso.dispatchEvent(new Event("change"));
        inicioPrueba = performance.now();
        iniciar.textContent = "Cancelar medición";
        estadoPrueba.textContent = "Cronómetro en marcha. Selecciona el curso.";
        curso.focus();
    });

    function finalizarPrueba(esperados, guardados, mensaje) {
        if (inicioPrueba === null || modo.value !== "curso") return;
        const duracionMs = Math.round(performance.now() - inicioPrueba);
        inicioPrueba = null;
        iniciar.textContent = "Iniciar prueba cronometrada";
        estadoPrueba.textContent = `Intento finalizado en ${segundosPrueba(duracionMs)} s.`;
        const prueba = { curso: curso.value, fecha: fecha.value, esperados, guardados, duracionMs, mensaje };
        pruebasAsistencia.push(prueba);
        if (!guardarDatos(CLAVES.pruebasAsistencia, pruebasAsistencia)) pruebasAsistencia.pop();
        mostrarPruebasAsistencia();
    }

    function actualizarVista() {
        const grupal = modo.value === "curso";
        const disponibles = estudiantesDelCurso(curso.value);
        modo.disabled = !disponibles.length;
        fecha.disabled = !disponibles.length;
        estudiante.disabled = grupal || !disponibles.length;
        document.getElementById("seleccionIndividual").hidden = grupal;
        document.getElementById("estadoIndividual").hidden = grupal;
        estado.disabled = grupal || !estudiante.value;
        lista.hidden = !grupal || !disponibles.length;
        guardar.disabled = !disponibles.length;
        if (disponibles.length) mensaje.textContent = "";
        if (!grupal || !disponibles.length) return;

        filas.innerHTML = disponibles.map((registro, indice) => {
            const existente = asistenciaRegistrada(registro.documento, fecha.value);
            const nombre = escapar(nombreEstudiante(registro.documento));
            return `<div class="asistencia-fila">
                ${existente ? `<span>${nombre}</span>
                    <span class="estado ${existente.estado === "Presente" ? "estado-bien" : "estado-mal"}">
                        ${escapar(existente.estado)} · Registrado
                    </span>` : `<label for="estadoCurso${indice}">${nombre}</label>
                    <select id="estadoCurso${indice}" data-documento="${escapar(registro.documento)}">
                        ${opcionesEstadoAsistencia()}
                    </select>`}
            </div>`;
        }).join("");
        guardar.disabled = !filas.querySelector("select");
        if (guardar.disabled) mensaje.textContent = "Todo el curso ya tiene asistencia registrada para esta fecha.";
    }

    curso.addEventListener("change", () => {
        filtrarSelectorEstudiantes(curso.value, estudiante, mensaje);
        estado.value = "";
        actualizarVista();
    });
    modo.addEventListener("change", actualizarVista);
    fecha.addEventListener("change", actualizarVista);
    estudiante.addEventListener("change", () => {
        estado.value = "";
        estado.disabled = !estudiante.value;
    });
    filtrarSelectorEstudiantes("", estudiante, mensaje);

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();
        if (!puedeRegistrarActividad(sesion?.rol)) return;

        const matriculados = estudiantesDelCurso(curso.value);
        if (!matriculados.length || !fecha.value || !fecha.validity.valid) {
            const error = "Selecciona un curso con estudiantes y una fecha válida.";
            finalizarPrueba(matriculados.length, 0, error);
            avisar(error, true);
            return;
        }

        const grupal = modo.value === "curso";
        const pendientes = grupal
            ? matriculados.filter(registro => !asistenciaRegistrada(registro.documento, fecha.value))
            : matriculados.filter(registro => registro.documento === estudiante.value);

        if (!pendientes.length) {
            const error = grupal ? "Ya se registró la asistencia de todo el curso en esta fecha."
                : "Selecciona un estudiante matriculado en el curso.";
            finalizarPrueba(matriculados.length, 0, error);
            avisar(error, true);
            return;
        }

        if (!grupal && asistenciaRegistrada(estudiante.value, fecha.value)) {
            avisar("Ya hay una asistencia registrada para ese estudiante en esa fecha.", true);
            return;
        }

        const estados = grupal
            ? new Map([...filas.querySelectorAll("select")].map(campo => [campo.dataset.documento, campo.value]))
            : new Map([[estudiante.value, estado.value]]);
        const registros = pendientes.map(registro => ({
            documento: registro.documento,
            fecha: fecha.value,
            estado: estados.get(registro.documento)
        }));

        if (registros.some(registro => !ESTADOS_ASISTENCIA.includes(registro.estado))) {
            const error = grupal ? "Selecciona un estado para cada estudiante pendiente."
                : "Selecciona un estado de asistencia.";
            finalizarPrueba(matriculados.length, 0, error);
            avisar(error, true);
            return;
        }

        asistencias.push(...registros);
        if (!guardarAsistencias()) {
            asistencias.splice(-registros.length);
            finalizarPrueba(matriculados.length, 0, "Error de almacenamiento.");
            return;
        }

        finalizarPrueba(matriculados.length, registros.length, registros.length === matriculados.length
            ? "Guardado completo." : "Guardado parcial. El curso tenía registros previos.");
        avisar(grupal ? `Asistencia guardada para ${registros.length} estudiante(s).` : "Asistencia guardada correctamente.");
        mostrarGuardado(guardar);
        seleccionarCursoConsulta(curso.value);
        actualizarTablaAsistencia();
        actualizarVista();
    });
}

function asistenciaRegistrada(documento, fecha, registros = asistencias) {
    return registros.find(asistencia => asistencia.documento === documento && asistencia.fecha === fecha);
}

function segundosPrueba(milisegundos) {
    return (milisegundos / 1000).toFixed(3);
}

function pruebaCumpleMeta(prueba) {
    return prueba.esperados > 0 && prueba.guardados === prueba.esperados &&
        prueba.duracionMs <= META_PRUEBA_ASISTENCIA * 1000;
}

function mostrarPruebasAsistencia() {
    const resultados = document.getElementById("resultadosPruebasAsistencia");
    document.getElementById("descargarPruebasAsistencia").disabled = !pruebasAsistencia.length;
    if (!pruebasAsistencia.length) {
        resultados.textContent = "Todavía no hay intentos cronometrados.";
        return;
    }

    const cumplidos = pruebasAsistencia.filter(pruebaCumpleMeta).length;
    const porcentaje = formatoNumero(cumplidos / pruebasAsistencia.length * 100, 1);
    const maximo = Math.max(META_PRUEBA_ASISTENCIA * 1000, ...pruebasAsistencia.map(prueba => prueba.duracionMs)) * 1.12;
    const posicionY = milisegundos => milisegundos / maximo * 100;
    resultados.innerHTML = `
        <p><strong>${porcentaje} %</strong> de los intentos guardaron todo el grupo dentro de la meta
            (${cumplidos} de ${pruebasAsistencia.length}).</p>
        <figure class="grafico-pruebas" aria-label="Dispersión de tiempos. Los valores exactos aparecen en la tabla.">
            <figcaption>Tiempo por intento (s)</figcaption>
            <div class="grafico-pruebas-area" aria-hidden="true">
                <span class="grafico-pruebas-meta" style="bottom:${posicionY(META_PRUEBA_ASISTENCIA * 1000)}%">120 s</span>
                ${pruebasAsistencia.map((prueba, indice) => `
                    <span class="grafico-pruebas-punto ${pruebaCumpleMeta(prueba) ? "cumple" : ""}"
                        style="left:${(indice + 1) / (pruebasAsistencia.length + 1) * 100}%; bottom:${posicionY(prueba.duracionMs)}%"
                        title="Intento ${indice + 1}: ${segundosPrueba(prueba.duracionMs)} s"></span>`).join("")}
                <span class="grafico-pruebas-cero">0 s</span>
            </div>
            <p class="nota">Intentos en orden de registro · Verde si cumple la meta · Rojo si no cumple</p>
        </figure>
        <div class="tabla-contenedor">
            <table>
                <thead><tr>
                    <th scope="col">Intento</th><th scope="col">Curso</th><th scope="col">Fecha</th>
                    <th scope="col">Guardados / esperados</th><th scope="col">Tiempo (s)</th>
                    <th scope="col">Diferencia frente a 120 s</th><th scope="col">Estado</th>
                </tr></thead>
                <tbody>${pruebasAsistencia.map((prueba, indice) => `
                    <tr><th scope="row">${indice + 1}</th><td>${escapar(prueba.curso)}</td>
                        <td>${escapar(prueba.fecha)}</td><td>${prueba.guardados} / ${prueba.esperados}</td>
                        <td>${segundosPrueba(prueba.duracionMs)}</td>
                        <td>${segundosPrueba(prueba.duracionMs - META_PRUEBA_ASISTENCIA * 1000)} s</td>
                        <td><span class="estado ${pruebaCumpleMeta(prueba) ? "estado-bien" : "estado-mal"}">
                            ${pruebaCumpleMeta(prueba) ? "Cumple" : "No cumple"}
                        </span> ${escapar(prueba.mensaje)}</td></tr>`).join("")}
                </tbody>
            </table>
        </div>`;
}

function descargarPruebasAsistencia() {
    const filas = [["Intento", "Curso", "Fecha", "Guardados", "Esperados", "Tiempo (s)",
        "Meta (s)", "Diferencia (s)", "Cumple", "Mensaje"]];
    pruebasAsistencia.forEach((prueba, indice) => {
        filas.push([indice + 1, prueba.curso, prueba.fecha, prueba.guardados, prueba.esperados,
            prueba.duracionMs / 1000, META_PRUEBA_ASISTENCIA,
            (prueba.duracionMs - META_PRUEBA_ASISTENCIA * 1000) / 1000,
            pruebaCumpleMeta(prueba) ? "Sí" : "No", prueba.mensaje]);
    });
    descargarExcel("pruebas-asistencia-plataforma-academica.xlsx", [{ nombre: "Asistencia", filas }]);
}

function ejecutarPruebasExperimentales() {
    const documento = "prueba-a";
    const fecha = "2026-02-10";
    const materia = "Matemáticas";
    const otraMateria = "Inglés";
    const notas = [
        { documento, asignatura: materia, nota: 2, fecha },
        { documento, asignatura: materia, nota: 4, fecha },
        { documento, asignatura: materia, nota: 3, periodo: 2 },
        { documento, asignatura: otraMateria, nota: 5 },
        { documento: "prueba-b", asignatura: materia, nota: 1, fecha }
    ];
    const asistenciasPrueba = [
        { documento, fecha, estado: "Presente" },
        { documento, fecha: "2026-02-11", estado: "Presente" },
        { documento, fecha: "2026-02-12", estado: "Ausente" },
        { documento, fecha: "2026-02-13", estado: "Presente" },
        { documento: "prueba-b", fecha, estado: "Ausente" }
    ];
    const cuentaAdmin = CUENTAS_DEMO.find(cuenta => cuenta.rol === "administrador");
    const estudiante = { rol: "estudiante" };
    let latenciaAcumulada = 0;
    let lecturasMedidas = 0;
    function probarGuardado(registro, medirLatencia = false) {
        const clave = "edugestion_prueba_temporal_" + Math.random().toString(36).slice(2);
        try {
            const inicio = performance.now();
            if (!guardarDatos(clave, [registro])) throw new Error("Error de escritura.");
            const datos = leerDatos(clave);
            if (medirLatencia) {
                latenciaAcumulada += performance.now() - inicio;
                lecturasMedidas++;
            }
            return JSON.stringify(datos[0]) === JSON.stringify(registro) ? 1 : 0;
        } finally {
            localStorage.removeItem(clave);
        }
    }
    const casos = [
        ["Validar credenciales de administrador", "administrador", "Cuenta de demostración válida.",
            () => autenticarCuenta(cuentaAdmin.usuario, cuentaAdmin.clave)?.rol ?? "Rechazado", false, "", "acceso"],
        ["Rechazar credenciales incorrectas", "Rechazado", "Usuario válido con una contraseña incorrecta.",
            () => autenticarCuenta(cuentaAdmin.usuario, "")?.rol ?? "Rechazado", true, "", "acceso"],
        ["Guardar y leer en localStorage", 1, "Se compara el registro leído con el original.",
            () => probarGuardado({ documento }, true), false, "", "almacenamiento", true],
        ["Guardar registro de estudiante", 1, "Escritura y verificación de un registro en una clave temporal.",
            () => probarGuardado({ documento, nombre: "Prueba", apellido: "Temporal", grado: "6-1" }), false, "", "estudiantes", true],
        ["Guardar registro de calificación", 1, "Escritura y verificación de una calificación en una clave temporal.",
            () => probarGuardado(notas[0]), false, "", "calificaciones", true],
        ["Guardar registro de asistencia", 1, "Escritura y verificación de una asistencia en una clave temporal.",
            () => probarGuardado(asistenciasPrueba[0]), false, "", "asistencia", true],
        ["Detectar asistencia duplicada", "Rechazado", "Documento y fecha ya registrados.",
            () => asistenciaRegistrada(documento, fecha, asistenciasPrueba) ? "Rechazado" : "Permitido", true],
        ["Calcular promedio de calificaciones", 3, "Notas 2 y 4 para la asignatura y fecha seleccionadas.",
            () => promedio(documento, materia, fecha, notas), false, "Nota", "promedios"],
        ["Calcular promedio del periodo 1", 3, "Notas 2 y 4 en el primer trimestre.",
            () => calcularBoletin(notas.slice(0, 4)).filas.find(fila => fila.asignatura === materia).periodos[0], false, "Nota", "reportes"],
        ["Calcular promedio general del boletín", 4, "Promedios finales de 3 y 5, con igual peso.",
            () => calcularBoletin(notas.slice(0, 4)).general, false, "Nota", "reportes"],
        ["Consultar periodo sin calificaciones", null, "Tercer periodo sin notas.",
            () => calcularBoletin(notas.slice(0, 4)).filas.find(fila => fila.asignatura === materia).periodos[2], false, "", "reportes"],
        ["Calcular porcentaje de asistencia", 75, "Tres presentes de cuatro registros del estudiante.",
            () => porcentajeAsistencia(documento, asistenciasPrueba), false, "%", "asistencia"],
        ["Permitir edición de estudiantes al Administrador", "Permitido", "Permiso de registro de estudiantes.",
            () => puedeEditarEstudiantes("administrador") ? "Permitido" : "Rechazado"],
        ["Bloquear edición de estudiantes al Docente", "Rechazado", "Puede consultar estudiantes.",
            () => puedeEditarEstudiantes("docente") ? "Permitido" : "Rechazado", true],
        ["Permitir registro de actividad al Docente", "Permitido", "Permiso usado por asistencia y calificaciones.",
            () => puedeRegistrarActividad("docente") ? "Permitido" : "Rechazado"],
        ["Bloquear registro de actividad al Estudiante", "Rechazado", "Permiso usado por asistencia y calificaciones.",
            () => puedeRegistrarActividad("estudiante") ? "Permitido" : "Rechazado", true],
        ["Bloquear gestión de estudiantes al Estudiante", "Rechazado", "Acceso al módulo de estudiantes.",
            () => puedeAbrirModulo("estudiante", "estudiantes") ? "Permitido" : "Rechazado", true],
        ["Permitir al Estudiante consultar su boletín", "Permitido", "Coincide el documento de la cuenta.",
            () => puedeConsultarDocumento(estudiante, documento, documento) ? "Permitido" : "Rechazado"],
        ["Bloquear al Estudiante el boletín ajeno", "Rechazado", "El documento pertenece a otro estudiante.",
            () => puedeConsultarDocumento(estudiante, "prueba-b", documento) ? "Permitido" : "Rechazado", true]
    ];

    return casos.map(([operacion, esperado, entrada, ejecutar, rechazo = false, unidad = "", grupo = "validaciones", integridad = false]) => {
        let observado;
        let error = false;
        let repeticiones = 0;
        let transcurrido = 0;
        const inicio = performance.now();
        try {
            do {
                repeticiones++;
                observado = ejecutar();
                transcurrido = performance.now() - inicio;
            } while (Object.is(observado, esperado) && transcurrido < 2 && repeticiones < 512);
        } catch (excepcion) {
            error = true;
            observado = "Error de ejecución";
            transcurrido = performance.now() - inicio;
            console.error(excepcion);
        }
        const duracionMs = transcurrido / repeticiones;
        const diferencia = typeof esperado === "number" && typeof observado === "number"
            ? observado - esperado : null;
        const cumple = !error && (diferencia === null ? observado === esperado : Math.abs(diferencia) < 1e-9);
        const resultado = !cumple ? "No cumple" : rechazo ? "Cumple · Rechazo esperado" : "Cumple";
        const observaciones = `${entrada} Esperado ${esperado ?? "sin datos"}. Observado ${observado ?? "sin datos"}.`
            + (diferencia === null ? "" : ` Diferencia ${diferencia}${unidad === "%" ? " pp" : ""}.`)
            + (repeticiones > 1 ? ` Tiempo promedio de ${repeticiones} repeticiones.` : "");
        return { operacion, duracionMs, resultado, cumple, observaciones, esperado, observado, diferencia, unidad,
            rechazo, grupo, integridad, repeticiones,
            latenciaMs: grupo === "almacenamiento" && lecturasMedidas ? latenciaAcumulada / lecturasMedidas : null };
    });
}

const OPERACIONES_PRUEBAS = {
    acceso: "Validación de inicio de sesión",
    estudiantes: "Guardado local de estudiantes",
    calificaciones: "Guardado local de calificaciones",
    asistencia: "Guardado y cálculo de asistencia",
    promedios: "Cálculo de promedios",
    reportes: "Cálculo del boletín",
    almacenamiento: "Lectura y escritura local",
    validaciones: "Validación de permisos y duplicados"
};

const INDICADORES_PRUEBAS = [
    ["latencia", "Latencia local", "Lectura y escritura de un registro en localStorage.", "ms", "↔"],
    ["tiempo", "Tiempo de ejecución", "Duración promedio por caso de prueba.", "ms", "◷"],
    ["integridad", "Integridad de datos", "Registros leídos que coinciden con los originales.", "%", "◇"],
    ["rechazo", "Validación de errores", "Casos inválidos rechazados correctamente.", "%", "✓"]
];

function calcularIndicadoresPruebas(resultados) {
    const porcentaje = casos => casos.length ? casos.filter(caso => caso.cumple).length / casos.length * 100 : null;
    return {
        latencia: media(resultados.map(caso => caso.latenciaMs).filter(Number.isFinite)),
        tiempo: media(resultados.map(caso => caso.duracionMs)),
        integridad: porcentaje(resultados.filter(caso => caso.integridad)),
        rechazo: porcentaje(resultados.filter(caso => caso.rechazo === true))
    };
}

function valorPruebas(valor, unidad) {
    if (!Number.isFinite(valor)) return "Sin datos";
    if (unidad === "ms" && valor === 0) return "Bajo la resolución del reloj";
    if (unidad === "ms" && valor < 0.000001) return "< 0,000001 ms";
    return `${formatoNumero(valor, unidad === "ms" ? (valor < 0.001 ? 6 : 3) : 1)} ${unidad}`;
}

function ejemploDashboardPruebas() {
    const resultados = [
        ["acceso", 0.08], ["estudiantes", 0.36], ["calificaciones", 0.42], ["asistencia", 0.31],
        ["promedios", 0.12], ["reportes", 0.67], ["almacenamiento", 0.28],
        ["validaciones", 0.07], ["validaciones", 0.13]
    ].map(([grupo, duracionMs], indice) => {
        const rechazo = grupo === "validaciones";
        const cumple = indice !== 8;
        return {
            grupo, duracionMs, rechazo, cumple,
            integridad: ["estudiantes", "calificaciones", "asistencia", "almacenamiento"].includes(grupo),
            latenciaMs: grupo === "almacenamiento" ? duracionMs : null,
            operacion: rechazo ? (cumple ? "Rechazar credenciales inválidas" : "Detectar asistencia duplicada")
                : OPERACIONES_PRUEBAS[grupo],
            resultado: cumple ? (rechazo ? "Cumple · Rechazo esperado" : "Cumple") : "No cumple",
            observaciones: "Caso ficticio para comprobar el panel."
        };
    });
    const exitos = resultados.filter(caso => caso.cumple).length;
    return {
        demostracion: true, resultados, cantidad: resultados.length, exitos,
        errores: resultados.length - exitos, cumplimiento: exitos / resultados.length * 100,
        tiempoTotal: resultados.reduce((total, caso) => total + caso.duracionMs, 0)
    };
}

function mostrarPruebasExperimentales() {
    if (!puedeAbrirModulo(sesion?.rol, "pruebas")) return;
    const historial = leerEjecucionesPruebas();
    const acumulados = leerDatos(CLAVES.pruebasExperimentales)
        .concat(historial.slice().reverse().flatMap(ejecucion => ejecucion.resultados));
    let ultima = historial[0];
    let demostracion = !ultima;
    const [metasGuardadas = {}] = leerDatos(CLAVES.metasPruebas);
    let metas = metasGuardadas;
    const camposMeta = INDICADORES_PRUEBAS.map(([id, titulo, , unidad]) => [id, titulo, unidad]).concat(
        Object.entries(OPERACIONES_PRUEBAS).map(([id, titulo]) => [id, titulo, "ms"]));
    const obtener = id => document.getElementById(id);
    const contenido = obtener("contenido");
    contenido.innerHTML = `
        <section class="dashboard-pruebas" aria-labelledby="tituloDashboardPruebas">
            <header class="dashboard-pruebas-cabecera">
                <div><p class="dashboard-contexto">Plataforma Académica · Etapa 4</p>
                    <h2 id="tituloDashboardPruebas">Pruebas experimentales</h2>
                    <p>Evaluación del prototipo local y sus controles académicos.</p></div>
                <div class="pruebas-acciones no-imprimir">
                    <button type="button" id="ejecutarPruebas" class="btn dashboard-primario">Ejecutar pruebas</button>
                    <button type="button" id="verHistorialPruebas" class="btn">Ver historial</button>
                    <button type="button" id="compararPruebas" class="btn">Comparar ejecuciones</button>
                    <button type="button" id="exportarPruebas" class="btn">Exportar Excel</button>
                    <button type="button" id="pdfPruebas" class="btn">Generar informe PDF</button>
                    <button type="button" id="alternarDemoPruebas" class="btn" aria-pressed="false">Ver demostración</button>
                </div>
            </header>
            <p id="avisoDemoPruebas" class="dashboard-demo" hidden>Datos ficticios de demostración. Ejecuta las pruebas para obtener mediciones reales.</p>
            <p id="estadoPruebas" class="dashboard-estado no-imprimir" role="status"></p>
            <div id="indicadoresPruebas" class="dashboard-indicadores"></div>
            <div class="dashboard-distribucion">
                <section class="dashboard-tarjeta">
                    <div class="dashboard-encabezado"><h3>Rendimiento del sistema</h3><span>Promedio por operación</span></div>
                    <div id="rendimientoPruebas"></div>
                    <p class="dashboard-nota">Los casos rápidos se cronometran en lotes. La duración muestra el promedio
                        por repetición y excluye las esperas visuales y la interacción humana.</p>
                </section>
                <aside class="dashboard-tarjeta" id="resumenPruebas" aria-label="Resumen de la última ejecución"></aside>
            </div>
            <section class="dashboard-graficos" id="graficosPruebas" aria-label="Gráficos experimentales"></section>
            <details class="dashboard-tarjeta dashboard-detalles no-imprimir">
                <summary>Configurar metas</summary>
                <p class="dashboard-nota">Objetivos locales de referencia. Deja un campo vacío para desactivar su meta.</p>
                <form id="metasPruebas">
                    <div class="dashboard-campos">${camposMeta.map(([id, titulo, unidad]) => `
                        <label>${titulo} (${unidad})<input name="${id}" type="number" min="0" step="any"
                            ${unidad === "%" ? 'max="100"' : ""} value="${Number.isFinite(metas[id]) ? metas[id] : ""}"></label>`).join("")}</div>
                    <button type="submit" class="btn">Guardar metas</button>
                </form>
            </details>
            <section class="dashboard-tarjeta" aria-labelledby="tituloCasosPruebas">
                <h3 id="tituloCasosPruebas">Resultados de la última ejecución</h3>
                <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Resultados experimentales">
                    <table class="tabla-pruebas"><thead><tr>
                        <th scope="col">N.º</th><th scope="col">Operación</th><th scope="col">Duración (ms)</th>
                        <th scope="col">Resultado</th><th scope="col">Observaciones</th>
                    </tr></thead><tbody id="filasPruebas"></tbody></table>
                </div>
            </section>
        </section>`;

    const estado = obtener("estadoPruebas");
    const actualizar = () => {
        actualizarDashboardPruebas(demostracion ? ejemploDashboardPruebas() : ultima, metas);
        obtener("avisoDemoPruebas").hidden = !demostracion;
        const alternar = obtener("alternarDemoPruebas");
        alternar.textContent = demostracion ? "Ocultar demostración" : "Ver demostración";
        alternar.setAttribute("aria-pressed", String(demostracion));
        obtener("exportarPruebas").disabled = demostracion || !acumulados.length;
        obtener("pdfPruebas").disabled = demostracion || !ultima;
    };
    actualizar();
    obtener("alternarDemoPruebas").addEventListener("click", () => {
        demostracion = !demostracion;
        estado.textContent = "";
        actualizar();
    });
    obtener("ejecutarPruebas").addEventListener("click", () => {
        if (!puedeAbrirModulo(sesion?.rol, "pruebas")) return;
        ultima = registrarEjecucionPruebas();
        acumulados.push(...ultima.resultados);
        demostracion = false;
        actualizar();
        estado.textContent = `${ultima.exitos} de ${ultima.cantidad} casos cumplen.`
            + (ultima.guardada ? "" : " La ejecución solo está disponible en esta vista.");
    });
    obtener("verHistorialPruebas").addEventListener("click", () => mostrarHistorialPruebas());
    obtener("compararPruebas").addEventListener("click", () => mostrarHistorialPruebas(true));
    obtener("exportarPruebas").addEventListener("click", () =>
        descargarExcel("pruebas-experimentales-plataforma-academica.xlsx",
            [{ nombre: "Resultados", filas: filasExcelPruebas(acumulados) }]));
    obtener("pdfPruebas").addEventListener("click", () => window.print());
    obtener("metasPruebas").addEventListener("submit", evento => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const nuevas = Object.fromEntries(camposMeta.flatMap(([id, , unidad]) => {
            const valor = formulario.elements[id].valueAsNumber;
            return Number.isFinite(valor) && valor >= 0 && (unidad !== "%" || valor <= 100) ? [[id, valor]] : [];
        }));
        if (!guardarDatos(CLAVES.metasPruebas, [nuevas])) return;
        metas = nuevas;
        actualizar();
        estado.textContent = "Metas guardadas.";
    });
    contenido.querySelector(".dashboard-pruebas").addEventListener("click", evento => {
        if (evento.target.closest("#historialRapidoPruebas")) mostrarHistorialPruebas();
        const punto = evento.target.closest("[data-grafico-pruebas]");
        if (!punto) return;
        const grafico = punto.closest("figure");
        grafico.querySelectorAll("[data-grafico-pruebas]").forEach(control =>
            control.setAttribute("aria-pressed", String(control === punto)));
        grafico.querySelector("output").textContent = punto.dataset.graficoPruebas;
    });
}

function actualizarDashboardPruebas(ejecucion, metas) {
    const resultados = ejecucion?.resultados ?? [];
    const indicadores = calcularIndicadoresPruebas(resultados);
    const grupos = Object.entries(OPERACIONES_PRUEBAS).map(([id, titulo]) => {
        const casos = resultados.filter(caso => caso.grupo === id);
        return { id, titulo, cantidad: casos.length, promedio: media(casos.map(caso => caso.duracionMs)) };
    });
    const estadoMeta = (valor, meta, unidad) => {
        if (!Number.isFinite(meta)) return '<span class="dashboard-meta">Meta sin configurar</span>';
        const estado = valor === null || (unidad === "ms" && valor === 0) ? "" : (unidad === "%" ? valor >= meta : valor <= meta) ? "dashboard-bien" : "dashboard-mal";
        return `<span class="dashboard-meta ${estado}">Meta ${unidad === "%" ? "≥" : "≤"} ${meta === 0 && unidad === "ms" ? "0 ms" : valorPruebas(meta, unidad)}
            ${estado ? estado === "dashboard-bien" ? " · Cumple" : " · Fuera de meta" : ""}</span>`;
    };
    const poner = (id, html) => { document.getElementById(id).innerHTML = html; };
    poner("indicadoresPruebas", INDICADORES_PRUEBAS.map(([id, titulo, descripcion, unidad, icono]) => `
        <article class="dashboard-tarjeta dashboard-indicador">
            <span class="dashboard-icono" aria-hidden="true">${icono}</span><h3>${titulo}</h3>
            <strong>${valorPruebas(indicadores[id], unidad)}</strong><p>${descripcion}</p>
            ${estadoMeta(indicadores[id], metas[id], unidad)}
        </article>`).join(""));

    const escala = Math.max(...grupos.flatMap(grupo => [grupo.promedio ?? 0, metas[grupo.id] ?? 0])) || 1;
    poner("rendimientoPruebas", grupos.map(({ id, titulo, promedio }) => `
        <div class="dashboard-operacion">
            <div><span>${titulo}</span><strong>${valorPruebas(promedio, "ms")}</strong></div>
            <div class="dashboard-pista" aria-hidden="true">
                ${promedio > 0 ? `<span class="dashboard-relleno" style="--avance:${promedio / escala * 100}%"></span>` : ""}
                ${Number.isFinite(metas[id]) ? `<span class="dashboard-marca" style="left:${metas[id] / escala * 100}%"></span>` : ""}
            </div>
            ${estadoMeta(promedio, metas[id], "ms")}
        </div>`).join(""));
    const fallos = resultados.filter(caso => !caso.cumple);
    poner("resumenPruebas", `
        <h3>Última ejecución</h3>
        <p class="dashboard-nota">${ejecucion?.demostracion ? "Ejecución ficticia" :
            ejecucion ? escapar(fechaEjecucionPruebas(ejecucion)) : "Sin datos"}</p>
        ${ejecucion ? `<dl class="dashboard-resumen">
            <div><dt>Pruebas</dt><dd>${ejecucion.cantidad}</dd></div>
            <div><dt>Exitosas</dt><dd class="dashboard-bien">${ejecucion.exitos}</dd></div>
            <div><dt>Fallidas</dt><dd class="dashboard-mal">${ejecucion.errores}</dd></div>
            <div><dt>Duración total</dt><dd>${valorPruebas(ejecucion.tiempoTotal, "ms")}</dd></div>
        </dl>` : ""}
        <div class="dashboard-alertas"><h4>Alertas de errores</h4>
            ${fallos.length ? `<ul>${fallos.map(caso => `<li class="dashboard-mal">${escapar(caso.operacion)}</li>`).join("")}</ul>`
                : `<p class="dashboard-nota">${ejecucion ? "Sin errores detectados." : "Sin datos"}</p>`}
        </div>
        <button type="button" id="historialRapidoPruebas" class="btn no-imprimir">Abrir historial</button>`);
    poner("graficosPruebas", graficosDashboardPruebas(resultados, grupos, ejecucion));
    poner("filasPruebas", filasResultadosPruebas(resultados) ||
        '<tr><td class="vacio" colspan="5">Sin datos</td></tr>');
}

function graficosDashboardPruebas(resultados, grupos, ejecucion) {
    const sinDatos = '<p class="dashboard-nota">Sin datos</p>';
    const maximo = Math.max(0, ...resultados.map(caso => caso.duracionMs));
    const escala = maximo || 1;
    const detalle = texto => `data-grafico-pruebas="${escapar(texto)}" aria-label="${escapar(texto)}" title="${escapar(texto)}" aria-pressed="false"`;
    const dispersion = resultados.length ? `
        <p class="dashboard-nota">Duración (ms) · Escala de 0 a ${valorPruebas(maximo, "ms")}</p>
        <div class="dashboard-dispersion">${resultados.map((caso, indice) => {
            const etiqueta = `Caso ${indice + 1} · ${caso.operacion} · ${valorPruebas(caso.duracionMs, "ms")}`;
            return `<button type="button" class="dashboard-punto ${caso.cumple ? "" : "dashboard-punto-mal"}"
                style="left:${4 + indice / Math.max(1, resultados.length - 1) * 92}%;bottom:${7 + caso.duracionMs / escala * 84}%"
                ${detalle(etiqueta)}></button>`;
        }).join("")}</div><div class="dashboard-eje"><span>Caso 1</span><span>Caso ${resultados.length}</span></div>` : sinDatos;
    const medidos = grupos.filter(grupo => grupo.cantidad);
    const maximoPromedio = Math.max(0, ...medidos.map(grupo => grupo.promedio)) || 1;
    const barras = medidos.length ? `<div class="dashboard-chart-barras">${medidos.map(grupo => {
        const valor = valorPruebas(grupo.promedio, "ms");
        return `<button type="button" ${detalle(`${grupo.titulo} · ${valor} · ${grupo.cantidad} casos`)}>
            <span>${grupo.titulo}</span><strong>${valor}</strong>
            <span class="dashboard-pista" aria-hidden="true">${grupo.promedio > 0 ? `<span class="dashboard-relleno"
                style="--avance:${grupo.promedio / maximoPromedio * 100}%"></span>` : ""}</span></button>`;
    }).join("")}</div>` : sinDatos;
    const circular = ejecucion ? `
        <div class="dashboard-anillo" style="--exitos:${ejecucion.cumplimiento}%" aria-hidden="true">
            <strong>${valorPruebas(ejecucion.cumplimiento, "%")}</strong>
        </div>
        <div class="dashboard-leyenda">
            <button type="button" class="dashboard-bien" ${detalle(`${ejecucion.exitos} exitosas de ${ejecucion.cantidad} pruebas`)}>Exitosas · ${ejecucion.exitos}</button>
            <button type="button" class="dashboard-mal" ${detalle(`${ejecucion.errores} fallidas de ${ejecucion.cantidad} pruebas`)}>Fallidas · ${ejecucion.errores}</button>
        </div>` : sinDatos;
    return [["Dispersión de duraciones", dispersion, resultados.length], ["Promedios por operación", barras, medidos.length],
        ["Resultados de las pruebas", circular, ejecucion]].map(([titulo, grafico, interactivo]) => `
            <figure class="dashboard-tarjeta">
                <figcaption>${titulo}</figcaption>${grafico}
                ${interactivo ? '<output class="dashboard-nota no-imprimir" aria-live="polite">Selecciona un dato para ver el detalle.</output>' : ""}
            </figure>`).join("");
}

function filasResultadosPruebas(resultados) {
    return resultados.map((prueba, indice) => `<tr>
        <td>${indice + 1}</td><td>${escapar(prueba.operacion)}</td>
        <td>${valorPruebas(prueba.duracionMs, "ms")}</td>
        <td><span class="estado ${prueba.cumple ? "estado-bien" : "estado-mal"}">${escapar(prueba.resultado)}</span></td>
        <td>${escapar(prueba.observaciones)}</td>
    </tr>`).join("");
}

function filasExcelPruebas(resultados) {
    return [["N.º", "Operación", "Duración (ms)", "Resultado", "Observaciones",
        "Esperado numérico", "Observado numérico", "Diferencia", "Unidad"],
    ...resultados.map((prueba, indice) => [
        indice + 1, prueba.operacion, prueba.duracionMs, prueba.resultado, prueba.observaciones,
        typeof prueba.esperado === "number" ? prueba.esperado : "",
        typeof prueba.observado === "number" ? prueba.observado : "", prueba.diferencia ?? "", prueba.unidad
    ])];
}

function registrarEjecucionPruebas() {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
    const fecha = new Date().toISOString();
    const inicio = performance.now();
    const resultados = ejecutarPruebasExperimentales();
    const tiempoTotal = performance.now() - inicio;
    const cantidad = resultados.length;
    const exitos = resultados.filter(prueba => prueba.cumple).length;
    const ejecucion = {
        id, fecha, resultados, cantidad, exitos, errores: cantidad - exitos, tiempoTotal,
        cumplimiento: exitos / cantidad * 100,
        tiempoPromedio: media(resultados.map(prueba => prueba.duracionMs))
    };
    const guardada = guardarDatos(PREFIJO_EJECUCION_PRUEBAS + id, [ejecucion]);
    return { ...ejecucion, guardada };
}

function leerEjecucionesPruebas() {
    const ejecuciones = [];
    try {
        for (let indice = 0; indice < localStorage.length; indice++) {
            const clave = localStorage.key(indice);
            if (!clave?.startsWith(PREFIJO_EJECUCION_PRUEBAS)) continue;
            const [ejecucion] = leerDatos(clave);
            if (ejecucion && Array.isArray(ejecucion.resultados)) ejecuciones.push(ejecucion);
        }
    } catch (error) {
        console.error("No se pudo leer el historial de pruebas:", error);
    }
    return ejecuciones.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}

function fechaEjecucionPruebas(ejecucion) {
    return new Date(ejecucion.fecha).toLocaleString("es-CO");
}

function mostrarHistorialPruebas(irAComparacion = false) {
    if (!puedeEditarEstudiantes(sesion?.rol)) return;
    const ejecuciones = leerEjecucionesPruebas();
    const porId = new Map(ejecuciones.map(ejecucion => [ejecucion.id, ejecucion]));
    const opciones = ejecuciones.map(ejecucion => `<option value="${escapar(ejecucion.id)}">
        ${escapar(fechaEjecucionPruebas(ejecucion))} · ${escapar(ejecucion.id.slice(0, 8))}</option>`).join("");
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `<section class="panel boletin">
        <header class="boletin-cabecera">
            <div><p class="boletin-marca">Plataforma Académica</p><h2>Historial de pruebas</h2></div>
            <button type="button" class="btn btn-secundario" id="volverPruebas">Volver a pruebas</button>
        </header>
        <div class="pruebas-controles">
            <div class="campo"><label for="fechaHistorialPruebas">Fecha de ejecución</label>
                <input type="date" id="fechaHistorialPruebas"></div>
            <div class="campo"><label for="resultadoHistorialPruebas">Resultado</label>
                <select id="resultadoHistorialPruebas"><option value="">Todos</option>
                    <option value="exito">Todas cumplen</option><option value="error">Con fallos</option></select></div>
        </div>
        <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Ejecuciones guardadas">
            <table><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Ejecución</th>
                <th scope="col">Pruebas</th><th scope="col">Éxitos</th><th scope="col">Fallos</th>
                <th scope="col">Cumplimiento</th><th scope="col">Total (ms)</th><th scope="col">Promedio (ms)</th>
                <th scope="col">Acciones</th></tr></thead><tbody id="filasHistorialPruebas"></tbody></table>
        </div>
        <section id="detalleEjecucionPruebas" aria-label="Detalle de ejecución" hidden></section>
        <p class="nota">Las mediciones anteriores siguen disponibles al exportar los resultados de Pruebas Experimentales.
            El historial agrupa las ejecuciones registradas a partir de esta versión.</p>
    </section>
    <section class="panel">
        <h3 id="tituloComparacionPruebas" tabindex="-1">Comparar ejecuciones</h3>
        <div class="pruebas-controles">
            <div class="campo"><label for="basePruebas">A · Ejecución base</label>
                <select id="basePruebas"><option value="">Selecciona una ejecución</option>${opciones}</select></div>
            <div class="campo"><label for="comparadaPruebas">B · Ejecución comparada</label>
                <select id="comparadaPruebas"><option value="">Selecciona una ejecución</option>${opciones}</select></div>
        </div>
        <div id="comparacionPruebas"></div>
    </section>`;

    const obtener = id => document.getElementById(id);
    const fecha = obtener("fechaHistorialPruebas");
    const resultado = obtener("resultadoHistorialPruebas");
    const filas = obtener("filasHistorialPruebas");
    const detalle = obtener("detalleEjecucionPruebas");
    const base = obtener("basePruebas");
    const comparada = obtener("comparadaPruebas");
    const comparacion = obtener("comparacionPruebas");
    const actualizarTabla = () => {
        detalle.hidden = true;
        const visibles = ejecuciones.filter(ejecucion =>
            (!fecha.value || new Date(ejecucion.fecha).toLocaleDateString("sv-SE") === fecha.value) &&
            (!resultado.value || (resultado.value === "error" ? ejecucion.errores > 0 : ejecucion.errores === 0)));
        filas.innerHTML = visibles.map(ejecucion => `<tr>
            <td>${escapar(fechaEjecucionPruebas(ejecucion))}</td>
            <td title="${escapar(ejecucion.id)}">${escapar(ejecucion.id.slice(0, 8))}</td>
            <td>${ejecucion.cantidad}</td><td>${ejecucion.exitos}</td><td>${ejecucion.errores}</td>
            <td>${formatoNumero(ejecucion.cumplimiento)} %</td><td>${formatoNumero(ejecucion.tiempoTotal, 3)}</td>
            <td>${formatoNumero(ejecucion.tiempoPromedio, 3)}</td>
            <td><div class="pruebas-acciones">
                <button type="button" class="btn btn-secundario" data-ejecucion="${escapar(ejecucion.id)}">Ver detalle</button>
                <button type="button" class="btn btn-secundario" data-ejecucion="${escapar(ejecucion.id)}" data-descargar>Descargar Excel</button>
            </div></td></tr>`).join("") || '<tr><td colspan="9" class="vacio">No hay ejecuciones para estos filtros.</td></tr>';
    };
    const actualizarComparacion = () => {
        comparacion.innerHTML = compararEjecucionesPruebas(porId.get(base.value), porId.get(comparada.value));
    };
    fecha.addEventListener("change", actualizarTabla);
    resultado.addEventListener("change", actualizarTabla);
    base.addEventListener("change", actualizarComparacion);
    comparada.addEventListener("change", actualizarComparacion);
    filas.addEventListener("click", evento => {
        if (!puedeEditarEstudiantes(sesion?.rol)) return;
        const boton = evento.target.closest("button[data-ejecucion]");
        const ejecucion = porId.get(boton?.dataset.ejecucion);
        if (!ejecucion) return;
        if (boton.hasAttribute("data-descargar")) {
            descargarExcel(`ejecucion-plataforma-academica-${ejecucion.id}.xlsx`, [
                { nombre: "Resumen", filas: [
                    ["Ejecución", "Fecha y hora ISO", "Pruebas", "Éxitos", "Fallos", "Cumplimiento (%)", "Total (ms)", "Promedio (ms)"],
                    [ejecucion.id, ejecucion.fecha, ejecucion.cantidad, ejecucion.exitos, ejecucion.errores,
                        ejecucion.cumplimiento, ejecucion.tiempoTotal, ejecucion.tiempoPromedio]
                ] },
                { nombre: "Resultados", filas: filasExcelPruebas(ejecucion.resultados) }
            ]);
            return;
        }
        detalle.hidden = false;
        detalle.innerHTML = `<h3 tabindex="-1">Detalle · ${escapar(fechaEjecucionPruebas(ejecucion))}</h3>
            <p class="nota">Identificador ${escapar(ejecucion.id)}</p>
            <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Resultados de la ejecución"><table>
                <thead><tr><th scope="col">N.º</th><th scope="col">Operación</th><th scope="col">Duración (ms)</th>
                <th scope="col">Resultado</th><th scope="col">Observaciones</th></tr></thead>
                <tbody>${filasResultadosPruebas(ejecucion.resultados)}</tbody>
            </table></div>`;
        detalle.querySelector("h3").focus();
    });
    obtener("volverPruebas").addEventListener("click", () => {
        mostrarPruebasExperimentales();
        obtener("verHistorialPruebas")?.focus();
    });
    actualizarTabla();
    if (ejecuciones.length >= 2) {
        base.value = ejecuciones[1].id;
        comparada.value = ejecuciones[0].id;
    }
    actualizarComparacion();
    obtener(irAComparacion ? "tituloComparacionPruebas" : "volverPruebas").focus();
}

function compararEjecucionesPruebas(base, comparada) {
    if (!base || !comparada || base.id === comparada.id) {
        return '<p class="nota">Selecciona dos ejecuciones distintas para compararlas.</p>';
    }
    const metricas = [
        ["Tiempo promedio", base.tiempoPromedio, comparada.tiempoPromedio, "ms", "ms", 3, 0],
        ["Cumplimiento", base.cumplimiento, comparada.cumplimiento, "%", "pp", 2, 100],
        ["Errores", base.errores, comparada.errores, "", "", 0, 0]
    ];
    const cambio = (valor, decimales, unidad) =>
        `${valor > 0 ? "+" : ""}${formatoNumero(valor, decimales)} ${unidad}`.trim();
    return `<div class="pruebas-graficos">${metricas.map(([titulo, a, b, unidad, unidadDelta, decimales, escala]) => {
        const diferencia = b - a;
        const maximo = Math.max(a, b, escala) || 1;
        const relativo = a === 0 ? "No calculable con base cero" : cambio(diferencia / a * 100, 2, "%");
        return `<figure>
            <figcaption>${titulo}</figcaption>
            ${[["A", a], ["B", b]].map(([etiqueta, valor]) =>
                `<div class="pruebas-barra"><span>${etiqueta} · ${formatoNumero(valor, decimales)} ${unidad}</span>
                    <div aria-hidden="true"><span style="width:${valor / maximo * 100}%"></span></div></div>`).join("")}
            <p class="nota">Diferencia B − A · ${cambio(diferencia, decimales, unidadDelta)}<br>
                Cambio relativo · ${relativo}</p>
        </figure>`;
    }).join("")}</div>
    <p class="nota">El cambio relativo divide la diferencia entre el valor de A. Un tiempo promedio y una cantidad
        de errores menores, o un cumplimiento mayor, indican una mejora en la comparación.</p>`;
}

// ACTUALIZAR TABLA DE ASISTENCIA

function actualizarTablaAsistencia() {
    const cuerpo = document.getElementById(
        "cuerpoAsistencias"
    );

    if (!cuerpo) return;

    const visibles = registrosVisibles(asistencias);
    if (!visibles.length) {
        cuerpo.innerHTML = `
            <tr>
                <td colspan="3" class="vacio">
                    ${mensajeConsultaVacia("No hay registros de asistencia.")}
                </td>
            </tr>
        `;

        return;
    }

    const ordenadas = [...visibles].sort(
        (a, b) => b.fecha.localeCompare(a.fecha)
    );

    cuerpo.innerHTML = ordenadas.map(
        asistencia => `
            <tr>
                <td>
                    ${escapar(asistencia.fecha)}
                </td>

                <td>
                    ${escapar(nombreEstudiante(asistencia.documento))}
                </td>

                <td>
                    <span class="estado ${
                        asistencia.estado === "Presente"
                            ? "estado-bien"
                            : "estado-mal"
                    }">
                        ${escapar(asistencia.estado)}
                    </span>
                </td>
            </tr>
        `
    ).join("");
}

// ======================================
// CALIFICACIONES
// ======================================

function mostrarCalificaciones() {
    const personal = sesion.rol === "estudiante";
    document.getElementById(
        "contenido"
    ).innerHTML = `
        <h2 class="seccion-titulo">
            ${personal ? "Mis calificaciones" : "Registro de calificaciones"}
        </h2>

        <p class="descripcion">
            ${personal ? "Consulta tus notas y tu promedio."
                : "Registra notas entre 1.0 y 5.0 y consulta los promedios."}
        </p>

        ${personal ? "" : `<section class="panel">

            <h3>Nueva calificación</h3>

            <form id="formCalificaciones" class="form-grid" novalidate>
                ${campoCurso("cursoCalificacion")}
                <div class="campo">
                    <label for="calificacionEstudiante">Estudiante</label>
                    <select id="calificacionEstudiante" required disabled></select>
                </div>
                <p id="mensajeCursoCalificacion" class="nota formulario-ancho" role="status"></p>
                <div class="campo">
                    <label for="asignatura">Asignatura</label>
                    <select id="asignatura" required disabled>
                        <option value="">Selecciona una asignatura</option>
                        ${opcionesAsignaturas(asignaturasRegistrables())}
                    </select>
                </div>
                <div class="campo">
                    <label for="nota">Nota (1.0 a 5.0)</label>
                    <select id="nota" required disabled>
                        <option value="">Selecciona una nota</option>
                        ${NOTAS.map(nota => `<option value="${nota}">${nota}</option>`).join("")}
                    </select>
                </div>
                <div class="campo">
                    <label for="fechaCalificacion">Fecha de la nota</label>
                    <input type="date" id="fechaCalificacion" value="${fechaHoy()}" required>
                </div>
                <div class="campo formulario-ancho">
                    <label for="descripcionCalificacion">Motivo de la nota</label>
                    <textarea id="descripcionCalificacion" rows="3" maxlength="1000"></textarea>
                </div>
                <div class="acciones-form">
                    <button class="btn btn-primario" type="submit" ${!estudiantes.length ? "disabled" : ""}>
                        Guardar calificación
                    </button>
                </div>
            </form>

        </section>`}

        <section class="panel">

            <h3>${personal ? "Calificaciones registradas" : "Calificaciones por curso"}</h3>
            <div class="filtros-calificaciones">
                ${personal ? "" : campoConsultaCurso()}
                <div class="campo">
                    <label for="asignaturaConsulta">Asignatura</label>
                    <select id="asignaturaConsulta" disabled>
                        <option value="">Todas las asignaturas</option>
                    </select>
                </div>
                <div class="campo">
                    <label for="fechaConsultaCalificacion">Fecha</label>
                    <select id="fechaConsultaCalificacion" disabled>
                        <option value="">Todas las fechas</option>
                    </select>
                </div>
            </div>

            <div class="tabla-contenedor">

                <table>
                    <thead>
                        <tr>
                            <th scope="col">Estudiante</th>
                            <th scope="col">Asignatura</th>
                            <th scope="col">Nota</th>
                            <th scope="col">Fecha</th>
                            <th scope="col">Motivo de la nota</th>
                        </tr>
                    </thead>

                    <tbody id="cuerpoCalificaciones">
                    </tbody>
                </table>

            </div>

        </section>

        <section class="panel">

            <h3 id="tituloPromedios">${personal ? "Mi promedio" : "Promedios por estudiante"}</h3>

            <div class="tabla-contenedor">

                <table>
                    <thead>
                        <tr>
                            <th scope="col">Estudiante</th>
                            <th scope="col">Promedio</th>
                        </tr>
                    </thead>

                    <tbody id="cuerpoPromedios">
                    </tbody>
                </table>

            </div>

        </section>
    `;

    if (!personal) {
        configurarFormularioCalificaciones();
        document.getElementById("cuerpoCalificaciones").addEventListener("submit", guardarDescripcionCalificacion);
    }
    configurarConsultaCurso(actualizarConsultaCalificaciones);
    document.getElementById("asignaturaConsulta").addEventListener("change", mostrarResultadosCalificaciones);
    document.getElementById("fechaConsultaCalificacion").addEventListener("change", mostrarResultadosCalificaciones);
}

function nombresAsignaturas(registros) {
    return registros.map(registro => registro.asignatura)
        .filter(asignatura => typeof asignatura === "string" && asignatura.trim());
}

function asignaturasRegistrables() {
    return [...new Set([...ASIGNATURAS, ...nombresAsignaturas(calificaciones)])];
}

function opcionesAsignaturas(asignaturas) {
    return [...new Set(asignaturas)].sort((a, b) => a.localeCompare(b, "es"))
        .map(asignatura => `<option value="${escapar(asignatura)}">${escapar(asignatura)}</option>`).join("");
}

function actualizarConsultaCalificaciones() {
    const selector = document.getElementById("asignaturaConsulta");
    const seleccionada = selector.value;
    const visibles = registrosVisibles(calificaciones);
    const asignaturas = nombresAsignaturas(visibles);
    selector.innerHTML = '<option value="">Todas las asignaturas</option>' + opcionesAsignaturas(asignaturas);
    selector.value = asignaturas.includes(seleccionada) ? seleccionada : "";
    selector.disabled = !asignaturas.length;

    const selectorFecha = document.getElementById("fechaConsultaCalificacion");
    const fechaSeleccionada = selectorFecha.value;
    const fechas = [...new Set(visibles.map(calificacion => calificacion.fecha).filter(Boolean))].sort().reverse();
    if (visibles.some(calificacion => !calificacion.fecha)) fechas.push("sin-fecha");
    selectorFecha.innerHTML = '<option value="">Todas las fechas</option>' + fechas.map(fecha =>
        `<option value="${escapar(fecha)}">${fecha === "sin-fecha" ? "Sin fecha" : escapar(fecha)}</option>`
    ).join("");
    selectorFecha.value = fechas.includes(fechaSeleccionada) ? fechaSeleccionada : "";
    selectorFecha.disabled = !fechas.length;
    mostrarResultadosCalificaciones();
}

function coincideFechaCalificacion(calificacion, fecha) {
    return !fecha || (calificacion.fecha || "sin-fecha") === fecha;
}

function mostrarResultadosCalificaciones() {
    const asignatura = document.getElementById("asignaturaConsulta").value;
    const fecha = document.getElementById("fechaConsultaCalificacion").value;
    const titulo = sesion.rol === "estudiante" ? "Mi promedio" : "Promedios por estudiante";
    document.getElementById("tituloPromedios").textContent =
        [titulo, asignatura, fecha === "sin-fecha" ? "Sin fecha" : fecha].filter(Boolean).join(" · ");
    actualizarTablaCalificaciones(asignatura, fecha);
    calcularPromedios(asignatura, fecha);
}

function configurarFormularioCalificaciones() {
    const formulario = document.getElementById("formCalificaciones");
    const curso = document.getElementById("cursoCalificacion");
    const estudiante = document.getElementById("calificacionEstudiante");
    const asignatura = document.getElementById("asignatura");
    const nota = document.getElementById("nota");
    const fecha = document.getElementById("fechaCalificacion");
    const descripcion = document.getElementById("descripcionCalificacion");
    const mensaje = document.getElementById("mensajeCursoCalificacion");
    const guardar = formulario.querySelector('button[type="submit"]');

    function actualizarCampos() {
        asignatura.disabled = !estudiante.value;
        nota.disabled = asignatura.disabled || !asignatura.value;
        if (nota.disabled) nota.value = "";
    }

    curso.addEventListener("change", () => {
        filtrarSelectorEstudiantes(curso.value, estudiante, mensaje);
        actualizarCampos();
    });
    estudiante.addEventListener("change", actualizarCampos);
    asignatura.addEventListener("change", actualizarCampos);
    filtrarSelectorEstudiantes("", estudiante, mensaje);

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();
        if (!puedeRegistrarActividad(sesion?.rol)) return;

        const matriculados = estudiantesDelCurso(curso.value);
        if (!matriculados.some(registro => registro.documento === estudiante.value)) {
            avisar("Selecciona un curso y un estudiante matriculado en él.", true);
            return;
        }

        const materia = asignatura.value;
        if (!asignaturasRegistrables().includes(materia)) {
            avisar("Selecciona una asignatura de la lista.", true);
            return;
        }

        if (!NOTAS.includes(nota.value)) {
            avisar("Selecciona una nota entre 1.0 y 5.0 de la lista.", true);
            return;
        }

        if (!fecha.value || !fecha.validity.valid) {
            avisar("Selecciona una fecha válida para la nota.", true);
            return;
        }

        if (descripcion.value.trim().length > 1000) {
            avisar("El motivo puede tener hasta 1000 caracteres.", true);
            return;
        }

        calificaciones.push({
            documento: estudiante.value, asignatura: materia, nota: Number(nota.value), fecha: fecha.value,
            descripcion: descripcion.value.trim()
        });
        if (!guardarCalificaciones()) {
            calificaciones.pop();
            return;
        }

        avisar("Calificación guardada correctamente.");
        mostrarGuardado(guardar);
        seleccionarCursoConsulta(curso.value);
        actualizarConsultaCalificaciones();
        asignatura.value = "";
        descripcion.value = "";
        actualizarCampos();
        asignatura.focus();
    });
}

function guardarDescripcionCalificacion(evento) {
    evento.preventDefault();
    if (!puedeRegistrarActividad(sesion?.rol)) return;

    const formulario = evento.target;
    const calificacion = calificaciones[Number(formulario.dataset.calificacion)];
    if (!calificacion || !registrosVisibles(calificaciones).includes(calificacion)) return;

    const campo = formulario.elements.descripcion;
    const descripcion = campo.value.trim();
    if (descripcion.length > 1000) {
        avisar("El motivo puede tener hasta 1000 caracteres.", true);
        return;
    }

    const datos = calificaciones.map(registro => registro === calificacion ? { ...registro, descripcion } : registro);
    if (!guardarDatos(CLAVES.calificaciones, datos)) return;
    calificaciones = datos;
    campo.value = descripcion;
    avisar("Motivo de la nota guardado.");
}

// TABLA DE CALIFICACIONES

function actualizarTablaCalificaciones(asignatura, fecha) {
    const cuerpo = document.getElementById(
        "cuerpoCalificaciones"
    );

    if (!cuerpo) return;

    const visibles = registrosVisibles(calificaciones)
        .filter(calificacion => (!asignatura || calificacion.asignatura === asignatura) &&
            coincideFechaCalificacion(calificacion, fecha));
    if (!visibles.length) {
        cuerpo.innerHTML = `
            <tr>
                <td colspan="5" class="vacio">
                    ${mensajeConsultaVacia("No hay calificaciones registradas.")}
                </td>
            </tr>
        `;

        return;
    }

    const editable = puedeRegistrarActividad(sesion?.rol);
    cuerpo.innerHTML = visibles.map(
        calificacion => `
            <tr>
                <td>
                    ${escapar(nombreEstudiante(calificacion.documento))}
                </td>

                <td>
                    ${escapar(calificacion.asignatura)}
                </td>

                <td>
                    ${formatoNota(calificacion.nota)}
                </td>
                <td>${escapar(calificacion.fecha || "Sin fecha")}</td>
                <td>${editable ? `<form class="campo motivo-calificacion" data-calificacion="${calificaciones.indexOf(calificacion)}">
                    <textarea name="descripcion" rows="2" maxlength="1000"
                        aria-label="Motivo de la nota de ${escapar(calificacion.asignatura)} de ${escapar(nombreEstudiante(calificacion.documento))}">${escapar(calificacion.descripcion || "")}</textarea>
                    <button class="btn btn-secundario" type="submit">Guardar motivo</button>
                </form>` : escapar(calificacion.descripcion || "Sin motivo registrado")}</td>
            </tr>
        `
    ).join("");
}

// PROMEDIOS POR ESTUDIANTE

function calcularPromedios(asignatura, fecha) {
    const cuerpo = document.getElementById(
        "cuerpoPromedios"
    );

    if (!cuerpo) return;

    const visibles = registrosVisibles(estudiantes);
    if (!visibles.length) {
        cuerpo.innerHTML = `
            <tr>
                <td colspan="2" class="vacio">
                    ${mensajeConsultaVacia("No hay estudiantes registrados.")}
                </td>
            </tr>
        `;

        return;
    }

    cuerpo.innerHTML = visibles.map(
        estudiante => `
            <tr>
                <td>
                    ${escapar(nombreEstudiante(estudiante.documento))}
                </td>

                <td>
                    ${formatoNota(promedio(estudiante.documento, asignatura, fecha))}
                </td>
            </tr>
        `
    ).join("");
}

// ======================================
//  REPORTES
// ======================================

function mostrarBoletines(desdeReportes = false) {
    const personal = sesion.rol === "estudiante";
    document.getElementById("contenido").innerHTML = `
        ${desdeReportes ? `<button class="btn btn-secundario volver-reportes no-imprimir" type="button"
            id="volverReportes">Volver a reportes</button>` : ""}
        ${personal ? "" : `<section class="panel no-imprimir" aria-label="Consultar boletín">
            <div class="form-grid">
                ${campoCurso("cursoConsulta")}
                <div class="campo">
                    <label for="estudianteBoletin">Estudiante</label>
                    <select id="estudianteBoletin" disabled></select>
                </div>
                <p id="mensajeBoletin" class="nota formulario-ancho" role="status"></p>
            </div>
        </section>`}
        <section id="resultadoBoletin" class="panel boletin" aria-label="Boletín académico"></section>
    `;

    if (desdeReportes) {
        const volver = document.getElementById("volverReportes");
        volver.addEventListener("click", () => {
            mostrarReportes();
            document.getElementById("abrirBoletinReporte").focus();
        });
        volver.focus();
    }

    if (personal) {
        mostrarBoletinIndividual(documentoCuentaEstudiante());
        return;
    }

    const selector = document.getElementById("estudianteBoletin");
    const mensaje = document.getElementById("mensajeBoletin");
    configurarConsultaCurso(() => {
        filtrarSelectorEstudiantes(cursoConsulta, selector, mensaje);
        mostrarBoletinIndividual("");
    });
    selector.addEventListener("change", () => mostrarBoletinIndividual(selector.value));
}

function periodoCalificacion({ periodo, fecha }) {
    if ([1, 2, 3, 4, "1", "2", "3", "4"].includes(periodo)) return Number(periodo);

    const mes = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.exec(fecha)?.[1];
    return mes ? Math.ceil(Number(mes) / 3) : null;
}

function mostrarBoletinIndividual(documento) {
    if (!puedeConsultarDocumento(sesion, documento)) return;

    const resultado = document.getElementById("resultadoBoletin");
    const estudiante = obtenerEstudiante(documento);
    if (!estudiante || (sesion.rol !== "estudiante" && estudiante.grado !== cursoConsulta)) {
        resultado.textContent = sesion.rol === "estudiante"
            ? "Tu cuenta aún no tiene un registro académico asociado."
            : "Selecciona un curso y un estudiante para consultar su boletín.";
        return;
    }

    const registros = registrosVisibles(calificaciones).filter(registro => registro.documento === documento);
    const periodos = [1, 2, 3, 4];
    const { filas, general } = calcularBoletin(registros, periodos);
    const asistencia = porcentajeAsistencia(documento);
    const estado = general === null ? ["estado-aviso", "Sin calificaciones"]
        : general < NOTA_MINIMA ? ["estado-mal", "No aprobado"] : ["estado-bien", "Aprobado"];
    const celdaNota = nota => nota === null
        ? '<span class="boletin-sin-nota" aria-label="Sin calificación">—</span>'
        : formatoNota(nota);

    resultado.innerHTML = `
        <header class="boletin-cabecera">
            <div>
                <p class="boletin-marca">Plataforma Académica</p>
                <h2 id="tituloBoletin">Boletín académico</h2>
                <p class="boletin-estudiante">${escapar(nombreEstudiante(documento))}</p>
                <p class="boletin-identificacion">Curso ${escapar(estudiante.grado)} · Documento ${escapar(documento)}</p>
            </div>
            <button class="btn btn-secundario no-imprimir" type="button" id="imprimirBoletin">
                Imprimir / Guardar PDF
            </button>
        </header>
        <div class="resumen-reporte boletin-resumen">
            <div class="resumen-item"><span>Promedio general</span><strong>${formatoNota(general)}</strong></div>
            <div class="resumen-item"><span>Asistencia</span><strong>${asistencia === null
                ? "Sin datos" : formatoNumero(asistencia, 1) + "%"}</strong></div>
            <div class="resumen-item">
                <span>Estado académico</span>
                <div><span class="estado ${estado[0]}">${estado[1]}</span></div>
            </div>
        </div>
        <div class="tabla-contenedor boletin-tabla" tabindex="0" role="region" aria-label="Notas por asignatura y periodo">
            <table aria-describedby="criteriosBoletin">
                <thead><tr>
                    <th scope="col">Asignatura</th>
                    ${periodos.map(periodo => `<th scope="col">Periodo ${periodo}</th>`).join("")}
                    <th scope="col">Promedio final</th>
                </tr></thead>
                <tbody>${filas.map(fila => `<tr>
                    <th scope="row">${escapar(fila.asignatura)}</th>
                    ${fila.periodos.map(nota => `<td>${celdaNota(nota)}</td>`).join("")}
                    <td class="boletin-final">${celdaNota(fila.final)}</td>
                </tr>`).join("")}</tbody>
            </table>
        </div>
        <section class="boletin-motivos" aria-labelledby="tituloMotivos">
            <h3 id="tituloMotivos">Detalle y motivo de las notas por asignatura</h3>
            ${filas.some(fila => fila.notas.length) ? filas.filter(fila => fila.notas.length).map(fila => `
                <h4>${escapar(fila.asignatura)}</h4>
                <ul>${fila.notas.map(registro => {
                    const periodo = periodoCalificacion(registro);
                    return `<li>
                        <strong>${formatoNota(registro.nota)} · ${periodo ? `Periodo ${periodo}` : "Sin periodo"}
                            ${registro.fecha ? " · " + escapar(registro.fecha) : ""}
                            ${registro.ficticia === true ? " · Nota ficticia" : ""}</strong>
                        <p>${escapar(String(registro.descripcion ?? "").trim() || "Sin motivo registrado.")}</p>
                    </li>`;
                }).join("")}</ul>
            `).join("") : '<p class="nota">Sin calificaciones registradas.</p>'}
        </section>
        <p id="criteriosBoletin" class="nota boletin-criterios">
            El guion indica que no hay calificaciones en la casilla. Los periodos sin asignación explícita se
            determinan por trimestre calendario. El promedio final incluye todas las notas de la asignatura,
            incluso las notas sin fecha. El promedio general pondera por igual las asignaturas con notas.
            Nota mínima aprobatoria ${formatoNota(NOTA_MINIMA)}. Estado calculado con el promedio general disponible.
        </p>
    `;
    document.getElementById("imprimirBoletin").addEventListener("click", () => window.print());
}

function tieneNotaNumerica({ nota }) {
    return (typeof nota === "number" || (typeof nota === "string" && nota.trim())) &&
        Number.isFinite(Number(nota));
}

function calcularBoletin(registros, periodos = [1, 2, 3, 4]) {
    const asignaturas = [...new Set([...ASIGNATURAS, ...nombresAsignaturas(registros)])]
        .sort((a, b) => a.localeCompare(b, "es"));
    const notas = registros.filter(tieneNotaNumerica);
    const filas = asignaturas.map(asignatura => {
        const notasAsignatura = notas.filter(registro => registro.asignatura === asignatura);
        return {
            asignatura,
            notas: notasAsignatura,
            periodos: periodos.map(periodo => media(notasAsignatura
                .filter(registro => periodoCalificacion(registro) === periodo)
                .map(registro => Number(registro.nota)))),
            final: media(notasAsignatura.map(registro => Number(registro.nota)))
        };
    });
    const general = media(filas.map(fila => fila.final).filter(nota => nota !== null));
    return { filas, general };
}

function mostrarReportes() {
    const personal = sesion.rol === "estudiante";
    document.getElementById(
        "contenido"
    ).innerHTML = `
        <h2 class="seccion-titulo">
            Reportes académicos
        </h2>

        <p class="descripcion">
            ${personal ? "Consulta tus indicadores y alertas académicas."
                : "Consulta indicadores individuales y detecta posibles alertas académicas."}
        </p>
        <button class="btn btn-secundario volver-reportes no-imprimir" type="button" id="abrirBoletinReporte">
            Consultar boletín detallado
        </button>

        ${personal ? "" : `<section class="panel no-imprimir">

            <h3>Seleccionar estudiante</h3>

            <form id="formReporte" class="form-grid" novalidate>
                ${campoCurso("cursoReporte")}
                <div class="campo">
                    <label for="reporteEstudiante">Estudiante</label>
                    <select id="reporteEstudiante" required disabled></select>
                </div>
                <p id="mensajeCursoReporte" class="nota formulario-ancho" role="status"></p>
                <div class="acciones-form">
                    <button type="submit" class="btn btn-primario" ${!estudiantes.length ? "disabled" : ""}>
                        Generar reporte
                    </button>
                </div>
            </form>

        </section>`}

        <section class="panel" id="resultadoReporte">

            <h3>Reporte individual</h3>

            ${personal ? "" : `<p class="descripcion">
                Selecciona un curso y un estudiante, y presiona
                «Generar reporte».
            </p>`}

        </section>
    `;

    document.getElementById("abrirBoletinReporte").addEventListener("click", () => mostrarBoletines(true));

    if (personal) {
        mostrarReporteIndividual(documentoCuentaEstudiante());
    } else {
        const curso = document.getElementById("cursoReporte");
        const estudiante = document.getElementById("reporteEstudiante");
        const mensaje = document.getElementById("mensajeCursoReporte");
        curso.value = cursoConsulta;
        filtrarSelectorEstudiantes(curso.value, estudiante, mensaje);
        const limpiarReporte = () => {
            document.getElementById("resultadoReporte").textContent = "Selecciona un estudiante para generar su reporte.";
        };
        curso.addEventListener("change", () => {
            seleccionarCursoConsulta(curso.value);
            filtrarSelectorEstudiantes(curso.value, estudiante, mensaje);
            limpiarReporte();
        });
        estudiante.addEventListener("change", limpiarReporte);
        document.getElementById("formReporte").addEventListener("submit", evento => {
            evento.preventDefault();
            if (!estudiantesDelCurso(curso.value).some(registro => registro.documento === estudiante.value)) {
                avisar("Selecciona un curso y un estudiante matriculado en él.", true);
                return;
            }
            mostrarReporteIndividual(estudiante.value);
        });
    }
}

// GENERAR REPORTE ACADÉMICO

function mostrarReporteIndividual(documento) {
    if (!puedeConsultarDocumento(sesion, documento)) return;

    const estudiante = obtenerEstudiante(documento);

    if (!estudiante) {
        if (sesion.rol === "estudiante") {
            document.getElementById("resultadoReporte").innerHTML =
                '<p class="descripcion">Tu cuenta de demostración aún no tiene un registro académico asociado.</p>';
            return;
        }
        avisar(
            "Selecciona un estudiante válido.",
            true
        );

        return;
    }

    const prom = promedio(documento);

    const asistencia = porcentajeAsistencia(
        documento
    );

    const notas = calificaciones.filter(
        calificacion =>
            calificacion.documento === documento
    );

    const registros = asistencias.filter(
        registro =>
            registro.documento === documento
    );

    // Criterios de riesgo académico

    const riesgo =
        (prom !== null && prom < NOTA_MINIMA) ||
        (asistencia !== null && asistencia < ASISTENCIA_MINIMA);

    const sinDatos =
        prom === null ||
        asistencia === null;

    let claseEstado;
    let textoEstado;

    if (riesgo) {
        claseEstado = "estado-mal";
        textoEstado = "Alerta académica";

    } else if (sinDatos) {
        claseEstado = "estado-aviso";
        textoEstado =
            "Datos insuficientes para evaluación completa";

    } else {
        claseEstado = "estado-bien";
        textoEstado =
            "Sin alertas según los registros";
    }

    document.getElementById(
        "resultadoReporte"
    ).innerHTML = `
        <div class="acciones-superiores">

            <h3>
                Plataforma Académica · Reporte de
                ${escapar(estudiante.nombre)}
                ${escapar(estudiante.apellido)}
            </h3>

            <button
                class="btn btn-secundario no-imprimir"
                type="button"
                id="imprimirReporte"
            >
                🖨 Imprimir reporte
            </button>

        </div>

        <p class="descripcion">
            Documento: ${escapar(documento)}
            · Grado: ${escapar(estudiante.grado)}
        </p>

        <div class="resumen-reporte">

            <div class="resumen-item">
                <span>Promedio de notas</span>

                <strong>
                    ${formatoNota(prom)}
                </strong>
            </div>

            <div class="resumen-item">
                <span>Porcentaje de asistencia</span>

                <strong>
                    ${asistencia === null
                        ? "Sin datos"
                        : formatoNumero(asistencia, 1) + "%"}
                </strong>
            </div>

            <div class="resumen-item">
                <span>Registros</span>

                <strong>
                    ${notas.length} notas ·
                    ${registros.length} asistencias
                </strong>
            </div>

        </div>

        <p>
            <span class="estado ${claseEstado}">
                ${textoEstado}
            </span>
        </p>

        <p class="nota">
            Criterios del prototipo:
            promedio inferior a ${formatoNota(NOTA_MINIMA)} o
            asistencia inferior al ${ASISTENCIA_MINIMA} %.

            Los indicadores sin registros
            no se consideran cero.

            Este reporte no sustituye
            la evaluación institucional.
        </p>
    `;

    document.getElementById(
        "imprimirReporte"
    ).addEventListener("click", () => {
        window.print();
    });
}


// Detectar cambios de conexión

window.addEventListener(
    "online",
    actualizarEstadoConexion
);

window.addEventListener(
    "offline",
    actualizarEstadoConexion
);

// Sincronizar cambios hechos en otra pestaña

window.addEventListener("storage", evento => {
    if (!Object.values(CLAVES).includes(evento.key)) return;

    estudiantes = leerDatos(CLAVES.estudiantes);
    asistencias = leerDatos(CLAVES.asistencias);
    calificaciones = leerDatos(CLAVES.calificaciones);
    vinculacionDemo = leerDatos(CLAVES.vinculacionDemo);
    pruebasAsistencia = leerDatos(CLAVES.pruebasAsistencia);

    if (sesion && !eliminando) {
        mostrarModulo(moduloActual);
        avisar("Datos actualizados desde otra pestaña.");
    }
});

// Iniciar la plataforma

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Configurar menú lateral

        document.querySelectorAll(
            ".menu-opcion"
        ).forEach(boton => {

            boton.addEventListener(
                "click",
                () => {
                    mostrarModulo(
                        boton.dataset.modulo
                    );

                    document.getElementById("contenido")
                        .focus({ preventScroll: true });
                }
            );

        });

        // Mostrar conexión

        actualizarEstadoConexion();

        configurarAcceso();
    }
);
