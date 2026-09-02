/* =========================================================
   MATIZ TRIP CALCULATOR
   ========================================================= */

const OSRM_URL =
  "https://router.project-osrm.org/route/v1/driving";


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const defaultTariffs = {

  uberx: {
    name: "UberX",
    base: 35,
    km: 5.5,
    minute: 0.50
  },

  indrive: {
    name: "inDrive",
    base: 30,
    km: 5,
    minute: 0.40
  },

  didi: {
    name: "DiDi Pasajeros",
    base: 30,
    km: 5,
    minute: 0.45
  },

  ubereats: {
    name: "Uber Eats",
    base: 30,
    km: 5,
    minute: 0.40
  },

  uberpackage: {
    name: "Uber Paquetería",
    base: 35,
    km: 5.5,
    minute: 0.45
  },

  didifood: {
    name: "DiDi Food",
    base: 30,
    km: 5,
    minute: 0.40
  },

  rappi: {
    name: "Rappi",
    base: 30,
    km: 5,
    minute: 0.40
  }

};


let tariffs =
  JSON.parse(
    localStorage.getItem("matizTariffs")
  ) || defaultTariffs;


let lastCalculation = null;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   UTILIDADES
   ========================================================= */

function number(id) {

  return parseFloat($(id).value) || 0;

}


function money(value) {

  return "$" +
    value.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

}


function round(value, decimals = 2) {

  const factor =
    Math.pow(10, decimals);

  return Math.round(value * factor) / factor;

}


/* =========================================================
   PARSEAR COORDENADAS
   ========================================================= */

function parseCoordinateString(text) {

  if (!text) return null;

  const clean =
    text
      .trim()
      .replace(/\s+/g, " ");

  /*
    Formatos:

    22.156,-100.985
    22.156 -100.985
  */

  const match =
    clean.match(
      /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/
    );

  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);

  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return {
    lat,
    lon
  };

}


/* =========================================================
   EXTRAER COORDENADAS DE URL
   ========================================================= */

function extractCoordinates(urlText) {

  if (!urlText) return [];

  const coords = [];

  function add(lat, lon) {

    lat = Number(lat);
    lon = Number(lon);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {

      const exists =
        coords.some(
          c =>
            Math.abs(c.lat - lat) < 0.000001 &&
            Math.abs(c.lon - lon) < 0.000001
        );

      if (!exists) {
        coords.push({ lat, lon });
      }

    }

  }


  /*
    @22.123,-100.123
  */

  let match;

  const atRegex =
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;

  while ((match = atRegex.exec(urlText))) {

    add(match[1], match[2]);

  }


  /*
    !3d22.123!4d-100.123
  */

  const googleRegex =
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g;

  while ((match = googleRegex.exec(urlText))) {

    add(match[1], match[2]);

  }


  /*
    Coordenadas separadas por coma.
  */

  const pairRegex =
    /(-?\d{1,3}\.\d{4,})\s*[,;]\s*(-?\d{1,3}\.\d{4,})/g;

  while ((match = pairRegex.exec(urlText))) {

    const a = Number(match[1]);
    const b = Number(match[2]);

    /*
      Google normalmente usa lat,lon.
    */

    if (
      Math.abs(a) <= 90 &&
      Math.abs(b) <= 180
    ) {

      add(a, b);

    }

  }


  return coords;

}


/* =========================================================
   EXTRAER ORIGIN / DESTINATION DE GOOGLE MAPS
   ========================================================= */

function extractGoogleParams(urlText) {

  try {

    const url =
      new URL(urlText);

    const params =
      url.searchParams;

    const result = {
      origin: null,
      destination: null,
      waypoints: []
    };


    if (params.get("origin")) {

      result.origin =
        decodeURIComponent(
          params.get("origin")
        );

    }


    if (params.get("destination")) {

      result.destination =
        decodeURIComponent(
          params.get("destination")
        );

    }


    if (params.get("waypoints")) {

      result.waypoints =
        params
          .get("waypoints")
          .split("|")
          .map(x => decodeURIComponent(x));

    }


    return result;

  } catch {

    return null;

  }

}


/* =========================================================
   RUTA OSRM
   ========================================================= */

