"use strict";

function descargarExcel(nombre, hojas) {
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(crearLibroExcel(hojas));
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

function crearLibroExcel(hojas) {
    const hojaXml = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const relaciones = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const paquete = "http://schemas.openxmlformats.org/package/2006";
    const tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml";
    const xml = contenido => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${contenido}`;
    const texto = valor => String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const definirRelacion = (id, clase, destino) =>
        `<Relationship Id="${id}" Type="${relaciones}/${clase}" Target="${destino}"/>`;
    const definirTipo = (ruta, clase) => `<Override PartName="/${ruta}" ContentType="${tipo}.${clase}+xml"/>`;
    const archivos = {
        "[Content_Types].xml": xml(`<Types xmlns="${paquete}/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            ${definirTipo("xl/workbook.xml", "sheet.main")}${definirTipo("xl/styles.xml", "styles")}
            ${hojas.map((_, i) => definirTipo(`xl/worksheets/sheet${i + 1}.xml`, "worksheet")).join("")}</Types>`),
        "_rels/.rels": xml(`<Relationships xmlns="${paquete}/relationships">
            ${definirRelacion("rId1", "officeDocument", "xl/workbook.xml")}</Relationships>`),
        "xl/workbook.xml": xml(`<workbook xmlns="${hojaXml}" xmlns:r="${relaciones}">
            <bookViews><workbookView activeTab="0"/></bookViews><sheets>
            ${hojas.map(({ nombre }, i) => `<sheet name="${texto(nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}
            </sheets></workbook>`),
        "xl/_rels/workbook.xml.rels": xml(`<Relationships xmlns="${paquete}/relationships">
            ${hojas.map((_, i) => definirRelacion(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)).join("")}
            ${definirRelacion("estilos", "styles", "styles.xml")}</Relationships>`),
        "xl/styles.xml": xml(`<styleSheet xmlns="${hojaXml}">
            <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>
            <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
            <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FF142641"/><bgColor indexed="64"/></patternFill></fill></fills>
            <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
            <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
            <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
            <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
            <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
            </styleSheet>`)
    };

    hojas.forEach(({ filas }, indice) => {
        const anchos = [];
        const registros = filas.map((fila, numero) => {
            const celdas = fila.map((valor, columna) => {
                anchos[columna] = Math.max(anchos[columna] ?? 12, Math.min(62, String(valor ?? "").length + 3));
                if (valor === "" || valor == null) return "";
                const referencia = `${letraColumnaExcel(columna)}${numero + 1}`;
                const estilo = numero === 0 ? ' s="1"' : "";
                return Number.isFinite(valor) ? `<c r="${referencia}"${estilo}><v>${valor}</v></c>`
                    : `<c r="${referencia}"${estilo} t="inlineStr"><is><t xml:space="preserve">${texto(valor)}</t></is></c>`;
            }).join("");
            return `<row r="${numero + 1}">${celdas}</row>`;
        }).join("");
        archivos[`xl/worksheets/sheet${indice + 1}.xml`] = xml(`<worksheet xmlns="${hojaXml}">
            <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft"
                state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
            <cols>${anchos.map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join("")}</cols>
            <sheetData>${registros}</sheetData></worksheet>`);
    });
    return empaquetarLibroExcel(archivos);
}

function letraColumnaExcel(indice) {
    let letras = "";
    for (let numero = indice + 1; numero > 0; numero = Math.floor((numero - 1) / 26)) {
        letras = String.fromCharCode(65 + (numero - 1) % 26) + letras;
    }
    return letras;
}

function empaquetarLibroExcel(archivos) {
    const codificar = new TextEncoder();
    const partes = [];
    const directorio = [];
    let desplazamiento = 0;
    let tamanoDirectorio = 0;
    const tablaCrc = Uint32Array.from({ length: 256 }, (_, valor) => {
        for (let bit = 0; bit < 8; bit++) {
            valor = (valor >>> 1) ^ (valor & 1 ? 0xedb88320 : 0);
        }
        return valor;
    });

    // XLSX es un paquete ZIP. Los XML se guardan con el método ZIP sin compresión.
    for (const [ruta, xml] of Object.entries(archivos)) {
        const nombre = codificar.encode(ruta);
        const datos = codificar.encode(xml);
        let crc = 0xffffffff;
        for (const byte of datos) crc = (crc >>> 8) ^ tablaCrc[(crc ^ byte) & 255];
        crc ^= 0xffffffff;

        const cabecera = new DataView(new ArrayBuffer(30));
        cabecera.setUint32(0, 0x04034b50, true);
        cabecera.setUint16(4, 20, true);
        cabecera.setUint16(12, 33, true);
        cabecera.setUint32(14, crc, true);
        cabecera.setUint32(18, datos.length, true);
        cabecera.setUint32(22, datos.length, true);
        cabecera.setUint16(26, nombre.length, true);
        partes.push(cabecera.buffer, nombre, datos);

        const entrada = new DataView(new ArrayBuffer(46));
        entrada.setUint32(0, 0x02014b50, true);
        entrada.setUint16(4, 20, true);
        entrada.setUint16(6, 20, true);
        entrada.setUint16(14, 33, true);
        entrada.setUint32(16, crc, true);
        entrada.setUint32(20, datos.length, true);
        entrada.setUint32(24, datos.length, true);
        entrada.setUint16(28, nombre.length, true);
        entrada.setUint32(42, desplazamiento, true);
        directorio.push(entrada.buffer, nombre);
        tamanoDirectorio += entrada.byteLength + nombre.length;
        desplazamiento += cabecera.byteLength + nombre.length + datos.length;
    }

    const cierre = new DataView(new ArrayBuffer(22));
    cierre.setUint32(0, 0x06054b50, true);
    cierre.setUint16(8, directorio.length / 2, true);
    cierre.setUint16(10, directorio.length / 2, true);
    cierre.setUint32(12, tamanoDirectorio, true);
    cierre.setUint32(16, desplazamiento, true);
    return new Blob([...partes, ...directorio, cierre.buffer],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
