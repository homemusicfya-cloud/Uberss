let configuracion = {

  kmLitro: 14,

  precioGasolina: 24,

  costoDesgaste: 1,

  metaHora: 150,

  apiKey: ""

};


let ultimoViaje = null;


/* =========================
   CONFIGURACIÓN
========================= */

function cargarConfiguracion() {

  const guardado =
    localStorage.getItem("configuracion");

  if (guardado) {

    configuracion =
      JSON.parse(guardado);

  }

}


function abrirConfiguracion() {

  document
    .getElementById("configuracion")
    .classList.remove("oculto");

  document.getElementById("kmLitro").value =
    configuracion.kmLitro;

  document.getElementById("precioGasolina").value =
    configuracion.precioGasolina;

  document.getElementById("costoDesgaste").value =
    configuracion.costoDesgaste;

  document.getElementById("metaHora").value =
    configuracion.metaHora;

  document.getElementById("apiKey").value =
    configuracion.apiKey;

}


function cerrarConfiguracion() {

  document
    .getElementById("configuracion")
    .classList.add("oculto");

}


function guardarConfiguracion() {

  configuracion.kmLitro =
    Number(document.getElementById("kmLitro").value);

  configuracion.precioGasolina =
    Number(document.getElementById("precioGasolina").value);

  configuracion.costoDesgaste =
    Number(document.getElementById("costoDesgaste").value);

  configuracion.metaHora =
    Number(document.getElementById("metaHora").value);

  configuracion.apiKey =
    document.getElementById("apiKey").value.trim();

  localStorage.setItem(
    "configuracion",
    JSON.stringify(configuracion)
  );

  cerrarConfiguracion();

}


/* =========================
   GOOGLE MAPS
========================= */

async function cargarGoogleMaps() {

  if (!configuracion.apiKey) {

    throw new Error(
      "Primero agrega tu Google Maps API Key en ⚙️"
    );

  }


  if (window.google &&
      window.google.maps) {

    return;

  }


  return new Promise(
    (resolve,reject)=>{

      const script =
        document.createElement("script");

      script.src =
        "https://maps.googleapis.com/maps/api/js?key="
        + encodeURIComponent(configuracion.apiKey);

      script.async = true;

      script.defer = true;

      script.onload = resolve;

      script.onerror = () =>
        reject(
          new Error(
            "No se pudo cargar Google Maps. Revisa tu API Key."
          )
        );

      document.head.appendChild(script);

    }
  );

}


/* =========================
   CALCULAR RUTA
========================= */

async function calcularRuta() {

  const origen =
    document.getElementById("origen").value.trim();

  const destino =
    document.getElementById("destino").value.trim();

  const pago =
    Number(document.getElementById("pago").value);

  const plataforma =
    document.getElementById("plataforma").value;


  if (!origen ||
      !destino ||
      pago <= 0) {

    document.getElementById("mensaje")
      .textContent =
      "Completa origen, destino y pago.";

    return;

  }


  document.getElementById("mensaje")
    .textContent =
    "Consultando Google Maps...";


  try {

    await cargarGoogleMaps();


    const servicio =
      new google.maps.DirectionsService();


    servicio.route(

      {

        origin: origen,

        destination: destino,

        travelMode:
          google.maps.TravelMode.DRIVING,

        drivingOptions: {

          departureTime:
            new Date(),

          trafficModel:
            google.maps.TrafficModel.BEST_GUESS

        }

      },

      function(resultado, estado) {

        if (estado !== "OK") {

          document.getElementById("mensaje")
            .textContent =
            "Google Maps no encontró la ruta.";

          return;

        }


        const ruta =
          resultado.routes[0];

        const tramo =
          ruta.legs[0];


        const metros =
          tramo.distance.value;

        const segundos =
          tramo.duration.value;


        const km =
          metros / 1000;

        const minutos =
          segundos / 60;


        /* GASOLINA */

        const costoGasolina =
          (km / configuracion.kmLitro)
          *
          configuracion.precioGasolina;


        /* DESGASTE */

        const desgaste =
          km *
          configuracion.costoDesgaste;


        /* GANANCIA */

        const ganancia =
          pago -
          costoGasolina -
          desgaste;


        /* GANANCIA POR HORA */

        const horas =
          minutos / 60;


        const gananciaHora =
          ganancia / horas;


        /* GANANCIA POR KM */

        const gananciaKm =
          ganancia / km;


        mostrarResultado({

          origen,

          destino,

          plataforma,

          pago,

          km,

          minutos,

          costoGasolina,

          desgaste,

          ganancia,

          gananciaHora,

          gananciaKm

        });


        mostrarMapa(
          ruta,
          resultado
        );


        ultimoViaje = {

          fecha:
            new Date().toISOString(),

          origen,

          destino,

          plataforma,

          pago,

          km,

          minutos,

          costoGasolina,

          desgaste,

          ganancia,

          gananciaHora,

          gananciaKm

        };

      }

    );

  }

  catch(error) {

    document.getElementById("mensaje")
      .textContent =
      error.message;

  }

}