async function calculateOSRM(coords) {

  if (!coords || coords.length < 2) {

    throw new Error(
      "Se necesitan al menos origen y destino."
    );

  }


  const coordinateString =
    coords
      .map(c => `${c.lon},${c.lat}`)
      .join(";");


  const url =
    `${OSRM_URL}/${coordinateString}?overview=false`;


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      "El servidor de rutas no respondió."
    );

  }


  const data =
    await response.json();


  if (data.code !== "Ok") {

    throw new Error(
      data.message ||
      "No se encontró una ruta."
    );

  }


  if (!data.routes?.length) {

    throw new Error(
      "No se encontró una ruta."
    );

  }


  return {

    km:
      data.routes[0].distance / 1000,

    minutes:
      data.routes[0].duration / 60

  };

}


/* =========================================================
   PROCESAR GOOGLE MAPS
   ========================================================= */

$("processMaps")
  .addEventListener(
    "click",
    async () => {

      const url =
        $("mapsUrl").value.trim();

      if (!url) {

        setStatus(
          "Pega primero un enlace de Google Maps.",
          true
        );

        return;

      }


      setStatus(
        "🔎 Analizando enlace...",
        false
      );


      /*
        Primero intentamos sacar coordenadas.
      */

      let coords =
        extractCoordinates(url);


      /*
        Después revisamos parámetros.
      */

      const params =
        extractGoogleParams(url);


      if (
        coords.length >= 2
      ) {

        try {

          const route =
            await calculateOSRM(coords);

          $("km").value =
            round(route.km, 2);

          $("minutes").value =
            Math.round(route.minutes);

          setStatus(
            `✅ Ruta encontrada: ${round(route.km,2)} km · ${Math.round(route.minutes)} min`,
            false
          );

          return;

        } catch (error) {

          console.error(error);

        }

      }


      /*
        Si el enlace tiene origin/destination
        pero no coordenadas, mostramos instrucciones.
      */

      if (
        params?.origin &&
        params?.destination
      ) {

        $("origin").value =
          params.origin;

        $("destination").value =
          params.destination;


        setStatus(
          "📍 Encontré origen y destino. Para calcular automáticamente desde texto necesitas introducir coordenadas o usar el botón de ruta con coordenadas.",
          true
        );

        return;

      }


      /*
        Enlaces cortos de maps.app.goo.gl
      */

      if (
        url.includes("maps.app.goo.gl") ||
        url.includes("goo.gl/maps")
      ) {

        setStatus(
          "⚠️ Este es un enlace corto de Google Maps. GitHub Pages no puede resolverlo directamente de forma confiable. Usa el enlace completo de la ruta o introduce origen/destino como coordenadas.",
          true
        );

        return;

      }


      setStatus(
        "❌ No pude obtener las coordenadas de esta URL.",
        true
      );

    }
  );


/* =========================================================
   CALCULAR RUTA DESDE COORDENADAS
   ========================================================= */

$("routeButton")
  .addEventListener(
    "click",
    async () => {

      const origin =
        parseCoordinateString(
          $("origin").value
        );

      const destination =
        parseCoordinateString(
          $("destination").value
        );


      if (!origin || !destination) {

        setStatus(
          "Introduce las coordenadas como: 22.156,-100.985",
          true
        );

        return;

      }


      setStatus(
        "🚗 Calculando ruta...",
        false
      );


      try {

        const route =
          await calculateOSRM([
            origin,
            destination
          ]);


        $("km").value =
          round(route.km, 2);

        $("minutes").value =
          Math.round(route.minutes);


        setStatus(
          `✅ ${round(route.km,2)} km · ${Math.round(route.minutes)} min`,
          false
        );

      } catch (error) {

        console.error(error);

        setStatus(
          "❌ No fue posible calcular la ruta.",
          true
        );

      }

    }
  );


/* =========================================================
   ESTADO
   ========================================================= */

function setStatus(text, error) {

  const element =
    $("routeStatus");

  element.textContent =
    text;

  element.style.color =
    error
      ? "#ff5252"
      : "#00e676";

}


/* =========================================================
   TARIFA ESTIMADA
   ========================================================= */

function estimatedPayment(
  platform,
  km,
  minutes
) {

  const tariff =
    tariffs[platform];

  if (!tariff) return 0;


  return (
    tariff.base +
    km * tariff.km +
    minutes * tariff.minute
  );

}


