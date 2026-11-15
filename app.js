let examenActual = [];
let respuestasUsuario = {};
let indiceActual = 0;
let timerInterval = null;
let segundosTranscurridos = 0;
let sustentoAbierto = false;

const LETRAS = ["A", "B", "C", "D", "E"];

document.addEventListener("DOMContentLoaded", () => {
  if (typeof BANCO_PREGUNTAS_OECE === "undefined") {
    alert("Error: No se cargó el archivo preguntas.js.");
    return;
  }
  document.getElementById("total-bank-count").textContent = BANCO_PREGUNTAS_OECE.length;
  document.getElementById("count-prep").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Actuaciones Preparatorias").length;
  document.getElementById("count-sel").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Selección").length;
  document.getElementById("count-ejec").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Ejecución Contractual").length;
});

function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function iniciarExamen(cantidad) {
  const faseFiltro = document.getElementById("filtro-fase").value;
  let pool = BANCO_PREGUNTAS_OECE;

  if (faseFiltro !== "TODAS") {
    pool = pool.filter(p => p.fase === faseFiltro);
    examenActual = barajar(pool).slice(0, Math.min(cantidad, pool.length));
  } else if (cantidad === 72) {
    // Distribución oficial OECE aproximada (25 Prep, 22 Sel, 25 Ejec)
    const p1 = barajar(pool.filter(p => p.fase === "Actuaciones Preparatorias")).slice(0, 25);
    const p2 = barajar(pool.filter(p => p.fase === "Selección")).slice(0, 22);
    const p3 = barajar(pool.filter(p => p.fase === "Ejecución Contractual")).slice(0, 25);
    examenActual = barajar([...p1, ...p2, ...p3]);
  } else {
    examenActual = barajar(pool).slice(0, cantidad);
  }

  // Barajar opciones de cada pregunta manteniendo rastreada la correcta
  examenActual = examenActual.map(item => {
    const pares = item.opciones.map((texto, idx) => ({
      texto,
      esCorrecta: idx === item.correcta
    }));
    const mezcladas = barajar(pares);
    return {
      ...item,
      opcionesMezcladas: mezcladas.map(m => m.texto),
      correctaMezclada: mezcladas.findIndex(m => m.esCorrecta)
    };
  });

  respuestasUsuario = {};
  indiceActual = 0;
  segundosTranscurridos = 0;

  document.getElementById("hud-mode").textContent = cantidad === 20 ? "Examen Rápido (20)" : "Simulacro Oficial (72)";
  document.getElementById("screen-home").classList.add("hidden");
  document.getElementById("screen-results").classList.add("hidden");
  document.getElementById("screen-quiz").classList.remove("hidden");

  iniciarTimer();
  renderizarDots();
  mostrarPregunta();
}

function iniciarTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    segundosTranscurridos++;
    const min = String(Math.floor(segundosTranscurridos / 60)).padStart(2, "0");
    const seg = String(segundosTranscurridos % 60).padStart(2, "0");
    document.getElementById("hud-timer").textContent = `${min}:${seg}`;
  }, 1000);
}

