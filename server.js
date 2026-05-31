/**
 * GOTAIA - PLATAFORMA AGRICOLA TÉCNICA CON IA
 * Versión 2.0 - SaaS de Precisión Hídrica
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// ==========================================
// 1. CARGA DE ENTORNO Y CONFIGURACIÓN (Node.js 24 Native)
// ==========================================
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
    console.log('✓ [.env] Archivo de variables de entorno cargado correctamente.');
  } catch (e) {
    // Si no existe, se ignorará y se tomarán las variables del entorno global
  }
}

// Generar package.json si no existe
const packageJsonContent = {
  "name": "gotaia-plataforma-tecnica",
  "version": "2.0.0",
  "description": "Plataforma agrícola técnica e inteligente de riego - GOTAIA 2.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "author": "GOTAIA SaaS",
  "license": "MIT"
};

if (!fs.existsSync(path.join(__dirname, 'package.json'))) {
  fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(packageJsonContent, null, 2), 'utf-8');
}

// Cargar Express de forma segura
let express;
try {
  express = require('express');
} catch (e) {
  console.log('\n======================================================');
  console.log('⚠️  ¡FALTAN DEPENDENCIAS!');
  console.log('Por favor, ejecuta "npm install" en la terminal.');
  console.log('======================================================\n');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 2. PERSISTENCIA EN MEMORIA / ARCHIVO LOCAL (DatabaseService)
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');

class DatabaseService {
  constructor() {
    this.data = {
      reports: [],
      chats: [],
      waterLogs: [],
      subscription: { plan: 'semillita' },
      config: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        weatherProvider: 'mock', // 'mock', 'openweather', 'weatherapi', 'visualcrossing'
        weatherApiKey: process.env.WEATHER_API_KEY || ''
      }
    };
    this.load();
  }

  load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        console.log('✓ [Database] Datos cargados correctamente desde database.json.');
      } catch (e) {
        console.error('⚠️ [Database] Error al leer database.json, inicializando datos vacíos.', e);
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('⚠️ [Database] Error al guardar datos en database.json', e);
    }
  }
}

const db = new DatabaseService();

// ==========================================
// 3. CATALOGOS AGRÓNOMOS DE CULTIVOS Y MUNICIPIOS
// ==========================================
const CROP_CATALOG = {
  maiz: { name: "Maíz", baseConsumption: 5000, sensitivity: "Alta", criticalStage: "Floración", tempRange: "18-28°C", obs: "Sensible al estrés hídrico durante la polinización." },
  soya: { name: "Soya", baseConsumption: 4500, sensitivity: "Media", criticalStage: "Llenado de vainas", tempRange: "20-30°C", obs: "Requiere humedad uniforme durante la floración." },
  arroz: { name: "Arroz", baseConsumption: 12000, sensitivity: "Muy Alta", criticalStage: "Floración", tempRange: "22-35°C", obs: "Sensible al secado del suelo; consumo hídrico masivo." },
  trigo: { name: "Trigo", baseConsumption: 4000, sensitivity: "Media-Baja", criticalStage: "Espigado", tempRange: "15-22°C", obs: "Tolera sequía moderada en etapas vegetativas iniciales." },
  papa: { name: "Papa", baseConsumption: 6000, sensitivity: "Alta", criticalStage: "Tuberización", tempRange: "15-20°C", obs: "Exceso de agua puede inducir pudrición y asfixia radicular." },
  tomate: { name: "Tomate", baseConsumption: 7000, sensitivity: "Alta", criticalStage: "Floración y cuajado", tempRange: "18-25°C", obs: "Requiere riegos frecuentes para evitar agrietamiento del fruto." },
  cebolla: { name: "Cebolla", baseConsumption: 4500, sensitivity: "Alta", criticalStage: "Bulbificación", tempRange: "13-24°C", obs: "Raíces muy superficiales; sensible a fluctuaciones bruscas de humedad." },
  zanahoria: { name: "Zanahoria", baseConsumption: 5000, sensitivity: "Media", criticalStage: "Desarrollo de raíz", tempRange: "15-21°C", obs: "Suelo debe mantenerse húmedo para un crecimiento uniforme." },
  lechuga: { name: "Lechuga", baseConsumption: 3000, sensitivity: "Muy Alta", criticalStage: "Todo el ciclo", tempRange: "15-18°C", obs: "Ciclo rápido; el estrés hídrico induce floración prematura y amargor." },
  yuca: { name: "Yuca", baseConsumption: 3500, sensitivity: "Baja", criticalStage: "Arraigamiento", tempRange: "20-30°C", obs: "Altamente resistente a la sequía tras los primeros 90 días." },
  mani: { name: "Maní", baseConsumption: 5000, sensitivity: "Media", criticalStage: "Clavado de frutos", tempRange: "22-30°C", obs: "Requiere suelo suelto en el clavado para penetrar y formar la vaina." },
  frijol: { name: "Frijol", baseConsumption: 4000, sensitivity: "Alta", criticalStage: "Floración y vainas", tempRange: "18-27°C", obs: "Exceso de humedad induce hongos foliares rápidamente." },
  cana_de_azucar: { name: "Caña de Azúcar", baseConsumption: 14000, sensitivity: "Baja-Media", criticalStage: "Macollamiento", tempRange: "22-32°C", obs: "Gran volumen vegetativo; consume mucha agua en total." },
  girasol: { name: "Girasol", baseConsumption: 5500, sensitivity: "Baja-Media", criticalStage: "Formación de capítulo", tempRange: "18-25°C", obs: "Raíz pivotante profunda que extrae agua de perfiles bajos del suelo." },
  quinua: { name: "Quinua", baseConsumption: 3000, sensitivity: "Baja", criticalStage: "Floración (antesis)", tempRange: "10-20°C", obs: "Gran resistencia al déficit hídrico, heladas y salinidad." },
  platano: { name: "Plátano", baseConsumption: 11000, sensitivity: "Alta", criticalStage: "Diferenciación floral", tempRange: "24-30°C", obs: "Gran área foliar; requiere un aporte hídrico alto y continuo." },
  cafe: { name: "Café", baseConsumption: 8000, sensitivity: "Media-Alta", criticalStage: "Floración y fruto", tempRange: "18-24°C", obs: "Soporta sequía corta que induce una floración uniforme al llover." },
  cacao: { name: "Cacao", baseConsumption: 9000, sensitivity: "Alta", criticalStage: "Llenado de mazorcas", tempRange: "22-28°C", obs: "Sensible a sequías prolongadas; afecta directamente al rendimiento del grano." },
  aji: { name: "Ají", baseConsumption: 5000, sensitivity: "Alta", criticalStage: "Floración y cuajado", tempRange: "20-30°C", obs: "Riego controlado puede regular la pungencia del fruto." },
  sandia: { name: "Sandía", baseConsumption: 6000, sensitivity: "Media-Alta", criticalStage: "Desarrollo del fruto", tempRange: "22-30°C", obs: "Suspender riego días antes de cosechar para concentrar azúcares." }
};

const MUNICIPALITIES_CATALOG = {
  // Santa Cruz
  santa_cruz_de_la_sierra: { name: "Santa Cruz de la Sierra", dept: "Santa Cruz", baseTemp: 30, baseHumidity: 65, baseWind: 15, baseRain: 2, condition: "Parcialmente nublado" },
  montero: { name: "Montero", dept: "Santa Cruz", baseTemp: 31, baseHumidity: 60, baseWind: 18, baseRain: 3, condition: "Soleado" },
  warnes: { name: "Warnes", dept: "Santa Cruz", baseTemp: 31, baseHumidity: 62, baseWind: 16, baseRain: 2, condition: "Soleado" },
  cotoca: { name: "Cotoca", dept: "Santa Cruz", baseTemp: 30, baseHumidity: 64, baseWind: 14, baseRain: 1, condition: "Parcialmente nublado" },
  la_guardia: { name: "La Guardia", dept: "Santa Cruz", baseTemp: 29, baseHumidity: 66, baseWind: 12, baseRain: 3, condition: "Parcialmente nublado" },
  el_torno: { name: "El Torno", dept: "Santa Cruz", baseTemp: 28, baseHumidity: 68, baseWind: 10, baseRain: 4, condition: "Nublado" },
  yapacani: { name: "Yapacaní", dept: "Santa Cruz", baseTemp: 29, baseHumidity: 85, baseWind: 10, baseRain: 15, condition: "Lluvia ligera" },
  san_carlos: { name: "San Carlos", dept: "Santa Cruz", baseTemp: 30, baseHumidity: 80, baseWind: 8, baseRain: 12, condition: "Llovizna" },
  portachuelo: { name: "Portachuelo", dept: "Santa Cruz", baseTemp: 31, baseHumidity: 70, baseWind: 12, baseRain: 5, condition: "Parcialmente nublado" },
  buena_vista: { name: "Buena Vista", dept: "Santa Cruz", baseTemp: 29, baseHumidity: 78, baseWind: 10, baseRain: 8, condition: "Nublado" },
  mineros: { name: "Mineros", dept: "Santa Cruz", baseTemp: 32, baseHumidity: 58, baseWind: 14, baseRain: 2, condition: "Soleado" },
  fernandez_alonso: { name: "Fernández Alonso", dept: "Santa Cruz", baseTemp: 32, baseHumidity: 57, baseWind: 15, baseRain: 1, condition: "Despejado" },
  san_pedro: { name: "San Pedro", dept: "Santa Cruz", baseTemp: 32, baseHumidity: 56, baseWind: 16, baseRain: 1, condition: "Despejado" },
  cuatro_canadas: { name: "Cuatro Cañadas", dept: "Santa Cruz", baseTemp: 33, baseHumidity: 52, baseWind: 22, baseRain: 0, condition: "Despejado / Viento" },
  san_julian: { name: "San Julián", dept: "Santa Cruz", baseTemp: 33, baseHumidity: 54, baseWind: 20, baseRain: 0, condition: "Soleado" },
  okinawa: { name: "Okinawa", dept: "Santa Cruz", baseTemp: 31, baseHumidity: 62, baseWind: 14, baseRain: 2, condition: "Parcialmente nublado" },
  pailon: { name: "Pailón", dept: "Santa Cruz", baseTemp: 34, baseHumidity: 48, baseWind: 25, baseRain: 0, condition: "Extremadamente seco" },
  camiri: { name: "Camiri", dept: "Santa Cruz", baseTemp: 33, baseHumidity: 45, baseWind: 18, baseRain: 0, condition: "Caluroso" },
  charagua: { name: "Charagua", dept: "Santa Cruz", baseTemp: 34, baseHumidity: 42, baseWind: 20, baseRain: 0, condition: "Soleado" },
  vallegrande: { name: "Vallegrande", dept: "Santa Cruz", baseTemp: 21, baseHumidity: 55, baseWind: 12, baseRain: 2, condition: "Parcialmente nublado" },
  samaipata: { name: "Samaipata", dept: "Santa Cruz", baseTemp: 22, baseHumidity: 58, baseWind: 14, baseRain: 3, condition: "Templado" },
  mairana: { name: "Mairana", dept: "Santa Cruz", baseTemp: 24, baseHumidity: 60, baseWind: 12, baseRain: 3, condition: "Parcialmente nublado" },
  comarapa: { name: "Comarapa", dept: "Santa Cruz", baseTemp: 23, baseHumidity: 57, baseWind: 10, baseRain: 2, condition: "Templado" },
  
  // Cochabamba
  cochabamba: { name: "Cochabamba", dept: "Cochabamba", baseTemp: 24, baseHumidity: 45, baseWind: 10, baseRain: 0, condition: "Despejado" },
  sacaba: { name: "Sacaba", dept: "Cochabamba", baseTemp: 23, baseHumidity: 48, baseWind: 12, baseRain: 0, condition: "Templado" },
  quillacollo: { name: "Quillacollo", dept: "Cochabamba", baseTemp: 24, baseHumidity: 44, baseWind: 10, baseRain: 0, condition: "Despejado" },
  punata: { name: "Punata", dept: "Cochabamba", baseTemp: 22, baseHumidity: 50, baseWind: 8, baseRain: 0, condition: "Despejado" },
  cliza: { name: "Cliza", dept: "Cochabamba", baseTemp: 22, baseHumidity: 50, baseWind: 9, baseRain: 0, condition: "Soleado" },
  
  // Tarija
  tarija: { name: "Tarija", dept: "Tarija", baseTemp: 25, baseHumidity: 50, baseWind: 12, baseRain: 1, condition: "Despejado" },
  yacuiba: { name: "Yacuiba", dept: "Tarija", baseTemp: 32, baseHumidity: 55, baseWind: 15, baseRain: 2, condition: "Cálido" },
  villamontes: { name: "Villamontes", dept: "Tarija", baseTemp: 35, baseHumidity: 40, baseWind: 18, baseRain: 0, condition: "Caluroso" },
  
  // La Paz
  la_paz: { name: "La Paz", dept: "La Paz", baseTemp: 14, baseHumidity: 40, baseWind: 12, baseRain: 0, condition: "Frío / Despejado" },
  el_alto: { name: "El Alto", dept: "La Paz", baseTemp: 10, baseHumidity: 35, baseWind: 18, baseRain: 0, condition: "Frío y ventoso" },
  achacachi: { name: "Achacachi", dept: "La Paz", baseTemp: 12, baseHumidity: 45, baseWind: 14, baseRain: 0, condition: "Frío" },
  viacha: { name: "Viacha", dept: "La Paz", baseTemp: 11, baseHumidity: 42, baseWind: 15, baseRain: 0, condition: "Frío" },
  
  // Oruro
  oruro: { name: "Oruro", dept: "Oruro", baseTemp: 15, baseHumidity: 30, baseWind: 20, baseRain: 0, condition: "Soleado" },
  
  // Potosí
  potosi: { name: "Potosí", dept: "Potosí", baseTemp: 13, baseHumidity: 32, baseWind: 18, baseRain: 0, condition: "Despejado" },
  
  // Sucre
  sucre: { name: "Sucre", dept: "Chuquisaca", baseTemp: 20, baseHumidity: 45, baseWind: 10, baseRain: 0, condition: "Templado" },
  
  // Trinidad
  trinidad: { name: "Trinidad", dept: "Beni", baseTemp: 32, baseHumidity: 75, baseWind: 12, baseRain: 8, condition: "Lluvia" }
};

// ==========================================
// 4. SERVICIO CLIMÁTICO MULTI-PROVEEDOR
// ==========================================
class WeatherService {
  static async fetchWeather(municipioKey, provider, apiKey) {
    const defaultMuni = MUNICIPALITIES_CATALOG[municipioKey] || MUNICIPALITIES_CATALOG.santa_cruz_de_la_sierra;
    
    // Fallback con variación aleatoria para simular tiempo real
    const mockFallback = {
      temp: defaultMuni.baseTemp + Math.round((Math.random() - 0.5) * 4),
      humidity: Math.min(100, Math.max(10, defaultMuni.baseHumidity + Math.round((Math.random() - 0.5) * 10))),
      rain: Math.max(0, defaultMuni.baseRain + Math.round((Math.random() - 0.2) * 5)),
      wind: Math.max(0, defaultMuni.baseWind + Math.round((Math.random() - 0.5) * 8)),
      feels_like: defaultMuni.baseTemp + Math.round((Math.random() - 0.5) * 2),
      rain_chance: defaultMuni.baseRain > 0 ? Math.min(100, 40 + Math.round(Math.random() * 50)) : Math.round(Math.random() * 20),
      condition: defaultMuni.condition,
      timestamp: new Date().toISOString(),
      provider: 'mock'
    };

    if (provider === 'mock' || !apiKey) {
      return mockFallback;
    }

    try {
      const cityName = defaultMuni.name;
      let url = '';
      let data = {};

      if (provider === 'weatherapi') {
        url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(cityName)},Bolivia`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`WeatherAPI returned ${res.status}`);
        const json = await res.json();
        
        return {
          temp: Math.round(json.current.temp_c),
          humidity: json.current.humidity,
          rain: parseFloat(json.current.precip_mm) || 0,
          wind: Math.round(json.current.wind_kph),
          feels_like: Math.round(json.current.feelslike_c),
          rain_chance: json.current.precip_mm > 0 ? 80 : 10,
          condition: json.current.condition.text,
          timestamp: new Date().toISOString(),
          provider: 'weatherapi'
        };
      } 
      
      else if (provider === 'openweather') {
        url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)},BO&appid=${apiKey}&units=metric&lang=es`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenWeatherMap returned ${res.status}`);
        const json = await res.json();

        return {
          temp: Math.round(json.main.temp),
          humidity: json.main.humidity,
          rain: (json.rain && json.rain['1h']) ? json.rain['1h'] : 0,
          wind: Math.round(json.wind.speed * 3.6), // converts m/s to km/h
          feels_like: Math.round(json.main.feels_like),
          rain_chance: json.weather[0].main.toLowerCase().includes('rain') ? 90 : 15,
          condition: json.weather[0].description,
          timestamp: new Date().toISOString(),
          provider: 'openweather'
        };
      } 
      
      else if (provider === 'visualcrossing') {
        url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(cityName)},Bolivia?unitGroup=metric&key=${apiKey}&contentType=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Visual Crossing returned ${res.status}`);
        const json = await res.json();

        return {
          temp: Math.round(json.currentConditions.temp),
          humidity: Math.round(json.currentConditions.humidity),
          rain: parseFloat(json.currentConditions.precip) || 0,
          wind: Math.round(json.currentConditions.windspeed),
          feels_like: Math.round(json.currentConditions.feelslike),
          rain_chance: Math.round(json.currentConditions.precipprob) || 0,
          condition: json.currentConditions.conditions,
          timestamp: new Date().toISOString(),
          provider: 'visualcrossing'
        };
      }

      return mockFallback;
    } catch (e) {
      console.warn(`⚠️ [Weather API error] Fallando al proveedor local. Razón:`, e.message);
      return mockFallback;
    }
  }
}

// ==========================================
// 5. CONTROL DE ACCESO CENTRALIZADO (canAccess)
// ==========================================
const PLANS = {
  SEMILLITA: 'semillita',
  CEBOLLITA: 'cebollita',
  MAIZINGO: 'maizingo',
  AGROPRO: 'agropro'
};

const FEATURES = {
  ASSISTANT_AI: 'assistant_ai',
  VOICE_CHAT: 'voice_chat',
  ADVANCED_REPORT: 'advanced_report',
  WORD_EXPORT: 'word_export',
  EXCEL_EXPORT: 'excel_export',
  WATER_TRACKING: 'water_tracking',
  FULL_HISTORY: 'full_history',
  BUSINESS_DASHBOARD: 'business_dashboard'
};

function canAccess(userPlan, feature) {
  const plan = (userPlan || 'semillita').toLowerCase();
  if (plan === PLANS.AGROPRO) return true;
  
  if (plan === PLANS.MAIZINGO) {
    return [
      FEATURES.ASSISTANT_AI,
      FEATURES.VOICE_CHAT,
      FEATURES.ADVANCED_REPORT,
      FEATURES.FULL_HISTORY
    ].includes(feature);
  }
  
  if (plan === PLANS.CEBOLLITA) {
    return [
      FEATURES.ASSISTANT_AI,
      FEATURES.FULL_HISTORY
    ].includes(feature);
  }

  // Semillita (Gratis) no tiene features especiales
  return false;
}

// Middleware de verificación de plan
function checkFeature(feature) {
  return (req, res, next) => {
    const currentPlan = db.data.subscription.plan;
    if (canAccess(currentPlan, feature)) {
      next();
    } else {
      res.status(403).json({ error: `Función exclusiva. Tu plan actual (${currentPlan}) no tiene acceso a '${feature}'.` });
    }
  };
}

// ==========================================
// 6. ENDPOINTS DE API (SaaS SERVICES)
// ==========================================

// Endpoint: Obtener lista de planes
app.get('/api/plans', (req, res) => {
  const plans = [
    {
      id: PLANS.SEMILLITA,
      name: "Plan Semillita",
      price: "Gratis",
      period: "Siempre",
      features: {
        [FEATURES.ASSISTANT_AI]: false,
        [FEATURES.VOICE_CHAT]: false,
        [FEATURES.ADVANCED_REPORT]: false,
        [FEATURES.WORD_EXPORT]: false,
        [FEATURES.EXCEL_EXPORT]: false,
        [FEATURES.WATER_TRACKING]: false,
        [FEATURES.FULL_HISTORY]: false,
        [FEATURES.BUSINESS_DASHBOARD]: false
      },
      description: "Acceso básico para pequeños productores."
    },
    {
      id: PLANS.CEBOLLITA,
      name: "Plan Cebollita",
      price: "Bs. 70",
      period: "Mes",
      features: {
        [FEATURES.ASSISTANT_AI]: true,
        [FEATURES.VOICE_CHAT]: false,
        [FEATURES.ADVANCED_REPORT]: false,
        [FEATURES.WORD_EXPORT]: false,
        [FEATURES.EXCEL_EXPORT]: false,
        [FEATURES.WATER_TRACKING]: false,
        [FEATURES.FULL_HISTORY]: true,
        [FEATURES.BUSINESS_DASHBOARD]: false
      },
      description: "Ideal para productores que buscan asesoramiento IA."
    },
    {
      id: PLANS.MAIZINGO,
      name: "Plan Maizingo",
      price: "Bs. 560",
      period: "Año",
      discount: "20% Ahorro",
      features: {
        [FEATURES.ASSISTANT_AI]: true,
        [FEATURES.VOICE_CHAT]: true,
        [FEATURES.ADVANCED_REPORT]: true,
        [FEATURES.WORD_EXPORT]: false,
        [FEATURES.EXCEL_EXPORT]: false,
        [FEATURES.WATER_TRACKING]: false,
        [FEATURES.FULL_HISTORY]: true,
        [FEATURES.BUSINESS_DASHBOARD]: false
      },
      description: "Completo con chat de voz para toda la campaña."
    },
    {
      id: PLANS.AGROPRO,
      name: "Plan AgroPro",
      price: "Bs. 1200",
      period: "Año",
      features: {
        [FEATURES.ASSISTANT_AI]: true,
        [FEATURES.VOICE_CHAT]: true,
        [FEATURES.ADVANCED_REPORT]: true,
        [FEATURES.WORD_EXPORT]: true,
        [FEATURES.EXCEL_EXPORT]: true,
        [FEATURES.WATER_TRACKING]: true,
        [FEATURES.FULL_HISTORY]: true,
        [FEATURES.BUSINESS_DASHBOARD]: true
      },
      description: "Control de agua empresarial y exportación profesional."
    }
  ];
  res.json(plans);
});

// Endpoint: Obtener/actualizar plan actual
app.get('/api/subscription/current', (req, res) => {
  res.json(db.data.subscription);
});

app.post('/api/subscription/current', (req, res) => {
  const { plan } = req.body;
  if (Object.values(PLANS).includes(plan)) {
    db.data.subscription.plan = plan;
    db.save();
    res.json(db.data.subscription);
  } else {
    res.status(400).json({ error: "Nombre de plan inválido." });
  }
});

// Endpoint: Catálogo de cultivos
app.get('/api/crops', (req, res) => {
  res.json(CROP_CATALOG);
});

// Endpoint: Catálogo de municipios
app.get('/api/municipalities', (req, res) => {
  res.json(MUNICIPALITIES_CATALOG);
});

// Endpoint: Configuración de Clima y Gemini
app.get('/api/weather/providers', (req, res) => {
  res.json({
    activeProvider: db.data.config.weatherProvider,
    providers: [
      { id: 'mock', name: 'Servicio Climatológico Local (GOTAIA)' },
      { id: 'weatherapi', name: 'WeatherAPI.com' },
      { id: 'openweather', name: 'OpenWeatherMap.org' },
      { id: 'visualcrossing', name: 'Visual Crossing' }
    ]
  });
});

app.post('/api/weather/providers', (req, res) => {
  const { activeProvider, weatherApiKey, geminiApiKey } = req.body;
  
  if (activeProvider) db.data.config.weatherProvider = activeProvider;
  if (weatherApiKey !== undefined) db.data.config.weatherApiKey = weatherApiKey;
  if (geminiApiKey !== undefined) db.data.config.geminiApiKey = geminiApiKey;
  
  db.save();
  res.json({ success: true });
});

// Endpoint: Climatología en tiempo real
app.get('/api/weather', async (req, res) => {
  const { municipio } = req.query;
  const provider = db.data.config.weatherProvider;
  const apiKey = db.data.config.weatherApiKey;
  
  const weather = await WeatherService.fetchWeather(municipio, provider, apiKey);
  res.json(weather);
});

// ==========================================
// 7. MOTOR IA INTEGRADO (Gemini API / Mock)
// ==========================================
const SYSTEM_PROMPT = `Actúa como un Asistente Técnico Agrícola experto en agronomía boliviana, especializado en riego de precisión, cultivos, tipos de suelo y condiciones climáticas del departamento de Santa Cruz y otras regiones de Bolivia.
Ayuda a responder preguntas técnicas sobre agricultura, humedad del suelo, evapotranspiración, balance hídrico, recomendaciones de riego y frecuencia de riego.
Sé claro, directo, profesional y estructurado en tus respuestas. Utiliza unidades métricas estándar en Bolivia (grados Celsius, litros, hectáreas, milímetros de precipitación).
Mantén un tono de apoyo para los productores.`;

async function getAICognition(prompt, type = 'text') {
  const apiKey = db.data.config.geminiApiKey || process.env.GEMINI_API_KEY;
  const chatsHistory = db.data.chats.slice(-10); // last 10 messages for memory

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const contents = [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT }]
        },
        {
          role: 'model',
          parts: [{ text: "Entendido. Asistiré técnicamente a los agricultores de Bolivia con precisión y objetividad." }]
        }
      ];

      chatsHistory.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });

      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      if (!response.ok) {
        throw new Error(`Gemini error status ${response.status}`);
      }

      const json = await response.json();
      return json.candidates[0].content.parts[0].text;

    } catch (e) {
      console.warn("⚠️ [Gemini API error] Usando generador mock local de IA. Razón:", e.message);
    }
  }

  // Fallback Mock Inteligente en Español
  const lower = prompt.toLowerCase();
  let reply = "Como recomendador agrícola de GOTAIA, te aconsejo ";

  if (lower.includes('soya') || lower.includes('soja')) {
    reply += "para el cultivo de soya mantener una humedad de suelo superior al 50% en el llenado de vainas (R5-R6). Evita riegos excesivos si las temperaturas son templadas para prevenir hongos radiculares como Fitóftora.";
  } else if (lower.includes('maiz') || lower.includes('maíz')) {
    reply += "para el maíz priorizar el riego en la etapa de floración y polinización (R1), ya que el déficit en esta fase puede reducir el rendimiento hasta un 40%. Prefiere riegos profundos y espaciados en suelos francos.";
  } else if (lower.includes('arroz')) {
    reply += "monitorear de cerca el arroz, ya que al ser muy sensible a la sequía en la etapa de floración, requiere un aporte volumétrico elevado (12,000 L/Ha base). Si el suelo es arcilloso, aprovecha su capacidad de retención para distanciar los turnos.";
  } else if (lower.includes('humedad') || lower.includes('suelo')) {
    reply += "que evalúes la textura del suelo. Suelos arenosos tienen baja retención y requieren riegos cortos pero continuos, mientras que los arcillosos retienen más humedad y son propensos al encharcamiento si se riega en exceso.";
  } else if (lower.includes('clima') || lower.includes('calor') || lower.includes('lluvia')) {
    reply += "revisar la previsión climática. Si la sensación térmica supera los 32°C y hay fuertes vientos, la tasa de evapotranspiración sube drásticamente. Planifica riegos nocturnos o de madrugada para mitigar pérdidas por evaporación.";
  } else {
    reply += "monitorear el balance de agua de tus predios. Recuerda programar tus turnos de riego en base al índice de estrés hídrico de GOTAIA, combinando la fenología del cultivo, tipo de suelo y lluvias registradas por la estación climática de tu municipio.";
  }

  return reply;
}

// Endpoint: Chat IA con memoria
app.post('/api/assistant/chat', checkFeature(FEATURES.ASSISTANT_AI), async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío." });

  // Guardar mensaje de usuario
  db.data.chats.push({
    role: 'user',
    text: message,
    timestamp: new Date().toISOString()
  });

  const reply = await getAICognition(message, 'text');

  // Guardar respuesta de IA
  db.data.chats.push({
    role: 'assistant',
    text: reply,
    timestamp: new Date().toISOString(),
    type: 'text'
  });
  
  db.save();
  res.json({ reply });
});

// Endpoint: Voz a Voz
app.post('/api/assistant/voice', checkFeature(FEATURES.VOICE_CHAT), async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje vacío." });

  // Guardar
  db.data.chats.push({
    role: 'user',
    text: message,
    timestamp: new Date().toISOString()
  });

  // Prompt orientado a voz (más corto y conversacional)
  const voicePrompt = `${message} (Responde en español de forma extremadamente concisa y directa, como si fuera una conversación telefónica de campo, máximo 2 frases cortas)`;
  const reply = await getAICognition(voicePrompt, 'voice');

  db.data.chats.push({
    role: 'assistant',
    text: reply,
    timestamp: new Date().toISOString(),
    type: 'voice'
  });

  db.save();
  res.json({ reply });
});

// Endpoint: Obtener historial chats
app.get('/api/assistant/history', checkFeature(FEATURES.FULL_HISTORY), (req, res) => {
  res.json(db.data.chats);
});

// Endpoint: Reiniciar memoria chats
app.post('/api/assistant/memory', checkFeature(FEATURES.ASSISTANT_AI), (req, res) => {
  db.data.chats = [];
  db.save();
  res.json({ success: true });
});

// ==========================================
// 8. ALGORITMO AGRÓNOMO Y GENERADOR DE REPORTES
// ==========================================

// Endpoint: Generar reporte técnico
app.post('/api/irrigation/report', async (req, res) => {
  const {
    municipio,
    cropType,
    hectares,
    soilType,
    cropStage,
    soilHumidity,
    daysSinceLastIrrigation,
    waterAssigned,
    pumpingHours
  } = req.body;

  // Validación
  if (!municipio || !cropType || isNaN(hectares) || !soilType || !cropStage || isNaN(soilHumidity) || isNaN(daysSinceLastIrrigation)) {
    return res.status(400).json({ error: "Faltan variables técnicas fundamentales." });
  }

  // Obtener clima
  const provider = db.data.config.weatherProvider;
  const apiKey = db.data.config.weatherApiKey;
  const weather = await WeatherService.fetchWeather(municipio, provider, apiKey);

  // --- Algoritmo de Índice de Riesgo Hídrico (0-100) ---
  // 1. Temperatura (20%)
  let scoreTemp = 20;
  if (weather.temp >= 35) scoreTemp = 100;
  else if (weather.temp >= 30) scoreTemp = 80;
  else if (weather.temp >= 25) scoreTemp = 50;

  // 2. Lluvia / Precipitación (20%)
  let scoreRain = 100;
  if (weather.rain >= 15) scoreRain = 10;
  else if (weather.rain >= 5) scoreRain = 40;
  else if (weather.rain > 0) scoreRain = 75;

  // 3. Días sin riego (15%)
  let scoreDays = 10;
  if (daysSinceLastIrrigation >= 7) scoreDays = 100;
  else if (daysSinceLastIrrigation >= 4) scoreDays = 75;
  else if (daysSinceLastIrrigation >= 2) scoreDays = 40;

  // 4. Tipo de cultivo y sensibilidad (15%)
  const cropData = CROP_CATALOG[cropType] || { baseConsumption: 5000, sensitivity: "Media" };
  let scoreCrop = 50;
  if (cropData.sensitivity === "Muy Alta") scoreCrop = 100;
  else if (cropData.sensitivity === "Alta") scoreCrop = 85;
  else if (cropData.sensitivity === "Media") scoreCrop = 60;
  else scoreCrop = 30;

  // 5. Humedad de suelo (10%)
  let scoreSoilHum = 100 - soilHumidity;

  // 6. Textura de Suelo y drenaje (10%)
  let scoreSoilType = 50;
  if (soilType === 'arenoso') scoreSoilType = 100; // drena muy rápido
  else if (soilType === 'franco') scoreSoilType = 55;  // óptimo
  else if (soilType === 'arcilloso') scoreSoilType = 25; // retiene mucho

  // 7. Etapa fenológica del cultivo (10%)
  let scoreStage = 50;
  if (cropStage === 'floracion_fructificacion') scoreStage = 100; // etapa crítica
  else if (cropStage === 'germinacion_emergencia') scoreStage = 70;
  else if (cropStage === 'desarrollo_vegetativo') scoreStage = 50;
  else scoreStage = 20;

  // Suma Ponderada
  const finalIndex = Math.round(
    (scoreTemp * 0.20) +
    (scoreRain * 0.20) +
    (scoreDays * 0.15) +
    (scoreCrop * 0.15) +
    (scoreSoilHum * 0.10) +
    (scoreSoilType * 0.10) +
    (scoreStage * 0.10)
  );

  // Niveles y Recomendaciones
  let level = 'Medio';
  let actionText = '';
  if (finalIndex <= 35) {
    level = 'Bajo';
    actionText = 'Humedad suficiente. Mantener monitoreo regular del clima antes de programar el próximo turno.';
  } else if (finalIndex <= 70) {
    level = 'Medio';
    actionText = 'Estrés hídrico moderado detectado. Programar riego complementario ligero en las próximas 48 horas.';
  } else {
    level = 'Alto';
    actionText = 'Riesgo crítico de déficit hídrico. Programar riego urgente e inmediato para mitigar daños permanentes.';
  }

  // --- Recomendación volumétrica de agua (Litros recomendados) ---
  const stageCoeffs = {
    germinacion_emergencia: 1.0,
    desarrollo_vegetativo: 1.2,
    floracion_fructificacion: 1.5,
    maduracion_cosecha: 0.6
  };
  const sc = stageCoeffs[cropStage] || 1.0;
  const tempMult = weather.temp > 30 ? 1.25 : 1.0;
  const soilMult = soilType === 'arenoso' ? 1.15 : (soilType === 'arcilloso' ? 0.85 : 1.0);
  const humFactor = Math.max(0.1, 1 - (soilHumidity / 100));

  const waterRecommended = Math.round(
    cropData.baseConsumption * hectares * sc * tempMult * soilMult * humFactor
  );

  // --- Generar Observación de IA (Solo si plan tiene IA) ---
  let aiObservation = "Asistente Técnico IA no disponible en tu plan.";
  const currentPlan = db.data.subscription.plan;
  if (canAccess(currentPlan, FEATURES.ASSISTANT_AI)) {
    const aiPrompt = `El productor tiene un predio de ${hectares} hectáreas de ${cropData.name} en el municipio de ${MUNICIPALITIES_CATALOG[municipio]?.name || municipio}.
La etapa fenológica es ${cropStage.replace('_', ' ')} y el tipo de suelo es ${soilType} con una humedad de suelo declarada del ${soilHumidity}%.
El clima actual es de ${weather.temp}°C, humedad ambiental ${weather.humidity}%, con condición de ${weather.condition}.
El índice de estrés hídrico calculado es del ${finalIndex}% (${level}).
El agua asignada por el usuario es de ${waterAssigned} litros y la recomendada es de ${waterRecommended} litros.
Redacta una recomendación técnica agronómica corta y directa para el agricultor en base a estos datos específicos (máximo 3 líneas en español).`;

    aiObservation = await getAICognition(aiPrompt, 'text');
  }

  // Crear reporte
  const newReport = {
    id: 'rep_' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString(),
    municipio,
    cropType,
    hectares,
    soilType,
    cropStage,
    soilHumidity,
    daysSinceLastIrrigation,
    waterAssigned,
    pumpingHours,
    weather,
    finalIndex,
    level,
    actionText,
    waterRecommended,
    aiObservation
  };

  // Guardar en base de datos si corresponde
  if (canAccess(currentPlan, FEATURES.FULL_HISTORY)) {
    db.data.reports.unshift(newReport);
    db.save();
  }

  res.json(newReport);
});

// Endpoint: Obtener historial de informes
app.get('/api/reports/history', checkFeature(FEATURES.FULL_HISTORY), (req, res) => {
  res.json(db.data.reports);
});

// ==========================================
// 9. MÓDULO DE AGUA Y MONITOREO (AgroPro)
// ==========================================
app.get('/api/irrigation/water-tracking', checkFeature(FEATURES.WATER_TRACKING), (req, res) => {
  res.json(db.data.waterLogs);
});

app.post('/api/irrigation/water-tracking', checkFeature(FEATURES.WATER_TRACKING), (req, res) => {
  const {
    municipio,
    cropType,
    surfaceArea,
    cropStage,
    waterAvailable,
    waterUsed
  } = req.body;

  if (!municipio || !cropType || isNaN(surfaceArea) || isNaN(waterAvailable) || isNaN(waterUsed)) {
    return res.status(400).json({ error: "Datos del control de agua incompletos." });
  }

  const newLog = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString(),
    municipio,
    cropType,
    surfaceArea,
    cropStage,
    waterAvailable,
    waterUsed
  };

  db.data.waterLogs.unshift(newLog);
  db.save();
  
  res.json(newLog);
});

// ==========================================
// 10. SERVICIO DE EXPORTACIÓN (Word & Excel)
// ==========================================

// Exportación a Word (.doc compatible con MS Word)
app.post('/api/reports/export/word', checkFeature(FEATURES.WORD_EXPORT), (req, res) => {
  const report = req.body;
  if (!report) return res.status(400).json({ error: "Datos del reporte inválidos." });

  const cropName = CROP_CATALOG[report.cropType]?.name || report.cropType;
  const muniName = MUNICIPALITIES_CATALOG[report.municipio]?.name || report.municipio;
  const dateStr = new Date(report.date).toLocaleString('es-BO');

  const wordHTML = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <title>Informe Agrícola Técnico GOTAIA</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; }
      .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
      .logo { font-size: 24px; font-weight: bold; color: #10b981; }
      .title { font-size: 20px; margin-top: 5px; color: #1e293b; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 14px; font-weight: bold; color: #10b981; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 10px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
      th { background-color: #f8fafc; text-align: left; font-weight: bold; }
      .badge { display: inline-block; padding: 4px 8px; font-weight: bold; border-radius: 4px; font-size: 11px; }
      .badge-alto { background-color: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
      .badge-medio { background-color: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
      .badge-bajo { background-color: #ecfdf5; color: #10b981; border: 1px solid #d1fae5; }
      .alert { padding: 10px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-top: 10px; text-align: center; }
      .alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
      .alert-warning { background-color: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
      .alert-danger { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">GOTAIA 2.0</div>
      <div class="title">INFORME TÉCNICO DE RIEGO INTELIGENTE</div>
      <div style="font-size: 10px; color: #64748b;">Generado automáticamente el ${dateStr}</div>
    </div>

    <div class="section">
      <div class="section-title">Resumen de Diagnóstico</div>
      <table>
        <tr>
          <th>ID Reporte</th>
          <td>${report.id}</td>
          <th>Fecha Consulta</th>
          <td>${dateStr}</td>
        </tr>
        <tr>
          <th>Cultivo</th>
          <td>${cropName}</td>
          <th>Municipio</th>
          <td>${muniName}</td>
        </tr>
        <tr>
          <th>Superficie Cultivada</th>
          <td>${report.hectares} Hectáreas</td>
          <th>Índice de Riesgo Hídrico</th>
          <td><strong>${report.finalIndex} / 100</strong></td>
        </tr>
        <tr>
          <th>Nivel de Riesgo</th>
          <td>
            <span class="badge badge-${report.level.toLowerCase()}">RIESGO ${report.level.toUpperCase()}</span>
          </td>
          <th>Frecuencia Riego Sugerida</th>
          <td>${report.level === 'Alto' ? 'Diario' : (report.level === 'Medio' ? 'Cada 2-3 días' : 'Mantener monitoreo')}</td>
        </tr>
      </table>
      <div style="font-style: italic; font-weight: 500; font-size: 12px; margin-top: 5px;">
        Recomendación Operativa: "${report.actionText}"
      </div>
    </div>

    <div class="section">
      <div class="section-title">Condiciones Técnicas de Campo</div>
      <table>
        <tr>
          <th>Temperatura Actual</th>
          <td>${report.weather.temp}°C</td>
          <th>Humedad Ambiental</th>
          <td>${report.weather.humidity}% HR</td>
        </tr>
        <tr>
          <th>Precipitación Registrada</th>
          <td>${report.weather.rain} mm</td>
          <th>Velocidad del Viento</th>
          <td>${report.weather.wind} km/h</td>
        </tr>
        <tr>
          <th>Humedad del Suelo (Declarada)</th>
          <td>${report.soilHumidity}%</td>
          <th>Días transcurridos sin riego</th>
          <td>${report.daysSinceLastIrrigation} días</td>
        </tr>
        <tr>
          <th>Textura de Suelo</th>
          <td>${report.soilType.toUpperCase()}</td>
          <th>Etapa de Desarrollo Cultivo</th>
          <td>${report.cropStage.replace('_', ' ').toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Balance y Demanda Hídrica Proyectada</div>
      <table>
        <tr>
          <th>Agua Disponible Asignada</th>
          <td>${report.waterAssigned.toLocaleString()} Litros</td>
        </tr>
        <tr>
          <th>Agua Recomendada por GOTAIA</th>
          <td>${report.waterRecommended.toLocaleString()} Litros</td>
        </tr>
        <tr>
          <th>Diferencia / Balance Volumétrico</th>
          <td style="font-weight: bold; color: ${report.waterAssigned - report.waterRecommended >= 0 ? '#10b981' : '#ef4444'};">
            ${report.waterAssigned - report.waterRecommended >= 0 ? '+' : ''}${(report.waterAssigned - report.waterRecommended).toLocaleString()} Litros
          </td>
        </tr>
      </table>

      ${report.waterAssigned - report.waterRecommended >= 0
        ? `<div class="alert alert-success">El agua asignada por el productor es suficiente para la demanda del cultivo en esta fase.</div>`
        : `<div class="alert alert-danger">⚠️ ALERTA DE DÉFICIT: El volumen asignado es insuficiente para cubrir la evapotranspiración y necesidad hídrica del predio. Se recomienda aumentar el bombeo.</div>`
      }
    </div>

    <div class="section" style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
      <div class="section-title">Observación Científica del Asistente IA</div>
      <p style="font-style: italic; font-size: 11px; color: #1e293b; margin: 0;">
        "${report.aiObservation}"
      </p>
    </div>

    <div style="margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center;">
      © GOTAIA SaaS 2.0 &bull; Plataforma Ejecutable Local &bull; Hackathon Build With AI 2026
    </div>
  </body>
  </html>
  `;

  res.setHeader('Content-Type', 'application/msword');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte_gotaia.doc');
  res.send(wordHTML);
});

// Exportación a Excel (.csv con formato TSV y UTF-8 BOM para soporte óptimo en Excel Windows)
app.post('/api/reports/export/excel', checkFeature(FEATURES.EXCEL_EXPORT), (req, res) => {
  const report = req.body;
  if (!report) return res.status(400).json({ error: "Datos del reporte inválidos." });

  const cropName = CROP_CATALOG[report.cropType]?.name || report.cropType;
  const muniName = MUNICIPALITIES_CATALOG[report.municipio]?.name || report.municipio;
  const dateStr = new Date(report.date).toLocaleString('es-BO');

  // Cabeceras y filas delimitadas por tabulador
  const headers = ["Propiedad", "Valor Técnico"];
  const rows = [
    ["ID Reporte", report.id],
    ["Fecha Consulta", dateStr],
    ["Municipio", muniName],
    ["Cultivo", cropName],
    ["Hectareas", report.hectares],
    ["Textura de Suelo", report.soilType],
    ["Etapa de Desarrollo", report.cropStage],
    ["Dias sin Riego", report.daysSinceLastIrrigation],
    ["Humedad Suelo (%)", report.soilHumidity],
    ["Temperatura Clima (C)", report.weather.temp],
    ["Humedad Ambiental (%)", report.weather.humidity],
    ["Precipitacion (mm)", report.weather.rain],
    ["Velocidad del Viento (km/h)", report.weather.wind],
    ["Indice GOTAIA (%)", report.finalIndex],
    ["Nivel de Riesgo", report.level],
    ["Agua Recomendada (L)", report.waterRecommended],
    ["Agua Asignada (L)", report.waterAssigned],
    ["Diferencia Balance (L)", report.waterAssigned - report.waterRecommended],
    ["Recomendacion Operativa", report.actionText],
    ["Observacion IA", report.aiObservation.replace(/\r?\n|\r/g, " ")]
  ];

  let tsvContent = "\uFEFF"; // UTF-8 BOM
  tsvContent += headers.join("\t") + "\n";
  rows.forEach(row => {
    tsvContent += row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join("\t") + "\n";
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte_gotaia.csv');
  res.send(tsvContent);
});

// Fallback del servidor al index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 11. INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('🌧️  GOTAIA SaaS 2.0 - SISTEMA AGROPECUARIO TÉCNICO INICIADO');
  console.log('======================================================');
  console.log(`✓ Servidor Express ejecutándose en: http://localhost:${PORT}`);
  console.log('✓ Modulo de suscripciones (Gratis, Plus y Enterprise) activo.');
  console.log('✓ Climatología multi-proveedor configurada con fallback local.');
  console.log('✓ Asistente de IA listo con memoria y respuestas de agronomía.');
  console.log('✓ Exportadores a Office (Word y Excel) operativos.');
  console.log('======================================================\n');
});