/* =========================================================
   CALCULAR VIAJE
   ========================================================= */

$("calculate")
  .addEventListener(
    "click",
    calculateTrip
  );


function calculateTrip() {

  const kmBase =
    number("km");

  const minutesBase =
    number("minutes");

  const extraKm =
    number("extraKm");

  const extraMinutes =
    number("extraMinutes");


  const km =
    kmBase + extraKm;

  const minutes =
    minutesBase + extraMinutes;


  if (
    km <= 0 ||
    minutes <= 0
  ) {

    alert(
      "Primero introduce los kilómetros y el tiempo."
    );

    return;

  }


  const kmL =
    number("kmL");

  const gasPrice =
    number("gasPrice");

  const wearKm =
    number("wearKm");

  const targetHour =
    number("targetHour");


  if (kmL <= 0) {

    alert(
      "El rendimiento del vehículo debe ser mayor que 0."
    );

    return;

  }


  const platform =
    $("platform").value;


  const estimated =
    estimatedPayment(
      platform,
      km,
      minutes
    );


  const realOffer =
    number("realOffer");


  const usingRealOffer =
    realOffer > 0;


  const payment =
    usingRealOffer
      ? realOffer
      : estimated;


  const fuel =
    (km / kmL) *
    gasPrice;


  const wear =
    km *
    wearKm;


  const totalCost =
    fuel + wear;


  const net =
    payment - totalCost;


  const hours =
    minutes / 60;


  const netHour =
    hours > 0
      ? net / hours
      : 0;


  const netKm =
    km > 0
      ? net / km
      : 0;


  /*
    Pago mínimo necesario:

    costos + objetivo por hora
  */

  const minimum =
    totalCost +
    targetHour * hours;


  let decision =
    "RECHAZAR";

  let className =
    "reject";


  /*
    Aceptar:
    supera el objetivo horario

    Depende:
    cubre costos pero no alcanza objetivo

    Rechazar:
    ni siquiera cubre costos
  */

  if (
    payment >= minimum
  ) {

    decision =
      "ACEPTAR";

    className =
      "accept";

  } else if (
    payment > totalCost
  ) {

    decision =
      "DEPENDE";

    className =
      "depends";

  }


  $("decision").textContent =
    decision;

  $("decision").className =
    `decision ${className}`;


  $("rKm").textContent =
    `${round(km,2)} km`;

  $("rTime").textContent =
    `${Math.round(minutes)} min`;

  $("rEstimated").textContent =
    money(estimated);

  $("rPayment").textContent =
    money(payment);

  $("rFuel").textContent =
    money(fuel);

  $("rWear").textContent =
    money(wear);

  $("rCost").textContent =
    money(totalCost);

  $("rNet").textContent =
    money(net);

  $("rKmProfit").textContent =
    money(netKm);

  $("rHourProfit").textContent =
    money(netHour);

  $("rMinimum").textContent =
    money(minimum);


  lastCalculation = {

    date:
      new Date().toLocaleString(
        "es-MX"
      ),

    platform:
      tariffs[platform].name,

    km,

    minutes,

    estimated,

    payment,

    realOffer:
      usingRealOffer,

    fuel,

    wear,

    cost:
      totalCost,

    net,

    netKm,

    netHour,

    minimum,

    decision

  };

}


/* =========================================================
   ABRIR GOOGLE MAPS
   ========================================================= */

$("openMaps")
  .addEventListener(
    "click",
    () => {

      const origin =
        $("origin").value.trim();

      const destination =
        $("destination").value.trim();


      if (
        !origin ||
        !destination
      ) {

        alert(
          "Introduce origen y destino primero."
        );

        return;

      }


      const url =
        "https://www.google.com/maps/dir/?api=1" +
        "&origin=" +
        encodeURIComponent(origin) +
        "&destination=" +
        encodeURIComponent(destination) +
        "&travelmode=driving";


      window.open(
        url,
        "_blank"
      );

    }
  );


/* =========================================================
   GUARDAR VIAJE
   ========================================================= */