function mostrarPregunta() {
  const q = examenActual[indiceActual];
  const total = examenActual.length;
  const respElegida = respuestasUsuario[indiceActual];
  sustentoAbierto = false;

  document.getElementById("hud-progress").textContent = `Pregunta ${indiceActual + 1} de ${total}`;
  document.getElementById("progress-fill").style.width = `${((indiceActual + 1) / total) * 100}%`;
  document.getElementById("question-text").textContent = `${indiceActual + 1}. ${q.pregunta}`;

  const contOpciones = document.getElementById("options-container");
  contOpciones.innerHTML = "";

  q.opcionesMezcladas.forEach((optTexto, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span class="opt-letter">${LETRAS[idx]}</span><span>${optTexto}</span>`;

    if (respElegida !== undefined) {
      btn.disabled = true;
      if (idx === q.correctaMezclada) {
        btn.classList.add("correct");
      } else if (idx === respElegida) {
        btn.classList.add("wrong");
      }
    } else {
      btn.onclick = () => seleccionarOpcion(idx);
    }
    contOpciones.appendChild(btn);
  });

  // Panel de feedback bajo demanda
  const fbControls = document.getElementById("feedback-controls");
  const sustentoPanel = document.getElementById("sustento-panel");
  sustentoPanel.classList.add("hidden");
  document.getElementById("btn-toggle-sustento").textContent = "📖 Ver sustento legal / repaso";

  if (respElegida !== undefined) {
    fbControls.classList.remove("hidden");
    const banner = document.getElementById("result-banner");
    if (respElegida === q.correctaMezclada) {
      banner.textContent = "✔ ¡Respuesta correcta!";
      banner.className = "result-banner ok";
    } else {
      banner.textContent = `✘ Incorrecto. La respuesta válida es la ${LETRAS[q.correctaMezclada]}.`;
      banner.className = "result-banner err";
    }

    // Cargar datos del sustento (ocultos hasta que el usuario dé clic)
    document.getElementById("sustento-fase").textContent = q.fase;
    document.getElementById("sustento-tema").textContent = q.tema;
    document.getElementById("sustento-art-ref").textContent = q.articulo_ref || "Ley N° 32069 y Reglamento";
    document.getElementById("sustento-texto").textContent = q.sustento_legal || "Sustento normativo vinculado en la Ley N° 32069 y su Reglamento.";
  } else {
    fbControls.classList.add("hidden");
  }

  document.getElementById("btn-prev").disabled = indiceActual === 0;
  const esUltima = indiceActual === total - 1;
  document.getElementById("btn-next").classList.toggle("hidden", esUltima);
  document.getElementById("btn-finish").classList.toggle("hidden", !esUltima);

  actualizarDots();
}

function seleccionarOpcion(idx) {
  if (respuestasUsuario[indiceActual] !== undefined) return;
  respuestasUsuario[indiceActual] = idx;

  // Actualizar puntaje
  let aciertos = 0;
  examenActual.forEach((q, i) => {
    if (respuestasUsuario[i] === q.correctaMezclada) aciertos++;
  });
  document.getElementById("hud-score").textContent = aciertos;

  mostrarPregunta();
}

function toggleSustento() {
  sustentoAbierto = !sustentoAbierto;
  const panel = document.getElementById("sustento-panel");
  const btn = document.getElementById("btn-toggle-sustento");
  if (sustentoAbierto) {
    panel.classList.remove("hidden");
    btn.textContent = "▲ Ocultar sustento legal";
  } else {
    panel.classList.add("hidden");
    btn.textContent = "📖 Ver sustento legal / repaso";
  }
}

function anteriorPregunta() {
  if (indiceActual > 0) {
    indiceActual--;
    mostrarPregunta();
  }
}

function siguientePregunta() {
  if (indiceActual < examenActual.length - 1) {
    indiceActual++;
    mostrarPregunta();
  }
}

function renderizarDots() {
  const cont = document.getElementById("question-dots");
  cont.innerHTML = "";
  examenActual.forEach((_, idx) => {
    const b = document.createElement("button");
    b.className = "dot";
    b.textContent = idx + 1;
    b.onclick = () => {
      indiceActual = idx;
      mostrarPregunta();
    };
    cont.appendChild(b);
  });
}

function actualizarDots() {
  const dots = document.querySelectorAll(".dot");
  dots.forEach((d, idx) => {
    d.classList.remove("active", "dot-ok", "dot-err");
    if (idx === indiceActual) d.classList.add("active");
    const r = respuestasUsuario[idx];
    if (r !== undefined) {
      d.classList.add(r === examenActual[idx].correctaMezclada ? "dot-ok" : "dot-err");
    }
  });
}

function confirmarSalir() {
  if (confirm("¿Deseas salir del simulacro actual y volver al menú principal?")) {
    volverInicio();
  }
}

function volverInicio() {
  clearInterval(timerInterval);
  document.getElementById("screen-quiz").classList.add("hidden");
  document.getElementById("screen-results").classList.add("hidden");
  document.getElementById("screen-home").classList.remove("hidden");
}

function finalizarExamen() {
  clearInterval(timerInterval);
  document.getElementById("screen-quiz").classList.add("hidden");
  document.getElementById("screen-results").classList.remove("hidden");

  const total = examenActual.length;
  let aciertos = 0;
  const fasesStats = {
    "Actuaciones Preparatorias": { ok: 0, tot: 0 },
    "Selección": { ok: 0, tot: 0 },
    "Ejecución Contractual": { ok: 0, tot: 0 }
  };

  examenActual.forEach((q, idx) => {
    const esOk = respuestasUsuario[idx] === q.correctaMezclada;
    if (esOk) aciertos++;
    if (fasesStats[q.fase]) {
      fasesStats[q.fase].tot++;
      if (esOk) fasesStats[q.fase].ok++;
    }
  });

  const pct = Math.round((aciertos / total) * 100);
  document.getElementById("final-percent").textContent = `${pct}%`;
  document.getElementById("final-fraction").textContent = `${aciertos} de ${total} correctas`;
  document.getElementById("results-subtitle").textContent = `Tiempo empleado: ${document.getElementById("hud-timer").textContent}`;

  const breakdown = document.getElementById("phase-breakdown");
  breakdown.innerHTML = "";
  Object.entries(fasesStats).forEach(([fase, st]) => {
    if (st.tot > 0) {
      breakdown.innerHTML += `<div class="phase-row"><strong>${fase}</strong><span>${st.ok} / ${st.tot} (${Math.round((st.ok/st.tot)*100)}%)</span></div>`;
    }
  });

  document.getElementById("review-list").innerHTML = "";
}

function revisarFalladas() {
  const cont = document.getElementById("review-list");
  cont.innerHTML = "<h3 style='margin-bottom:12px; color:var(--primary);'>Detalle de preguntas falladas o sin responder</h3>";
  let hayFalladas = false;

  examenActual.forEach((q, idx) => {
    const r = respuestasUsuario[idx];
    if (r !== q.correctaMezclada) {
      hayFalladas = true;
      const elegidaTxt = r !== undefined ? q.opcionesMezcladas[r] : "Sin responder";
      const correctaTxt = q.opcionesMezcladas[q.correctaMezclada];
      cont.innerHTML += `
        <div class="review-item">
          <div style="font-size:0.78rem; font-weight:700; color:var(--primary); text-transform:uppercase;">${q.fase} • ${q.tema}</div>
          <h4>${idx + 1}. ${q.pregunta}</h4>
          <p style="color:var(--danger); font-size:0.9rem;"><strong>Tu respuesta:</strong> ${elegidaTxt}</p>
          <p style="color:var(--success); font-size:0.9rem; margin-bottom:8px;"><strong>Respuesta correcta:</strong> ${correctaTxt}</p>
          <details>
            <summary style="cursor:pointer; color:#1d4ed8; font-weight:600; font-size:0.88rem;">📖 Ver sustento legal (${q.articulo_ref})</summary>
            <div style="margin-top:8px; padding:10px; background:#f8fafc; border-radius:8px; font-size:0.85rem; white-space:pre-line;">${q.sustento_legal}</div>
          </details>
        </div>
      `;
    }
  });

  if (!hayFalladas) {
    cont.innerHTML += "<p style='color:var(--success); font-weight:600;'>¡Felicitaciones! Respondiste todas las preguntas correctamente.</p>";
  }
}
