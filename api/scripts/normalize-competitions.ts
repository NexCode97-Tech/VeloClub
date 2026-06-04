/**
 * Script de migración: normaliza nombres y ubicaciones de competencias existentes.
 * Ejecutar UNA sola vez: npx ts-node scripts/normalize-competitions.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Cargar .env manualmente
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const PLACE_FIX: Record<string, string> = {
  'BOGOTA': 'Bogotá', 'BOGOTÁ': 'Bogotá',
  'MEDELLIN': 'Medellín', 'MEDELLÍN': 'Medellín',
  'CALI': 'Cali',
  'BARRANQUILLA': 'Barranquilla',
  'BUCARAMANGA': 'Bucaramanga',
  'CARTAGENA': 'Cartagena',
  'MANIZALES': 'Manizales',
  'PEREIRA': 'Pereira',
  'CUCUTA': 'Cúcuta', 'CÚCUTA': 'Cúcuta',
  'IBAGUE': 'Ibagué', 'IBAGUÉ': 'Ibagué',
  'SANTA MARTA': 'Santa Marta',
  'VILLAVICENCIO': 'Villavicencio',
  'PASTO': 'Pasto',
  'MONTERIA': 'Montería', 'MONTERÍA': 'Montería',
  'NEIVA': 'Neiva',
  'ARMENIA': 'Armenia',
  'POPAYAN': 'Popayán', 'POPAYÁN': 'Popayán',
  'TUNJA': 'Tunja',
  'SINCELEJO': 'Sincelejo',
  'VALLEDUPAR': 'Valledupar',
  'RIOHACHA': 'Riohacha',
  'QUIBDO': 'Quibdó', 'QUIBDÓ': 'Quibdó',
};

function normalizeName(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function normalizePlace(str: string): string {
  const upper = str.toUpperCase().trim();
  if (PLACE_FIX[upper]) return PLACE_FIX[upper];
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function main() {
  const competitions = await prisma.competition.findMany();
  console.log(`Encontradas ${competitions.length} competencias...`);

  let updated = 0;
  for (const c of competitions) {
    const newName  = normalizeName(c.name);
    const newPlace = c.place ? normalizePlace(c.place) : null;

    if (newName !== c.name || newPlace !== c.place) {
      await prisma.competition.update({
        where: { id: c.id },
        data: { name: newName, ...(newPlace !== null ? { place: newPlace } : {}) },
      });
      console.log(`  ✓ "${c.name}" → "${newName}"${c.place ? ` | "${c.place}" → "${newPlace}"` : ''}`);
      updated++;
    }
  }

  console.log(`\nListo: ${updated} competencia(s) actualizadas.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