$("saveTrip")
  .addEventListener(
    "click",
    () => {

      if (!lastCalculation) {

        alert(
          "Primero calcula el viaje."
        );

        return;

      }


      const history =
        JSON.parse(
          localStorage.getItem(
            "matizHistory"
          )
        ) || [];


      history.unshift(
        lastCalculation
      );


      /*
        Máximo 100 viajes
      */

      const limited =
        history.slice(0, 100);


      localStorage.setItem(
        "matizHistory",
        JSON.stringify(limited)
      );


      renderHistory();


      alert(
        "Viaje guardado."
      );

    }
  );


/* =========================================================
   HISTORIAL
   ========================================================= */

function renderHistory() {

  const container =
    $("history");


  const history =
    JSON.parse(
      localStorage.getItem(
        "matizHistory"
      )
    ) || [];


  if (!history.length) {

    container.innerHTML =
      `<p class="muted">
        Todavía no tienes viajes guardados.
      </p>`;

    return;

  }


  container.innerHTML =
    history
      .map(
        (trip, index) => {

          const decisionClass =
            trip.decision === "ACEPTAR"
              ? "accept"
              : trip.decision === "DEPENDE"
                ? "depends"
                : "reject";


          return `

            <div class="historyItem">

              <div>
                <strong>
                  ${escapeHtml(trip.platform)}
                </strong>

                <span style="float:right">
                  ${money(trip.net)}
                </span>
              </div>

              <div class="muted">

                ${round(trip.km,2)} km ·
                ${Math.round(trip.minutes)} min ·
                ${money(trip.payment)}

              </div>

              <div
                style="margin-top:7px"
                class="${decisionClass}"
              >

                ${trip.decision}

              </div>

              <div class="muted">

                ${escapeHtml(trip.date)}

              </div>

              <button
                onclick="deleteTrip(${index})"
                class="danger"
                style="margin-top:8px"
              >
                Eliminar
              </button>

            </div>

          `;

        }
      )
      .join("");

}


function deleteTrip(index) {

  const history =
    JSON.parse(
      localStorage.getItem(
        "matizHistory"
      )
    ) || [];


  history.splice(
    index,
    1
  );


  localStorage.setItem(
    "matizHistory",
    JSON.stringify(history)
  );


  renderHistory();

}


$("clearHistory")
  .addEventListener(
    "click",
    () => {

      if (
        !confirm(
          "¿Borrar todo el historial?"
        )
      ) {

        return;

      }


      localStorage.removeItem(
        "matizHistory"
      );


      renderHistory();

    }
  );


/* =========================================================
   ESCAPAR HTML
   ========================================================= */

function escapeHtml(value) {

  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");

}


/* =========================================================
   TARIFAS EDITABLES
   ========================================================= */

function renderTariffs() {

  const container =
    $("tariffs");


  container.innerHTML =
    Object.entries(tariffs)
      .map(
        ([key, tariff]) => {

          return `

            <div class="tariff">

              <h3>
                ${escapeHtml(tariff.name)}
              </h3>

              <div class="tariffGrid">

                <label>

                  Base

                  <input
                    type="number"
                    step="0.01"
                    value="${tariff.base}"
                    data-tariff="${key}"
                    data-field="base"
                  >

                </label>


                <label>

                  $ / km

                  <input
                    type="number"
                    step="0.01"
                    value="${tariff.km}"
                    data-tariff="${key}"
                    data-field="km"
                  >

                </label>


                <label>

                  $ / minuto

                  <input
                    type="number"
                    step="0.01"
                    value="${tariff.minute}"
                    data-tariff="${key}"
                    data-field="minute"
                  >

                </label>

              </div>

            </div>

          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "input[data-tariff]"
    )
    .forEach(
      input => {

        input.addEventListener(
          "change",
          () => {

            const key =
              input.dataset.tariff;

            const field =
              input.dataset.field;


            tariffs[key][field] =
              parseFloat(input.value) || 0;


            localStorage.setItem(
              "matizTariffs",
              JSON.stringify(tariffs)
            );

          }
        );

      }
    );

}


/* =========================================================
   MODO OSCURO / CLARO
   ========================================================= */

$("themeBtn")
  .addEventListener(
    "click",
    () => {

      document.body.classList.toggle(
        "light"
      );


      const light =
        document.body.classList.contains(
          "light"
        );


      $("themeBtn").textContent =
        light
          ? "🌙"
          : "☀️";

    }
  );


/* =========================================================
   INICIALIZAR
   ========================================================= */

renderTariffs();

renderHistory();
