const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_yNdtpC2DsZj4@ep-noisy-cake-akru0inj.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

function normName(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
const PLACE_FIX = {
  'BOGOTA':'Bogota','MEDELLIN':'Medellin','CALI':'Cali',
  'BARRANQUILLA':'Barranquilla','BUCARAMANGA':'Bucaramanga',
  'CARTAGENA':'Cartagena','MANIZALES':'Manizales','PEREIRA':'Pereira',
  'CUCUTA':'Cucuta','IBAGUE':'Ibague','SANTA MARTA':'Santa Marta',
  'VILLAVICENCIO':'Villavicencio','PASTO':'Pasto','NEIVA':'Neiva',
  'ARMENIA':'Armenia','TUNJA':'Tunja',
};
function normPlace(s) {
  if (!s) return s;
  const up = s.toUpperCase().trim();
  if (PLACE_FIX[up]) return PLACE_FIX[up];
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function main() {
  await client.connect();
  const { rows } = await client.query('SELECT id, name, place FROM "Competition"');
  console.log(rows.length + ' competencias encontradas');
  let count = 0;
  for (const r of rows) {
    const newName = normName(r.name);
    const newPlace = normPlace(r.place);
    if (newName !== r.name || newPlace !== r.place) {
      await client.query('UPDATE "Competition" SET name=$1, place=$2 WHERE id=$3', [newName, newPlace || null, r.id]);
      console.log('  OK "' + r.name + '" -> "' + newName + '"' + (r.place ? ' | "' + r.place + '" -> "' + newPlace + '"' : ''));
      count++;
    }
  }
  console.log('\nActualizadas: ' + count);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