/* =========================
   MOSTRAR RESULTADO
========================= */

function mostrarResultado(viaje) {

  document
    .getElementById("resultado")
    .classList.remove("oculto");


  document.getElementById("distancia")
    .textContent =
    viaje.km.toFixed(1)
    + " km";


  document.getElementById("tiempo")
    .textContent =
    Math.round(viaje.minutos)
    + " min";


  document.getElementById("gasolina")
    .textContent =
    dinero(viaje.costoGasolina);


  document.getElementById("desgaste")
    .textContent =
    dinero(viaje.desgaste);


  document.getElementById("ganancia")
    .textContent =
    dinero(viaje.ganancia);


  document.getElementById("porHora")
    .textContent =
    dinero(viaje.gananciaHora)
    + "/h";


  document.getElementById("porKm")
    .textContent =
    dinero(viaje.gananciaKm)
    + "/km";


  const decision =
    document.getElementById("decision");


  decision.className =
    "decision";


  if (viaje.gananciaHora >=
      configuracion.metaHora) {

    decision.classList.add("verde");

    decision.textContent =
      "🟢 CONVIENE";

  }

  else if (
    viaje.gananciaHora >=
    configuracion.metaHora * .67
  ) {

    decision.classList.add("amarillo");

    decision.textContent =
      "🟡 REGULAR";

  }

  else {

    decision.classList.add("rojo");

    decision.textContent =
      "🔴 NO CONVIENE";

  }

}


/* =========================
   MAPA
========================= */

function mostrarMapa(ruta, resultado) {

  document
    .getElementById("mapaContainer")
    .classList.remove("oculto");


  const mapa =
    new google.maps.Map(

      document.getElementById("mapa"),

      {

        zoom: 13,

        center:
          ruta.overview_path[0]

      }

    );


  const directionsRenderer =
    new google.maps.DirectionsRenderer({

      map: mapa,

      directions: resultado

    });

}


/* =========================
   GUARDAR VIAJE
========================= */

function guardarViaje() {

  if (!ultimoViaje) {

    return;

  }


  const viajes =
    obtenerViajes();


  viajes.unshift(
    ultimoViaje
  );


  localStorage.setItem(
    "viajes",
    JSON.stringify(viajes)
  );


  actualizarResumen();


  document.getElementById("mensaje")
    .textContent =
    "✅ Viaje guardado.";

}


/* =========================
   HISTORIAL
========================= */

function obtenerViajes() {

  return JSON.parse(
    localStorage.getItem("viajes")
    || "[]"
  );

}


function actualizarResumen() {

  const viajes =
    obtenerViajes();


  let ingresos = 0;

  let gasolina = 0;

  let desgaste = 0;

  let ganancia = 0;

  let horas = 0;


  viajes.forEach(
    viaje => {

      ingresos += viaje.pago;

      gasolina += viaje.costoGasolina;

      desgaste += viaje.desgaste;

      ganancia += viaje.ganancia;

      horas +=
        viaje.minutos / 60;

    }
  );


  document.getElementById("totalViajes")
    .textContent =
    viajes.length;


  document.getElementById("totalIngresos")
    .textContent =
    dinero(ingresos);


  document.getElementById("totalGasolina")
    .textContent =
    dinero(gasolina);


  document.getElementById("totalDesgaste")
    .textContent =
    dinero(desgaste);


  document.getElementById("totalGanancia")
    .textContent =
    dinero(ganancia);


  document.getElementById("totalHora")
    .textContent =
    horas > 0
      ? dinero(ganancia / horas)
      : "$0";


  mostrarHistorial(viajes);

}


function mostrarHistorial(viajes) {

  const contenedor =
    document.getElementById("historial");


  contenedor.innerHTML = "";


  viajes.slice(0,30)
    .forEach(viaje => {

      const div =
        document.createElement("div");

      div.className =
        "historial";


      div.innerHTML = `

        <small>
          ${new Date(viaje.fecha)
            .toLocaleString("es-MX")}
          ·
          ${viaje.plataforma}
        </small>

        <br>

        <strong>
          ${viaje.origen}
          →
          ${viaje.destino}
        </strong>

        <br>

        ${viaje.km.toFixed(1)} km

        ·

        ${Math.round(viaje.minutos)} min

        ·

        Neto:

        ${dinero(viaje.ganancia)}

        ·

        ${dinero(viaje.gananciaHora)}/h

      `;


      contenedor.appendChild(div);

    });

}


/* =========================
   BORRAR
========================= */

function borrarHistorial() {

  if (
    confirm(
      "¿Seguro que quieres borrar todos los viajes?"
    )
  ) {

    localStorage.removeItem(
      "viajes"
    );

    actualizarResumen();

  }

}


/* =========================
   DINERO
========================= */

function dinero(numero) {

  return new Intl.NumberFormat(
    "es-MX",
    {

      style: "currency",

      currency: "MXN"

    }

  ).format(numero || 0);

}


/* =========================
   INICIO
========================= */

cargarConfiguracion();

actualizarResumen();
