import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import * as Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Declaración de tipos para que TypeScript reconozca las propiedades del plugin
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Interfaces para la estructura de datos
export interface Escenario {
  'ID Caso': string;
  'Escenario de Prueba': string;
  Precondiciones: string;
  'Paso a Paso': string;
  'Resultado Esperado': string;
  evidencias: Evidencia[];
}

export interface Evidencia {
  tipo: 'img';
  nombre: string;
  data: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Matriz de Casos de Prueba';
  public escenarios: Escenario[] = [];
  public escenarioActivo: number = 0;

  ngOnInit(): void {
    // Datos de ejemplo para la demostración
    this.escenarios = [{
      'ID Caso': 'CP1',
      'Escenario de Prueba': 'Crear tabla con nombre válido.',
      'Precondiciones': 'El sistema de base de datos está accesible.',
      'Paso a Paso': 'Ejecutar la sentencia SQL para crear la tabla de saldos.',
      'Resultado Esperado': 'La tabla se crea exitosamente.',
      evidencias: []
    }];
    this.escenarioActivo = 0;
  }

  // --- Métodos de manejo de la UI (sin cambios) ---
  seleccionarEscenario(index: number): void { this.escenarioActivo = index; }
  agregarEscenario(): void {
    const nuevoEscenario: Escenario = { 'ID Caso': `CP${this.escenarios.length + 1}`, 'Escenario de Prueba': '', 'Precondiciones': '', 'Paso a Paso': '', 'Resultado Esperado': '', evidencias: [] };
    this.escenarios.push(nuevoEscenario);
    this.escenarioActivo = this.escenarios.length - 1;
  }
  eliminarEscenario(index: number): void {
    if (confirm('¿Estás seguro?')) {
      this.escenarios.splice(index, 1);
      if (this.escenarioActivo >= index && this.escenarioActivo > 0) this.escenarioActivo--;
      else if (this.escenarios.length === 0) this.escenarioActivo = 0;
    }
  }
  subirEvidencias(event: Event, escenarioIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const reader = new FileReader();
      reader.onload = (e: any) => this.escenarios[escenarioIndex].evidencias.push({ tipo: 'img', nombre: file.name, data: e.target.result });
      reader.readAsDataURL(file);
    }
    input.value = '';
  }
  async pegarEvidencia(escenarioIndex: number): Promise<void> { /* ... sin cambios ... */ }
  eliminarEvidencia(escenarioIndex: number, evidenciaIndex: number): void { this.escenarios[escenarioIndex].evidencias.splice(evidenciaIndex, 1); }
  limpiarEvidencias(escenarioIndex: number): void { if (confirm('¿Limpiar evidencias?')) this.escenarios[escenarioIndex].evidencias = []; }
  cargarCSV(event: Event): void { /* ... sin cambios ... */ }


  // --- FUNCIÓN MEJORADA PARA GENERAR EL PDF ---

  async generarReportePDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const indiceItems: { nombre: string, page: number }[] = [];

    // ======================================================
    // 1. Portada del Documento
    // ======================================================
    doc.setFontSize(26);
    doc.text('Reporte de Matriz de Casos de Prueba', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-CO')}`, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    doc.text('Área: QA / Testing', pageWidth / 2, pageHeight / 2, { align: 'center' });
    doc.text('Versión: 1.0', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });


    // ======================================================
    // 2. Página de Índice (se llenará al final)
    // ======================================================
    doc.addPage();
    const pageIndex = doc.getNumberOfPages();
    doc.setFontSize(20);
    doc.text('Índice', margin, margin + 20);


    // ======================================================
    // 3. Páginas de Contenido (Loop por cada escenario)
    // ======================================================
    for (const esc of this.escenarios) {
      doc.addPage();
      const currentPage = doc.getNumberOfPages();
      indiceItems.push({ nombre: esc['ID Caso'] || 'Escenario sin ID', page: currentPage });

      autoTable(doc, {
        head: [['ID Caso', 'Escenario de Prueba', 'Precondiciones', 'Paso a Paso', 'Resultado Esperado']],
        body: [[
          esc['ID Caso'],
          esc['Escenario de Prueba'],
          esc['Precondiciones'],
          esc['Paso a Paso'],
          esc['Resultado Esperado']
        ]],
        startY: margin,
        theme: 'grid',
        headStyles: {
          fillColor: '#e3eafc',
          textColor: '#1e293b',
          fontStyle: 'bold'
        },
        styles: {
          cellPadding: 8,
          fontSize: 10
        }
      });

      // Sección de Evidencias (si existen)
      if (esc.evidencias && esc.evidencias.length > 0) {
        let yPos = (doc as any).lastAutoTable.finalY + 30;

        // Título de la sección de evidencias
        if (yPos > pageHeight - 150) { // Salto de página si no hay espacio
          doc.addPage();
          yPos = margin;
        }
        doc.setFontSize(14);
        doc.setTextColor('#2563eb');
        doc.text('Evidencias:', margin, yPos);
        yPos += 20;

        // Dibujar evidencias en una grilla de 2 columnas
        const colWidth = (pageWidth - margin * 3) / 2;
        const imgMaxHeight = 150;
        const containerPadding = 10;
        const containerHeight = imgMaxHeight + (containerPadding * 2) + 20; // Espacio para imagen, padding y texto
        let col = 0;

        for (const ev of esc.evidencias) {
          const xPos = margin + (col * (colWidth + margin));
          
          if (yPos > pageHeight - (containerHeight + margin)) {
            doc.addPage();
            yPos = margin;
            col = 0; // Reiniciar columnas en la nueva página
          }
          
          // === DIBUJAR EL CONTENEDOR CON FONDO Y BORDE ===
          doc.setFillColor('#f5f5f5'); // Fondo gris muy claro
          doc.setDrawColor('#e0e0e0'); // Borde sutil
          doc.setLineWidth(1);
          doc.roundedRect(xPos, yPos, colWidth, containerHeight, 5, 5, 'FD'); // 'FD' = Fill and Draw (Rellenar y dibujar borde)

          // === DIBUJAR TEXTO E IMAGEN DENTRO DEL CONTENEDOR ===
          // Dibujar el nombre del archivo
          doc.setFontSize(9);
          doc.setTextColor('#333');
          doc.text(
            ev.nombre,
            xPos + containerPadding,
            yPos + containerPadding + 5,
            { maxWidth: colWidth - (containerPadding * 2) }
          );

          // Dibujar la imagen
          const imageY = yPos + containerPadding + 20;
          try {
             doc.addImage(
               ev.data, 
               'PNG', 
               xPos + containerPadding, 
               imageY, 
               colWidth - (containerPadding * 2), 
               imgMaxHeight
              );
          } catch(e) {
            console.error(`Error al añadir imagen: ${ev.nombre}`, e);
            doc.text('Error al cargar imagen', xPos + containerPadding, imageY);
          }

          // Mover a la siguiente posición en la grilla
          if (col === 1) { // Si es la segunda columna, bajar la posición Y para la siguiente fila
            yPos += containerHeight + 20; // 20 es el espacio entre filas
            col = 0;
          } else { // Si es la primera, pasar a la segunda columna
            col = 1;
          }
        }
      }
    }

    // ======================================================
    // 4. Página de Firmas
    // ======================================================
    doc.addPage();
    doc.setFontSize(20);
    doc.text('Firmas y Validaciones', margin, margin + 20);
    doc.setFontSize(12);
    doc.text('Responsable QA:', margin, margin + 80);
    doc.line(margin + 120, margin + 75, margin + 400, margin + 75);
    doc.text('Revisor:', margin, margin + 140);
    doc.line(margin + 70, margin + 135, margin + 400, margin + 135);
    doc.text('Aprobador:', margin, margin + 200);
    doc.line(margin + 85, margin + 195, margin + 400, margin + 195);


    // ======================================================
    // 5. Paginación y llenado del Índice
    // ======================================================
    const totalPages = doc.getNumberOfPages();
    
    // Llenar el índice en la página 2
    doc.setPage(pageIndex);
    let yPosIndex = margin + 50;
    for (const item of indiceItems) {
      if (yPosIndex > pageHeight - margin) {
        doc.addPage();
        yPosIndex = margin;
      }
      const dots = '.'.repeat(120);
      doc.text(`${item.nombre} ${dots} ${item.page}`, margin, yPosIndex, { maxWidth: pageWidth - margin * 2 });
      yPosIndex += 20;
    }

    // Añadir pie de página a todas las páginas
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor('#888');
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
    }
    
    // ======================================================
    // 6. Guardar el PDF
    // ======================================================
    doc.save('reporte_casos_prueba.pdf');
  }
} 