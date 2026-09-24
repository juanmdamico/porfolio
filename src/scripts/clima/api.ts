export interface Lugar {
  nombre: string;
  detalle: string; // provincia, país
  latitud: number;
  longitud: number;
}

export interface Clima {
  actual: {
    hora: string;
    temperatura: number;
    sensacion: number;
    humedad: number;
    viento: number;
    codigo: number;
    esDeDia: boolean;
  };
  horas: { hora: string; temperatura: number; probLluvia: number }[];
  dias: { fecha: string; codigo: number; maxima: number; minima: number; lluvia: number }[];
  /** Índice en `dias` que corresponde a hoy */
  indiceHoy: number;
}

const DIAS_PASADOS = 30;

export async function buscarLugares(texto: string, senal?: AbortSignal): Promise<Lugar[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: texto, count: '6', language: 'es', format: 'json' }).toString();
  const res = await fetch(url, { signal: senal });
  if (!res.ok) throw new Error('No se pudo buscar la ciudad');
  const datos = await res.json();
  return (datos.results ?? []).map((r: any) => ({
    nombre: r.name,
    detalle: [r.admin1, r.country].filter(Boolean).join(', '),
    latitud: r.latitude,
    longitud: r.longitude,
  }));
}

export async function obtenerClima(latitud: number, longitud: number): Promise<Clima> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitud),
    longitude: String(longitud),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    past_days: String(DIAS_PASADOS),
    forecast_days: '7',
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo obtener el clima. Probá de nuevo en un rato.');
  const d = await res.json();

  // Las horas vienen desde hace 30 días: nos quedamos con las próximas 24 desde la hora actual.
  const horaActual = `${d.current.time.slice(0, 13)}:00`;
  const desde = Math.max(0, d.hourly.time.indexOf(horaActual));
  const horas = d.hourly.time.slice(desde, desde + 24).map((hora: string, i: number) => ({
    hora,
    temperatura: d.hourly.temperature_2m[desde + i],
    probLluvia: d.hourly.precipitation_probability[desde + i] ?? 0,
  }));

  const dias = d.daily.time.map((fecha: string, i: number) => ({
    fecha,
    codigo: d.daily.weather_code[i],
    maxima: d.daily.temperature_2m_max[i],
    minima: d.daily.temperature_2m_min[i],
    lluvia: d.daily.precipitation_sum[i] ?? 0,
  }));

  return {
    actual: {
      hora: d.current.time,
      temperatura: d.current.temperature_2m,
      sensacion: d.current.apparent_temperature,
      humedad: d.current.relative_humidity_2m,
      viento: d.current.wind_speed_10m,
      codigo: d.current.weather_code,
      esDeDia: d.current.is_day === 1,
    },
    horas,
    dias,
    indiceHoy: Math.max(0, d.daily.time.indexOf(d.current.time.slice(0, 10))),
  };
}

/** Códigos WMO que usa Open-Meteo → descripción y emoji. */
export function describir(codigo: number, esDeDia = true): { texto: string; icono: string } {
  const tabla: [number[], string, string, string?][] = [
    [[0], 'Despejado', '☀️', '🌙'],
    [[1], 'Mayormente despejado', '🌤️', '🌙'],
    [[2], 'Parcialmente nublado', '⛅', '☁️'],
    [[3], 'Nublado', '☁️'],
    [[45, 48], 'Niebla', '🌫️'],
    [[51, 53, 55, 56, 57], 'Llovizna', '🌦️', '🌧️'],
    [[61, 63, 65, 66, 67], 'Lluvia', '🌧️'],
    [[71, 73, 75, 77], 'Nieve', '🌨️'],
    [[80, 81, 82], 'Chaparrones', '🌦️', '🌧️'],
    [[85, 86], 'Chaparrones de nieve', '🌨️'],
    [[95, 96, 99], 'Tormenta', '⛈️'],
  ];
  const fila = tabla.find(([codigos]) => codigos.includes(codigo));
  if (!fila) return { texto: 'Sin datos', icono: '❔' };
  const [, texto, dia, noche] = fila;
  return { texto, icono: esDeDia ? dia : (noche ?? dia) };
}
