const STORAGE_KEY = "osa_loreto_oece_vistas_v2";

let examenActual = [];
let respuestasUsuario = {};
let indiceActual = 0;
let timerInterval = null;
let segundosTranscurridos = 0;
let sustentoAbierto = false;

const LETRAS = ["A", "B", "C", "D", "E"];

function obtenerVistas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function guardarVista(idPregunta) {
  try {
    const vistas = obtenerVistas();
    vistas.add(idPregunta);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...vistas]));
    actualizarContadorHistorial();
  } catch (e) {}
}

function actualizarContadorHistorial() {
  const vistas = obtenerVistas();
  const total = BANCO_PREGUNTAS_OECE.length;
  const vistasReales = Math.min(vistas.size, total);
  const elSeen = document.getElementById("seen-count");
  const elTot = document.getElementById("seen-total");
  const elRem = document.getElementById("remaining-count");
  if (elSeen) elSeen.textContent = vistasReales;
  if (elTot) elTot.textContent = total;
  if (elRem) elRem.textContent = Math.max(0, total - vistasReales);
}

function reiniciarHistorial() {
  if (confirm("¿Deseas reiniciar el lote completo para volver a incluir todas las 810 preguntas desde cero?")) {
    localStorage.removeItem(STORAGE_KEY);
    actualizarContadorHistorial();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof BANCO_PREGUNTAS_OECE === "undefined") {
    alert("Error: No se cargó el archivo preguntas.js.");
    return;
  }
  document.getElementById("total-bank-count").textContent = BANCO_PREGUNTAS_OECE.length;
  document.getElementById("count-prep").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Actuaciones Preparatorias").length;
  document.getElementById("count-sel").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Selección").length;
  document.getElementById("count-ejec").textContent = BANCO_PREGUNTAS_OECE.filter(p => p.fase === "Ejecución Contractual").length;
  actualizarContadorHistorial();
});

function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function seleccionarLoteNuevo(subPool, n) {
  const vistas = obtenerVistas();
  let noVistas = barajar(subPool.filter(p => !vistas.has(p.id)));
  if (noVistas.length === 0) {
    // Si ya se completó todo ese subconjunto, reiniciar automáticamente el ciclo limpio
    noVistas = barajar(subPool);
  }
  return noVistas.slice(0, Math.min(n, noVistas.length));
}

function iniciarExamen(cantidad) {
  const faseFiltro = document.getElementById("filtro-fase").value;
  let pool = BANCO_PREGUNTAS_OECE;

  if (faseFiltro !== "TODAS") {
    pool = pool.filter(p => p.fase === faseFiltro);
    examenActual = seleccionarLoteNuevo(pool, cantidad);
  } else if (cantidad === 72) {
    const p1 = seleccionarLoteNuevo(pool.filter(p => p.fase === "Actuaciones Preparatorias"), 25);
    const p2 = seleccionarLoteNuevo(pool.filter(p => p.fase === "Selección"), 22);
    const p3 = seleccionarLoteNuevo(pool.filter(p => p.fase === "Ejecución Contractual"), 25);
    examenActual = barajar([...p1, ...p2, ...p3]);
  } else {
    examenActual = seleccionarLoteNuevo(pool, cantidad);
  }

  // Lote limpio: ninguna pregunta pre-marcada y alternativas barajadas
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
  document.getElementById("hud-score").textContent = "0";
  document.getElementById("hud-timer").textContent = "00:00";

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
  guardarVista(examenActual[indiceActual].id);

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
  examenActual = [];
  respuestasUsuario = {};
  document.getElementById("screen-quiz").classList.add("hidden");
  document.getElementById("screen-results").classList.add("hidden");
  document.getElementById("screen-home").classList.remove("hidden");
  actualizarContadorHistorial();
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
  cont.innerHTML = "<h3 style='margin-bottom:12px; color:#243b53;'>Detalle de preguntas falladas o sin responder</h3>";
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
            <summary style="cursor:pointer; color:var(--primary); font-weight:600; font-size:0.88rem;">📖 Ver sustento legal (${q.articulo_ref})</summary>
            <div style="margin-top:8px; padding:12px; background:#f8fafc; border-radius:8px; font-size:0.86rem; white-space:pre-wrap; line-height:1.65;">${q.sustento_legal}</div>
          </details>
        </div>
      `;
    }
  });

  if (!hayFalladas) {
    cont.innerHTML += "<p style='color:var(--success); font-weight:600;'>¡Felicitaciones! Respondiste todas las preguntas correctamente.</p>";
  }
}
